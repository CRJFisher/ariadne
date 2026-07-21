import type {
  SymbolId,
  SymbolName,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, ok } from "@ariadnejs/types";
import { DefinitionRegistry } from "../registries/definition";
import { resolve_namespace_export, resolve_named_import } from "../export_chain_lookup";
import type { ReceiverResolutionContext } from "./receiver_resolution";

/**
 * Look up a method on a resolved receiver type, dispatching on receiver kind
 * (namespace/named/default import, object-literal collection, class, interface).
 *
 * On failure the `ResolutionFailure` names the sub-stage and reason so
 * downstream classifiers can distinguish failure modes without re-resolving.
 */
export function resolve_method_on_type(
  receiver_type: SymbolId,
  method_name: SymbolName,
  context: ReceiverResolutionContext
): Result<SymbolId[], ResolutionFailure> {
  const { definitions, types } = context;

  const receiver_def = definitions.get(receiver_type);

  if (receiver_def?.kind === "import" && receiver_def.import_kind === "namespace") {
    const source_file = context.imports.get_resolved_import_path(receiver_type);
    if (!source_file) {
      return err({
        stage: "import_resolution",
        reason: "import_unresolved",
        partial_info: { resolved_receiver_type: receiver_type },
      });
    }
    const sym = resolve_namespace_export(
      source_file,
      method_name,
      context.exports,
      context.languages,
      context.root_folder
    );
    if (!sym) {
      return err({
        stage: "method_lookup",
        reason: "method_not_on_type",
        partial_info: {
          resolved_receiver_type: receiver_type,
          import_target_file: source_file,
        },
      });
    }
    return ok([sym]);
  }

  // A named/default import is a stand-in for the class it points at; follow it
  // to the terminal definition and resolve the method there.
  if (receiver_def?.kind === "import" && (receiver_def.import_kind === "named" || receiver_def.import_kind === "default")) {
    const source_file = context.imports.get_resolved_import_path(receiver_type);
    if (source_file) {
      const export_name = receiver_def.original_name || receiver_def.name;
      const actual_type = resolve_named_import(
        source_file,
        export_name,
        definitions
      );
      if (actual_type) {
        return resolve_method_on_type(actual_type, method_name, context);
      }
    }
    // A named import may point at a submodule file rather than an export
    // (e.g. `from training import pipeline` where pipeline is a .py file).
    const submodule_path = context.imports.get_submodule_import_path(receiver_type);
    if (submodule_path) {
      const sym = resolve_namespace_export(
        submodule_path,
        method_name,
        context.exports,
        context.languages,
        context.root_folder
      );
      if (!sym) {
        return err({
          stage: "method_lookup",
          reason: "method_not_on_type",
          partial_info: {
            resolved_receiver_type: receiver_type,
            import_target_file: submodule_path,
          },
        });
      }
      return ok([sym]);
    }
    if (source_file) {
      // Source file resolved but neither a matching export nor a submodule was
      // found: the re-export chain terminated with no definition.
      return err({
        stage: "import_resolution",
        reason: "reexport_chain_unresolved",
        partial_info: {
          resolved_receiver_type: receiver_type,
          import_target_file: source_file,
        },
      });
    }
    return err({
      stage: "import_resolution",
      reason: "import_unresolved",
      partial_info: { resolved_receiver_type: receiver_type },
    });
  }

  const fn_collection = definitions.get_function_collection(receiver_type);
  if (fn_collection) {
    return resolve_collection_method(receiver_type, method_name, definitions, context);
  }

  let method_symbol = types.get_type_member(receiver_type, method_name);

  // The TypeRegistry only holds members it could resolve types for; fall back
  // to the raw member index for members it never typed.
  if (!method_symbol) {
    const member_index = definitions.get_member_index();
    const type_members = member_index.get(receiver_type);
    if (type_members) {
      method_symbol = type_members.get(method_name) || null;
    }
  }

  if (!method_symbol) {
    return err({
      stage: "method_lookup",
      reason: "method_not_on_type",
      partial_info: { resolved_receiver_type: receiver_type },
    });
  }

  // A constructor keyed into the member index (self.__init__(),
  // super().__init__()) targets exactly one concrete constructor. Skip the
  // class-polymorphic expansion below so it does not fan a single constructor
  // call out to every subclass's constructor.
  if (definitions.get(method_symbol)?.kind === "constructor") {
    return ok([method_symbol]);
  }

  if (receiver_def?.kind === "interface") {
    const impls = resolve_polymorphic_method(receiver_type, method_name, definitions);
    if (impls.length === 0) {
      return err({
        stage: "method_lookup",
        reason: "polymorphic_no_implementations",
        partial_info: { resolved_receiver_type: receiver_type },
      });
    }
    return ok(impls);
  }

  // Fan a class call out to every subtype override so all possible runtime
  // targets are connected in the call graph, which entry-point detection needs.
  if (receiver_def?.kind === "class") {
    return ok(
      resolve_polymorphic_class_method(
        receiver_type,
        method_name,
        method_symbol,
        definitions
      )
    );
  }

  return ok([method_symbol]);
}

/**
 * Resolve an interface method call to every implementing class's version,
 * across transitive inheritance: if A implements I and B extends A, a call
 * to I.method() resolves to both A.method() and B.method() (where overridden).
 *
 * Interfaces are abstract, so only implementations are returned — there is no
 * base method to include.
 */
function resolve_polymorphic_method(
  interface_type_id: SymbolId,
  method_name: SymbolName,
  definitions: DefinitionRegistry
): SymbolId[] {
  const all_subtypes = get_transitive_subtypes(interface_type_id, definitions);

  if (all_subtypes.size === 0) {
    return [];
  }

  const implementations: SymbolId[] = [];
  const member_index = definitions.get_member_index();

  for (const subtype_id of all_subtypes) {
    const subtype_members = member_index.get(subtype_id);
    if (!subtype_members) {
      continue;
    }

    const impl_method_id = subtype_members.get(method_name);
    if (impl_method_id) {
      implementations.push(impl_method_id);
    }
  }

  return implementations;
}

/**
 * Resolve a class method call to the base method plus every subtype override.
 *
 * Unlike an interface (abstract, so only implementations count), a class
 * method may be called directly, so the base is always included alongside the
 * overrides. Returning all runtime targets keeps entry-point detection accurate.
 */
function resolve_polymorphic_class_method(
  class_id: SymbolId,
  method_name: SymbolName,
  base_method_id: SymbolId,
  definitions: DefinitionRegistry
): SymbolId[] {
  const results: SymbolId[] = [base_method_id];

  const all_subtypes = get_transitive_subtypes(class_id, definitions);
  if (all_subtypes.size === 0) {
    return results;
  }

  const member_index = definitions.get_member_index();

  for (const subtype_id of all_subtypes) {
    const subtype_members = member_index.get(subtype_id);
    if (!subtype_members) {
      continue;
    }

    const override_method_id = subtype_members.get(method_name);
    if (override_method_id && override_method_id !== base_method_id) {
      results.push(override_method_id);
    }
  }

  return results;
}

/**
 * Collect the full subtree of subtypes below a type. For I with A implements I,
 * B extends A, C extends B, returns {A, B, C}. The root itself is excluded.
 *
 * `processed` guards against cycles in a malformed inheritance graph.
 */
function get_transitive_subtypes(
  type_id: SymbolId,
  definitions: DefinitionRegistry
): Set<SymbolId> {
  const result = new Set<SymbolId>();
  const to_process = [type_id];
  const processed = new Set<SymbolId>();

  while (to_process.length > 0) {
    const current = to_process.pop();
    if (!current || processed.has(current)) {
      continue;
    }
    processed.add(current);

    const direct_subtypes = definitions.get_subtypes(current);
    for (const subtype of direct_subtypes) {
      result.add(subtype);
      to_process.push(subtype);
    }
  }

  return result;
}

/**
 * Resolve a method call on an object literal held in a FunctionCollection, e.g.
 * `const HANDLERS = { process() {} }; HANDLERS.process();` resolves `process`
 * to the stored function.
 */
function resolve_collection_method(
  variable_id: SymbolId,
  method_name: SymbolName,
  definitions: DefinitionRegistry,
  context: ReceiverResolutionContext
): Result<SymbolId[], ResolutionFailure> {
  const fn_collection = definitions.get_function_collection(variable_id);
  if (!fn_collection) {
    return err({
      stage: "method_lookup",
      reason: "collection_dispatch_miss",
      partial_info: { resolved_receiver_type: variable_id },
    });
  }

  // Property-named members carry the sibling looked up by `obj.method()` /
  // `this.method()`: an inline function value, or a value identifier resolved
  // in the collection's defining scope.
  for (const member of fn_collection.named_members ?? []) {
    if (member.name !== method_name) {
      continue;
    }
    if (member.symbol_id) {
      return ok([member.symbol_id]);
    }
    if (member.reference_name) {
      const var_def = definitions.get(variable_id);
      if (var_def) {
        const resolved = context.resolutions.resolve(
          var_def.defining_scope_id,
          member.reference_name
        );
        if (resolved) {
          return ok([resolved]);
        }
      }
    }
    break;
  }

  // stored_functions are inline anonymous definitions keyed by SymbolId; match
  // on each definition's own name.
  for (const stored_fn_id of fn_collection.stored_functions) {
    const fn_def = definitions.get(stored_fn_id);
    if (fn_def && fn_def.name === method_name) {
      return ok([stored_fn_id]);
    }
  }

  // stored_references are names of functions defined elsewhere; resolve them in
  // the scope where the collection variable is declared.
  if (fn_collection.stored_references) {
    for (const ref_name of fn_collection.stored_references) {
      if (ref_name === method_name) {
        const var_def = definitions.get(variable_id);
        if (var_def) {
          const resolved = context.resolutions.resolve(var_def.defining_scope_id, method_name);
          if (resolved) {
            return ok([resolved]);
          }
        }
      }
    }
  }

  return err({
    stage: "method_lookup",
    reason: "collection_dispatch_miss",
    partial_info: { resolved_receiver_type: variable_id },
  });
}

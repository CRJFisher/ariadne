import type {
  SymbolId,
  SymbolName,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, ok } from "@ariadnejs/types";
import { DefinitionRegistry } from "../registries/definition";
import { resolve_module_member } from "../module_member_lookup";
import { resolve_named_member } from "./collection_dispatch";
import type { ReceiverResolutionContext } from "./receiver_resolution";
import { resolve_namespace_scope_member } from "./namespace_member";

/**
 * What a method lookup answered, and whose subtypes the answer was read from.
 *
 * A dispatch through a class or interface enumerates that type's transitive
 * subtypes, so its answer is only as current as the subtype graph was when it
 * ran: an implementer that arrives afterwards changes it without touching the
 * caller's file or anything the caller imports. `subtype_closure_of` names the
 * type so the project can re-resolve the call when that closure changes.
 */
export interface MethodLookup {
  readonly targets: Result<SymbolId[], ResolutionFailure>;
  /** The receiver type whose subtype closure the answer enumerated, or null when it enumerated none. */
  readonly subtype_closure_of: SymbolId | null;
}

/**
 * How the object a call runs on relates to the type the lookup starts at.
 *
 * - `"value"`: the receiver holds an instance of the type or of any subtype, so
 *   a member only a subtype declares can be what runs.
 * - `"super"`: `super` starts the lookup at the parent, and dispatch from there
 *   continues up the inheritance chain — never down to the parent's subtypes,
 *   which include the calling class itself.
 */
export type ReceiverBinding = "value" | "super";

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
  context: ReceiverResolutionContext,
  receiver_binding: ReceiverBinding
): MethodLookup {
  const { definitions, types } = context;

  const receiver_def = definitions.get(receiver_type);

  if (receiver_def?.kind === "import" && receiver_def.import_kind === "namespace") {
    const source_file = context.imports.get_resolved_import_path(receiver_type);
    if (!source_file) {
      return without_subtype_closure(err({
        stage: "import_resolution",
        reason: "import_unresolved",
        partial_info: { resolved_receiver_type: receiver_type },
      }));
    }
    const sym = resolve_module_member(
      source_file,
      method_name,
      "namespace",
      context.exports,
      definitions,
      context.languages,
      context.modules
    );
    if (!sym) {
      return without_subtype_closure(err({
        stage: "method_lookup",
        reason: "method_not_on_type",
        partial_info: {
          resolved_receiver_type: receiver_type,
          import_target_file: source_file,
        },
      }));
    }
    return without_subtype_closure(ok([sym]));
  }

  // A TypeScript `namespace` block holds its members in its own body scope,
  // which neither the type registry nor the member index covers.
  if (receiver_def?.kind === "namespace") {
    const member = resolve_namespace_scope_member(
      receiver_def,
      method_name,
      context
    );
    if (member) {
      return without_subtype_closure(ok([member]));
    }
    return without_subtype_closure(err({
      stage: "method_lookup",
      reason: "method_not_on_type",
      partial_info: { resolved_receiver_type: receiver_type },
    }));
  }

  // A named/default import is a stand-in for the class it points at; follow it
  // to the terminal definition and resolve the method there.
  if (receiver_def?.kind === "import" && (receiver_def.import_kind === "named" || receiver_def.import_kind === "default")) {
    const source_file = context.imports.get_resolved_import_path(receiver_type);
    if (source_file) {
      const export_name = receiver_def.original_name || receiver_def.name;
      const actual_type = resolve_module_member(
        source_file,
        export_name,
        receiver_def.import_kind,
        context.exports,
        definitions,
        context.languages,
        context.modules
      );
      if (actual_type) {
        return resolve_method_on_type(actual_type, method_name, context, receiver_binding);
      }
    }
    // A named import may point at a submodule file rather than an export
    // (e.g. `from training import pipeline` where pipeline is a .py file).
    const submodule_path = context.imports.get_submodule_import_path(receiver_type);
    if (submodule_path) {
      const sym = resolve_module_member(
        submodule_path,
        method_name,
        "namespace",
        context.exports,
        definitions,
        context.languages,
        context.modules
      );
      if (!sym) {
        return without_subtype_closure(err({
          stage: "method_lookup",
          reason: "method_not_on_type",
          partial_info: {
            resolved_receiver_type: receiver_type,
            import_target_file: submodule_path,
          },
        }));
      }
      return without_subtype_closure(ok([sym]));
    }
    if (source_file) {
      // Source file resolved but neither a matching export nor a submodule was
      // found: the re-export chain terminated with no definition.
      return without_subtype_closure(err({
        stage: "import_resolution",
        reason: "reexport_chain_unresolved",
        partial_info: {
          resolved_receiver_type: receiver_type,
          import_target_file: source_file,
        },
      }));
    }
    return without_subtype_closure(err({
      stage: "import_resolution",
      reason: "import_unresolved",
      partial_info: { resolved_receiver_type: receiver_type },
    }));
  }

  const fn_collection = definitions.get_function_collection(receiver_type);
  if (fn_collection) {
    return without_subtype_closure(
      resolve_collection_method(receiver_type, method_name, definitions, context)
    );
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

  const can_have_subtypes =
    receiver_def?.kind === "class" || receiver_def?.kind === "interface";

  if (!method_symbol) {
    // The receiver neither declares nor inherits the member, but a subtype
    // may — an abstract base calling a hook only its subclasses define, a
    // mixin calling what the classes mixing it in provide. Every subtype that
    // declares it is a runtime target, so `method_not_on_type` is left for a
    // member no reachable subtype declares either. A `super` miss names a
    // member the chain above the parent supplies from outside the project
    // (`super().setUp()` under `unittest.TestCase`), which no subtype of the
    // parent answers.
    const fans_out = can_have_subtypes && receiver_binding === "value";
    const implementations = fans_out
      ? resolve_polymorphic_method(receiver_type, method_name, definitions).filter(
          // A constructor runs for exactly one concrete class; a miss never
          // fans a constructor call out to every subclass's constructor.
          (impl_id) => definitions.get(impl_id)?.kind !== "constructor"
        )
      : [];
    const targets: Result<SymbolId[], ResolutionFailure> =
      implementations.length > 0
        ? ok(implementations)
        : err({
            stage: "method_lookup",
            reason: "method_not_on_type",
            partial_info: { resolved_receiver_type: receiver_type },
          });
    return {
      targets,
      subtype_closure_of: fans_out ? receiver_type : null,
    };
  }

  // A constructor keyed into the member index (self.__init__(),
  // super().__init__()) targets exactly one concrete constructor. Skip the
  // class-polymorphic expansion below so it does not fan a single constructor
  // call out to every subclass's constructor.
  if (definitions.get(method_symbol)?.kind === "constructor") {
    return without_subtype_closure(ok([method_symbol]));
  }

  if (receiver_def?.kind === "interface") {
    const impls = resolve_polymorphic_method(receiver_type, method_name, definitions);
    if (impls.length === 0) {
      return {
        targets: err({
          stage: "method_lookup",
          reason: "polymorphic_no_implementations",
          partial_info: { resolved_receiver_type: receiver_type },
        }),
        subtype_closure_of: receiver_type,
      };
    }
    // The interface member the call names leads the list; the implementations
    // that can actually run follow it. A consumer asking who calls
    // `IDisposable.dispose` is asking a real question, so the member keeps its
    // edge, while entry-point detection still reaches every implementation.
    // This adds exactly one attribution per interface dispatch; the
    // implementation fan-out is unchanged.
    return { targets: ok([method_symbol, ...impls]), subtype_closure_of: receiver_type };
  }

  // Fan a class call out to every subtype override so all possible runtime
  // targets are connected in the call graph, which entry-point detection needs.
  // Unlike an interface member, a class method may run itself, so the base
  // leads alongside the overrides.
  if (receiver_def?.kind === "class") {
    const base_method_id = method_symbol;
    const overrides = resolve_polymorphic_method(receiver_type, method_name, definitions).filter(
      (override_id) => override_id !== base_method_id
    );
    return {
      targets: ok([base_method_id, ...overrides]),
      subtype_closure_of: receiver_type,
    };
  }

  return without_subtype_closure(ok([method_symbol]));
}

/** A lookup whose answer did not enumerate any type's subtypes. */
function without_subtype_closure(targets: Result<SymbolId[], ResolutionFailure>): MethodLookup {
  return { targets, subtype_closure_of: null };
}

/**
 * Every declaration of `method_name` on a transitive subtype of `type_id`:
 * if A implements I and B extends A, the subtypes of I declaring `method` give
 * both A.method() and B.method() (where overridden).
 *
 * Shared by every dispatch that reads the subtype closure — an interface
 * receiver's implementations, a class receiver's overrides, and a miss fanned
 * out over the subtypes that declare what the receiver does not. Only subtype
 * declarations are returned; each caller decides what leads them.
 */
function resolve_polymorphic_method(
  type_id: SymbolId,
  method_name: SymbolName,
  definitions: DefinitionRegistry
): SymbolId[] {
  const all_subtypes = get_transitive_subtypes(type_id, definitions);

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
  // `this.method()`: an inline function value, an identifier resolved in the
  // collection's defining scope, or a nested object literal (not itself
  // callable). The last member wins, matching last-write-wins reassignment
  // (`app.m = a; app.m = b;`) and duplicate object keys.
  const var_def = definitions.get(variable_id);
  if (var_def) {
    const resolved = resolve_named_member(
      fn_collection.named_members ?? [],
      method_name,
      var_def.defining_scope_id,
      context.resolutions
    );
    if (resolved) {
      return ok([resolved]);
    }
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
  if (fn_collection.stored_references && var_def) {
    for (const ref_name of fn_collection.stored_references) {
      if (ref_name === method_name) {
        const resolved = context.resolutions.resolve(var_def.defining_scope_id, method_name);
        if (resolved) {
          return ok([resolved]);
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

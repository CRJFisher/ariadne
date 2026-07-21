/**
 * Receiver Resolution Module
 *
 * Resolves receiver expressions to their types for method call resolution.
 * This module unifies the handling of both self-reference calls (this.method())
 * and regular method calls (obj.method()) through a two-phase approach:
 *
 * Phase 1: Resolve the base of the receiver expression
 *   - Self-reference keywords (this, self, super, cls) → containing class type
 *   - Identifiers → resolve in scope, get type
 *
 * Phase 2: Walk the property chain to get the final receiver type
 *   - For each property, look up member on current type
 *   - Get member's type for next iteration
 *
 * This architecture allows natural composition:
 *   - this.method() → resolve this → class type → lookup method
 *   - this.property.method() → resolve this → class type → property type → lookup method
 *   - obj.field.method() → resolve obj → type → field type → lookup method
 */

import type {
  SymbolId,
  SymbolName,
  FilePath,
  ScopeId,
  Language,
  SelfReferenceCall,
  MethodCallReference,
  SelfReferenceKeyword,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, ok } from "@ariadnejs/types";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import type { TypeRegistry } from "../registries/type";
import type { ExportRegistry } from "../registries/export";
import type { ResolutionRegistry } from "../resolution_registry";
import type { ImportGraph } from "../import_resolution/import_graph";
import type { FileSystemFolder } from "../file_folders";

/**
 * Receiver expression - normalized form for both self-reference and method calls
 */
export interface ReceiverExpression {
  readonly base:
    | { type: "keyword"; value: SelfReferenceKeyword }
    | { type: "identifier"; value: SymbolName };
  /** Properties between the base and the method being called, both excluded. */
  readonly chain: readonly SymbolName[];
  readonly method_name: SymbolName;
  readonly scope_id: ScopeId;
}

/**
 * Registries needed to infer the type of a receiver expression and look up
 * methods on that type (phases 1 and 2 of receiver resolution).
 */
export interface ReceiverResolutionContext {
  readonly scopes: ScopeRegistry;
  readonly definitions: DefinitionRegistry;
  readonly types: TypeRegistry;
  readonly resolutions: ResolutionRegistry;
  readonly imports: ImportGraph;
  readonly exports: ExportRegistry;
  readonly languages: ReadonlyMap<FilePath, Language>;
  readonly root_folder: FileSystemFolder;
}

const SELF_REFERENCE_KEYWORDS = new Set(["this", "self", "super", "cls"]);

/**
 * Normalize a SelfReferenceCall or MethodCallReference into a ReceiverExpression.
 *
 * Both carry a flat property_chain of `[base, ...properties, method_name]`. The base is
 * a self-reference keyword for self_reference_call, and either a keyword or an
 * identifier for method_call — `this.property.method()` is frequently indexed as
 * method_call, so a leading keyword there is still a keyword base, not an identifier.
 */
export function extract_receiver(
  ref: SelfReferenceCall | MethodCallReference
): ReceiverExpression {
  const chain = ref.property_chain;

  if (ref.kind === "self_reference_call") {
    return {
      base: { type: "keyword", value: ref.keyword },
      chain: chain.slice(1, -1) as SymbolName[],
      method_name: ref.name,
      scope_id: ref.scope_id,
    };
  }

  const first_element = chain[0] as string;
  if (SELF_REFERENCE_KEYWORDS.has(first_element)) {
    return {
      base: { type: "keyword", value: first_element as SelfReferenceKeyword },
      chain: chain.slice(1, -1) as SymbolName[],
      method_name: ref.name,
      scope_id: ref.scope_id,
    };
  }

  return {
    base: { type: "identifier", value: chain[0] as SymbolName },
    chain: chain.slice(1, -1) as SymbolName[],
    method_name: ref.name,
    scope_id: ref.scope_id,
  };
}

/**
 * Resolve a receiver expression to the SymbolId of its type.
 *
 * Phase 1 resolves the base (keyword or identifier) to a type; phase 2 walks the
 * property chain to reach the final receiver type. Returns a `ResolutionFailure`
 * describing where resolution stopped.
 */
export function resolve_receiver_type(
  receiver: ReceiverExpression,
  context: ReceiverResolutionContext
): Result<SymbolId, ResolutionFailure> {
  const base_result = resolve_base(receiver.base, receiver.scope_id, context);
  if (!base_result.ok) {
    return base_result;
  }

  if (receiver.chain.length === 0) {
    return base_result;
  }

  return walk_property_chain(base_result.value, receiver.chain, context);
}

/**
 * Resolve the base of a receiver expression to a type
 */
function resolve_base(
  base: ReceiverExpression["base"],
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): Result<SymbolId, ResolutionFailure> {
  if (base.type === "keyword") {
    return resolve_keyword_base(base.value, scope_id, context);
  } else {
    return resolve_identifier_base(base.value, scope_id, context);
  }
}

/**
 * Resolve a self-reference keyword to its type
 */
function resolve_keyword_base(
  keyword: SelfReferenceKeyword,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): Result<SymbolId, ResolutionFailure> {
  const class_scope_id = find_containing_class_scope(scope_id, context.scopes, context.definitions);
  if (!class_scope_id) {
    // Object-literal methods and prototype/member-assigned functions have no
    // enclosing class scope. Bind `this`/self to the function collection whose
    // body encloses the call so `this.method()` resolves against its siblings.
    if (keyword !== "super") {
      const scope = context.scopes.get_scope(scope_id);
      if (scope) {
        const collection_id = context.definitions.find_enclosing_collection(scope.location);
        if (collection_id) {
          return ok(collection_id);
        }
      }
    }

    return err({
      stage: "receiver_resolution",
      reason: "no_enclosing_class_scope",
      partial_info: { last_known_scope: scope_id },
    });
  }

  const class_symbol_id = find_class_from_scope(class_scope_id, context.definitions);
  if (!class_symbol_id) {
    return err({
      stage: "receiver_resolution",
      reason: "class_definition_not_found",
      partial_info: { last_known_scope: class_scope_id },
    });
  }

  // super dispatches against the parent class; index 0 is the current class.
  if (keyword === "super") {
    const inheritance_chain = context.types.walk_inheritance_chain(class_symbol_id);
    if (inheritance_chain.length < 2) {
      return err({
        stage: "receiver_resolution",
        reason: "no_parent_class",
        partial_info: { resolved_receiver_type: class_symbol_id },
      });
    }
    return ok(inheritance_chain[1]);
  }

  return ok(class_symbol_id);
}

/**
 * Resolve an identifier receiver to a type SymbolId.
 */
function resolve_identifier_base(
  identifier: SymbolName,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): Result<SymbolId, ResolutionFailure> {
  const symbol_id = context.resolutions.resolve(scope_id, identifier);
  if (!symbol_id) {
    return err({
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: scope_id },
    });
  }

  const def = context.definitions.get(symbol_id);

  // An import or a function-collection variable has no followable type of its own;
  // method_lookup resolves methods against the module exports or collection instead.
  if (def?.kind === "import") {
    return ok(symbol_id);
  }
  if (def?.kind === "variable" || def?.kind === "constant") {
    const fn_collection = context.definitions.get_function_collection(symbol_id);
    if (fn_collection) {
      return ok(symbol_id);
    }
  }

  let type_id = context.types.get_symbol_type(symbol_id);

  if (!type_id && def) {
    // A type used as a receiver (Type.staticMethod(), Type::associated_function())
    // is its own type; otherwise fall back to a resolvable type annotation.
    if (
      def.kind === "class" ||
      def.kind === "interface" ||
      def.kind === "enum" ||
      def.kind === "type" ||
      def.kind === "type_alias"
    ) {
      type_id = symbol_id;
    } else if (
      (def.kind === "variable" ||
        def.kind === "constant" ||
        def.kind === "property" ||
        def.kind === "parameter") &&
      def.type
    ) {
      type_id = context.resolutions.resolve(def.defining_scope_id, def.type);
    }
  }

  if (!type_id) {
    return err({
      stage: "type_inference",
      reason: "receiver_type_unknown",
      partial_info: { last_known_scope: scope_id },
    });
  }

  return ok(type_id);
}

/**
 * Walk a property chain, resolving each property to its member's type so the next
 * property is looked up on that type, and returning the final type.
 */
function walk_property_chain(
  start_type: SymbolId,
  chain: readonly SymbolName[],
  context: ReceiverResolutionContext
): Result<SymbolId, ResolutionFailure> {
  let current_type = start_type;

  for (const property_name of chain) {
    let member_symbol = context.types.get_type_member(current_type, property_name);

    // The member index catches members the TypeRegistry has not resolved a type for.
    if (!member_symbol) {
      const member_index = context.definitions.get_member_index();
      const type_members = member_index.get(current_type);
      if (type_members) {
        member_symbol = type_members.get(property_name) || null;
      }
    }

    if (!member_symbol) {
      return err({
        stage: "receiver_resolution",
        reason: "method_not_on_type",
        partial_info: { resolved_receiver_type: current_type },
      });
    }

    let member_type = context.types.get_symbol_type(member_symbol);

    if (!member_type) {
      const member_def = context.definitions.get(member_symbol);
      if (member_def) {
        if (
          member_def.kind === "class" ||
          member_def.kind === "interface" ||
          member_def.kind === "enum" ||
          member_def.kind === "type" ||
          member_def.kind === "type_alias"
        ) {
          member_type = member_symbol;
        } else if (
          (member_def.kind === "property" || member_def.kind === "parameter") &&
          member_def.type
        ) {
          member_type = context.resolutions.resolve(
            member_def.defining_scope_id,
            member_def.type
          );
        }
      }
    }

    if (!member_type) {
      return err({
        stage: "type_inference",
        reason: "member_type_unknown",
        partial_info: { resolved_receiver_type: current_type },
      });
    }

    current_type = member_type;
  }

  return ok(current_type);
}

/**
 * Walk up the scope tree to the class scope enclosing `start_scope_id`, or null if none.
 * `definitions` lets a Rust impl block — which is a `block` scope, not a `class` scope —
 * count as a class scope when it owns methods.
 */
export function find_containing_class_scope(
  start_scope_id: ScopeId,
  scopes: ScopeRegistry,
  definitions?: DefinitionRegistry
): ScopeId | null {
  let current_scope_id: ScopeId | null = start_scope_id;

  while (current_scope_id) {
    const scope = scopes.get_scope(current_scope_id);
    if (!scope) {
      return null;
    }

    if (scope.type === "class") {
      return current_scope_id;
    }

    // @language rust
    // A Rust impl block is a `block` scope; owning methods distinguishes it from a
    // plain block (if/for/loop), which never owns class members.
    if (scope.type === "block" && definitions) {
      if (find_class_from_scope(current_scope_id, definitions)) {
        return current_scope_id;
      }
    }

    current_scope_id = scope.parent_id;
  }

  return null;
}

/**
 * Find the class definition owning a class scope, by locating any method defined in the
 * scope and reverse-looking-up its owner through the member index. The scope tree alone
 * does not link a class body back to its class symbol.
 */
export function find_class_from_scope(
  class_scope_id: ScopeId,
  definitions: DefinitionRegistry
): SymbolId | null {
  const scope_symbols = definitions.get_scope_definitions(class_scope_id);
  if (!scope_symbols) {
    return null;
  }

  let method_symbol_id: SymbolId | null = null;
  for (const symbol_id of scope_symbols.values()) {
    const definition = definitions.get(symbol_id);
    if (definition && definition.kind === "method") {
      method_symbol_id = symbol_id;
      break;
    }
  }

  if (!method_symbol_id) {
    return null;
  }

  const member_index = definitions.get_member_index();
  for (const [class_symbol_id, members] of member_index) {
    for (const member_symbol_id of members.values()) {
      if (member_symbol_id === method_symbol_id) {
        return class_symbol_id;
      }
    }
  }

  return null;
}

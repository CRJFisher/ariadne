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
  ScopeId,
  SelfReferenceCall,
  MethodCallReference,
  SelfReferenceKeyword,
  FilePath,
} from "@ariadnejs/types";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import type { TypeRegistry } from "../registries/type";
import type { ResolutionRegistry } from "../resolve_references";

/**
 * Receiver expression - normalized form for both self-reference and method calls
 */
export interface ReceiverExpression {
  /** Base of the receiver - either a keyword or an identifier */
  readonly base:
    | { type: "keyword"; value: SelfReferenceKeyword }
    | { type: "identifier"; value: SymbolName };
  /** Property chain after the base (excluding the method being called) */
  readonly chain: readonly SymbolName[];
  /** The method being called */
  readonly method_name: SymbolName;
  /** Scope where the call appears */
  readonly scope_id: ScopeId;
}

/**
 * Resolver for import paths - resolves import symbol to its source file
 */
export type ImportPathResolver = (import_symbol_id: SymbolId) => FilePath | undefined;

/**
 * Context for resolution - bundles all registries
 */
export interface ResolutionContext {
  readonly scopes: ScopeRegistry;
  readonly definitions: DefinitionRegistry;
  readonly types: TypeRegistry;
  readonly resolutions: ResolutionRegistry;
  /** Optional resolver for import paths (for module import resolution) */
  readonly resolve_import_path?: ImportPathResolver;
  /** Optional resolver for submodule import paths (named imports referring to submodules) */
  readonly resolve_submodule_import_path?: ImportPathResolver;
}

/**
 * Extract a normalized ReceiverExpression from either a SelfReferenceCall or MethodCallReference
 *
 * Both types have property_chain where:
 * - SelfReferenceCall: [keyword, ...properties, method_name]
 * - MethodCallReference: [receiver_identifier, ...properties, method_name]
 *
 * @param ref - Either type of method call reference
 * @returns Normalized receiver expression
 */
/**
 * Self-reference keywords that should be treated as keywords even in method_call refs
 */
const SELF_REFERENCE_KEYWORDS = new Set(["this", "self", "super", "cls"]);

export function extract_receiver(
  ref: SelfReferenceCall | MethodCallReference
): ReceiverExpression {
  const chain = ref.property_chain;

  if (ref.kind === "self_reference_call") {
    // Self-reference: chain[0] is keyword, chain[-1] is method
    return {
      base: { type: "keyword", value: ref.keyword },
      chain: chain.slice(1, -1) as SymbolName[], // properties between keyword and method
      method_name: ref.name,
      scope_id: ref.scope_id,
    };
  } else {
    // Method call: chain[0] is receiver identifier, chain[-1] is method
    // BUT: If chain[0] is a self-reference keyword (this, self, super, cls),
    // we should treat it as a keyword, not an identifier.
    // This happens when this.property.method() is indexed as method_call.
    const first_element = chain[0] as string;
    if (SELF_REFERENCE_KEYWORDS.has(first_element)) {
      return {
        base: {
          type: "keyword",
          value: first_element as SelfReferenceKeyword,
        },
        chain: chain.slice(1, -1) as SymbolName[], // properties between keyword and method
        method_name: ref.name,
        scope_id: ref.scope_id,
      };
    }

    return {
      base: { type: "identifier", value: chain[0] as SymbolName },
      chain: chain.slice(1, -1) as SymbolName[], // properties between receiver and method
      method_name: ref.name,
      scope_id: ref.scope_id,
    };
  }
}

/**
 * Resolve a receiver expression to its type
 *
 * Two-phase resolution:
 * 1. Resolve the base (keyword or identifier) to a type
 * 2. Walk the property chain to get the final receiver type
 *
 * @param receiver - Normalized receiver expression
 * @param context - Resolution context with all registries
 * @returns Type symbol_id of the receiver, or null if resolution fails
 */
export function resolve_receiver_type(
  receiver: ReceiverExpression,
  context: ResolutionContext
): SymbolId | null {
  // Phase 1: Resolve the base to a type
  const base_type = resolve_base(receiver.base, receiver.scope_id, context);
  if (!base_type) {
    return null;
  }

  // Phase 2: Walk property chain (if any)
  if (receiver.chain.length === 0) {
    return base_type;
  }

  return walk_property_chain(base_type, receiver.chain, context);
}

/**
 * Resolve the base of a receiver expression to a type
 *
 * For keywords (this, self, super, cls):
 *   - Walk scope tree to find containing class
 *   - For super, get parent class from inheritance chain
 *
 * For identifiers:
 *   - Resolve in scope via ResolutionRegistry
 *   - Get type via TypeRegistry
 *   - Handle special cases (type definitions, object literals)
 *
 * @param base - The base of the receiver expression
 * @param scope_id - Scope where the reference appears
 * @param context - Resolution context
 * @returns Type symbol_id, or null if resolution fails
 */
function resolve_base(
  base: ReceiverExpression["base"],
  scope_id: ScopeId,
  context: ResolutionContext
): SymbolId | null {
  if (base.type === "keyword") {
    return resolve_keyword_base(base.value, scope_id, context);
  } else {
    return resolve_identifier_base(base.value, scope_id, context);
  }
}

/**
 * Resolve a self-reference keyword to its type
 *
 * @param keyword - this, self, super, or cls
 * @param scope_id - Scope where the reference appears
 * @param context - Resolution context
 * @returns Class type symbol_id, or null if not in class context
 */
function resolve_keyword_base(
  keyword: SelfReferenceKeyword,
  scope_id: ScopeId,
  context: ResolutionContext
): SymbolId | null {
  // Find the containing class scope
  const class_scope_id = find_containing_class_scope(scope_id, context.scopes);
  if (!class_scope_id) {
    return null;
  }

  // Find the class definition from the class scope
  const class_symbol_id = find_class_from_scope(class_scope_id, context.definitions);
  if (!class_symbol_id) {
    return null;
  }

  // For super, we need the parent class, not the current class
  if (keyword === "super") {
    const inheritance_chain = context.types.walk_inheritance_chain(class_symbol_id);
    // inheritance_chain[0] is current class, inheritance_chain[1] is parent
    if (inheritance_chain.length < 2) {
      return null; // No parent class
    }
    return inheritance_chain[1];
  }

  // For this, self, cls - return the current class
  return class_symbol_id;
}

/**
 * Resolve an identifier to its type
 *
 * Handles:
 * - Regular variables/parameters → get their type
 * - Type definitions (class, interface, enum) → return the type itself
 * - Object literals with FunctionCollection → return the variable's symbol
 *   (method_lookup will handle looking up methods in the collection)
 *
 * @param identifier - The identifier name
 * @param scope_id - Scope where the reference appears
 * @param context - Resolution context
 * @returns Type symbol_id, or null if resolution fails
 */
function resolve_identifier_base(
  identifier: SymbolName,
  scope_id: ScopeId,
  context: ResolutionContext
): SymbolId | null {
  // Resolve the identifier in scope
  const symbol_id = context.resolutions.resolve(scope_id, identifier);
  if (!symbol_id) {
    return null;
  }

  // Check if this is a module-level import - needs special handling
  const def = context.definitions.get(symbol_id);
  if (def?.kind === "import") {
    // Return the symbol itself - method_lookup will handle module exports
    return symbol_id;
  }

  // Check if this is an object literal with function collection
  // (for OBJECT_NAME.method() pattern)
  if (def?.kind === "variable" || def?.kind === "constant") {
    const fn_collection = context.definitions.get_function_collection(symbol_id);
    if (fn_collection) {
      // Return the symbol itself - method_lookup will handle collection lookup
      return symbol_id;
    }
  }

  // Get the type of the symbol
  let type_id = context.types.get_symbol_type(symbol_id);

  // If no type from TypeRegistry, try to get it from the definition
  if (!type_id && def) {
    // Check if the symbol itself is a type definition
    // (for Type.staticMethod() or Type::associated_function())
    if (
      def.kind === "class" ||
      def.kind === "interface" ||
      def.kind === "enum" ||
      def.kind === "type" ||
      def.kind === "type_alias"
    ) {
      type_id = symbol_id;
    }
    // Check if variable/constant/property/parameter has a type annotation
    else if (
      (def.kind === "variable" ||
        def.kind === "constant" ||
        def.kind === "property" ||
        def.kind === "parameter") &&
      def.type
    ) {
      // Resolve the type name in the defining scope
      type_id = context.resolutions.resolve(def.defining_scope_id, def.type);
    }
  }

  return type_id;
}

/**
 * Walk a property chain to get the final type
 *
 * For each property in the chain:
 * 1. Look up the member on the current type
 * 2. Get the member's type
 * 3. Continue to next property
 *
 * @param start_type - Starting type to walk from
 * @param chain - Property names to walk through
 * @param context - Resolution context
 * @returns Final type symbol_id, or null if any step fails
 */
function walk_property_chain(
  start_type: SymbolId,
  chain: readonly SymbolName[],
  context: ResolutionContext
): SymbolId | null {
  let current_type = start_type;

  for (const property_name of chain) {
    // Look up the property on the current type
    let member_symbol = context.types.get_type_member(current_type, property_name);

    // Fallback to definition registry's member index
    if (!member_symbol) {
      const member_index = context.definitions.get_member_index();
      const type_members = member_index.get(current_type);
      if (type_members) {
        member_symbol = type_members.get(property_name) || null;
      }
    }

    if (!member_symbol) {
      return null;
    }

    // Get the type of this member
    let member_type = context.types.get_symbol_type(member_symbol);

    // If no type from TypeRegistry, try to get it from the definition
    if (!member_type) {
      const member_def = context.definitions.get(member_symbol);
      if (member_def) {
        // Check if the member itself is a type definition
        if (
          member_def.kind === "class" ||
          member_def.kind === "interface" ||
          member_def.kind === "enum" ||
          member_def.kind === "type" ||
          member_def.kind === "type_alias"
        ) {
          member_type = member_symbol;
        }
        // Check if property/parameter has a type annotation we can resolve
        else if (
          (member_def.kind === "property" || member_def.kind === "parameter") &&
          member_def.type
        ) {
          // Resolve the type name in the defining scope
          const defining_scope = member_def.defining_scope_id;
          member_type = context.resolutions.resolve(defining_scope, member_def.type);
        }
      }
    }

    if (!member_type) {
      return null;
    }

    current_type = member_type;
  }

  return current_type;
}

/**
 * Find the class scope containing a given scope
 *
 * Walks up the scope tree until it finds a scope with type === 'class'
 *
 * @param start_scope_id - Scope to start from
 * @param scopes - Scope registry
 * @returns Class scope_id, or null if not in a class
 */
export function find_containing_class_scope(
  start_scope_id: ScopeId,
  scopes: ScopeRegistry
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

    current_scope_id = scope.parent_id;
  }

  return null;
}

/**
 * Find the class definition that owns a given class scope
 *
 * Strategy: Find a method in the class scope, then use the member_index
 * to find which class owns that method.
 *
 * @param class_scope_id - The class body scope
 * @param definitions - Definition registry
 * @returns Class symbol_id, or null if not found
 */
function find_class_from_scope(
  class_scope_id: ScopeId,
  definitions: DefinitionRegistry
): SymbolId | null {
  // Get all definitions in the class scope (methods, properties, etc.)
  const scope_symbols = definitions.get_scope_definitions(class_scope_id);
  if (!scope_symbols) {
    return null;
  }

  // Find any method in this scope
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

  // Use the member_index to find which class owns this method
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

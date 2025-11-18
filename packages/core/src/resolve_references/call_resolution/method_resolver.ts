/**
 * Method Call Resolution
 *
 * Resolves method calls by:
 * 1. Resolving the receiver object (scope-aware)
 * 2. Determining the receiver's type (from TypeRegistry)
 * 3. Looking up the method on that type
 *
 * Integration points:
 * - Uses ResolutionRegistry for eager receiver resolution
 * - Uses TypeRegistry for type tracking and member lookup
 * - Direct O(1) lookups in pre-resolved data
 *
 * Example resolution flow:
 * ```
 * const user = new User();
 * user.getName();  // ← Resolve this
 * ```
 *
 * Steps:
 * 1. Extract receiver "user" from context
 * 2. Resolve "user" in scope → symbol_id for the variable
 * 3. Get type of "user" → User class symbol_id
 * 4. Look up "getName" in User → User.getName symbol_id
 */

import type {
  SymbolId,
  SymbolName,
  MethodCallReference,
} from "@ariadnejs/types";
import { ScopeRegistry } from "../registries/scope_registry";
import { DefinitionRegistry } from "../registries/definition_registry";
import type { ResolutionRegistry } from "../resolution_registry";
import type { TypeRegistry } from "../registries/type_registry";


/**
 * Resolve a method call to zero, one, or more symbols
 *
 * Four-step resolution:
 * 1. Resolve receiver symbol (e.g., "user" in user.getName())
 * 2. Check if receiver is namespace import (utils.helper())
 * 3. Get receiver's type (e.g., User class)
 * 4. Look up method/member on type or namespace
 *
 * Returns:
 * - []: Resolution failed (no receiver, no type, or no method)
 * - [symbol]: Concrete method call (user.getName())
 * - [a, b, c]: Polymorphic method call (handler.process()) - future tasks will add this
 *
 * Future tasks (11.158, 11.156.3) will add multi-candidate logic.
 * This task only changes the return type to array.
 *
 * @param call_ref - Method call reference from semantic index
 * @param scopes - Scope registry (unused, kept for signature compatibility)
 * @param definitions - Definition registry (unused, kept for signature compatibility)
 * @param types - TypeRegistry for type tracking and member lookup
 * @param resolutions - Resolution registry for eager receiver resolution
 * @returns Array of resolved method symbol_ids (empty if resolution fails)
 */
export function resolve_method_call(
  call_ref: MethodCallReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): SymbolId[] {
  // Resolve the receiver type from property chain
  // No more chain length branching - all method calls use same logic
  const receiver_type = resolve_property_chain(
    call_ref,
    scopes,
    definitions,
    types,
    resolutions
  );

  if (!receiver_type) {
    return [];
  }

  // Step 4: Look up method on that type
  // First try the resolved type_members cache
  let method_symbol = types.get_type_member(
    receiver_type,
    call_ref.name
  );

  // If not found in cache, try direct lookup in DefinitionRegistry
  // This is needed because TypeRegistry may not be populated yet during resolution
  if (!method_symbol) {
    const member_index = definitions.get_member_index();
    const type_members = member_index.get(receiver_type);
    if (type_members) {
      method_symbol = type_members.get(call_ref.name) || null;
    }
  }

  if (!method_symbol) {
    return [];
  }

  // For now, return single element array
  // Task 11.158 will add polymorphic resolution logic here
  return [method_symbol];
}

/**
 * Resolve property chain to final receiver type
 *
 * For calls like `obj.field.method()`:
 * - property_chain: ["obj", "field", "method"]
 * - Walk: "obj" → get type → look up "field" → get field type
 * - Returns: Type of the field
 *
 * For simple calls like `user.getName()`:
 * - property_chain: ["user", "getName"]
 * - Walk: "user" → get User type
 * - Returns: User type
 *
 * Handles:
 * - Variable/parameter receivers
 * - Field access on classes
 * - Namespace imports
 * - Multi-level property chains
 *
 * NOTE: Self-reference keywords (this, self, super) are NOT handled here.
 * They are routed to self_reference_resolver.ts by the entry point.
 *
 * @param call_ref - Method call reference with property chain
 * @param scopes - Scope registry (for scope lookups)
 * @param definitions - Definition registry for looking up fields
 * @param types - TypeRegistry for type tracking
 * @param resolutions - Resolution registry for symbol resolution
 * @returns Type symbol_id of the final receiver, or null if resolution fails
 */
function resolve_property_chain(
  call_ref: MethodCallReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): SymbolId | null {
  const chain = call_ref.property_chain;
  if (!chain || chain.length === 0) {
    return null;
  }

  // Walk the property chain from start to second-to-last
  // (last element is the method name we're calling)
  let current_symbol: SymbolId | null = null;
  let current_type: SymbolId | null = null;

  for (let i = 0; i < chain.length - 1; i++) {
    const prop_name = chain[i] as SymbolName;

    if (i === 0) {
      // First element: resolve in scope
      // NOTE: Self-reference keywords (this, self, super) are NOT handled here
      // They are filtered out by the entry point and routed to self_reference_resolver
      current_symbol = resolutions.resolve(call_ref.scope_id, prop_name);
      if (!current_symbol) {
        return null;
      }

      // Check if receiver is a namespace import
      const receiver_def = definitions.get(current_symbol);
      if (
        receiver_def &&
        receiver_def.kind === "import" &&
        receiver_def.import_kind === "namespace"
      ) {
        // Namespace import! Look up the member in the source file
        const source_file = receiver_def.location.file_path;
        const source_defs = definitions.get_exportable_definitions_in_file(source_file);

        for (const def of source_defs) {
          if (def.name === call_ref.name) {
            if (def.kind !== "import" && def.is_exported) {
              return def.symbol_id;
            }
          }
        }

        // Member not found in namespace
        return null;
      }

      // Get the type of the first symbol
      current_type = types.get_symbol_type(current_symbol);

      // Check if it's itself a type (for associated function calls like Type::function())
      if (!current_type) {
        const def = definitions.get(current_symbol);
        if (def && (def.kind === "class" || def.kind === "interface" ||
                    def.kind === "enum" || def.kind === "type" ||
                    def.kind === "type_alias")) {
          current_type = current_symbol;
        }
      }

      if (!current_type) {
        return null;
      }
    } else {
      // Subsequent elements: look up as member/field on current type
      if (!current_type) {
        return null;
      }

      // Look up the property on the current type
      const member_symbol = types.get_type_member(current_type, prop_name);
      if (!member_symbol) {
        // Try direct lookup in DefinitionRegistry
        const member_index = definitions.get_member_index();
        const type_members = member_index.get(current_type);
        if (!type_members) {
          return null;
        }
        current_symbol = type_members.get(prop_name) || null;
        if (!current_symbol) {
          return null;
        }
      } else {
        current_symbol = member_symbol;
      }

      // Get the type of this member/field
      current_type = types.get_symbol_type(current_symbol);

      // Check if member itself is a type
      if (!current_type) {
        const def = definitions.get(current_symbol);
        if (def && (def.kind === "class" || def.kind === "interface" ||
                    def.kind === "enum" || def.kind === "type" ||
                    def.kind === "type_alias")) {
          current_type = current_symbol;
        }
      }

      if (!current_type) {
        return null;
      }
    }
  }

  return current_type;
}

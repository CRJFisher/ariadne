/**
 * Type Context
 *
 * Provides type tracking and member lookup for symbols.
 * Uses on-demand resolution through ScopeResolverIndex to resolve type names.
 *
 * Integration with task 11.105:
 * - Uses type_bindings from SemanticIndex (preprocessed type annotations)
 * - Uses type_members from SemanticIndex (preprocessed member information)
 */

import type {
  SymbolId,
  SymbolName,
  ScopeId,
  FilePath,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { ScopeResolverIndex } from "../scope_resolver_index/scope_resolver_index";
import type { ResolutionCache } from "../resolution_cache/resolution_cache";
import type { NamespaceSources } from "../types";
import type { DefinitionRegistry } from "../../project/definition_registry";
import type { TypeRegistry } from "../../project/type_registry";

/**
 * Type Context Interface
 *
 * Provides type information for symbols and member lookup for types.
 * Does NOT cache - delegates to ScopeResolverIndex which uses the shared cache.
 */
export interface TypeContext {
  /**
   * Get the type of a symbol (variable, parameter, etc.)
   * Returns the SymbolId of the type (class, interface, etc.)
   *
   * Priority:
   * 1. Explicit type annotations (const x: Type)
   * 2. Constructor assignments (const x = new Type())
   * 3. Return types from function calls (future)
   *
   * @param symbol_id - The symbol to get the type for
   * @returns SymbolId of the type, or null if type unknown
   */
  get_symbol_type(symbol_id: SymbolId): SymbolId | null;

  /**
   * Get a member (method/property) of a type by name
   *
   * Walks the inheritance chain to find inherited members.
   *
   * @param type_id - The type to look up members in
   * @param member_name - The member name to find
   * @returns SymbolId of the member, or null if not found
   */
  get_type_member(type_id: SymbolId, member_name: SymbolName): SymbolId | null;

  /**
   * Get the parent class of a class (from extends clause)
   *
   * @param class_id - The class to get parent for
   * @returns SymbolId of parent class, or null if no parent
   */
  get_parent_class(class_id: SymbolId): SymbolId | null;

  /**
   * Get implemented interfaces for a class
   *
   * @param class_id - The class to get interfaces for
   * @returns Array of interface SymbolIds
   */
  get_implemented_interfaces(class_id: SymbolId): readonly SymbolId[];

  /**
   * Walk the full inheritance chain from most derived to base
   *
   * Returns array starting with the class itself, followed by parent,
   * grandparent, etc. Handles circular inheritance gracefully.
   *
   * @param class_id - The class to start from
   * @returns Array of SymbolIds in inheritance chain
   */
  walk_inheritance_chain(class_id: SymbolId): readonly SymbolId[];

  /**
   * Get a member of a namespace import by name
   *
   * Resolves namespace member access like `utils.helper()` where `utils` is
   * a namespace import (`import * as utils from './utils'`).
   *
   * Process:
   * 1. Find the source file for the namespace
   * 2. Look up the exported symbol with the given name
   * 3. Resolve the exported symbol in the source file's scope
   *
   * @param namespace_id - The namespace symbol (from import resolution)
   * @param member_name - The member name to find
   * @returns SymbolId of the member, or null if not found
   *
   * @example
   * ```typescript
   * // Given: import * as utils from './utils';
   * //        utils.helper();
   * const namespace_id = resolver_index.resolve(scope_id, "utils", cache);
   * const member_id = type_context.get_namespace_member(namespace_id, "helper");
   * // → "fn:src/utils.ts:helper:10:0"
   * ```
   */
  get_namespace_member(
    namespace_id: SymbolId,
    member_name: SymbolName
  ): SymbolId | null;
}

/**
 * Build type context from registries
 *
 * Creates a type tracking system that:
 * 1. Maps symbols to their types (symbol_id → type_id)
 * 2. Provides member lookup for types (type_id → members)
 * 3. Provides namespace member lookup for namespace imports
 *
 * Uses on-demand resolution:
 * - Type names from TypeRegistry are resolved via resolver_index
 * - Resolution results are cached in the shared cache
 *
 * Performance: Uses O(1) lookups from DefinitionRegistry and TypeRegistry
 * instead of O(n) linear searches through SemanticIndex maps.
 *
 * @param indices - All semantic indices (for namespace member lookup)
 * @param definitions - Definition registry (for O(1) location/scope lookups)
 * @param types - Type registry (for aggregated type data)
 * @param resolver_index - Scope-aware symbol resolver for type name resolution
 * @param cache - Shared resolution cache
 * @param namespace_sources - Map of namespace symbol_id → source file path
 * @returns TypeContext implementation
 */
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache,
  namespace_sources: NamespaceSources,
): TypeContext {
  // Map: symbol_id → type_id
  // Tracks the type of each symbol (variable, parameter, etc.)
  const symbol_types = new Map<SymbolId, SymbolId>();

  // Map: type_id → (member_name → member_symbol_id)
  // Built from TypeRegistry data
  const type_members_map = new Map<SymbolId, Map<SymbolName, SymbolId>>();

  // PASS 1: Build symbol → type mappings using TypeRegistry
  // Use O(1) lookups from DefinitionRegistry instead of O(n) searches
  for (const [loc_key, type_name] of types.get_all_type_bindings()) {
    // O(1): Find the symbol at this location
    const symbol_id = definitions.get_symbol_at_location(loc_key);
    if (!symbol_id) continue;

    // O(1): Find the scope where this symbol is defined
    const scope_id = definitions.get_symbol_scope(symbol_id);
    if (!scope_id) continue;

    // Resolve type name ON-DEMAND using resolver index
    // This handles:
    // - Local type definitions
    // - Imported types
    // - Shadowing
    const type_symbol = resolver_index.resolve(scope_id, type_name, cache);
    if (type_symbol) {
      symbol_types.set(symbol_id, type_symbol);
    }
  }

  // PASS 2: Build type member maps from TypeRegistry
  for (const [type_id, member_info] of types.get_all_type_members()) {
    const members = new Map<SymbolName, SymbolId>();

    // Add methods
    for (const [method_name, method_id] of member_info.methods) {
      members.set(method_name, method_id);
    }

    // Add properties
    for (const [prop_name, prop_id] of member_info.properties) {
      members.set(prop_name, prop_id);
    }

    type_members_map.set(type_id, members);
  }

  // PASS 3: Build inheritance maps by resolving extends clauses
  // Map: class_id → parent_class_id
  const parent_classes = new Map<SymbolId, SymbolId>();
  // Map: class_id → interface_ids[]
  const implemented_interfaces = new Map<SymbolId, SymbolId[]>();

  for (const [type_id, member_info] of types.get_all_type_members()) {
    // O(1): Get the scope where this type is defined (for resolving extends names)
    const scope_id = definitions.get_symbol_scope(type_id);
    if (!scope_id) continue;

    // Resolve extends names to SymbolIds
    if (member_info.extends && member_info.extends.length > 0) {
      const parent_ids: SymbolId[] = [];

      for (const parent_name of member_info.extends) {
        const parent_id = resolver_index.resolve(
          scope_id,
          parent_name,
          cache,
        );
        if (parent_id) {
          parent_ids.push(parent_id);
        }
      }

      // First extends is parent class, rest are interfaces (TypeScript convention)
      // For other languages, we'll treat all as potential parents
      if (parent_ids.length > 0) {
        parent_classes.set(type_id, parent_ids[0]);

        // Additional extends are interfaces (TypeScript/Java style)
        if (parent_ids.length > 1) {
          implemented_interfaces.set(type_id, parent_ids.slice(1));
        }
      }
    }
  }

  // Helper: Find member in a single type (no inheritance)
  function find_direct_member(
    type_id: SymbolId,
    member_name: SymbolName,
  ): SymbolId | null {
    const members = type_members_map.get(type_id);
    if (!members) return null;
    return members.get(member_name) || null;
  }

  // Return TypeContext implementation
  return {
    get_symbol_type(symbol_id: SymbolId): SymbolId | null {
      return symbol_types.get(symbol_id) || null;
    },

    get_type_member(
      type_id: SymbolId,
      member_name: SymbolName,
    ): SymbolId | null {
      // Walk inheritance chain from most derived to base
      const chain = this.walk_inheritance_chain(type_id);

      for (const class_id of chain) {
        // Check direct members first
        const direct_member = find_direct_member(class_id, member_name);
        if (direct_member) {
          return direct_member;
        }

        // Check implemented interfaces
        const interfaces = implemented_interfaces.get(class_id) || [];
        for (const interface_id of interfaces) {
          const interface_member = find_direct_member(
            interface_id,
            member_name,
          );
          if (interface_member) {
            return interface_member;
          }
        }
      }

      return null;
    },

    get_parent_class(class_id: SymbolId): SymbolId | null {
      return parent_classes.get(class_id) || null;
    },

    get_implemented_interfaces(class_id: SymbolId): readonly SymbolId[] {
      return implemented_interfaces.get(class_id) || [];
    },

    walk_inheritance_chain(class_id: SymbolId): readonly SymbolId[] {
      const chain: SymbolId[] = [class_id];
      const seen = new Set<SymbolId>([class_id]);
      let current = class_id;

      // Walk up extends chain
      while (true) {
        const parent = parent_classes.get(current);
        if (!parent) break;

        // Detect cycles
        if (seen.has(parent)) break;

        chain.push(parent);
        seen.add(parent);
        current = parent;
      }

      return chain;
    },

    get_namespace_member(
      namespace_id: SymbolId,
      member_name: SymbolName,
    ): SymbolId | null {
      // Step 1: Find the source file for this namespace
      const source_file = namespace_sources.get(namespace_id);
      if (!source_file) {
        return null; // Not a namespace or source not found
      }

      // Step 2: Get the semantic index for the source file
      const source_index = indices.get(source_file);
      if (!source_index) {
        return null; // Source file not indexed
      }

      // Step 3: Look up the exported symbol with this name
      const exported_def = source_index.exported_symbols.get(member_name);
      if (!exported_def) {
        return null; // Member not exported
      }

      // Step 4: Return the symbol_id directly
      // The exported_symbols map already contains resolved symbol_ids
      return exported_def.symbol_id;
    },
  };
}

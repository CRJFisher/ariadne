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
  LocationKey,
  Location as SymbolLocation,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { ScopeResolverIndex } from "../scope_resolver_index/scope_resolver_index";
import type { ResolutionCache } from "../resolution_cache/resolution_cache";

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
   * Currently only looks at direct members.
   * Future: Walk inheritance chain using type_members.extends
   *
   * @param type_id - The type to look up members in
   * @param member_name - The member name to find
   * @returns SymbolId of the member, or null if not found
   */
  get_type_member(type_id: SymbolId, member_name: SymbolName): SymbolId | null;

  /**
   * Get all members of a type (for debugging)
   *
   * Returns all methods and properties of a type.
   * Currently only returns direct members.
   *
   * @param type_id - The type to get members for
   * @returns ReadonlyMap of member names to SymbolIds
   */
  get_type_members(type_id: SymbolId): ReadonlyMap<SymbolName, SymbolId>;
}

/**
 * Build type context from semantic indices
 *
 * Creates a type tracking system that:
 * 1. Maps symbols to their types (symbol_id → type_id)
 * 2. Provides member lookup for types (type_id → members)
 *
 * Uses on-demand resolution:
 * - Type names from type_bindings are resolved via resolver_index
 * - Resolution results are cached in the shared cache
 *
 * @param indices - All semantic indices (one per file)
 * @param resolver_index - Scope-aware symbol resolver for type name resolution
 * @param cache - Shared resolution cache
 * @returns TypeContext implementation
 */
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache
): TypeContext {
  // Map: symbol_id → type_id
  // Tracks the type of each symbol (variable, parameter, etc.)
  const symbol_types = new Map<SymbolId, SymbolId>();

  // Map: type_id → (member_name → member_symbol_id)
  // Extracted from preprocessed type_members in SemanticIndex
  const type_members_map = new Map<SymbolId, Map<SymbolName, SymbolId>>();

  // PASS 1: Build symbol → type mappings using type_bindings
  for (const [file_path, index] of indices) {
    // Process type bindings from task 11.105
    // Maps LocationKey → SymbolName (type names)
    for (const [loc_key, type_name] of index.type_bindings) {
      // Find the symbol at this location
      const symbol_id = find_symbol_at_location(loc_key, index);
      if (!symbol_id) continue;

      // Find the scope where this symbol is defined
      const scope_id = get_symbol_scope(symbol_id, index);
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
  }

  // PASS 2: Build type member maps from preprocessed type_members
  for (const [file_path, index] of indices) {
    // Use preprocessed type_members from task 11.105
    // Already contains methods, properties, constructor, extends
    for (const [type_id, member_info] of index.type_members) {
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
  }

  // Return TypeContext implementation
  return {
    get_symbol_type(symbol_id: SymbolId): SymbolId | null {
      return symbol_types.get(symbol_id) || null;
    },

    get_type_member(
      type_id: SymbolId,
      member_name: SymbolName
    ): SymbolId | null {
      const members = type_members_map.get(type_id);
      if (!members) return null;

      // Direct lookup
      const member = members.get(member_name);
      if (member) return member;

      // TODO: Walk inheritance chain
      // Will use type_members.extends from task 11.105
      return null;
    },

    get_type_members(type_id: SymbolId): ReadonlyMap<SymbolName, SymbolId> {
      return type_members_map.get(type_id) || new Map();
    },
  };
}

/**
 * Find symbol at a specific location
 *
 * Searches through all definition types to find a symbol at the given location.
 * Also handles near matches (within 2 columns) to account for slight differences
 * in how tree-sitter captures locations for constructor targets vs variable definitions.
 *
 * @param loc_key - Location key to search for
 * @param index - Semantic index to search in
 * @returns SymbolId if found, null otherwise
 */
function find_symbol_at_location(
  loc_key: LocationKey,
  index: SemanticIndex
): SymbolId | null {
  // Parse the location key
  const parts = loc_key.split(":");
  if (parts.length < 4) return null;
  const file_path = parts[0] as FilePath;
  const start_line = parseInt(parts[1]);
  const start_col = parseInt(parts[2]);
  const end_line = parseInt(parts[3]);
  const end_col = parts.length > 4 ? parseInt(parts[4]) : start_col + 1;

  /**
   * Check if two locations are close enough to be considered the same
   * Allows for small column offsets (e.g., construct_target vs variable location)
   */
  function locations_near(loc: SymbolLocation): boolean {
    if (loc.file_path !== file_path) return false;
    if (loc.start_line !== start_line || loc.end_line !== end_line) return false;

    // Allow up to 2 columns difference on same line
    const col_diff = Math.abs(loc.start_column - start_col);
    return col_diff <= 2;
  }

  // Check variables
  for (const [var_id, var_def] of index.variables) {
    const exact_match = location_key(var_def.location) === loc_key;
    const near_match = locations_near(var_def.location);

    if (exact_match || near_match) {
      return var_id;
    }
  }

  // Check functions
  for (const [func_id, func_def] of index.functions) {
    if (location_key(func_def.location) === loc_key) {
      return func_id;
    }

    // Check function parameters
    if (func_def.signature?.parameters) {
      for (const param of func_def.signature.parameters) {
        if (location_key(param.location) === loc_key) {
          return param.symbol_id;
        }
      }
    }
  }

  // Check classes
  for (const [class_id, class_def] of index.classes) {
    if (location_key(class_def.location) === loc_key) {
      return class_id;
    }

    // Check class methods
    for (const method of class_def.methods) {
      if (location_key(method.location) === loc_key) {
        return method.symbol_id;
      }

      // Check method parameters
      if (method.parameters) {
        for (const param of method.parameters) {
          if (location_key(param.location) === loc_key) {
            return param.symbol_id;
          }
        }
      }
    }

    // Check class properties
    for (const prop of class_def.properties) {
      if (location_key(prop.location) === loc_key) {
        return prop.symbol_id;
      }
    }
  }

  // Check interfaces
  for (const [iface_id, iface_def] of index.interfaces) {
    if (location_key(iface_def.location) === loc_key) {
      return iface_id;
    }

    // Check interface methods
    for (const method of iface_def.methods) {
      if (location_key(method.location) === loc_key) {
        return method.symbol_id;
      }

      // Check method parameters
      if (method.parameters) {
        for (const param of method.parameters) {
          if (location_key(param.location) === loc_key) {
            return param.symbol_id;
          }
        }
      }
    }

    // Check interface properties
    for (const prop of iface_def.properties) {
      if (location_key(prop.location) === loc_key) {
        return prop.name; // PropertySignature has 'name' field
      }
    }
  }

  return null;
}

/**
 * Get the scope where a symbol is defined
 *
 * Looks up the symbol in all definition maps and returns its scope_id.
 *
 * @param symbol_id - Symbol to find scope for
 * @param index - Semantic index to search in
 * @returns ScopeId if found, null otherwise
 */
function get_symbol_scope(
  symbol_id: SymbolId,
  index: SemanticIndex
): ScopeId | null {
  // Check variables
  const var_def = index.variables.get(symbol_id);
  if (var_def) return var_def.scope_id;

  // Check functions
  const func_def = index.functions.get(symbol_id);
  if (func_def) return func_def.scope_id;

  // Check classes
  const class_def = index.classes.get(symbol_id);
  if (class_def) return class_def.scope_id;

  // Check interfaces
  const iface_def = index.interfaces.get(symbol_id);
  if (iface_def) return iface_def.scope_id;

  // Check enums
  const enum_def = index.enums.get(symbol_id);
  if (enum_def) return enum_def.scope_id;

  // Check namespaces
  const ns_def = index.namespaces.get(symbol_id);
  if (ns_def) return ns_def.scope_id;

  // Check types
  const type_def = index.types.get(symbol_id);
  if (type_def) return type_def.scope_id;

  // Check if it's a parameter - need to search through functions and methods
  for (const func of index.functions.values()) {
    if (func.signature?.parameters) {
      for (const param of func.signature.parameters) {
        if (param.symbol_id === symbol_id) {
          return param.scope_id;
        }
      }
    }
  }

  for (const class_def of index.classes.values()) {
    for (const method of class_def.methods) {
      if (method.parameters) {
        for (const param of method.parameters) {
          if (param.symbol_id === symbol_id) {
            return param.scope_id;
          }
        }
      }
    }
  }

  return null;
}

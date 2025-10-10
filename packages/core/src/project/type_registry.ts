import type { SymbolId, FilePath, LocationKey, SymbolName, TypeMemberInfo } from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";

/**
 * Track which types a file contributed (for removal).
 */
interface FileTypeContributions {
  /** Location keys that have type bindings */
  bindings: Set<LocationKey>

  /** Type SymbolIds that have members */
  member_types: Set<SymbolId>

  /** Type alias SymbolIds */
  aliases: Set<SymbolId>
}

/**
 * Central registry for type information across the project.
 *
 * Aggregates:
 * - Type bindings (location → type name)
 * - Type members (type → methods/properties/constructor/extends)
 * - Type aliases (alias → type expression)
 *
 * Supports incremental updates and cross-file type queries.
 */
export class TypeRegistry {
  /** Location → type name (from annotations, constructors, return types) */
  private type_bindings: Map<LocationKey, SymbolName> = new Map();

  /** Type SymbolId → its members (for classes, interfaces, enums, etc.) */
  private type_members: Map<SymbolId, TypeMemberInfo> = new Map();

  /** Type alias SymbolId → type expression string */
  private type_aliases: Map<SymbolId, string> = new Map();

  /** Track which file contributed which types (for cleanup) */
  private by_file: Map<FilePath, FileTypeContributions> = new Map();

  /**
   * Update type information for a file.
   * Removes old type data from the file first, then adds new data.
   *
   * @param file_path - The file being updated
   * @param index - Semantic index containing type information
   */
  update_file(file_path: FilePath, index: SemanticIndex): void {
    // Step 1: Remove old type data from this file
    this.remove_file(file_path);

    // Step 2: Track what this file contributes
    const contributions: FileTypeContributions = {
      bindings: new Set(),
      member_types: new Set(),
      aliases: new Set(),
    };

    // Step 3: Add type bindings
    for (const [location_key, type_name] of index.type_bindings) {
      this.type_bindings.set(location_key, type_name);
      contributions.bindings.add(location_key);
    }

    // Step 4: Add type members
    for (const [type_id, members] of index.type_members) {
      this.type_members.set(type_id, members);
      contributions.member_types.add(type_id);
    }

    // Step 5: Add type aliases
    for (const [alias_id, type_expression] of index.type_alias_metadata) {
      this.type_aliases.set(alias_id, type_expression);
      contributions.aliases.add(alias_id);
    }

    // Step 6: Record contributions
    if (contributions.bindings.size > 0 ||
        contributions.member_types.size > 0 ||
        contributions.aliases.size > 0) {
      this.by_file.set(file_path, contributions);
    }
  }

  /**
   * Get the type name bound to a location.
   *
   * @param location_key - The location to query
   * @returns The type name, or undefined if not found
   */
  get_type_binding(location_key: LocationKey): SymbolName | undefined {
    return this.type_bindings.get(location_key);
  }

  /**
   * Get members of a type by its SymbolId.
   *
   * @param type_id - The type SymbolId (class, interface, enum, etc.)
   * @returns TypeMemberInfo with methods, properties, constructor, extends
   */
  get_type_members(type_id: SymbolId): TypeMemberInfo | undefined {
    return this.type_members.get(type_id);
  }

  /**
   * Resolve a type alias to its type expression.
   *
   * @param alias_id - The type alias SymbolId
   * @returns Type expression string, or undefined if not a type alias
   */
  resolve_type_alias(alias_id: SymbolId): string | undefined {
    return this.type_aliases.get(alias_id);
  }

  /**
   * Check if a location has a type binding.
   *
   * @param location_key - The location to check
   * @returns True if the location has a type binding
   */
  has_type_binding(location_key: LocationKey): boolean {
    return this.type_bindings.has(location_key);
  }

  /**
   * Check if a type has members.
   *
   * @param type_id - The type to check
   * @returns True if the type has members
   */
  has_type_members(type_id: SymbolId): boolean {
    return this.type_members.has(type_id);
  }

  /**
   * Get all type bindings in the registry.
   *
   * @returns Map of all type bindings
   */
  get_all_type_bindings(): Map<LocationKey, SymbolName> {
    return new Map(this.type_bindings);
  }

  /**
   * Get all type members in the registry.
   *
   * @returns Map of all type members
   */
  get_all_type_members(): Map<SymbolId, TypeMemberInfo> {
    return new Map(this.type_members);
  }

  /**
   * Remove all type information from a file.
   *
   * @param file_path - The file to remove
   */
  remove_file(file_path: FilePath): void {
    const contributions = this.by_file.get(file_path);
    if (!contributions) {
      return;  // File not in registry
    }

    // Remove type bindings
    for (const location_key of contributions.bindings) {
      this.type_bindings.delete(location_key);
    }

    // Remove type members
    for (const type_id of contributions.member_types) {
      this.type_members.delete(type_id);
    }

    // Remove type aliases
    for (const alias_id of contributions.aliases) {
      this.type_aliases.delete(alias_id);
    }

    // Remove file tracking
    this.by_file.delete(file_path);
  }

  /**
   * Get the total number of type bindings, members, and aliases.
   *
   * @returns Counts of each type category
   */
  size(): { bindings: number; members: number; aliases: number } {
    return {
      bindings: this.type_bindings.size,
      members: this.type_members.size,
      aliases: this.type_aliases.size,
    };
  }

  /**
   * Clear all type information from the registry.
   */
  clear(): void {
    this.type_bindings.clear();
    this.type_members.clear();
    this.type_aliases.clear();
    this.by_file.clear();
  }
}

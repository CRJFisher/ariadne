import type {
  SymbolId,
  FilePath,
  LocationKey,
  SymbolName,
  TypeMemberInfo,
  ScopeId,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";
import type { DefinitionRegistry } from "./definition_registry";
import type { ResolutionRegistry } from "./resolution_registry";
import {
  extract_type_bindings,
  extract_constructor_bindings,
  extract_type_members,
  extract_type_alias_metadata,
} from "../index_single_file/type_preprocessing";

/**
 * Track which types a file contributed (for removal).
 */
interface FileTypeContributions {
  /** Location keys that have type bindings */
  bindings: Set<LocationKey>;

  /** Type SymbolIds that have members */
  member_types: Set<SymbolId>;

  /** Type alias SymbolIds */
  aliases: Set<SymbolId>;

  /** NEW: SymbolIds with resolved type information */
  resolved_symbols: Set<SymbolId>;
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
  // ===== Existing name-based storage (keep for now) =====
  /** Location → type name (from annotations, constructors, return types) */
  private type_bindings: Map<LocationKey, SymbolName> = new Map();

  /** Type SymbolId → its members (for classes, interfaces, enums, etc.) */
  private type_members: Map<SymbolId, TypeMemberInfo> = new Map();

  /** Type alias SymbolId → type expression string */
  private type_aliases: Map<SymbolId, SymbolName> = new Map();

  /** Track which file contributed which types (for cleanup) */
  private by_file: Map<FilePath, FileTypeContributions> = new Map();

  // ===== NEW: SymbolId-based resolved storage =====

  /** Maps symbol → type (resolved). e.g., variable → class it's typed as */
  private symbol_types: Map<SymbolId, SymbolId> = new Map();

  /** Maps type → member name → member symbol (resolved) */
  private resolved_type_members: Map<SymbolId, Map<SymbolName, SymbolId>> = new Map();

  /** Maps class → parent class (resolved from extends clause) */
  private parent_classes: Map<SymbolId, SymbolId> = new Map();

  /** Maps class → implemented interfaces (resolved from implements/extends) */
  private implemented_interfaces: Map<SymbolId, SymbolId[]> = new Map();

  /** Track which file contributed resolved data (for cleanup) */
  private resolved_by_file: Map<FilePath, Set<SymbolId>> = new Map();

  /**
   * Update type information for a file.
   *
   * Two-phase process:
   * 1. Extract type metadata from semantic index (names)
   * 2. Resolve type metadata to SymbolIds (using ResolutionRegistry)
   *
   * NOTE: Must be called AFTER ResolutionRegistry.resolve_files() for the file.
   *
   * @param file_path - The file being updated
   * @param index - Semantic index containing type information
   * @param definitions - Definition registry (for location/scope lookups)
   * @param resolutions - Resolution registry (for name → SymbolId resolution)
   */
  update_file(
    file_path: FilePath,
    index: SemanticIndex,
    definitions: DefinitionRegistry,
    resolutions: ResolutionRegistry
  ): void {
    // Phase 1: Remove old type data from this file
    this.remove_file(file_path);

    // Phase 2: Track what this file contributes
    const contributions: FileTypeContributions = {
      bindings: new Set(),
      member_types: new Set(),
      aliases: new Set(),
      resolved_symbols: new Set(),
    };

    // Phase 3: Extract raw type data (names)
    this.extract_type_data(index, contributions);

    // Phase 4: Resolve type metadata (names → SymbolIds)
    this.resolve_type_metadata(file_path, definitions, resolutions);

    // Phase 5: Store contributions tracking
    if (
      contributions.bindings.size > 0 ||
      contributions.member_types.size > 0 ||
      contributions.aliases.size > 0
    ) {
      this.by_file.set(file_path, contributions);
    }
  }

  /**
   * Extract type metadata from semantic index.
   * Stores names - resolution happens separately.
   *
   * @param index - Semantic index with type information
   * @param contributions - Tracks what this file contributes
   */
  private extract_type_data(
    index: SemanticIndex,
    contributions: FileTypeContributions
  ): void {
    // PASS 6: Extract type preprocessing data
    const type_bindings_from_defs = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    const type_bindings_from_ctors = extract_constructor_bindings(
      index.references
    );

    // Merge type bindings from definitions and constructors
    const type_bindings = new Map([
      ...type_bindings_from_defs,
      ...type_bindings_from_ctors,
    ]);

    const type_members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    const type_alias_metadata = extract_type_alias_metadata(index.types);

    // Store type bindings
    for (const [location_key, type_name] of type_bindings) {
      this.type_bindings.set(location_key, type_name);
      contributions.bindings.add(location_key);
    }

    // Store type members
    for (const [type_id, members] of type_members) {
      this.type_members.set(type_id, members);
      contributions.member_types.add(type_id);
    }

    // Store type aliases
    for (const [alias_id, type_expression] of type_alias_metadata) {
      this.type_aliases.set(alias_id, type_expression);
      contributions.aliases.add(alias_id);
    }
  }

  /**
   * Resolve type metadata from names to SymbolIds.
   *
   * Process:
   * 1. Resolve type bindings: location → type_name → type_id
   * 2. Build member maps: type_id → member_name → member_id
   * 3. Resolve inheritance: type_id → parent_name → parent_id
   * 4. Resolve interfaces: type_id → interface_names → interface_ids
   *
   * This is called internally by update_file() after extraction.
   *
   * @param file_id - The file being processed
   * @param definitions - Definition registry for location/scope lookups
   * @param resolutions - Resolution registry for name → SymbolId lookups
   */
  private resolve_type_metadata(
    file_id: FilePath,
    definitions: DefinitionRegistry,
    resolutions: ResolutionRegistry
  ): void {
    const contributions = this.by_file.get(file_id);
    if (!contributions) return;

    const resolved_symbols = new Set<SymbolId>();

    // STEP 1: Resolve type bindings (location → type_name → type_id)
    for (const loc_key of contributions.bindings) {
      // Get the symbol at this location (the variable/parameter being typed)
      const symbol_id = definitions.get_symbol_at_location(loc_key);
      if (!symbol_id) continue;

      // Get the type name from bindings
      const type_name = this.type_bindings.get(loc_key);
      if (!type_name) continue;

      // Get the scope where this symbol is defined
      const scope_id = definitions.get_symbol_scope(symbol_id);
      if (!scope_id) continue;

      // Resolve the type name to a type SymbolId
      const type_id = resolutions.resolve(scope_id, type_name);
      if (type_id) {
        this.symbol_types.set(symbol_id, type_id);
        resolved_symbols.add(symbol_id);
      }
    }

    // STEP 2: Build resolved member maps
    for (const type_id of contributions.member_types) {
      const member_info = this.type_members.get(type_id);
      if (!member_info) continue;

      // Get members directly from DefinitionRegistry (already SymbolIds)
      const member_map = definitions.get_member_index().get(type_id);
      if (member_map && member_map.size > 0) {
        this.resolved_type_members.set(type_id, new Map(member_map));
        resolved_symbols.add(type_id);
      }
    }

    // STEP 3: Resolve inheritance (extends clause)
    for (const type_id of contributions.member_types) {
      const member_info = this.type_members.get(type_id);
      if (!member_info || !member_info.extends || member_info.extends.length === 0) {
        continue;
      }

      // Get the scope where this type is defined
      const scope_id = definitions.get_symbol_scope(type_id);
      if (!scope_id) continue;

      // Resolve parent/interface names to SymbolIds
      const resolved_parents: SymbolId[] = [];
      for (const parent_name of member_info.extends) {
        const parent_id = resolutions.resolve(scope_id, parent_name);
        if (parent_id) {
          resolved_parents.push(parent_id);
        }
      }

      if (resolved_parents.length > 0) {
        // First is parent class, rest are interfaces
        this.parent_classes.set(type_id, resolved_parents[0]);
        resolved_symbols.add(type_id);

        if (resolved_parents.length > 1) {
          this.implemented_interfaces.set(type_id, resolved_parents.slice(1));
        }
      }
    }

    // Track what this file contributed
    if (resolved_symbols.size > 0) {
      this.resolved_by_file.set(file_id, resolved_symbols);
      contributions.resolved_symbols = resolved_symbols;
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

  // ===== TypeContext Interface Implementation =====

  /**
   * Get the type of a symbol (variable, parameter, etc.)
   *
   * Returns the SymbolId of the type (class, interface, etc.) that the symbol is typed as.
   *
   * Priority:
   * 1. Explicit type annotations (const x: Type)
   * 2. Constructor assignments (const x = new Type())
   * 3. Return types from function calls (future)
   *
   * @param symbol_id - The symbol to get the type for
   * @returns SymbolId of the type, or null if type unknown
   *
   * @example
   * ```typescript
   * const user: User = new User();
   * //    ^--- symbol_id
   * //           ^--- returned type_id
   * ```
   */
  get_symbol_type(symbol_id: SymbolId): SymbolId | null {
    return this.symbol_types.get(symbol_id) || null;
  }

  /**
   * Get the parent class of a class (from extends clause).
   *
   * @param class_id - The class to get parent for
   * @returns SymbolId of parent class, or null if no parent
   *
   * @example
   * ```typescript
   * class Dog extends Animal { }
   * get_parent_class(dog_id) → animal_id
   * ```
   */
  get_parent_class(class_id: SymbolId): SymbolId | null {
    return this.parent_classes.get(class_id) || null;
  }

  /**
   * Get implemented interfaces for a class.
   *
   * Note: In TypeScript, interfaces in extends clause (after first) are treated as
   * implemented interfaces.
   *
   * @param class_id - The class to get interfaces for
   * @returns Array of interface SymbolIds
   *
   * @example
   * ```typescript
   * class Duck implements Flyable, Swimmable { }
   * get_implemented_interfaces(duck_id) → [flyable_id, swimmable_id]
   * ```
   */
  get_implemented_interfaces(class_id: SymbolId): readonly SymbolId[] {
    return this.implemented_interfaces.get(class_id) || [];
  }

  /**
   * Walk the full inheritance chain from most derived to base.
   *
   * Returns array starting with the class itself, followed by parent,
   * grandparent, etc. Handles circular inheritance gracefully (stops at cycle).
   *
   * @param class_id - The class to start from
   * @returns Array of SymbolIds in inheritance chain
   *
   * @example
   * ```typescript
   * class Animal { }
   * class Mammal extends Animal { }
   * class Dog extends Mammal { }
   *
   * walk_inheritance_chain(dog_id) → [dog_id, mammal_id, animal_id]
   * ```
   */
  walk_inheritance_chain(class_id: SymbolId): readonly SymbolId[] {
    const chain: SymbolId[] = [class_id];
    const seen = new Set<SymbolId>([class_id]);
    let current = class_id;

    // Walk up extends chain
    while (true) {
      const parent = this.parent_classes.get(current);
      if (!parent) break;

      // Detect cycles (shouldn't happen in valid code, but be defensive)
      if (seen.has(parent)) {
        console.warn(`Circular inheritance detected: ${class_id} → ${parent}`);
        break;
      }

      chain.push(parent);
      seen.add(parent);
      current = parent;
    }

    return chain;
  }

  /**
   * Get a member (method/property) of a type by name.
   *
   * Walks the inheritance chain to find inherited members.
   *
   * Search order:
   * 1. Direct members of the type
   * 2. Members of parent class (recursively)
   * 3. Members of implemented interfaces
   *
   * @param type_id - The type to look up members in
   * @param member_name - The member name to find
   * @returns SymbolId of the member, or null if not found
   *
   * @example
   * ```typescript
   * class Animal { speak() {} }
   * class Dog extends Animal { bark() {} }
   *
   * get_type_member(dog_id, "bark")  → dog.bark symbol_id
   * get_type_member(dog_id, "speak") → animal.speak symbol_id (inherited)
   * ```
   */
  get_type_member(type_id: SymbolId, member_name: SymbolName): SymbolId | null {
    // Walk inheritance chain from most derived to base
    const chain = this.walk_inheritance_chain(type_id);

    for (const class_id of chain) {
      // Check direct members first
      const members = this.resolved_type_members.get(class_id);
      if (members) {
        const member_id = members.get(member_name);
        if (member_id) {
          return member_id;
        }
      }

      // Check implemented interfaces
      const interfaces = this.implemented_interfaces.get(class_id) || [];
      for (const interface_id of interfaces) {
        const interface_members = this.resolved_type_members.get(interface_id);
        if (interface_members) {
          const member_id = interface_members.get(member_name);
          if (member_id) {
            return member_id;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get a member of a namespace import by name.
   *
   * TODO: Not implemented yet. Requires ImportGraph + ExportRegistry integration.
   *
   * This is a complex operation that requires:
   * 1. Determining the source file for the namespace import
   * 2. Looking up the exported symbol in that file
   * 3. Resolving the symbol in the file's scope
   *
   * @param _namespace_id - The namespace symbol (from import resolution)
   * @param _member_name - The member name to find
   * @returns SymbolId of the member, or null if not found
   */
  get_namespace_member(
    _namespace_id: SymbolId,
    _member_name: SymbolName
  ): SymbolId | null {
    // TODO: Implement namespace member resolution
    // For now, return null - this is a rare edge case
    return null;
  }

  /**
   * Remove all type information from a file.
   *
   * @param file_path - The file to remove
   */
  remove_file(file_path: FilePath): void {
    const contributions = this.by_file.get(file_path);
    if (!contributions) {
      return; // File not in registry
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

    // NEW: Clean up resolved data
    const resolved_symbols = this.resolved_by_file.get(file_path);
    if (resolved_symbols) {
      for (const symbol_id of resolved_symbols) {
        this.symbol_types.delete(symbol_id);
        this.resolved_type_members.delete(symbol_id);
        this.parent_classes.delete(symbol_id);
        this.implemented_interfaces.delete(symbol_id);
      }
      this.resolved_by_file.delete(file_path);
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

    // NEW: Clear resolved data
    this.symbol_types.clear();
    this.resolved_type_members.clear();
    this.parent_classes.clear();
    this.implemented_interfaces.clear();
    this.resolved_by_file.clear();
  }
}

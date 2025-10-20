import type {
  SymbolId,
  FilePath,
  LocationKey,
  SymbolName,
  TypeMemberInfo,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { DefinitionRegistry } from "./definition_registry";
import {
  extract_type_bindings,
  extract_constructor_bindings,
  extract_type_members,
  extract_type_alias_metadata,
} from "../../index_single_file/type_preprocessing";  // TODO: move these to a folder with this module
import { ResolutionRegistry } from "../resolution_registry";

/**
 * Extracted type metadata (transient - not persisted).
 * Used during update_file() to pass data from extraction to resolution.
 */
interface ExtractedTypeData {
  /** Location → type name bindings */
  type_bindings: Map<LocationKey, SymbolName>;
  /** Type → member metadata (with extends/implements as names) */
  type_members: Map<SymbolId, TypeMemberInfo>;
  /** Type alias → expression */
  type_aliases: Map<SymbolId, SymbolName>;
}

/**
 * Track which symbols a file contributed (for removal).
 * Only tracks resolved SymbolIds - no name-based data.
 */
interface FileTypeContributions {
  /** SymbolIds with resolved type information */
  resolved_symbols: Set<SymbolId>;
}

/**
 * Central registry for type information across the project.
 *
 * Stores resolved type relationships using SymbolIds:
 * - Symbol types (variable → type class/interface)
 * - Type members (type → methods/properties)
 * - Inheritance (class → parent class)
 * - Interfaces (class → implemented interfaces)
 *
 * Follows the registry pattern: update_file() extracts and resolves in one operation.
 * All data is resolved using DefinitionRegistry and ResolutionRegistry.
 */
export class TypeRegistry {
  // ===== SymbolId-based resolved storage =====

  /** Maps symbol → type (resolved). e.g., variable → class it's typed as */
  private symbol_types: Map<SymbolId, SymbolId> = new Map();

  /** Maps type → member name → member symbol (resolved) */
  private resolved_type_members: Map<SymbolId, Map<SymbolName, SymbolId>> =
    new Map();

  /** Maps class → parent class (resolved from extends clause) */
  private parent_classes: Map<SymbolId, SymbolId> = new Map();

  /** Maps class → implemented interfaces (resolved from implements/extends) */
  private implemented_interfaces: Map<SymbolId, SymbolId[]> = new Map();

  /** Track which file contributed resolved data (for cleanup) */
  private resolved_by_file: Map<FilePath, FileTypeContributions> = new Map();

  /**
   * Store reference to DefinitionRegistry for get_type_members() lookups.
   * Set during update_file() calls.
   */
  private definitions?: DefinitionRegistry;

  /**
   * Update type information for a file.
   *
   * Two-phase process:
   * 1. Extract type metadata from semantic index (names) - TRANSIENT
   * 2. Resolve type metadata to SymbolIds (using ResolutionRegistry) - PERSISTED
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
    // Store definitions reference for get_type_members()
    this.definitions = definitions;

    // Phase 1: Remove old type data from this file
    this.remove_file(file_path);

    // Phase 2: Extract raw type data (names) - TRANSIENT, not persisted
    const extracted = this.extract_type_data(index);

    // Phase 3: Resolve type metadata (names → SymbolIds) - PERSISTED
    this.resolve_type_metadata(file_path, extracted, definitions, resolutions);
  }

  /**
   * Extract type metadata from semantic index.
   *
   * Returns extracted data WITHOUT persisting it.
   * The data is immediately passed to resolve_type_metadata().
   *
   * @param index - Semantic index with type information
   * @returns Extracted type metadata (transient)
   */
  private extract_type_data(index: SemanticIndex): ExtractedTypeData {
    // Extract type bindings from definitions
    const type_bindings_from_defs = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    // Extract type bindings from constructor calls
    const type_bindings_from_ctors = extract_constructor_bindings(
      index.references
    );

    // Merge type bindings
    const type_bindings = new Map([
      ...type_bindings_from_defs,
      ...type_bindings_from_ctors,
    ]);

    // Extract type members
    const type_members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    // Extract type aliases
    const type_aliases = extract_type_alias_metadata(index.types);

    return {
      type_bindings,
      type_members: new Map(type_members),
      type_aliases: new Map(type_aliases),
    };
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
   * @param extracted - Extracted type data (transient)
   * @param definitions - Definition registry for location/scope lookups
   * @param resolutions - Resolution registry for name → SymbolId lookups
   */
  private resolve_type_metadata(
    file_id: FilePath,
    extracted: ExtractedTypeData,
    definitions: DefinitionRegistry,
    resolutions: ResolutionRegistry
  ): void {
    const resolved_symbols = new Set<SymbolId>();

    // STEP 1: Resolve type bindings (location → type_name → type_id)
    for (const [loc_key, type_name] of extracted.type_bindings) {
      // Get the symbol at this location (the variable/parameter being typed)
      const symbol_id = definitions.get_symbol_at_location(loc_key);
      if (!symbol_id) continue;

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
    for (const [type_id] of extracted.type_members) {
      // Get members directly from DefinitionRegistry (already SymbolIds)
      const member_map = definitions.get_member_index().get(type_id);
      if (member_map && member_map.size > 0) {
        this.resolved_type_members.set(type_id, new Map(member_map));
        resolved_symbols.add(type_id);
      }
    }

    // STEP 3: Resolve inheritance (extends clause)
    for (const [type_id, member_info] of extracted.type_members) {
      if (!member_info.extends || member_info.extends.length === 0) {
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
      this.resolved_by_file.set(file_id, { resolved_symbols });
    }
  }

  /**
   * Get members of a type by its SymbolId.
   *
   * Delegates to DefinitionRegistry for type member metadata.
   *
   * @param type_id - The type SymbolId (class, interface, enum, etc.)
   * @returns TypeMemberInfo with methods, properties, constructor, extends
   */
  get_type_members(type_id: SymbolId): TypeMemberInfo | undefined {
    if (!this.definitions) {
      return undefined;
    }

    // Get the definition for this type
    const def = this.definitions.get(type_id);
    if (!def) return undefined;

    // Build TypeMemberInfo from definition
    if (def.kind === "class") {
      // Use the constructor field from ClassDefinition (language-agnostic)
      const constructor_symbol_id = def.constructor?.[0]?.symbol_id;

      return {
        methods: new Map(
          def.methods.map((m) => [m.name as SymbolName, m.symbol_id])
        ),
        properties: new Map(
          def.properties.map((p) => [p.name as SymbolName, p.symbol_id])
        ),
        constructor: constructor_symbol_id,
        extends: def.extends ? def.extends : [],
      };
    } else if (def.kind === "interface") {
      return {
        methods: new Map(
          def.methods.map((m) => [m.name as SymbolName, m.symbol_id])
        ),
        properties: new Map(
          def.properties.map((p) => [p.name as SymbolName, p.symbol_id])
        ),
        constructor: undefined,
        extends: def.extends ? def.extends : [],
      };
    } else if (def.kind === "enum") {
      // For enums, get members from the member index
      const member_map = this.definitions.get_member_index().get(type_id);
      return {
        methods: new Map(),
        properties: member_map || new Map(),
        constructor: undefined,
        extends: [],
      };
    }

    return undefined;
  }

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
    const contributions = this.resolved_by_file.get(file_path);
    if (!contributions) {
      return; // File not in registry
    }

    // Clean up resolved data
    for (const symbol_id of contributions.resolved_symbols) {
      this.symbol_types.delete(symbol_id);
      this.resolved_type_members.delete(symbol_id);
      this.parent_classes.delete(symbol_id);
      this.implemented_interfaces.delete(symbol_id);
    }

    // Remove file tracking
    this.resolved_by_file.delete(file_path);
  }

  /**
   * Get the total number of resolved symbols.
   *
   * @returns Count of symbols with resolved type information
   */
  size(): number {
    return this.symbol_types.size;
  }

  /**
   * Clear all type information from the registry.
   */
  clear(): void {
    this.symbol_types.clear();
    this.resolved_type_members.clear();
    this.parent_classes.clear();
    this.implemented_interfaces.clear();
    this.resolved_by_file.clear();
  }
}

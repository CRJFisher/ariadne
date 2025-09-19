/**
 * Type Resolution - Core interfaces for Phase 3 of symbol resolution
 *
 * This module handles all cross-file type resolution after imports
 * and function calls have been resolved in Phases 1 and 2.
 */

import type {
  TypeId,
  SymbolId,
  Location,
  FilePath,
  SymbolName,
  ScopeId,
} from "@ariadnejs/types";

/**
 * Input to type resolution - local type info from semantic_index
 */
export interface LocalTypeExtraction {
  // Type definitions found in each file
  readonly type_definitions: Map<FilePath, LocalTypeDefinition[]>;

  // Type annotations found in each file
  readonly type_annotations: Map<FilePath, LocalTypeAnnotation[]>;

  // Assignment flows found in each file
  readonly type_flows: Map<FilePath, LocalTypeFlow[]>;
}

/**
 * A type definition extracted from a single file
 */
export interface LocalTypeDefinition {
  readonly name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly location: Location;
  readonly file_path: FilePath;

  // Direct members only - no inheritance
  readonly direct_members: Map<SymbolName, LocalMemberInfo>;

  // Names only - not resolved
  readonly extends_names?: SymbolName[];
  readonly implements_names?: SymbolName[];
}

/**
 * A type annotation found in code (unresolved)
 */
export interface LocalTypeAnnotation {
  readonly location: Location;
  readonly annotation_text: string;  // Raw text like "Foo<Bar>"
  readonly annotation_kind: "variable" | "parameter" | "return" | "property";
  readonly scope_id: ScopeId;
}

/**
 * An assignment or type flow (unresolved)
 */
export interface LocalTypeFlow {
  readonly source_location: Location;
  readonly target_location: Location;
  readonly flow_kind: "assignment" | "return" | "parameter";
  readonly scope_id: ScopeId;
}

/**
 * Output of type resolution - fully resolved types
 */
export interface ResolvedTypes {
  // Global type registry with TypeIds
  readonly type_registry: GlobalTypeRegistry;

  // Symbol to type mappings
  readonly symbol_types: Map<SymbolId, TypeId>;

  // Location to type mappings
  readonly location_types: Map<Location, TypeId>;

  // Type inheritance hierarchy
  readonly type_hierarchy: TypeHierarchyGraph;

  // Constructor mappings
  readonly constructors: Map<TypeId, SymbolId>;
}

/**
 * Global registry of all types across files
 */
export interface GlobalTypeRegistry {
  readonly types: Map<TypeId, ResolvedTypeDefinition>;
  readonly type_names: Map<FilePath, Map<SymbolName, TypeId>>;
}

/**
 * Fully resolved type with all members including inherited
 */
export interface ResolvedTypeDefinition {
  readonly type_id: TypeId;
  readonly name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly definition_location: Location;
  readonly file_path: FilePath;

  // All members including inherited
  readonly all_members: Map<SymbolName, ResolvedMemberInfo>;

  // Resolved TypeIds
  readonly base_types: TypeId[];
  readonly derived_types: TypeId[];
}

/**
 * Type hierarchy relationships
 */
export interface TypeHierarchyGraph {
  // Direct relationships
  readonly extends_map: Map<TypeId, TypeId[]>;
  readonly implements_map: Map<TypeId, TypeId[]>;

  // Transitive closures (pre-computed for efficiency)
  readonly all_ancestors: Map<TypeId, Set<TypeId>>;
  readonly all_descendants: Map<TypeId, Set<TypeId>>;
}

/**
 * Information about a type member (local extraction)
 */
export interface LocalMemberInfo {
  readonly name: SymbolName;
  readonly kind: "method" | "property" | "getter" | "setter" | "field";
  readonly location: Location;
  readonly is_static?: boolean;
  readonly is_optional?: boolean;
  readonly type_annotation?: string; // Raw type string if present
}

/**
 * Information about a type member (after resolution)
 */
export interface ResolvedMemberInfo {
  readonly symbol_id: SymbolId;
  readonly name: SymbolName;
  readonly kind: "method" | "property" | "getter" | "setter" | "field";
  readonly location: Location;
  readonly is_static?: boolean;
  readonly is_optional?: boolean;
  readonly type_id?: TypeId; // Resolved type if available
  readonly inherited_from?: TypeId; // If inherited, which type it came from
}
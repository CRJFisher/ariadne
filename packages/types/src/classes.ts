import { Location } from "./common";
import { FilePath, QualifiedName, TypeString } from "./aliases";
import { SymbolId } from "./symbol";

/**
 * Enhanced ClassNode with computed fields for hierarchy processing
 *
 * Combines the best of shared types (immutability, type-safe collections)
 * with valuable functionality from local types (computed relationships, MRO)
 */
export interface ClassNode {
  // Core identification
  readonly symbol: SymbolId;
  readonly file_path: FilePath;
  readonly location: Location;

  // Direct relationships
  readonly base_classes: readonly SymbolId[];
  readonly derived_classes: readonly SymbolId[];
  readonly interfaces: readonly SymbolId[]; // Always present, defaults to empty array

  // Type characteristics
  readonly is_abstract: boolean;
  readonly is_interface: boolean;
  readonly is_trait: boolean;
  readonly is_mixin: boolean; // Added for Python mixins

  // Members
  readonly methods: ReadonlyMap<SymbolId, MethodNode>;
  readonly properties: ReadonlyMap<SymbolId, PropertyNode>;

  // Enhanced computed fields from local types
  readonly all_ancestors: readonly ClassNode[]; // Complete inheritance chain, defaults to empty
  readonly all_descendants: readonly ClassNode[]; // All derived classes, defaults to empty
  readonly method_resolution_order: readonly ClassNode[]; // MRO for method lookup, defaults to empty

  // Resolution tracking
  readonly parent_class: ClassNode | null; // Direct parent reference (explicit null for no parent)
  readonly interface_nodes: readonly ClassNode[]; // Resolved interface nodes, defaults to empty
}

export interface MethodNode {
  readonly symbol: SymbolId;
  readonly location: Location;
  readonly is_override: boolean;
  readonly overrides?: SymbolId;
  readonly overridden_by: readonly SymbolId[];
  readonly visibility: "public" | "private" | "protected";
  readonly is_static: boolean;
  readonly is_abstract: boolean;
}

export interface PropertyNode {
  readonly name: SymbolId;
  readonly location: Location;
  readonly type?: TypeString;
  readonly visibility: "public" | "private" | "protected";
  readonly is_static: boolean;
  readonly is_readonly: boolean;
}

/**
 * Enhanced InheritanceEdge with richer relationship types
 */
export interface InheritanceEdge {
  readonly from: SymbolId;
  readonly to: SymbolId;
  readonly type: "extends" | "implements" | "trait" | "mixin"; // Added trait and mixin
  readonly source_location?: Location; // Where the inheritance is declared
}

export interface ClassHierarchy {
  readonly classes: ReadonlyMap<SymbolId, ClassNode>;
  readonly inheritance_edges: readonly InheritanceEdge[];
  readonly root_classes: ReadonlySet<SymbolId>;
  readonly interface_implementations?: ReadonlyMap<
    SymbolId,
    ReadonlySet<SymbolId>
  >;
  readonly method_overrides?: ReadonlyMap<SymbolId, ReadonlySet<SymbolId>>;

  // Lookup maps for efficient access patterns needed by resolvers
  readonly classes_by_location?: ReadonlyMap<FilePath, ReadonlyMap<number, SymbolId>>; // file_path -> line_number -> class_symbol
  readonly classes_in_file?: ReadonlyMap<FilePath, ReadonlySet<SymbolId>>; // file_path -> set of class_symbols
}

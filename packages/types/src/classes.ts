import { Location } from "./common";
import {
  ClassName,
  FilePath,
  MethodName,
  PropertyName,
  QualifiedName,
  InterfaceName,
} from "./aliases";
import { SymbolId } from "./symbols";

/**
 * Enhanced ClassNode with computed fields for hierarchy processing
 *
 * Combines the best of shared types (immutability, type-safe collections)
 * with valuable functionality from local types (computed relationships, MRO)
 */
export interface ClassNode {
  // Core identification
  readonly name: ClassName;
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
  readonly all_ancestors?: readonly ClassNode[]; // Complete inheritance chain
  readonly all_descendants?: readonly ClassNode[]; // All derived classes
  readonly method_resolution_order?: readonly ClassNode[]; // MRO for method lookup

  // Resolution tracking
  readonly parent_class?: ClassNode; // Direct parent reference (resolved)
  readonly interface_nodes?: readonly ClassNode[]; // Resolved interface nodes
}

export interface MethodNode {
  readonly name: MethodName;
  readonly location: Location;
  readonly is_override: boolean;
  readonly overrides?: QualifiedName;
  readonly overridden_by: readonly QualifiedName[];
  readonly visibility: "public" | "private" | "protected";
  readonly is_static: boolean;
  readonly is_abstract: boolean;
}

export interface PropertyNode {
  readonly name: PropertyName;
  readonly location: Location;
  readonly type?: string;
  readonly visibility: "public" | "private" | "protected";
  readonly is_static: boolean;
  readonly is_readonly: boolean;
}

/**
 * Enhanced InheritanceEdge with richer relationship types
 */
export interface InheritanceEdge {
  readonly from: QualifiedName;
  readonly to: QualifiedName;
  readonly type: "extends" | "implements" | "trait" | "mixin"; // Added trait and mixin
  readonly source_location?: Location; // Where the inheritance is declared
}

export interface ClassHierarchy {
  readonly classes: ReadonlyMap<QualifiedName, ClassNode>;
  readonly inheritance_edges: readonly InheritanceEdge[];
  readonly root_classes: ReadonlySet<SymbolId>;
  readonly interface_implementations?: ReadonlyMap<
    SymbolId,
    ReadonlySet<SymbolId>
  >;

  // Enhanced fields from local types
  readonly metadata?: {
    readonly build_time?: number;
    readonly total_classes?: number;
    readonly max_depth?: number;
  };
}

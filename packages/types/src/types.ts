import { Location } from "./common";
import {
  TypeName,
  FilePath,
  VariableName,
  TypeString,
  PropertyName,
  MethodName,
  QualifiedName,
} from "./aliases";
import { SymbolId } from "./symbol_utils";
import { Language, ScopeType } from "./index";
import { TypeMember } from "./type_analysis";

export enum TypeKind {
  CLASS = "class",
  INTERFACE = "interface",
  TYPE = "type",
  ENUM = "enum",
  TRAIT = "trait",
  PRIMITIVE = "primitive",
  ARRAY = "array",
  FUNCTION = "function",
  OBJECT = "object",
  UNKNOWN = "unknown",
}

export interface TypeDefinition {
  readonly name: TypeName;
  readonly location: Location;
  readonly kind: TypeKind;
  readonly type_parameters?: readonly SymbolId[];
  readonly members?: ReadonlyMap<SymbolId, TypeMember>;
  readonly extends?: readonly SymbolId[];
  readonly implements?: readonly SymbolId[];
}


export interface VariableType {
  readonly name: VariableName;
  readonly type: TypeString; // Defaults to "unknown" when type unavailable
  readonly inferred_type: TypeString; // Defaults to "unknown" when not inferred
  readonly location: Location;
  readonly scope_kind: ScopeType;
  readonly is_reassigned: boolean;
}

export interface TypeEdge {
  readonly from: TypeName;
  readonly to: TypeName;
  readonly kind: "extends" | "implements" | "uses" | "returns";
  readonly location: Location; // Always present with source location
}

export interface TypeGraph {
  readonly nodes: ReadonlyMap<SymbolId, TypeDefinition>;
  readonly edges: readonly TypeEdge[];
}

export interface TypeIndex {
  readonly types: ReadonlyMap<SymbolId, TypeDefinition>;
  readonly variables: ReadonlyMap<QualifiedName, VariableType>;
  readonly type_graph?: TypeGraph;
}

// ============================================================================
// Type Tracking and Inference Types
// ============================================================================

/**
 * Type information for a variable at a specific position
 */
export interface TypeInfo {
  readonly type_name: TypeName; // The type name (e.g., "string", "MyClass")
  readonly type_kind: TypeKind;
  readonly location: Location;
  readonly confidence: "explicit" | "inferred" | "assumed";
  readonly source?:
    | "annotation"
    | "assignment"
    | "constructor"
    | "return"
    | "parameter";
}


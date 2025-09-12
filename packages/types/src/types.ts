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
import { SymbolId } from "./symbols";
import { Language, ScopeType } from "./index";

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
  readonly type_parameters?: readonly TypeName[];
  readonly members?: ReadonlyMap<SymbolId, TypeMember>;
  readonly extends?: readonly TypeName[];
  readonly implements?: readonly TypeName[];
}

export interface TypeMember {
  readonly name: PropertyName | MethodName;
  readonly type?: TypeString;
  readonly kind: "property" | "method" | "constructor";
  readonly is_optional: boolean;
  readonly is_readonly: boolean;
}

export interface VariableType {
  readonly name: VariableName;
  readonly type?: TypeString;
  readonly inferred_type?: TypeString;
  readonly location: Location;
  readonly scope_kind: ScopeType;
  readonly is_reassigned: boolean;
}

export interface TypeEdge {
  readonly from: TypeName;
  readonly to: TypeName;
  readonly kind: "extends" | "implements" | "uses" | "returns";
  readonly location?: Location;
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

/**
 * @deprecated Use ImportedTypeInfo from './import_export' instead
 * This type is preserved for backward compatibility but will be removed in the next major version.
 * The new ImportedTypeInfo in import_export.ts provides better type categorization.
 *
 * Information about an imported class/type
 */
export interface ImportedClassInfo {
  readonly class_name: string;
  readonly source_module: string;
  readonly local_name: string;
  readonly is_default?: boolean;
  readonly is_type_only?: boolean; // TypeScript type-only import
}

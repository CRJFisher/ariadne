import { Location } from './common';
import { TypeName, FilePath, VariableName, TypeString, PropertyName, MethodName, QualifiedName } from './aliases';
import { Language } from './index';

export interface TypeDefinition {
  readonly name: TypeName;
  readonly file_path: FilePath;
  readonly location: Location;
  readonly kind: 'class' | 'interface' | 'type' | 'enum' | 'trait';
  readonly type_parameters?: readonly TypeName[];
  readonly members?: ReadonlyMap<PropertyName | MethodName, TypeMember>;
  readonly extends?: readonly TypeName[];
  readonly implements?: readonly TypeName[];
}

export interface TypeMember {
  readonly name: PropertyName | MethodName;
  readonly type?: TypeString;
  readonly kind: 'property' | 'method' | 'constructor';
  readonly is_optional?: boolean;
  readonly is_readonly?: boolean;
}

export interface VariableType {
  readonly name: VariableName;
  readonly type?: TypeString;
  readonly inferred_type?: TypeString;
  readonly location: Location;
  readonly scope: 'global' | 'module' | 'function' | 'block';
  readonly is_reassigned?: boolean;
}

export interface TypeEdge {
  readonly from: TypeName;
  readonly to: TypeName;
  readonly kind: 'extends' | 'implements' | 'uses' | 'returns';
  readonly location?: Location;
}

export interface TypeGraph {
  readonly nodes: ReadonlyMap<TypeName, TypeDefinition>;
  readonly edges: readonly TypeEdge[];
}

export interface TypeIndex {
  readonly types: ReadonlyMap<TypeName, TypeDefinition>;
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
  readonly type_name: string;           // The type name (e.g., "string", "MyClass")
  readonly type_kind: 'primitive' | 'class' | 'interface' | 'function' | 'object' | 'array' | 'unknown';
  readonly position: {
    readonly row: number;
    readonly column: number;
  };
  readonly confidence: 'explicit' | 'inferred' | 'assumed';
  readonly source?: 'annotation' | 'assignment' | 'constructor' | 'return' | 'parameter';
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
  readonly is_type_only?: boolean;  // TypeScript type-only import
}
import { Location } from './common';
import { TypeName, FilePath, VariableName, TypeString, PropertyName, MethodName, QualifiedName } from './aliases';

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
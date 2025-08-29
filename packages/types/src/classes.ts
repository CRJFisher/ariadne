import { Location } from './common';
import { ClassName, FilePath, MethodName, PropertyName, QualifiedName, InterfaceName } from './aliases';

export interface ClassNode {
  readonly name: ClassName;
  readonly file_path: FilePath;
  readonly location: Location;
  readonly base_classes: readonly ClassName[];
  readonly derived_classes: readonly ClassName[];
  readonly interfaces?: readonly InterfaceName[];
  readonly is_abstract?: boolean;
  readonly is_interface?: boolean;
  readonly is_trait?: boolean;
  readonly methods: ReadonlyMap<MethodName, MethodNode>;
  readonly properties: ReadonlyMap<PropertyName, PropertyNode>;
}

export interface MethodNode {
  readonly name: MethodName;
  readonly location: Location;
  readonly is_override: boolean;
  readonly overrides?: QualifiedName;
  readonly overridden_by: readonly QualifiedName[];
  readonly visibility?: 'public' | 'private' | 'protected';
  readonly is_static?: boolean;
  readonly is_abstract?: boolean;
}

export interface PropertyNode {
  readonly name: PropertyName;
  readonly location: Location;
  readonly type?: string;
  readonly visibility?: 'public' | 'private' | 'protected';
  readonly is_static?: boolean;
  readonly is_readonly?: boolean;
}

export interface InheritanceEdge {
  readonly from: QualifiedName;
  readonly to: QualifiedName;
  readonly type: 'extends' | 'implements';
}

export interface ClassHierarchy {
  readonly classes: ReadonlyMap<QualifiedName, ClassNode>;
  readonly inheritance_edges: readonly InheritanceEdge[];
  readonly root_classes: ReadonlySet<ClassName>;
  readonly interface_implementations?: ReadonlyMap<InterfaceName, ReadonlySet<ClassName>>;
}
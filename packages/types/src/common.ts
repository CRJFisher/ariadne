import { ParameterName, TypeString, FilePath, FunctionName, ClassName, MethodName, PropertyName, DocString, DecoratorName } from './aliases';

// Language type
export type Language = "javascript" | "typescript" | "python" | "rust";

export interface Location {
  readonly file_path?: FilePath;
  readonly line: number;
  readonly column: number;
  readonly end_line?: number;
  readonly end_column?: number;
}

/**
 * Function signature information
 */
export interface FunctionSignature {
  readonly parameters: readonly ParameterType[];
  readonly return_type?: TypeString;
  readonly type_parameters?: readonly TypeParameter[];
  readonly is_async?: boolean;
  readonly is_generator?: boolean;
}

export interface ParameterType {
  readonly name: ParameterName;
  readonly type?: TypeString;
  readonly default_value?: string;
  readonly is_rest?: boolean;
  readonly is_optional?: boolean;
}

export interface TypeParameter {
  readonly name: string;
  readonly constraint?: TypeString;
  readonly default?: TypeString;
}

/**
 * Common metadata for functions
 */
export interface FunctionMetadata {
  readonly is_async?: boolean;
  readonly is_generator?: boolean;
  readonly is_exported?: boolean;
  readonly is_test?: boolean;
  readonly is_private?: boolean;
  readonly complexity?: number;
  readonly line_count: number;
  readonly parameter_names?: readonly ParameterName[];
  readonly has_decorator?: boolean;
  readonly class_name?: ClassName;
}

/**
 * Base information for functions
 */
export interface FunctionInfo {
  readonly name: FunctionName;
  readonly location: Location;
  readonly signature: FunctionSignature;
  readonly metadata?: FunctionMetadata;
  readonly docstring?: DocString;
  readonly decorators?: readonly DecoratorName[];
}

/**
 * Base information for classes
 */
export interface ClassInfo {
  readonly name: ClassName;
  readonly location: Location;
  readonly base_classes?: readonly ClassName[];
  readonly interfaces?: readonly string[];
  readonly is_abstract?: boolean;
  readonly is_exported?: boolean;
  readonly docstring?: DocString;
  readonly decorators?: readonly DecoratorName[];
  readonly methods: readonly MethodInfo[];
  readonly properties: readonly PropertyInfo[];
}

export interface MethodInfo {
  readonly name: MethodName;
  readonly location: Location;
  readonly signature: FunctionSignature;
  readonly visibility?: 'public' | 'private' | 'protected';
  readonly is_static?: boolean;
  readonly is_abstract?: boolean;
  readonly is_override?: boolean;
  readonly docstring?: DocString;
  readonly decorators?: readonly DecoratorName[];
}

export interface PropertyInfo {
  readonly name: PropertyName;
  readonly location: Location;
  readonly type?: TypeString;
  readonly visibility?: 'public' | 'private' | 'protected';
  readonly is_static?: boolean;
  readonly is_readonly?: boolean;
  readonly default_value?: string;
}
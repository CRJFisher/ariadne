import {
  ParameterName,
  TypeString,
  FilePath,
  FunctionName,
  ClassName,
  MethodName,
  PropertyName,
  DocString,
  DecoratorName,
} from "./aliases";

// Language type
export type Language = "javascript" | "typescript" | "python" | "rust";

export interface Location {
  readonly file_path: FilePath;
  readonly line: number;
  readonly column: number;
  readonly end_line: number;
  readonly end_column: number;
}

export function location_contains(
  location: Location,
  other_location: Location
): boolean {
  return (
    location.file_path === other_location.file_path &&
    location.line <= other_location.line &&
    location.column <= other_location.column &&
    location.end_line >= other_location.end_line &&
    location.end_column >= other_location.end_column
  );
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
 * Enhanced with fields from FunctionDefinition for consolidation
 */
export interface FunctionInfo {
  readonly name: FunctionName;
  readonly location: Location;
  readonly signature: FunctionSignature;
  readonly metadata?: FunctionMetadata;
  readonly docstring?: DocString;
  readonly decorators?: readonly DecoratorName[];
  // Additional fields from FunctionDefinition
  readonly is_exported?: boolean;
  readonly is_arrow_function?: boolean; // For JS/TS
  readonly is_anonymous?: boolean;
  readonly closure_captures?: readonly string[]; // Variables from outer scope
}


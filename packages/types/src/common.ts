import {
  ParameterName,
  TypeString,
  FilePath,
} from "./aliases";
import { SymbolId } from "./symbol_utils";

// Language type
export type Language = "javascript" | "typescript" | "python" | "rust";

export interface Location {
  readonly file_path: FilePath;
  readonly line: number;
  readonly column: number;
  readonly end_line: number;
  readonly end_column: number;
}

/**
 * Creates a default location for cases where actual location is unknown
 */
export function unknown_location(file_path: FilePath): Location {
  return {
    file_path,
    line: 0,
    column: 0,
    end_line: 0,
    end_column: 0
  };
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
  readonly return_type: TypeString; // Required - use "unknown" when type cannot be inferred
  readonly type_parameters: readonly TypeParameter[]; // Always present, defaults to empty array
  readonly is_async: boolean;
  readonly is_generator: boolean;
}

export interface ParameterType {
  readonly name: ParameterName;
  readonly type: TypeString; // Required - use "unknown" when type cannot be inferred
  readonly default_value: string; // Defaults to empty string when no default
  readonly is_rest: boolean;
  readonly is_optional: boolean;
}

export interface TypeParameter {
  readonly name: SymbolId;
  readonly constraint: TypeString; // Defaults to "unknown" when no constraint
  readonly default: TypeString; // Defaults to "unknown" when no default
}


import { FilePath } from "./aliases";

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
 * Check if a scope's location contains the given location
 */
export function location_contains(
  reference_location: Location,
  target: Location
): boolean {
  // Check if target is within the bounds of scope_location
  // Check line boundaries first
  if (
    target.line < reference_location.line ||
    target.line > reference_location.end_line
  ) {
    return false;
  }

  // If on the start line, check column is after start
  if (
    target.line === reference_location.line &&
    target.column < reference_location.column
  ) {
    return false;
  }

  // If on the end line, check column is before end
  if (
    target.line === reference_location.end_line &&
    target.column > reference_location.end_column
  ) {
    return false;
  }

  return true;
}

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
// File and module identifiers
export type FilePath = string & { __brand: "FilePath" }; // Absolute or relative file path

/**
 * Branded type for location-based keys used in maps
 * Format: "file_path:line:column:end_line:end_column"
 */
export type LocationKey = string & { __brand: "LocationKey" };

/**
 * Convert a Location to a unique string key for map lookups
 * Includes all location fields to ensure uniqueness
 */
export function location_key(location: Location): LocationKey {
  return `${location.file_path}:${location.line}:${location.column}:${location.end_line}:${location.end_column}` as LocationKey;
}

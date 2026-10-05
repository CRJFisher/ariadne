export type Language = "javascript" | "typescript" | "python" | "rust";

export interface Location {
  readonly file_path: FilePath;
  readonly start_line: number;
  readonly start_column: number;
  readonly end_line: number;
  readonly end_column: number;
}
// File and module identifiers
// eslint-disable-next-line @typescript-eslint/naming-convention
export type FilePath = string & { __brand: "FilePath" }; // Absolute or relative file path

/**
 * Branded type for location-based keys used in maps
 * Format: "file_path:line:column:end_line:end_column"
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export type LocationKey = string & { __brand: "LocationKey" };

/**
 * Convert a Location to a unique string key for map lookups
 * Includes all location fields to ensure uniqueness
 */
export function location_key(location: Location): LocationKey {
  return `${location.file_path}:${location.start_line}:${location.start_column}:${location.end_line}:${location.end_column}` as LocationKey;
}

export function parse_location_key(key: LocationKey): Location {
  const parts = key.split(":");
  return {
    file_path: parts[0] as FilePath,
    start_line: parseInt(parts[1], 10),
    start_column: parseInt(parts[2], 10),
    end_line: parseInt(parts[3], 10),
    end_column: parseInt(parts[4], 10),
  };
}

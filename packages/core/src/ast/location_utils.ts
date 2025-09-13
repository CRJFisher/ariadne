/**
 * Location format utilities for handling different location representations
 * across different parsing contexts and sources.
 */

// Location format variants for parsing different sources
export type StandardLocation = {
  readonly line: number;
  readonly column: number;
};

export type RangeLocation = {
  readonly start: { readonly row: number; readonly column: number };
  readonly end: { readonly row: number; readonly column: number };
};

export type RowLocation = {
  readonly row: number;
  readonly column: number;
};

export type AnyLocationFormat = StandardLocation | RangeLocation | RowLocation;

// Type guards for location formats
export function isStandardLocation(location: AnyLocationFormat): location is StandardLocation {
  return 'line' in location && typeof location.line === 'number';
}

export function isRangeLocation(location: AnyLocationFormat): location is RangeLocation {
  return 'start' in location && typeof location.start === 'object';
}

export function isRowLocation(location: AnyLocationFormat): location is RowLocation {
  return 'row' in location && typeof location.row === 'number';
}

/**
 * Extract target row and column from any location format
 * Returns 0-based coordinates suitable for tree-sitter
 */
export function extractTargetPosition(location: AnyLocationFormat): { row: number; column: number } | null {
  if (isStandardLocation(location)) {
    // Format: { line: number, column: number } - convert to 0-based
    return {
      row: location.line - 1,
      column: location.column - 1
    };
  } else if (isRangeLocation(location)) {
    // Format: { start: { row, column }, end: { row, column } } - already 0-based
    return {
      row: location.start.row,
      column: location.start.column
    };
  } else if (isRowLocation(location)) {
    // Format: { row: number, column: number } - already 0-based
    return {
      row: location.row,
      column: location.column
    };
  }
  
  return null;
}
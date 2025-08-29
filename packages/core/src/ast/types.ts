/**
 * Internal tree-sitter types for AST processing.
 * 
 * IMPORTANT: Point/Range vs Location
 * 
 * We maintain two coordinate systems:
 * 
 * 1. Point/Range (this file) - Tree-sitter's internal coordinate system
 *    - Uses 0-indexed row/column
 *    - Required for tree-sitter API compatibility
 *    - Used internally for AST node positions and parsing
 *    - Never exposed in public API
 * 
 * 2. Location (@ariadnejs/types) - Our public API coordinate system
 *    - Uses 1-indexed line/column (standard editor convention)
 *    - Includes file_path for cross-file references
 *    - What consumers of our API see and use
 * 
 * WHY BOTH EXIST:
 * - Tree-sitter requires Point/Range for its internal operations
 * - Users expect 1-indexed line numbers (matches editors, error messages)
 * - We convert between them at the API boundary
 * - Keeps implementation details (tree-sitter) separate from public API
 * 
 * CONVERSION:
 * - Point to Location: row+1 → line, column → column, add file_path
 * - Location to Point: line-1 → row, column → column
 */

/**
 * Tree-sitter point type (0-indexed row/column)
 * Internal use only - not part of public API
 */
export interface Point {
  readonly row: number;    // 0-indexed (tree-sitter convention)
  readonly column: number; // 0-indexed
}

/**
 * Tree-sitter range type
 * Internal use only - not part of public API
 */
export interface Range {
  readonly start: Point;
  readonly end: Point;
}

/**
 * Tree-sitter edit type for incremental parsing
 */
export interface Edit {
  readonly start_byte: number;
  readonly old_end_byte: number;
  readonly new_end_byte: number;
  readonly start_position: Point;
  readonly old_end_position: Point;
  readonly new_end_position: Point;
}

/**
 * Mutable versions for internal tree-sitter operations
 */
export interface MutablePoint {
  row: number;
  column: number;
}

export interface MutableRange {
  start: MutablePoint;
  end: MutablePoint;
}

export interface MutableEdit {
  start_byte: number;
  old_end_byte: number;
  new_end_byte: number;
  start_position: MutablePoint;
  old_end_position: MutablePoint;
  new_end_position: MutablePoint;
}
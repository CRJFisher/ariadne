
/**
 * Position in source code with row and column
 */
export interface Point {
  readonly row: number;
  readonly column: number;
}

/**
 * Range in source code with start and end positions
 */
export interface Range {
  readonly start: Point;
  readonly end: Point;
}

/**
 * Mutable range for incremental updates
 */
export interface MutableRange {
  start: Point;
  end: Point;
}

/**
 * Tree-sitter edit type for incremental parsing
 */
export interface Edit {
  readonly start_byte: number;
  readonly old_end_byte: number;
  readonly new_end_byte: number;
  readonly start_position: Location;
  readonly old_end_position: Location;
  readonly new_end_position: Location;
}

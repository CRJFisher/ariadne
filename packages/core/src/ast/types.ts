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

import { Point, Edit } from '@ariadnejs/types';

// Re-export Edit for backward compatibility
export { Edit } from '@ariadnejs/types';

/**
 * Creates an Edit object from a text change
 * @param old_text - The original text
 * @param new_text - The new text
 * @param start_byte - The byte offset where the change starts
 * @param start_position - The position where the change starts
 */
export function create_edit(
  old_text: string,
  new_text: string,
  start_byte: number,
  start_position: Point,
  old_length: number,
  new_length: number,
  old_end_position: Point,
  new_end_position: Point
): Edit {
  return {
    start_byte,
    old_end_byte: start_byte + old_length,
    new_end_byte: start_byte + new_length,
    start_position,
    old_end_position,
    new_end_position,
  };
}

/**
 * Calculates the position after applying text of given length
 * @param start_position - Starting position
 * @param text - Text to measure
 * @returns End position after the text
 */
export function calculate_end_position(start_position: Point, text: string): Point {
  let row = start_position.row;
  let column = start_position.column;
  
  for (const char of text) {
    if (char === '\n') {
      row++;
      column = 0;
    } else {
      column++;
    }
  }
  
  return { row, column };
}
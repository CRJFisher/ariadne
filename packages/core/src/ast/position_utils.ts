/**
 * Position and range utility functions
 *
 * Provides helpers for working with positions and ranges in source code
 */

import { MutableRange, Point, Range } from "./types";

/**
 * Compare two points
 * Returns: -1 if p1 < p2, 0 if equal, 1 if p1 > p2
 */
export function compare_points(p1: Point, p2: Point): number {
  if (p1.row < p2.row) return -1;
  if (p1.row > p2.row) return 1;
  if (p1.column < p2.column) return -1;
  if (p1.column > p2.column) return 1;
  return 0;
}

/**
 * Check if a range contains a point
 */
export function range_contains_point(range: Range, point: Point): boolean {
  const startCmp = compare_points(point, range.start);
  const endCmp = compare_points(point, range.end);

  return startCmp >= 0 && endCmp <= 0;
}

/**
 * Check if range1 contains range2
 */
export function range_contains_range(range1: Range, range2: Range): boolean {
  return (
    range_contains_point(range1, range2.start) &&
    range_contains_point(range1, range2.end)
  );
}

/**
 * Get the intersection of two ranges
 */
export function range_intersection(range1: Range, range2: Range): Range | null {
  const start =
    compare_points(range1.start, range2.start) > 0
      ? range1.start
      : range2.start;
  const end =
    compare_points(range1.end, range2.end) < 0 ? range1.end : range2.end;

  // Check if there's actually an intersection
  if (compare_points(start, end) > 0) {
    return null;
  }

  return { start, end };
}

/**
 * Merge overlapping or adjacent ranges
 */
export function merge_ranges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];

  // Sort ranges by start position
  const sorted = [...ranges].sort((a, b) => compare_points(a.start, b.start));

  const merged: MutableRange[] = [{
    start: { ...sorted[0].start },
    end: { ...sorted[0].end }
  }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // Check if ranges overlap or are adjacent
    if (compare_points(current.start, last.end) <= 0) {
      // Merge ranges
      last.end =
        compare_points(current.end, last.end) > 0 ? { ...current.end } : last.end;
    } else {
      // Add as separate range
      merged.push({
        start: { ...current.start },
        end: { ...current.end }
      });
    }
  }

  return merged;
}

/**
 * Calculate the distance between two points (in lines)
 */
export function point_distance(p1: Point, p2: Point): number {
  return Math.abs(p2.row - p1.row);
}

/**
 * Create a range from two points
 */
export function create_range(start: Point, end: Point): Range {
  // Ensure start is before end
  if (compare_points(start, end) > 0) {
    return { start: end, end: start };
  }
  return { start, end };
}

/**
 * Expand a range by n lines in each direction
 */
export function expand_range(range: Range, lines: number): Range {
  return {
    start: {
      row: Math.max(0, range.start.row - lines),
      column: lines > 0 ? 0 : range.start.column,
    },
    end: {
      row: range.end.row + lines,
      column: lines > 0 ? Number.MAX_SAFE_INTEGER : range.end.column,
    },
  };
}

/**
 * Get the size of a range (number of lines)
 */
export function range_size(range: Range): number {
  return range.end.row - range.start.row + 1;
}

/**
 * Convert byte offset to point in source
 */
export function offset_to_point(source: string, offset: number): Point {
  const lines = source.split("\n");
  let currentOffset = 0;

  for (let row = 0; row < lines.length; row++) {
    const lineLength = lines[row].length + 1; // +1 for newline

    if (currentOffset + lineLength > offset) {
      return {
        row,
        column: offset - currentOffset,
      };
    }

    currentOffset += lineLength;
  }

  // Offset is beyond end of source
  return {
    row: lines.length - 1,
    column: lines[lines.length - 1].length,
  };
}

/**
 * Convert point to byte offset in source
 */
export function point_to_offset(source: string, point: Point): number {
  const lines = source.split("\n");
  let offset = 0;

  for (let row = 0; row < point.row && row < lines.length; row++) {
    offset += lines[row].length + 1; // +1 for newline
  }

  if (point.row < lines.length) {
    offset += Math.min(point.column, lines[point.row].length);
  }

  return offset;
}

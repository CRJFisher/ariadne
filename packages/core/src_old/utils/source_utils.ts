/**
 * Source code extraction utilities
 * 
 * These utilities handle extracting source code from cached files.
 * Extracted from the defunct QueryService.
 */

import { SimpleRange } from '../graph';

/**
 * File cache interface containing parsed tree and source code
 */
interface FileCache {
  source_code: string;
  tree?: any;
}

/**
 * Extract source code for a given range from a file cache
 * 
 * @param cache The file cache containing the source code
 * @param range The range to extract
 * @returns The extracted source code
 */
export function extract_source_code(
  cache: FileCache | undefined,
  range: SimpleRange
): string {
  if (!cache) return '';
  
  // Calculate byte positions from line/column positions
  const sourceLines = cache.source_code.split('\n');
  let startByte = 0;
  let endByte = 0;
  
  // Calculate start byte
  for (let i = 0; i < range.start.row; i++) {
    startByte += sourceLines[i].length + 1; // +1 for newline
  }
  startByte += range.start.column;
  
  // Calculate end byte
  endByte = startByte;
  for (let i = range.start.row; i <= range.end.row; i++) {
    if (i === range.end.row) {
      endByte += range.end.column - (i === range.start.row ? range.start.column : 0);
    } else {
      endByte += sourceLines[i].length - (i === range.start.row ? range.start.column : 0) + 1;
    }
  }
  
  return cache.source_code.substring(startByte, endByte);
}

/**
 * Extract source code with surrounding context lines
 * 
 * @param cache The file cache containing the source code
 * @param range The range to extract
 * @param contextLines Number of lines to include before and after
 * @returns Object containing the source with context and metadata
 */
export function extract_source_with_context(
  cache: FileCache | undefined,
  range: SimpleRange,
  contextLines: number = 0
): {
  source: string;
  start_line: number;
  end_line: number;
  context: {
    before: string[];
    after: string[];
  };
} {
  if (!cache) {
    return {
      source: '',
      start_line: 0,
      end_line: 0,
      context: { before: [], after: [] }
    };
  }
  
  const sourceLines = cache.source_code.split('\n');
  const startLine = Math.max(0, range.start.row - contextLines);
  const endLine = Math.min(sourceLines.length - 1, range.end.row + contextLines);
  
  // Extract the main source
  const mainStartLine = range.start.row;
  const mainEndLine = range.end.row;
  const mainSource = sourceLines.slice(mainStartLine, mainEndLine + 1);
  
  // Extract context
  const beforeContext = sourceLines.slice(startLine, mainStartLine);
  const afterContext = sourceLines.slice(mainEndLine + 1, endLine + 1);
  
  return {
    source: mainSource.join('\n'),
    start_line: mainStartLine,
    end_line: mainEndLine,
    context: {
      before: beforeContext,
      after: afterContext
    }
  };
}

/**
 * Get line count for a source string
 */
export function get_line_count(source: string): number {
  return source.split('\n').length;
}

/**
 * Get byte offset for a position in source code
 */
export function get_byte_offset(
  source: string,
  row: number,
  column: number
): number {
  const lines = source.split('\n');
  let offset = 0;
  
  for (let i = 0; i < row && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }
  
  if (row < lines.length) {
    offset += Math.min(column, lines[row].length);
  }
  
  return offset;
}
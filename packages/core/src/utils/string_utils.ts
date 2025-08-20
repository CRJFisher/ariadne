/**
 * String processing utilities
 * 
 * Provides helpers for string manipulation and analysis
 */

/**
 * Convert string to snake_case
 */
export function to_snake_case(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/-/g, '_');
}

/**
 * Convert string to camelCase
 */
export function to_camel_case(str: string): string {
  return str
    .replace(/[-_]([a-z])/g, (_, char) => char.toUpperCase())
    .replace(/^([A-Z])/, (_, char) => char.toLowerCase());
}

/**
 * Convert string to PascalCase
 */
export function to_pascal_case(str: string): string {
  const camel = to_camel_case(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Escape special regex characters in a string
 */
export function escape_regex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if string is a valid identifier
 */
export function is_valid_identifier(str: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}

/**
 * Extract leading comment from source
 */
export function extract_leading_comment(source: string): string | null {
  const lines = source.split('\n');
  const commentLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
      commentLines.push(trimmed);
    } else if (trimmed.startsWith('/*') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      // Multi-line comment start
      return extract_multiline_comment(source);
    } else if (trimmed.length > 0) {
      // Non-comment content found
      break;
    }
  }
  
  return commentLines.length > 0 ? commentLines.join('\n') : null;
}

/**
 * Extract multi-line comment
 */
function extract_multiline_comment(source: string): string | null {
  // JavaScript/TypeScript style
  const jsMatch = source.match(/^\/\*\*([\s\S]*?)\*\//);
  if (jsMatch) return jsMatch[1].trim();
  
  // Python style
  const pyMatch = source.match(/^"""([\s\S]*?)"""|^'''([\s\S]*?)'''/);
  if (pyMatch) return (pyMatch[1] || pyMatch[2]).trim();
  
  return null;
}

/**
 * Count occurrences of substring
 */
export function count_occurrences(str: string, substring: string): number {
  let count = 0;
  let index = 0;
  
  while ((index = str.indexOf(substring, index)) !== -1) {
    count++;
    index += substring.length;
  }
  
  return count;
}

/**
 * Indent a string by specified spaces
 */
export function indent(str: string, spaces: number): string {
  const indentation = ' '.repeat(spaces);
  return str.split('\n').map(line => indentation + line).join('\n');
}

/**
 * Remove common leading whitespace from lines
 */
export function dedent(str: string): string {
  const lines = str.split('\n');
  const minIndent = Math.min(
    ...lines
      .filter(line => line.trim().length > 0)
      .map(line => line.match(/^(\s*)/)?.[1].length || 0)
  );
  
  return lines
    .map(line => line.slice(minIndent))
    .join('\n');
}

/**
 * Check if string starts with any of the prefixes
 */
export function starts_with_any(str: string, prefixes: string[]): boolean {
  return prefixes.some(prefix => str.startsWith(prefix));
}

/**
 * Check if string ends with any of the suffixes
 */
export function ends_with_any(str: string, suffixes: string[]): boolean {
  return suffixes.some(suffix => str.endsWith(suffix));
}

/**
 * Split string by delimiter but respect quotes
 */
export function split_respecting_quotes(str: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
    }
    
    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current) {
    result.push(current.trim());
  }
  
  return result;
}
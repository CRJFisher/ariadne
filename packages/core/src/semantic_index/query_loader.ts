import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { Language } from '@ariadnejs/types';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import TypeScript from 'tree-sitter-typescript';
import { Query } from 'tree-sitter';

/**
 * Language to tree-sitter parser mapping
 */
export const LANGUAGE_TO_TREESITTER_LANG = new Map([
  ['javascript', JavaScript],
  ['typescript', TypeScript.tsx],
  ['python', Python],
  ['rust', Rust],
]);

/**
 * Supported languages (derived from the Language type)
 */
export const SUPPORTED_LANGUAGES: readonly Language[] = ['javascript', 'typescript', 'python', 'rust'] as const;

/**
 * Query cache for performance
 */
const query_cache = new Map<Language, string>();

/**
 * Get the queries directory path (robust across different environments)
 */
function get_queries_dir(): string {
  // Try multiple methods to find the queries directory
  const current_file = typeof __filename !== 'undefined' ? __filename :
                     typeof import.meta !== 'undefined' && import.meta.url ?
                     fileURLToPath(import.meta.url) : __filename;

  if (!current_file) {
    throw new Error('Unable to determine current file location for query loading');
  }

  return join(dirname(current_file), 'queries');
}

/**
 * Validate that a language is supported
 */
function validate_language(language: Language): void {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new Error(`Unsupported language: ${language}. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
  }

  if (!LANGUAGE_TO_TREESITTER_LANG.has(language)) {
    throw new Error(`No tree-sitter parser available for language: ${language}`);
  }
}

/**
 * Validate query syntax by attempting to parse it
 */
function validate_query_syntax(query_string: string, language: Language): void {
  try {
    const parser = LANGUAGE_TO_TREESITTER_LANG.get(language);
    if (!parser) {
      throw new Error(`No parser available for ${language}`);
    }
    // Attempt to create the query to validate syntax
    new Query(parser, query_string);
  } catch (error) {
    throw new Error(`Invalid query syntax for ${language}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Load a tree-sitter query for a specific language
 */
export function load_query(language: Language): string {
  // Check cache first
  const cached = query_cache.get(language);
  if (cached !== undefined) {
    return cached;
  }

  // Validate language support
  validate_language(language);

  const queries_dir = get_queries_dir();
  const query_path = join(queries_dir, `${language}.scm`);

  try {
    const query_string = readFileSync(query_path, 'utf-8');

    // Validate query syntax
    validate_query_syntax(query_string, language);

    // Cache the result
    query_cache.set(language, query_string);

    return query_string;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid query syntax')) {
      // Re-throw validation errors as-is
      throw error;
    }

    // File system errors
    const error_msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load semantic index query for language '${language}' from '${query_path}': ${error_msg}`);
  }
}

/**
 * Check if a query exists for a language (efficient version)
 */
export function has_query(language: Language): boolean {
  try {
    // Check cache first
    if (query_cache.has(language)) {
      return true;
    }

    // Validate language support (but don't throw)
    if (!SUPPORTED_LANGUAGES.includes(language) || !LANGUAGE_TO_TREESITTER_LANG.has(language)) {
      return false;
    }

    // Check file existence without loading
    const queries_dir = get_queries_dir();
    const query_path = join(queries_dir, `${language}.scm`);

    return existsSync(query_path);
  } catch {
    return false;
  }
}

/**
 * Clear the query cache (useful for testing)
 */
export function clear_query_cache(): void {
  query_cache.clear();
}

/**
 * Get cache size (useful for monitoring)
 */
export function get_cache_size(): number {
  return query_cache.size;
}
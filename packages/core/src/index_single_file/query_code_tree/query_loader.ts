import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import type { Language } from "@ariadnejs/types";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";
import { Query } from "tree-sitter";

/**
 * Language to tree-sitter parser mapping
 * NOTE: TypeScript uses .typescript grammar (not .tsx) for compatibility with both .ts and .tsx files
 */
export const LANGUAGE_TO_TREESITTER_LANG = new Map([
  ["javascript", JavaScript],
  ["typescript", TypeScript.typescript],
  ["python", Python],
  ["rust", Rust],
]);

/**
 * Supported languages (derived from the Language type)
 */
export const SUPPORTED_LANGUAGES: readonly Language[] = [
  "javascript",
  "typescript",
  "python",
  "rust",
] as const;

/**
 * Query cache for performance
 * Exported for testing purposes only
 */
export const query_cache = new Map<Language, string>();

/**
 * Cache for the queries directory path (computed once per process)
 */
let cached_queries_dir: string | null = null;

/**
 * Get the queries directory path (robust across different environments)
 */
export function get_queries_dir(): string {
  // Return cached result if available
  if (cached_queries_dir !== null) {
    return cached_queries_dir;
  }

  // Strategy: Try multiple approaches to find the queries directory
  // This handles development, CI, production, and bundled environments

  const possible_paths = [
    // 1. Standard CommonJS approach (works in most cases)
    join(dirname(__filename), "queries"),

    // 2. From package root (for cases where __filename is in a different structure)
    join(__dirname, "queries"),

    // 3. Relative to current working directory (fallback for some CI environments)
    join(
      process.cwd(),
      "packages",
      "core",
      "dist",
      "semantic_index",
      "queries"
    ),
    join(process.cwd(), "packages", "core", "src", "semantic_index", "queries"),
    join(process.cwd(), "dist", "semantic_index", "queries"),
    join(process.cwd(), "src", "semantic_index", "queries"),

    // 4. For bundled environments or when installed as a package
    join(
      process.cwd(),
      "node_modules",
      "@ariadnejs",
      "core",
      "dist",
      "semantic_index",
      "queries"
    ),
  ];

  // Try each path until we find one that exists
  for (const path of possible_paths) {
    if (existsSync(path)) {
      cached_queries_dir = path;
      return path;
    }
  }

  // If all else fails, provide detailed error information for debugging
  const error_details = possible_paths
    .map(
      (path, index) => `  ${index + 1}. ${path} (exists: ${existsSync(path)})`
    )
    .join("\n");

  const environment_info = {
    node_env: process.env.NODE_ENV,
    cwd: process.cwd(),
    filename: __filename,
    dirname: __dirname,
    argv0: process.argv[0],
    argv1: process.argv[1],
    platform: process.platform,
    arch: process.arch,
  };

  throw new Error(
    `Unable to locate queries directory. Tried the following paths:\n${error_details}\n\n` +
      `Environment information:\n${JSON.stringify(environment_info, null, 2)}`
  );
}

/**
 * Validate that a language is supported
 */
function validate_language(language: Language): void {
  // Check for null/undefined/empty inputs
  if (language == null || (language as string) === "") {
    throw new Error(
      `Invalid language: ${language}. Language cannot be null, undefined, or empty.`
    );
  }

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new Error(
      `Unsupported language: ${language}. Supported languages: ${SUPPORTED_LANGUAGES.join(
        ", "
      )}`
    );
  }

  if (!LANGUAGE_TO_TREESITTER_LANG.has(language)) {
    throw new Error(
      `No tree-sitter parser available for language: ${language}`
    );
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
    throw new Error(
      `Invalid query syntax for ${language}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
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
    const query_string = readFileSync(query_path, "utf-8");

    // Validate query syntax
    validate_query_syntax(query_string, language);

    // Cache the result
    query_cache.set(language, query_string);

    return query_string;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Invalid query syntax")
    ) {
      // Re-throw validation errors as-is
      throw error;
    }

    // File system errors
    const error_msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load semantic index query for language '${language}' from '${query_path}': ${error_msg}`
    );
  }
}

/**
 * Check if a query exists for a language (efficient version)
 */
export function has_query(language: Language): boolean {
  // Validate language support (this will throw for invalid inputs)
  validate_language(language);

  // Check cache first
  if (query_cache.has(language)) {
    return true;
  }

  // Check file existence without loading
  const queries_dir = get_queries_dir();
  const query_path = join(queries_dir, `${language}.scm`);

  return existsSync(query_path);
}

/**
 * Clear all caches including path cache (useful for testing different environments)
 */
export function clear_all_caches(): void {
  query_cache.clear();
  cached_queries_dir = null;
}

/**
 * Get cache size (useful for monitoring)
 */
export function get_cache_size(): number {
  return query_cache.size;
}

/**
 * Test path resolution without throwing errors (useful for debugging)
 */
export function test_path_resolution(): {
  found_path: string | null;
  tried_paths: Array<{ path: string; exists: boolean }>;
  environment_info: Record<string, unknown>;
} {
  const possible_paths = [
    join(dirname(__filename), "queries"),
    join(__dirname, "queries"),
    join(
      process.cwd(),
      "packages",
      "core",
      "dist",
      "semantic_index",
      "queries"
    ),
    join(process.cwd(), "packages", "core", "src", "semantic_index", "queries"),
    join(process.cwd(), "dist", "semantic_index", "queries"),
    join(process.cwd(), "src", "semantic_index", "queries"),
    join(
      process.cwd(),
      "node_modules",
      "@ariadnejs",
      "core",
      "dist",
      "semantic_index",
      "queries"
    ),
  ];

  const tried_paths = possible_paths.map((path) => ({
    path,
    exists: existsSync(path),
  }));

  const found_path = tried_paths.find((p) => p.exists)?.path || null;

  const environment_info = {
    node_env: process.env.NODE_ENV,
    cwd: process.cwd(),
    filename: __filename,
    dirname: __dirname,
    argv0: process.argv[0],
    argv1: process.argv[1],
    platform: process.platform,
    arch: process.arch,
    cached_queries_dir,
  };

  return {
    found_path,
    tried_paths,
    environment_info,
  };
}

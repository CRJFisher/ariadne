import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Language } from "@ariadnejs/types";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";
import { Query } from "tree-sitter";

// TypeScript maps to the `.typescript` grammar rather than `.tsx` so a single
// query works for both `.ts` and `.tsx` sources.
export const LANGUAGE_TO_TREESITTER_LANG = new Map([
  ["javascript", JavaScript],
  ["typescript", TypeScript.typescript],
  ["python", Python],
  ["rust", Rust],
]);

export const SUPPORTED_LANGUAGES: readonly Language[] = [
  "javascript",
  "typescript",
  "python",
  "rust",
] as const;

// Exported so tests can reset process-wide memoization between cases.
export const query_cache = new Map<Language, string>();
export const cached_queries_dir_cache = { value: null as string | null };

// The `.scm` files ship alongside this module in both `src` (dev/test) and
// `dist` (published), so they always resolve relative to this file.
export function get_queries_dir(): string {
  if (cached_queries_dir_cache.value !== null) {
    return cached_queries_dir_cache.value;
  }

  const queries_dir = join(__dirname, "queries");
  if (existsSync(queries_dir)) {
    cached_queries_dir_cache.value = queries_dir;
    return queries_dir;
  }

  const environment_info = {
    node_env: process.env.NODE_ENV,
    cwd: process.cwd(),
    dirname: __dirname,
    platform: process.platform,
    arch: process.arch,
  };

  throw new Error(
    `Unable to locate queries directory at '${queries_dir}'.\n\n` +
      `Environment information:\n${JSON.stringify(environment_info, null, 2)}`
  );
}

function validate_language(language: Language): void {
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

// Compiling the query surfaces `.scm` syntax errors at load time with the
// offending language named, rather than deep inside pass-1 execution.
function validate_query_syntax(query_string: string, language: Language): void {
  try {
    const parser = LANGUAGE_TO_TREESITTER_LANG.get(language);
    if (!parser) {
      throw new Error(`No parser available for ${language}`);
    }
    new Query(parser, query_string);
  } catch (error) {
    throw new Error(
      `Invalid query syntax for ${language}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function load_query(language: Language): string {
  const cached = query_cache.get(language);
  if (cached !== undefined) {
    return cached;
  }

  validate_language(language);

  const queries_dir = get_queries_dir();
  const query_path = join(queries_dir, `${language}.scm`);

  try {
    const query_string = readFileSync(query_path, "utf-8");
    validate_query_syntax(query_string, language);
    query_cache.set(language, query_string);
    return query_string;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Invalid query syntax")
    ) {
      throw error;
    }

    const error_msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load semantic index query for language '${language}' from '${query_path}': ${error_msg}`
    );
  }
}

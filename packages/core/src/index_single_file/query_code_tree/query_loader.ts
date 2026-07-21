import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Language } from "@ariadnejs/types";
import type TreeSitter from "tree-sitter";
import { Query } from "../../native";
import {
  LANGUAGE_TO_TREESITTER_LANG,
  SUPPORTED_LANGUAGES,
  grammar_for_dialect,
} from "./parsers";

// Exported so tests can reset process-wide memoization between cases. Keyed by
// query dialect: the language name, or "typescript:tsx" for the JSX-augmented
// TypeScript query.
export const query_cache = new Map<string, string>();
export const cached_queries_dir_cache = { value: null as string | null };

// JSX component captures appended to the `.tsx` TypeScript query. A `.tsx` file
// is parsed with the tsx grammar (which yields the jsx element nodes), while
// `typescript.scm` itself stays JSX-free so it compiles against the non-JSX
// typescript grammar used for `.ts`. The `javascript.scm` query carries an
// identical inline copy for `.js`/`.jsx`/`.mdx`; keep the two in sync.
const JSX_COMPONENT_CAPTURES = `
; JSX components — a JSX element is how a component is invoked, so its tag name
; captures as a call reference to the component. A lowercase-initial tag is an
; intrinsic host element (\`<div>\`) that names no definition; every other tag
; (\`<Panel>\`, \`<_Private>\`) names a component.
(jsx_opening_element
  (identifier) @reference.call.jsx
  (#not-match? @reference.call.jsx "^[a-z]")
)

(jsx_self_closing_element
  (identifier) @reference.call.jsx
  (#not-match? @reference.call.jsx "^[a-z]")
)
`;

// The dialect key under which a language's query is cached: `.tsx` gets its own
// JSX-augmented variant; every other file uses the bare language name.
export function query_dialect(language: Language, tsx: boolean): string {
  return language === "typescript" && tsx ? `${language}:tsx` : language;
}

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
// offending dialect named, rather than deep inside pass-1 execution. Compiled
// against the same grammar the dialect parses with, so a JSX pattern is
// validated against a JSX-capable grammar.
function validate_query_syntax(
  query_string: string,
  grammar: TreeSitter.Language,
  dialect: string
): void {
  try {
    new Query(grammar, query_string);
  } catch (error) {
    throw new Error(
      `Invalid query syntax for ${dialect}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function load_query(language: Language, tsx: boolean = false): string {
  const dialect = query_dialect(language, tsx);
  const cached = query_cache.get(dialect);
  if (cached !== undefined) {
    return cached;
  }

  validate_language(language);

  const queries_dir = get_queries_dir();
  const query_path = join(queries_dir, `${language}.scm`);

  try {
    const base = readFileSync(query_path, "utf-8");
    // `.tsx` appends the JSX component captures; `typescript.scm` itself is
    // JSX-free so it compiles against the non-JSX typescript grammar for `.ts`.
    const query_string =
      language === "typescript" && tsx
        ? `${base}\n${JSX_COMPONENT_CAPTURES}`
        : base;
    validate_query_syntax(
      query_string,
      grammar_for_dialect(language, tsx),
      dialect
    );
    query_cache.set(dialect, query_string);
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

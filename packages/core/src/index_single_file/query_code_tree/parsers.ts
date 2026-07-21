import type { Language } from "@ariadnejs/types";
import type TreeSitter from "tree-sitter";
import { JavaScript, Python, Rust, TypeScript } from "../../native";

type Grammar = TreeSitter.Language;

// The default grammar per language. TypeScript maps to the `.typescript`
// grammar; a `.tsx` file overrides this to the `.tsx` grammar (see grammar_for).
export const LANGUAGE_TO_TREESITTER_LANG = new Map<Language, Grammar>([
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

// A `.tsx` file is parsed with the tsx grammar, which yields the
// `jsx_opening_element` / `jsx_self_closing_element` nodes a component usage
// captures against. A `.ts` file keeps the typescript grammar so an
// angle-bracket type assertion (`<T>x`) still parses as a cast rather than a JSX
// element. Both are language "typescript"; only the grammar and the JSX half of
// the query differ, so the distinction stays inside the parse/query layer and
// never reaches the by-language dispatchers downstream.
export function is_tsx_file(language: Language, file_path: string): boolean {
  return language === "typescript" && file_path.endsWith(".tsx");
}

// Grammar for a compiled query, selected by the same tsx dialect the parser
// uses so a query always compiles against the grammar its tree was parsed with.
export function grammar_for_dialect(language: Language, tsx: boolean): Grammar {
  if (language === "typescript" && tsx) {
    return TypeScript.tsx;
  }
  const grammar = LANGUAGE_TO_TREESITTER_LANG.get(language);
  if (!grammar) {
    throw new Error(`No tree-sitter grammar for language: ${language}`);
  }
  return grammar;
}

// Grammar for parsing a file, dispatching `.tsx` to the tsx grammar.
export function grammar_for(language: Language, file_path: string): Grammar {
  return grammar_for_dialect(language, is_tsx_file(language, file_path));
}

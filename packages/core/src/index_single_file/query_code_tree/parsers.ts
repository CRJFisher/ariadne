import type { Language } from "@ariadnejs/types";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";

// TypeScript maps to the `.tsx` grammar so a single query works for both `.ts`
// and `.tsx` sources: `.tsx` parses as a superset of `.ts`, and only this grammar
// yields the `jsx_opening_element` / `jsx_self_closing_element` nodes that let a
// JSX component usage capture as a call reference. The trade-off is that an
// angle-bracket type assertion (`<T>x`) — legal in `.ts` but forbidden in `.tsx` —
// parses as a JSX element inside an error region, which drops the surrounding
// statement's captures. Casts must use the `as` form, which `typescript.scm`
// already relies on for its only type-assertion capture.
export const LANGUAGE_TO_TREESITTER_LANG = new Map([
  ["javascript", JavaScript],
  ["typescript", TypeScript.tsx],
  ["python", Python],
  ["rust", Rust],
]);

export const SUPPORTED_LANGUAGES: readonly Language[] = [
  "javascript",
  "typescript",
  "python",
  "rust",
] as const;

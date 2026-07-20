import type { Language } from "@ariadnejs/types";
import { JavaScript, Python, Rust, TypeScript } from "../../native";

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

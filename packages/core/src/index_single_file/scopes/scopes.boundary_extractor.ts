import type { Language } from "@ariadnejs/types";
import { PythonScopeBoundaryExtractor } from "./extractors/python_scope_boundary_extractor";
import { TypeScriptScopeBoundaryExtractor } from "./extractors/typescript_scope_boundary_extractor";
import { JavaScriptScopeBoundaryExtractor } from "./extractors/javascript_scope_boundary_extractor";
import { RustScopeBoundaryExtractor } from "./extractors/rust_scope_boundary_extractor";
import { type ScopeBoundaryExtractor } from "./scopes.boundary_base";

/**
 * Get the scope boundary extractor for a given language.
 */
export function get_scope_boundary_extractor(
  language: Language
): ScopeBoundaryExtractor {
  switch (language) {
    case "python":
      return new PythonScopeBoundaryExtractor();
    case "typescript":
      return new TypeScriptScopeBoundaryExtractor();
    case "javascript":
      return new JavaScriptScopeBoundaryExtractor();
    case "rust":
      return new RustScopeBoundaryExtractor();
    default:
      throw new Error(`No scope boundary extractor for language: ${language}`);
  }
}
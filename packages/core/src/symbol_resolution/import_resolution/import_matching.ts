/**
 * Import matching with language-specific routing
 *
 * Routes import matching to language-specific implementations
 * using simple control flow rather than function references.
 */

import type {
  Language,
  Import,
  Export,
  SymbolDefinition,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import { match_js_import_to_export } from "./language_handlers/javascript";
import { match_python_import_to_export } from "./language_handlers/python";
import { match_rust_import_to_export } from "./language_handlers/rust";

/**
 * Match imports to exports using language-specific logic
 *
 * Routes to the appropriate language-specific implementation
 * based on the language parameter.
 */
export function match_import_to_export(
  language: Language,
  import_stmt: Import,
  source_exports: readonly Export[],
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): Map<SymbolName, SymbolId> {
  // Route to language-specific implementation
  if (language === "javascript" || language === "typescript") {
    return match_js_import_to_export(import_stmt, source_exports, source_symbols);
  }

  if (language === "python") {
    return match_python_import_to_export(import_stmt, source_exports, source_symbols);
  }

  if (language === "rust") {
    return match_rust_import_to_export(import_stmt, source_exports, source_symbols);
  }

  // Unknown language, return empty map
  return new Map<SymbolName, SymbolId>();
}
/**
 * Core import resolution algorithm
 *
 * Coordinates path resolution and import matching to build
 * the complete import resolution map.
 */

import type {
  FilePath,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import type {
  ImportResolutionContext,
} from "./import_types";
import { resolve_module_path } from "./module_resolver";
import { match_import_to_export } from "./import_matching";

/**
 * Resolve all imports across all files
 *
 * For each file, resolves its imports to source symbols by:
 * 1. Resolving import paths to actual files
 * 2. Matching import names to export names
 * 3. Building the import->symbol mapping
 */
export function resolve_imports(
  context: ImportResolutionContext
): ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>> {
  const result = new Map<FilePath, Map<SymbolName, SymbolId>>();

  for (const [file_path, index] of Array.from(context.indices)) {
    const file_imports = new Map<SymbolName, SymbolId>();

    for (const import_stmt of index.imports) {
      // Skip side-effect imports as they don't import symbols
      if (import_stmt.kind === "side_effect") {
        continue;
      }

      // Resolve import path to source file
      if (!import_stmt.source) {
        // Skip imports with missing source
        continue;
      }

      const source_file = resolve_module_path(
        import_stmt.source,
        file_path,
        index.language,
        context
      );

      if (!source_file || !context.indices.has(source_file)) {
        // Source file not found or not indexed
        continue;
      }

      const source_index = context.indices.get(source_file)!;
      
      // Match import to exports using language-specific routing
      // TODO: this seems wrong - the imports should be matched to exports in many different modules (indexes) not the same index as the import - that's the one place it isn't!!!
      const symbol_mappings = match_import_to_export(
        index.language,
        import_stmt,
        source_index.exports,
        source_index.symbols
      );

      // Add all resolved symbols to the file imports
      for (const [name, symbol_id] of Array.from(symbol_mappings)) {
        file_imports.set(name, symbol_id);
      }
    }

    if (file_imports.size > 0) {
      result.set(file_path, file_imports);
    }
  }

  return result;
}

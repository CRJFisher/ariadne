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
  Import,
  Language,
} from "@ariadnejs/types";
import type {
  ImportResolutionMap,
  ImportResolutionContext,
} from "./import_types";
import { resolve_module_path } from "./module_resolver";

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
): ImportResolutionMap {
  const result = new Map<FilePath, Map<SymbolName, SymbolId>>();

  for (const [file_path, index] of context.indices) {
    const file_imports = new Map<SymbolName, SymbolId>();

    for (const import_stmt of index.imports) {
      // Skip side-effect imports as they don't import symbols
      if (import_stmt.kind === "side_effect") {
        continue;
      }

      // Resolve import path to source file
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

      // Get language handler for import matching
      const handler = context.language_handlers.get(index.language);
      if (!handler) {
        continue;
      }

      // Match import to exports and get symbol mappings
      const symbol_mappings = handler.match_import_to_export(
        import_stmt,
        source_index.exports,
        source_index.symbols
      );

      // Add all resolved symbols to the file imports
      for (const [name, symbol_id] of symbol_mappings) {
        file_imports.set(name, symbol_id);
      }
    }

    if (file_imports.size > 0) {
      result.set(file_path, file_imports);
    }
  }

  return { imports: result };
}

/**
 * Resolve imports for a specific file
 *
 * Useful for incremental resolution or debugging
 */
export function resolve_file_imports(
  file_path: FilePath,
  context: ImportResolutionContext
): Map<SymbolName, SymbolId> {
  const file_imports = new Map<SymbolName, SymbolId>();

  const index = context.indices.get(file_path);
  if (!index) {
    return file_imports;
  }

  for (const import_stmt of index.imports) {
    // Skip side-effect imports
    if (import_stmt.kind === "side_effect") {
      continue;
    }

    // Resolve import path to source file
    const source_file = resolve_module_path(
      import_stmt.source,
      file_path,
      index.language,
      context
    );

    if (!source_file || !context.indices.has(source_file)) {
      continue;
    }

    const source_index = context.indices.get(source_file)!;

    // Get language handler for import matching
    const handler = context.language_handlers.get(index.language);
    if (!handler) {
      continue;
    }

    // Match import to exports
    const symbol_mappings = handler.match_import_to_export(
      import_stmt,
      source_index.exports,
      source_index.symbols
    );

    // Add resolved symbols
    for (const [name, symbol_id] of symbol_mappings) {
      file_imports.set(name, symbol_id);
    }
  }

  return file_imports;
}

/**
 * Get all files that import from a given file
 *
 * Useful for understanding dependencies and impact analysis
 */
export function get_importing_files(
  source_file: FilePath,
  context: ImportResolutionContext
): Set<FilePath> {
  const importing_files = new Set<FilePath>();

  for (const [file_path, index] of context.indices) {
    for (const import_stmt of index.imports) {
      // Check if this import could resolve to the source file
      const resolved_file = resolve_module_path(
        import_stmt.source,
        file_path,
        index.language,
        context
      );

      if (resolved_file === source_file) {
        importing_files.add(file_path);
        break; // No need to check other imports in this file
      }
    }
  }

  return importing_files;
}
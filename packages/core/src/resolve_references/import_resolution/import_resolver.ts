/**
 * Import Resolution - Lazy resolver creation for imported symbols
 *
 * This module creates resolver functions for imports that are invoked on-demand.
 * Resolvers follow export chains only when an imported symbol is first referenced.
 */

import type {
  FilePath,
  Language,
  SymbolId,
  SymbolName,
  ScopeId,
  ImportDefinition,
  ModulePath,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { ImportSpec, NamespaceSources, FileSystemFolder } from "../types";
import type { ExportRegistry } from "../../project/export_registry";
import { resolve_module_path_javascript } from "./import_resolver.javascript";
import { resolve_module_path_typescript } from "./import_resolver.typescript";
import { resolve_module_path_python } from "./import_resolver.python";
import { resolve_module_path_rust } from "./import_resolver.rust";
import * as path from "path";

/**
 * Extract import specifications from a scope's import statements.
 * Used by ScopeResolverIndex when building resolver functions.
 *
 * @param scope_id - The scope to extract imports from
 * @param index - The semantic index for the current file
 * @param file_path - Path to the file being processed
 * @param root_folder - Root of the file system tree
 * @returns Array of import specifications
 */
export function extract_import_specs(
  scope_id: ScopeId,
  index: SemanticIndex,
  file_path: FilePath,
  root_folder: FileSystemFolder
): ImportSpec[] {
  const specs: ImportSpec[] = [];

  // Find all imports in this scope
  for (const import_def of (index.scope_to_definitions
    .get(scope_id)
    ?.get("import") || []) as ImportDefinition[]) {
    if (import_def.defining_scope_id === scope_id) {
      // Resolve the module path to a file path using language-specific rules
      const source_file = resolve_module_path(
        import_def.import_path,
        file_path,
        index.language,
        root_folder
      );

      specs.push({
        symbol_id: import_def.symbol_id,
        local_name: import_def.name,
        source_file,
        // For named imports: use original_name (if aliased) or name
        // For default imports: original_name is undefined, so falls back to name
        //   (Note: import_name is ignored when import_kind is "default")
        // For namespace imports: name is the namespace identifier
        import_name: import_def.original_name || import_def.name,
        import_kind: import_def.import_kind,
      });
    }
  }

  return specs;
}

/**
 * Follow export chain to find the ultimate source symbol.
 * This runs lazily when an import resolver is first invoked.
 *
 * Handles re-export chains like:
 *   base.js:   export function core() {}
 *   middle.js: export { core } from './base'
 *   main.js:   import { core } from './middle'
 *
 * @param source_file - File containing the export
 * @param export_name - Name of the exported symbol (ignored for default imports)
 * @param export_registry - Registry containing all export metadata
 * @param root_folder - Root of the file system tree
 * @param import_kind - Type of import (named, default, or namespace)
 * @param visited - Set of visited exports for cycle detection
 * @returns Symbol ID of the exported symbol, or null if not found
 */
export function resolve_export_chain(
  source_file: FilePath,
  export_name: SymbolName,
  export_registry: ExportRegistry,
  root_folder: FileSystemFolder,
  import_kind: "named" | "default" | "namespace" = "named",
  visited: Set<string> = new Set()
): SymbolId | null {
  // Check if export exists BEFORE attempting to resolve the chain
  // This allows us to distinguish between missing exports (throw) and cycles (return null)
  const export_exists = import_kind === "default"
    ? export_registry.get_default_export(source_file) !== undefined
    : export_registry.get_export(source_file, export_name) !== undefined;

  if (!export_exists) {
    // Export doesn't exist at all - throw immediately
    throw new Error(
      import_kind === "default"
        ? `Default export not found in file: ${source_file}`
        : `Export not found for symbol: ${export_name} in file: ${source_file}`
    );
  }

  // Create a resolve_module function that captures root_folder
  const resolve_module = (import_path: ModulePath, from_file: FilePath, language: Language): FilePath => {
    return resolve_module_path(import_path, from_file, language, root_folder);
  };

  // Delegate to ExportRegistry's resolve_export_chain method
  // If this returns null, it must be a cycle (since we already checked export exists)
  const result = export_registry.resolve_export_chain(
    source_file,
    export_name,
    import_kind,
    resolve_module,
    visited
  );

  return result; // Returns null for cycles, SymbolId for successful resolution
}

/**
 * Check if a file exists in the file system tree
 *
 * @param file_path - Absolute path to the file to check
 * @param root_folder - Root of the file system tree
 * @returns true if file exists, false otherwise
 */
export function has_file_in_tree(
  file_path: FilePath,
  root_folder: FileSystemFolder
): boolean {
  // Normalize the path and split into parts
  const normalized = path.normalize(file_path);
  const parts = normalized.split(path.sep).filter(p => p);

  let current: FileSystemFolder | undefined = root_folder;

  // Navigate to parent folder
  for (let i = 0; i < parts.length - 1; i++) {
    current = current?.folders.get(parts[i]);
    if (!current) return false;
  }

  // Check if file exists in the final folder
  const filename = parts[parts.length - 1];
  return current?.files.has(filename) || false;
}

/**
 * Check if a path is a directory in the file system tree
 *
 * @param folder_path - Absolute path to check
 * @param root_folder - Root of the file system tree
 * @returns true if path is a directory, false otherwise
 */
export function is_directory_in_tree(
  folder_path: FilePath,
  root_folder: FileSystemFolder
): boolean {
  // Normalize the path and split into parts
  const normalized = path.normalize(folder_path);
  const parts = normalized.split(path.sep).filter(p => p);

  let current: FileSystemFolder | undefined = root_folder;

  // Navigate through all parts
  for (const part of parts) {
    current = current?.folders.get(part);
    if (!current) return false;
  }

  return true;
}

/**
 * Resolve import path to absolute file path (language-aware)
 *
 * @param import_path - Import path string from the import statement
 * @param importing_file - Absolute path to the file containing the import
 * @param language - Programming language
 * @param root_folder - Root of the file system tree
 * @returns Absolute file path to the imported module
 */
function resolve_module_path(
  import_path: string,
  importing_file: FilePath,
  language: Language,
  root_folder: FileSystemFolder
): FilePath {
  switch (language) {
    case "javascript":
      return resolve_module_path_javascript(import_path, importing_file, root_folder);
    case "typescript":
      return resolve_module_path_typescript(import_path, importing_file, root_folder);
    case "python":
      return resolve_module_path_python(import_path, importing_file, root_folder);
    case "rust":
      return resolve_module_path_rust(import_path, importing_file, root_folder);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * Build namespace sources map from semantic indices
 *
 * Tracks which source file each namespace import points to.
 * This enables resolution of namespace member access like `utils.helper()`
 * where `utils` is a namespace import (`import * as utils from './utils'`).
 *
 * @param indices - All semantic indices for the codebase
 * @param root_folder - Root of the file system tree
 * @returns Map of namespace symbol_id → source file path
 *
 * @example
 * ```typescript
 * // Given: import * as utils from './utils';
 * const namespace_sources = build_namespace_sources(indices, root_folder);
 * // → Map { "import:src/app.ts:utils:5:0" => "src/utils.ts" }
 *
 * // Later when resolving: utils.helper()
 * const source_file = namespace_sources.get(namespace_symbol_id);
 * // → "src/utils.ts"
 * ```
 */
export function build_namespace_sources(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  root_folder: FileSystemFolder
): NamespaceSources {
  const namespace_sources = new Map<SymbolId, FilePath>();

  for (const [file_path, index] of indices) {
    // Find all namespace imports in this file
    for (const [import_symbol_id, import_def] of index.imported_symbols) {
      if (import_def.import_kind === "namespace") {
        // Resolve the module path to get the source file
        const source_file = resolve_module_path(
          import_def.import_path,
          file_path,
          index.language,
          root_folder
        );

        // Map this namespace import symbol to its source file
        namespace_sources.set(import_symbol_id, source_file);
      }
    }
  }

  return namespace_sources;
}

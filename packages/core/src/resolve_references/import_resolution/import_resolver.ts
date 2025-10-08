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
} from "@ariadnejs/types";
import { is_reexport } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { ImportSpec, ExportInfo, NamespaceSources } from "../types";
import { resolve_module_path_javascript } from "./import_resolver.javascript";
import { resolve_module_path_typescript } from "./import_resolver.typescript";
import { resolve_module_path_python } from "./import_resolver.python";
import { resolve_module_path_rust } from "./import_resolver.rust";

/**
 * Extract import specifications from a scope's import statements.
 * Used by ScopeResolverIndex when building resolver functions.
 *
 * @param scope_id - The scope to extract imports from
 * @param index - The semantic index for the current file
 * @param file_path - Path to the file being processed
 * @returns Array of import specifications
 */
export function extract_import_specs(
  scope_id: ScopeId,
  index: SemanticIndex,
  file_path: FilePath
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
        index.language
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
 * @param indices - Map of all semantic indices
 * @param import_kind - Type of import (named, default, or namespace)
 * @param visited - Set of visited exports for cycle detection
 * @returns Symbol ID of the exported symbol, or null if not found
 */
export function resolve_export_chain(
  source_file: FilePath,
  export_name: SymbolName,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  import_kind: "named" | "default" | "namespace" = "named",
  visited: Set<string> = new Set()
): SymbolId | null {
  const source_index = indices.get(source_file);
  if (!source_index) {
    throw new Error(`Source index not found for file: ${source_file}`);
  }

  // Detect cycles
  // For default imports, export_name is the local import name (meaningless for cycle detection)
  // For named imports, export_name is the actual symbol name being exported
  const key =
    import_kind === "default"
      ? `${source_file}:default`
      : `${source_file}:${export_name}:${import_kind}`;

  if (visited.has(key)) {
    return null; // Circular re-export
  }
  visited.add(key);

  // Look for export in source file
  const export_info =
    import_kind === "default"
      ? find_default_export(source_index)
      : find_export(export_name, source_index);

  if (!export_info) {
    throw new Error(
      import_kind === "default"
        ? `Default export not found in file: ${source_file}`
        : `Export not found for symbol: ${export_name} in file: ${source_file}`
    );
  }

  // If it's a re-exported import, follow the chain
  if (export_info.is_reexport && export_info.import_def) {
    const import_def = export_info.import_def;
    const resolved_file = resolve_module_path(
      import_def.import_path,
      source_file,
      source_index.language
    );

    // Recursively resolve with the correct import kind
    // For re-exports, we must use the import_kind from the re-export statement itself
    // Example: export { default } from './foo' → import_kind = "default"
    //          export { bar } from './foo' → import_kind = "named"
    const original_name = import_def.original_name || import_def.name;
    const next_import_kind = import_def.import_kind;

    if (!next_import_kind) {
      throw new Error(
        `import_kind missing on re-export in ${source_file}: ${import_def.symbol_id}`
      );
    }

    return resolve_export_chain(
      resolved_file,
      original_name,
      indices,
      next_import_kind,
      visited
    );
  }

  // Direct export
  return export_info.symbol_id;
}

/**
 * Find an exported symbol in a file's index
 *
 * Uses the exported_symbols map for O(1) lookup instead of iterating
 * through all definition collections.
 *
 * @param name - Symbol name as it appears in the import statement
 * @param index - Semantic index to search in
 * @returns Export information or null if not found
 */
function find_export(
  name: SymbolName,
  index: SemanticIndex
): ExportInfo | null {
  const def = index.exported_symbols.get(name);

  if (!def) {
    return null;
  }

  // If this is a re-exported import, include the ImportDefinition for chain following
  // Check if def has the properties of an ImportDefinition (re-exports are stored as imports)
  const import_def = is_reexport(def) && 'import_path' in def ? (def as any) : undefined;

  return {
    symbol_id: def.symbol_id,
    is_reexport: is_reexport(def),
    import_def,
  };
}

/**
 * Find the default export in a file's index
 *
 * Default exports are marked with export.is_default = true.
 * There should only be one default export per file.
 *
 * @param index - Semantic index to search in
 * @returns Export information or null if not found
 * @throws Error if multiple default exports are found (indicates indexing bug)
 */
function find_default_export(index: SemanticIndex): ExportInfo | null {
  let found: ExportInfo | null = null;

  // Search all exported symbols for default export
  for (const def of index.exported_symbols.values()) {
    if (def.export?.is_default) {
      if (found) {
        throw new Error(
          `Multiple default exports found in ${index.file_path}: ${found.symbol_id} and ${def.symbol_id}`
        );
      }

      // If this is a re-exported import, include the ImportDefinition for chain following
      // Check if def has the properties of an ImportDefinition (re-exports are stored as imports)
      const import_def = def.export.is_reexport && 'import_path' in def ? (def as any) : undefined;

      found = {
        symbol_id: def.symbol_id,
        is_reexport: def.export.is_reexport || false,
        import_def,
      };
    }
  }

  return found;
}

/**
 * Resolve import path to absolute file path (language-aware)
 *
 * @param import_path - Import path string from the import statement
 * @param importing_file - Absolute path to the file containing the import
 * @param language - Programming language
 * @returns Absolute file path to the imported module
 */
function resolve_module_path(
  import_path: string,
  importing_file: FilePath,
  language: Language
): FilePath {
  switch (language) {
    case "javascript":
      return resolve_module_path_javascript(import_path, importing_file);
    case "typescript":
      return resolve_module_path_typescript(import_path, importing_file);
    case "python":
      return resolve_module_path_python(import_path, importing_file);
    case "rust":
      return resolve_module_path_rust(import_path, importing_file);
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
 * @returns Map of namespace symbol_id → source file path
 *
 * @example
 * ```typescript
 * // Given: import * as utils from './utils';
 * const namespace_sources = build_namespace_sources(indices);
 * // → Map { "import:src/app.ts:utils:5:0" => "src/utils.ts" }
 *
 * // Later when resolving: utils.helper()
 * const source_file = namespace_sources.get(namespace_symbol_id);
 * // → "src/utils.ts"
 * ```
 */
export function build_namespace_sources(
  indices: ReadonlyMap<FilePath, SemanticIndex>
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
          index.language
        );

        // Map this namespace import symbol to its source file
        namespace_sources.set(import_symbol_id, source_file);
      }
    }
  }

  return namespace_sources;
}

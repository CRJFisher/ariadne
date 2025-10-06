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
  FunctionDefinition,
  ClassDefinition,
  VariableDefinition,
  InterfaceDefinition,
  EnumDefinition,
  TypeAliasDefinition,
  ImportDefinition,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { ImportSpec, ExportInfo, SymbolResolver } from "../types";
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
  for (const import_def of index.imported_symbols.values()) {
    if (import_def.defining_scope_id === scope_id) {
      // TODO: this is wrong - this is the scope of the import definition, not the scope_id of the imported symbol
      // Resolve the module path to a file path using language-specific rules
      const source_file = resolve_module_path(
        import_def.import_path,
        file_path,
        index.language
      );

      specs.push({
        local_name: import_def.name,
        source_file,
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
 * @param export_name - Name of the exported symbol
 * @param indices - Map of all semantic indices
 * @param visited - Set of visited exports for cycle detection
 * @returns Symbol ID of the exported symbol, or null if not found
 */
export function resolve_export_chain(
  source_file: FilePath,
  export_name: SymbolName,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  visited: Set<string> = new Set()
): SymbolId | null {
  const source_index = indices.get(source_file);
  if (!source_index) {
    throw new Error(`Source index not found for file: ${source_file}`);
  }

  // Detect cycles
  const key = `${source_file}:${export_name}`;
  if (visited.has(key)) {
    return null; // Circular re-export
  }
  visited.add(key);

  // Look for export in source file
  const export_info = find_export(export_name, source_index);
  if (!export_info) {
    throw new Error(
      `Export not found for symbol: ${export_name} in file: ${source_file}`
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

    // Recursively resolve in the imported file
    const original_name = import_def.original_name || import_def.name;
    return resolve_export_chain(resolved_file, original_name, indices, visited);
  }

  // Direct export
  return export_info.symbol_id;
}

/**
 * Find an exported symbol in a file's index
 *
 * @param name - Symbol name to find
 * @param index - Semantic index to search in
 * @returns Export information or null if not found
 */
function find_export(
  name: SymbolName,
  index: SemanticIndex
): ExportInfo | null {
  // Check all definition types
  const def =
    find_exported_function(name, index) ||
    find_exported_class(name, index) ||
    find_exported_variable(name, index) ||
    find_exported_interface(name, index) ||
    find_exported_enum(name, index) ||
    find_exported_type_alias(name, index);

  if (def) {
    return {
      symbol_id: def.symbol_id,
      is_reexport: def.availability?.export?.is_reexport || false,
    };
  }

  // Check for re-exported imports (e.g., export { foo } from './bar')
  const reexport = find_reexported_import(name, index);
  if (reexport) {
    return {
      symbol_id: reexport.symbol_id,
      is_reexport: true,
      import_def: reexport,
    };
  }

  return null;
}

/**
 * Find an exported function by name
 */
function find_exported_function(
  name: SymbolName,
  index: SemanticIndex
): FunctionDefinition | null {
  for (const [symbol_id, func_def] of index.functions) {
    if (func_def.name === name && is_exported(func_def)) {
      return func_def;
    }
  }
  return null;
}

/**
 * Find an exported class by name
 */
function find_exported_class(
  name: SymbolName,
  index: SemanticIndex
): ClassDefinition | null {
  for (const [symbol_id, class_def] of index.classes) {
    if (class_def.name === name && is_exported(class_def)) {
      return class_def;
    }
  }
  return null;
}

/**
 * Find an exported variable by name
 */
function find_exported_variable(
  name: SymbolName,
  index: SemanticIndex
): VariableDefinition | null {
  for (const [symbol_id, var_def] of index.variables) {
    if (var_def.name === name && is_exported(var_def)) {
      return var_def;
    }
  }
  return null;
}

/**
 * Find an exported interface by name
 */
function find_exported_interface(
  name: SymbolName,
  index: SemanticIndex
): InterfaceDefinition | null {
  for (const [symbol_id, iface_def] of index.interfaces) {
    if (iface_def.name === name && is_exported(iface_def)) {
      return iface_def;
    }
  }
  return null;
}

/**
 * Find an exported enum by name
 */
function find_exported_enum(
  name: SymbolName,
  index: SemanticIndex
): EnumDefinition | null {
  for (const [symbol_id, enum_def] of index.enums) {
    if (enum_def.name === name && is_exported(enum_def)) {
      return enum_def;
    }
  }
  return null;
}

/**
 * Find an exported type alias by name
 */
function find_exported_type_alias(
  name: SymbolName,
  index: SemanticIndex
): TypeAliasDefinition | null {
  for (const [symbol_id, type_def] of index.types) {
    if (type_def.name === name && is_exported(type_def)) {
      return type_def;
    }
  }
  return null;
}

/**
 * Check if a definition is exported
 *
 * IMPORTANT: This uses availability.scope to determine if a symbol is exported.
 * Based on the codebase, "file-export" and "public" indicate exported symbols.
 *
 * @param def - Symbol definition to check
 * @returns true if the symbol is exported
 */
function is_exported(
  def:
    | FunctionDefinition
    | ClassDefinition
    | VariableDefinition
    | InterfaceDefinition
    | EnumDefinition
    | TypeAliasDefinition
    | ImportDefinition
): boolean {
  return (
    def.availability?.scope === "file-export" ||
    def.availability?.scope === "public"
  );
}

/**
 * Find a re-exported import by name (e.g., export { foo } from './bar')
 *
 * This handles the case where a file re-exports an imported symbol.
 * For example:
 *   // middle.js
 *   export { core } from './base'
 *
 * In the semantic index, this appears as an import with availability.scope = "file-export"
 *
 * @param name - Symbol name to find
 * @param index - Semantic index to search in
 * @returns Import definition or null if not found
 */
function find_reexported_import(
  name: SymbolName,
  index: SemanticIndex
): ImportDefinition | null {
  for (const [symbol_id, import_def] of index.imported_symbols) {
    if (import_def.name === name && is_exported(import_def)) {
      return import_def;
    }
  }
  return null;
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

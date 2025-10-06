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
import { is_reexport, get_export_name } from "@ariadnejs/types";
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
  const key = import_kind === "default"
    ? `${source_file}:default`
    : `${source_file}:${export_name}:${import_kind}`;

  if (visited.has(key)) {
    return null; // Circular re-export
  }
  visited.add(key);

  // Look for export in source file
  const export_info = import_kind === "default"
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
      is_reexport: is_reexport(def),
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

  // Search functions
  for (const func_def of index.functions.values()) {
    if (func_def.export?.is_default) {
      if (found) {
        throw new Error(
          `Multiple default exports found in ${index.file_path}: ${found.symbol_id} and ${func_def.symbol_id}`
        );
      }
      found = {
        symbol_id: func_def.symbol_id,
        is_reexport: func_def.export.is_reexport || false,
      };
    }
  }

  // Search classes
  for (const class_def of index.classes.values()) {
    if (class_def.export?.is_default) {
      if (found) {
        throw new Error(
          `Multiple default exports found in ${index.file_path}: ${found.symbol_id} and ${class_def.symbol_id}`
        );
      }
      found = {
        symbol_id: class_def.symbol_id,
        is_reexport: class_def.export.is_reexport || false,
      };
    }
  }

  // Search variables
  for (const var_def of index.variables.values()) {
    if (var_def.export?.is_default) {
      if (found) {
        throw new Error(
          `Multiple default exports found in ${index.file_path}: ${found.symbol_id} and ${var_def.symbol_id}`
        );
      }
      found = {
        symbol_id: var_def.symbol_id,
        is_reexport: var_def.export.is_reexport || false,
      };
    }
  }

  // Search interfaces (TypeScript only)
  for (const iface_def of index.interfaces.values()) {
    if (iface_def.export?.is_default) {
      if (found) {
        throw new Error(
          `Multiple default exports found in ${index.file_path}: ${found.symbol_id} and ${iface_def.symbol_id}`
        );
      }
      found = {
        symbol_id: iface_def.symbol_id,
        is_reexport: iface_def.export.is_reexport || false,
      };
    }
  }

  // Search enums (TypeScript only)
  for (const enum_def of index.enums.values()) {
    if (enum_def.export?.is_default) {
      if (found) {
        throw new Error(
          `Multiple default exports found in ${index.file_path}: ${found.symbol_id} and ${enum_def.symbol_id}`
        );
      }
      found = {
        symbol_id: enum_def.symbol_id,
        is_reexport: enum_def.export.is_reexport || false,
      };
    }
  }

  // Search type aliases (TypeScript only)
  for (const type_def of index.types.values()) {
    if (type_def.export?.is_default) {
      if (found) {
        throw new Error(
          `Multiple default exports found in ${index.file_path}: ${found.symbol_id} and ${type_def.symbol_id}`
        );
      }
      found = {
        symbol_id: type_def.symbol_id,
        is_reexport: type_def.export.is_reexport || false,
      };
    }
  }

  // Search re-exported imports (e.g., export { default } from './other')
  for (const import_def of index.imported_symbols.values()) {
    if (import_def.export?.is_default) {
      if (found) {
        throw new Error(
          `Multiple default exports found in ${index.file_path}: ${found.symbol_id} and ${import_def.symbol_id}`
        );
      }
      found = {
        symbol_id: import_def.symbol_id,
        is_reexport: true,
        import_def: import_def,
      };
    }
  }

  return found;
}

/**
 * Find an exported function by export name
 *
 * Searches by:
 * 1. Export alias if present (export.export_name)
 * 2. Definition name otherwise (def.name)
 *
 * This handles export aliases correctly:
 *   export { internalFunc as publicFunc }
 *   → find_exported_function("publicFunc", index) returns the definition
 */
function find_exported_function(
  export_name: SymbolName,
  index: SemanticIndex
): FunctionDefinition | null {
  for (const func_def of index.functions.values()) {
    if (matches_export_name(func_def, export_name)) {
      return func_def;
    }
  }
  return null;
}

/**
 * Find an exported class by export name
 *
 * Searches by:
 * 1. Export alias if present (export.export_name)
 * 2. Definition name otherwise (def.name)
 */
function find_exported_class(
  export_name: SymbolName,
  index: SemanticIndex
): ClassDefinition | null {
  for (const class_def of index.classes.values()) {
    if (matches_export_name(class_def, export_name)) {
      return class_def;
    }
  }
  return null;
}

/**
 * Find an exported variable by export name
 *
 * Searches by:
 * 1. Export alias if present (export.export_name)
 * 2. Definition name otherwise (def.name)
 */
function find_exported_variable(
  export_name: SymbolName,
  index: SemanticIndex
): VariableDefinition | null {
  for (const var_def of index.variables.values()) {
    if (matches_export_name(var_def, export_name)) {
      return var_def;
    }
  }
  return null;
}

/**
 * Find an exported interface by export name
 *
 * Searches by:
 * 1. Export alias if present (export.export_name)
 * 2. Definition name otherwise (def.name)
 */
function find_exported_interface(
  export_name: SymbolName,
  index: SemanticIndex
): InterfaceDefinition | null {
  for (const iface_def of index.interfaces.values()) {
    if (matches_export_name(iface_def, export_name)) {
      return iface_def;
    }
  }
  return null;
}

/**
 * Find an exported enum by export name
 *
 * Searches by:
 * 1. Export alias if present (export.export_name)
 * 2. Definition name otherwise (def.name)
 */
function find_exported_enum(
  export_name: SymbolName,
  index: SemanticIndex
): EnumDefinition | null {
  for (const enum_def of index.enums.values()) {
    if (matches_export_name(enum_def, export_name)) {
      return enum_def;
    }
  }
  return null;
}

/**
 * Find an exported type alias by export name
 *
 * Searches by:
 * 1. Export alias if present (export.export_name)
 * 2. Definition name otherwise (def.name)
 */
function find_exported_type_alias(
  export_name: SymbolName,
  index: SemanticIndex
): TypeAliasDefinition | null {
  for (const type_def of index.types.values()) {
    if (matches_export_name(type_def, export_name)) {
      return type_def;
    }
  }
  return null;
}

/**
 * Check if a definition is exported
 *
 * Uses the is_exported flag which is set based on language-specific export conventions.
 * Falls back to checking availability.scope for backwards compatibility with definitions
 * that haven't been updated yet.
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
  // Use the new is_exported field
  if (def.is_exported !== undefined) {
    return def.is_exported;
  }

  // Fallback to old availability.scope check for backwards compatibility
  return (
    def.availability?.scope === "file-export" ||
    def.availability?.scope === "public"
  );
}

/**
 * Check if a definition matches the requested export name
 *
 * This is the core logic for export alias resolution. It checks:
 * 1. If the definition is exported
 * 2. If the effective export name (considering aliases) matches the requested name
 *
 * IMPORTANT: This handles export aliases correctly.
 * Example: export { internalName as publicName }
 *   - def.name = "internalName"
 *   - def.export.export_name = "publicName"
 *   - matches_export_name(def, "publicName") = true ✅
 *   - matches_export_name(def, "internalName") = false ❌
 *
 * @param def - Symbol definition to check
 * @param export_name - Name as it appears in the import statement
 * @returns true if this definition should be imported with this name
 */
function matches_export_name(
  def:
    | FunctionDefinition
    | ClassDefinition
    | VariableDefinition
    | InterfaceDefinition
    | EnumDefinition
    | TypeAliasDefinition
    | ImportDefinition,
  export_name: SymbolName
): boolean {
  if (!is_exported(def)) {
    return false;
  }
  return get_export_name(def) === export_name;
}

/**
 * Find a re-exported import by export name (e.g., export { foo } from './bar')
 *
 * This handles the case where a file re-exports an imported symbol.
 * For example:
 *   // middle.js
 *   export { core } from './base'
 *   export { core as publicCore } from './base'  // with alias
 *
 * In the semantic index, this appears as an import with is_exported = true
 *
 * @param export_name - Symbol name as it appears in the import statement
 * @param index - Semantic index to search in
 * @returns Import definition or null if not found
 */
function find_reexported_import(
  export_name: SymbolName,
  index: SemanticIndex
): ImportDefinition | null {
  for (const import_def of index.imported_symbols.values()) {
    if (matches_export_name(import_def, export_name)) {
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

/**
 * Rust import handler
 *
 * Handles Rust use statements and module resolution
 * including crate dependencies and local modules.
 */

import * as path from "path";
import * as fs from "fs";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Import,
  Export,
  SymbolDefinition,
  NamedImport,
  NamedExport,
} from "@ariadnejs/types";
import type { LanguageImportHandler } from "../import_types";

/**
 * Create a Rust import handler
 */
export function create_rust_handler(): LanguageImportHandler {
  return {
    resolve_module_path: resolve_rust_module_path,
    match_import_to_export: match_rust_import_to_export,
  };
}

/**
 * Resolve Rust module paths
 */
function resolve_rust_module_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // Rust uses are either:
  // 1. Local module declarations (mod module_name)
  // 2. Crate dependencies (use other_crate::item)
  // 3. Standard library (use std::collections::HashMap)
  // 4. Self/super/crate references

  // Handle self:: references (current module)
  if (import_path.startsWith("self::")) {
    const module_path = import_path.substring(6);
    return resolve_rust_relative_module(module_path, importing_file, 0);
  }

  // Handle super:: references (parent module)
  if (import_path.startsWith("super::")) {
    const module_path = import_path.substring(7);
    return resolve_rust_relative_module(module_path, importing_file, 1);
  }

  // Handle crate:: references (crate root)
  if (import_path.startsWith("crate::")) {
    const module_path = import_path.substring(7);
    return resolve_rust_from_crate_root(module_path, importing_file);
  }

  // Check if it's a crate import or nested module path
  if (import_path.includes("::")) {
    const crate_name = import_path.split("::")[0];

    // Standard library crates
    if (is_rust_std_crate(crate_name)) {
      return null; // Built-in crate
    }

    // Check if it might be an external crate (by trying to resolve it as such)
    const external_result = resolve_rust_external_crate(crate_name, import_path, importing_file);
    if (external_result) {
      return external_result;
    }

    // If not an external crate, treat as nested local module path
    // Convert :: to path components and resolve locally
    const path_components = import_path.split("::");
    const current_dir = path.dirname(importing_file);
    return find_rust_module_file(current_dir, path_components);
  }

  // Simple local module (relative to current file)
  return resolve_rust_local_module(import_path, importing_file);
}

/**
 * Resolve Rust relative modules (self:: and super::)
 */
function resolve_rust_relative_module(
  module_path: string,
  importing_file: FilePath,
  levels_up: number
): FilePath | null {
  let current_dir = path.dirname(importing_file);

  // Navigate up the specified number of levels
  for (let i = 0; i < levels_up; i++) {
    current_dir = path.dirname(current_dir);
  }

  if (!module_path) {
    // Importing the parent module itself
    const parent_mod = path.join(current_dir, "mod.rs");
    if (fs.existsSync(parent_mod)) {
      return parent_mod as FilePath;
    }
    // Or it might be named after the directory
    const parent_name = path.basename(current_dir);
    const parent_file = path.join(path.dirname(current_dir), parent_name + ".rs");
    if (fs.existsSync(parent_file)) {
      return parent_file as FilePath;
    }
    return null;
  }

  // Convert module path (mod1::mod2) to file path
  const path_components = module_path.split("::");
  return find_rust_module_file(current_dir, path_components);
}

/**
 * Resolve from crate root (crate::)
 */
function resolve_rust_from_crate_root(
  module_path: string,
  importing_file: FilePath
): FilePath | null {
  // Find the crate root (src/lib.rs or src/main.rs)
  const crate_root = find_crate_root(importing_file);
  if (!crate_root) {
    return null;
  }

  if (!module_path) {
    return crate_root;
  }

  // Resolve the module path from the crate root
  const crate_dir = path.dirname(crate_root);
  const path_components = module_path.split("::");
  return find_rust_module_file(crate_dir, path_components);
}

/**
 * Find the crate root for a Rust file
 */
function find_crate_root(file_path: FilePath): FilePath | null {
  let current_dir = path.dirname(file_path);
  const visited = new Set<string>();

  while (current_dir !== path.dirname(current_dir)) {
    if (visited.has(current_dir)) {
      break;
    }
    visited.add(current_dir);

    // Check for src/lib.rs or src/main.rs
    const src_dir = path.join(current_dir, "src");
    if (fs.existsSync(src_dir)) {
      const lib_rs = path.join(src_dir, "lib.rs");
      if (fs.existsSync(lib_rs)) {
        return lib_rs as FilePath;
      }

      const main_rs = path.join(src_dir, "main.rs");
      if (fs.existsSync(main_rs)) {
        return main_rs as FilePath;
      }
    }

    // Check for Cargo.toml to know we're at the crate root
    const cargo_toml = path.join(current_dir, "Cargo.toml");
    if (fs.existsSync(cargo_toml)) {
      // We're at the crate root, but no lib.rs or main.rs found
      break;
    }

    current_dir = path.dirname(current_dir);
  }

  return null;
}

/**
 * Resolve local Rust modules
 */
function resolve_rust_local_module(
  module_name: string,
  importing_file: FilePath
): FilePath | null {
  const current_dir = path.dirname(importing_file);
  return find_rust_module_file(current_dir, [module_name]);
}


/**
 * Find a Rust module file given a base directory and module path components
 */
function find_rust_module_file(
  base_dir: string,
  path_components: string[]
): FilePath | null {
  if (path_components.length === 0) {
    return null;
  }

  let current_dir = base_dir;

  // Process all but the last component as directories
  for (let i = 0; i < path_components.length - 1; i++) {
    const component = path_components[i];

    // Try as a directory first
    const dir_path = path.join(current_dir, component);
    if (fs.existsSync(dir_path)) {
      const stats = fs.statSync(dir_path);
      if (stats.isDirectory()) {
        current_dir = dir_path;
        continue;
      }
    }

    // Check if it's a file module (component.rs) - can't navigate into file modules
    const file_module = path.join(current_dir, component + ".rs");
    if (fs.existsSync(file_module)) {
      return null;
    }

    // Module path not found
    return null;
  }

  // Process the last component
  const last_component = path_components[path_components.length - 1];

  // Try as a file module (module.rs)
  const module_file = path.join(current_dir, last_component + ".rs");
  if (fs.existsSync(module_file)) {
    return module_file as FilePath;
  }

  // Try as a directory module with mod.rs
  const mod_file = path.join(current_dir, last_component, "mod.rs");
  if (fs.existsSync(mod_file)) {
    return mod_file as FilePath;
  }

  return null;
}

/**
 * Resolve external crate imports
 */
function resolve_rust_external_crate(
  crate_name: string,
  _import_path: string,
  importing_file: FilePath
): FilePath | null {
  // This would require parsing Cargo.toml to find the crate location
  // For now, we'll try some common patterns

  // Look for workspace members
  let current_dir = path.dirname(importing_file);
  const visited = new Set<string>();

  while (current_dir !== path.dirname(current_dir)) {
    if (visited.has(current_dir)) {
      break;
    }
    visited.add(current_dir);

    // Check if this directory has the crate
    const crate_dir = path.join(current_dir, crate_name);
    if (fs.existsSync(crate_dir)) {
      const lib_rs = path.join(crate_dir, "src", "lib.rs");
      if (fs.existsSync(lib_rs)) {
        return lib_rs as FilePath;
      }
    }

    // Check for Cargo.toml to see if we're at workspace root
    const cargo_toml = path.join(current_dir, "Cargo.toml");
    if (fs.existsSync(cargo_toml)) {
      // Try workspace members pattern
      const members_pattern = path.join(current_dir, "*", "Cargo.toml");
      // This is simplified - real implementation would parse Cargo.toml
      break;
    }

    current_dir = path.dirname(current_dir);
  }

  return null;
}

/**
 * Check if a crate is from the Rust standard library
 */
function is_rust_std_crate(crate_name: string): boolean {
  const std_crates = new Set([
    "std", "core", "alloc", "proc_macro", "test",
  ]);
  return std_crates.has(crate_name);
}

/**
 * Match Rust imports to their corresponding exports
 */
function match_rust_import_to_export(
  import_stmt: Import,
  source_exports: readonly Export[],
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): Map<SymbolName, SymbolId> {
  const result = new Map<SymbolName, SymbolId>();

  // Rust uses pub for exports
  // The import system in Rust is simpler - we just match names directly

  switch (import_stmt.kind) {
    case "named":
      return match_rust_named_import(import_stmt as NamedImport, source_exports);

    case "default":
      // Rust doesn't have default imports, but we might use this
      // for simple "use module" statements
      const default_import = import_stmt as any;
      if (default_import.name) {
        // Find a matching pub item
        for (const exp of source_exports) {
          if (exp.symbol_name === default_import.name) {
            result.set(default_import.name, exp.symbol);
            break;
          }
        }
      }
      return result;

    case "namespace":
      // Rust doesn't have namespace imports like JS
      // but "use module::*" is similar
      // For now, we'll handle it as importing the module itself
      const namespace = import_stmt as any;
      if (namespace.namespace_name) {
        // Find the module symbol
        const module_symbol = find_rust_module_symbol(source_symbols);
        if (module_symbol) {
          result.set(namespace.namespace_name as SymbolName, module_symbol);
        }
      }
      return result;

    case "side_effect":
      // No symbols imported
      return result;

    default:
      return result;
  }
}

/**
 * Match Rust named imports
 */
function match_rust_named_import(
  import_stmt: NamedImport,
  source_exports: readonly Export[]
): Map<SymbolName, SymbolId> {
  const result = new Map<SymbolName, SymbolId>();

  for (const import_item of import_stmt.imports) {
    const imported_name = import_item.name;
    const local_name = import_item.alias || import_item.name;

    // Find matching export (must be pub)
    for (const exp of source_exports) {
      if (exp.kind === "named") {
        const named_export = exp as NamedExport;
        for (const export_item of named_export.exports) {
          const export_name = export_item.export_name || export_item.local_name;
          if (export_name === imported_name) {
            result.set(local_name, named_export.symbol);
            break;
          }
        }
      } else if (exp.symbol_name === imported_name) {
        // Direct symbol export
        result.set(local_name, exp.symbol);
      }
    }
  }

  return result;
}

/**
 * Find the module symbol for a Rust file
 */
function find_rust_module_symbol(
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): SymbolId | null {
  // In Rust, modules are represented as namespaces in our type system
  for (const [symbol_id, symbol_def] of source_symbols) {
    if (symbol_def.kind === "namespace") {
      return symbol_id;
    }
  }

  // Return first symbol as fallback
  const first_symbol = source_symbols.keys().next();
  return first_symbol.done ? null : first_symbol.value;
}
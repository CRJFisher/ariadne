/**
 * Rust import resolution functions
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
  NamespaceImport,
  NamedExport,
} from "@ariadnejs/types";
import { RUST_CONFIG } from "./language_config";

/**
 * Resolve Rust module paths
 */
export function resolve_rust_module_path(
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
  // Count how many consecutive super:: are at the beginning
  if (import_path.startsWith("super::")) {
    let levels_up = 0;
    let remaining_path = import_path;
    while (remaining_path.startsWith("super::")) {
      levels_up++;
      remaining_path = remaining_path.substring(7);
    }
    return resolve_rust_relative_module(remaining_path, importing_file, levels_up);
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

    // Check for lib.rs or main.rs directly in current directory
    const direct_lib = path.join(current_dir, "lib.rs");
    if (fs.existsSync(direct_lib)) {
      return direct_lib as FilePath;
    }

    const direct_main = path.join(current_dir, "main.rs");
    if (fs.existsSync(direct_main)) {
      return direct_main as FilePath;
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

  // Build the full directory path for all but the last component
  const dir_path = path_components.length > 1
    ? path.join(base_dir, ...path_components.slice(0, -1))
    : base_dir;

  const last_component = path_components[path_components.length - 1];

  // Try as a file module (module.rs)
  const module_file = path.join(dir_path, last_component + ".rs");
  if (fs.existsSync(module_file)) {
    return module_file as FilePath;
  }

  // Try as a directory module with mod.rs
  const mod_file = path.join(dir_path, last_component, "mod.rs");
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

    // Check if this directory has the crate directly
    const crate_dir = path.join(current_dir, crate_name);
    if (fs.existsSync(crate_dir)) {
      const lib_rs = path.join(crate_dir, "src", "lib.rs");
      if (fs.existsSync(lib_rs)) {
        return lib_rs as FilePath;
      }
    }

    // Check common workspace member locations
    const workspace_subdirs = ["libs", "crates", "packages", "members"];
    for (const subdir of workspace_subdirs) {
      const workspace_crate_dir = path.join(current_dir, subdir, crate_name);
      if (fs.existsSync(workspace_crate_dir)) {
        const lib_rs = path.join(workspace_crate_dir, "src", "lib.rs");
        if (fs.existsSync(lib_rs)) {
          return lib_rs as FilePath;
        }
      }
    }

    // Check for Cargo.toml to see if we're at workspace root
    const cargo_toml = path.join(current_dir, "Cargo.toml");
    if (fs.existsSync(cargo_toml)) {
      // We're at workspace root, stop searching upward
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
  return RUST_CONFIG.builtin_modules.has(crate_name);
}

/**
 * Match Rust imports to their corresponding exports
 */
export function match_rust_import_to_export(
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
      const default_import = import_stmt;
      if (default_import.name) {
        // Find a matching pub item in exports
        let found = false;
        for (const exp of source_exports) {
          if (exp.symbol_name === default_import.name || (exp as Export).name === default_import.name) {
            result.set(default_import.name, exp.symbol);
            found = true;
            break;
          }
        }

        // If not found in exports, check for module symbol
        if (!found) {
          for (const [symbol_id, symbol_def] of source_symbols) {
            if (symbol_def.name === default_import.name && (symbol_def.kind as string) === "module") {
              result.set(default_import.name, symbol_id);
              break;
            }
          }
        }
      }
      return result;

    case "namespace":
      // Rust doesn't have namespace imports like JS
      // but "use module::*" is similar
      // For glob imports, we'll map "*" to the first export if available
      const namespace = import_stmt as NamespaceImport | Import;
      const namespace_name = (namespace as NamespaceImport).namespace_name ||
                              (namespace as Import).name;

      if (namespace_name && source_exports.length > 0) {
        // For glob imports (use module::*), map to first export's symbol
        result.set(namespace_name as unknown as SymbolName, source_exports[0].symbol);
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
        // Handle both formats: exports array or simple name field
        if ((named_export as any).exports) {
          for (const export_item of named_export.exports) {
            const export_name = export_item.export_name || export_item.local_name;
            if (export_name === imported_name) {
              result.set(local_name, named_export.symbol);
              break;
            }
          }
        } else if ((exp as Export).name === imported_name) {
          // Simple Export with matching name
          result.set(local_name, (exp as Export).symbol);
        }
      } else if (exp.symbol_name === imported_name) {
        // Direct symbol export
        result.set(local_name, exp.symbol);
      }
    }
  }

  return result;
}


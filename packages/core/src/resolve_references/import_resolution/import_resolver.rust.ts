/**
 * Rust Module Resolution
 *
 * Resolves Rust use paths to absolute file paths following Rust
 * module resolution rules.
 */

import * as path from "path";
import * as fs from "fs";
import type { FilePath } from "@ariadnejs/types";

/**
 * Resolve Rust module path to absolute file path
 *
 * Rules:
 * 1. Use statements: use crate::module;, use super::sibling;
 * 2. Module hierarchy: mod.rs, inline mod declarations
 * 3. Extensions: .rs
 * 4. Crate root: lib.rs or main.rs
 * 5. External crates: Cargo.toml dependencies (future)
 *
 * @param import_path - Use path from use statement
 * @param importing_file - Absolute path to file containing the use
 * @returns Absolute path to the imported file
 */
export function resolve_module_path_rust(
  import_path: string,
  importing_file: FilePath
): FilePath {
  // Parse use path: "crate::module::submodule"
  const parts = import_path.split("::");

  if (parts[0] === "crate") {
    // Absolute from crate root
    return resolve_from_crate_root(parts.slice(1), importing_file);
  } else if (parts[0] === "super") {
    // Relative to parent module
    return resolve_from_parent(parts.slice(1), importing_file);
  } else if (parts[0] === "self") {
    // Current module
    return resolve_from_current(parts.slice(1), importing_file);
  } else {
    // External crate (future: Cargo.toml resolution)
    return import_path as FilePath;
  }
}

/**
 * Resolve from crate root
 */
function resolve_from_crate_root(
  module_parts: string[],
  base_file: FilePath
): FilePath {
  const crate_root = find_rust_crate_root(base_file);
  return resolve_rust_module_path(crate_root, module_parts);
}

/**
 * Resolve from parent module
 *
 * In Rust:
 * - If current file is a module file (e.g., utils.rs), parent is the directory containing it
 * - If current file is mod.rs, parent is the directory containing the parent directory
 */
function resolve_from_parent(
  module_parts: string[],
  base_file: FilePath
): FilePath {
  const base_name = path.basename(base_file);
  const current_dir = path.dirname(base_file);

  // If this is a mod.rs file, go up two levels
  // Otherwise, stay at current directory (parent module is in same dir)
  const parent_dir = base_name === "mod.rs"
    ? path.dirname(current_dir)
    : current_dir;

  return resolve_rust_module_path(parent_dir, module_parts);
}

/**
 * Resolve from current module
 */
function resolve_from_current(
  module_parts: string[],
  base_file: FilePath
): FilePath {
  const current_dir = path.dirname(base_file);
  return resolve_rust_module_path(current_dir, module_parts);
}

/**
 * Resolve Rust module path parts to file path
 */
function resolve_rust_module_path(
  base_dir: string,
  module_parts: string[]
): FilePath {
  let current_path = base_dir;

  for (let i = 0; i < module_parts.length; i++) {
    const part = module_parts[i];
    const is_last = i === module_parts.length - 1;

    // Try module file or module directory
    const candidates = [
      path.join(current_path, `${part}.rs`),
      path.join(current_path, part, "mod.rs"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        if (is_last) {
          return candidate as FilePath;
        } else {
          // Continue into subdirectory
          current_path = path.dirname(candidate);
          break;
        }
      }
    }
  }

  // Fallback
  return path.join(base_dir, `${module_parts.join("/")}.rs`) as FilePath;
}

/**
 * Find Rust crate root by looking for lib.rs, main.rs, or Cargo.toml
 */
function find_rust_crate_root(start_file: FilePath): string {
  let current = path.dirname(start_file);

  while (true) {
    // Look for lib.rs or main.rs
    if (
      fs.existsSync(path.join(current, "lib.rs")) ||
      fs.existsSync(path.join(current, "main.rs"))
    ) {
      return current;
    }

    // Look for Cargo.toml
    if (fs.existsSync(path.join(current, "Cargo.toml"))) {
      // Check for src/ directory
      const src_dir = path.join(current, "src");
      if (fs.existsSync(src_dir)) {
        return src_dir;
      }
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.dirname(start_file);
}

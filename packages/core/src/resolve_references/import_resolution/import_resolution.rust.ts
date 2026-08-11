/**
 * Rust Module Resolution
 *
 * Resolves Rust use paths to absolute file paths following Rust
 * module resolution rules.
 */

import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import type { FileSystemFolder } from "../file_folders";
import { has_file_in_tree } from "../file_folders";

/**
 * Resolve a Rust `use` module path to an absolute file path. The leading segment
 * selects the base: `crate` is the crate root, `super` the parent module, `self`
 * the current module, and any other segment names a local module relative to the
 * importing file. When a bare path resolves to no local file it is an external
 * crate, whose path is returned opaquely for callers to key on.
 */
export function resolve_module_path_rust(
  import_path: string,
  importing_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const parts = import_path.split("::");

  if (parts[0] === "crate") {
    return resolve_from_crate_root(parts.slice(1), importing_file, root_folder);
  } else if (parts[0] === "super") {
    return resolve_from_parent(parts.slice(1), importing_file, root_folder);
  } else if (parts[0] === "self") {
    return resolve_from_current(parts.slice(1), importing_file, root_folder);
  } else {
    const resolved = resolve_local_module(parts, importing_file, root_folder);

    if (has_file_in_tree(resolved, root_folder)) {
      return resolved;
    }

    return import_path as FilePath;
  }
}

/**
 * The directory a module file's children live in. A `mod.rs` and a crate root
 * own the directory they sit in; any other module file owns the sibling
 * directory named after it (`src/deep.rs` owns `src/deep/`), which is how a
 * 2018-style crate lays its tree out.
 */
function module_child_dir(module_file: FilePath): string {
  const dir = path.dirname(module_file);
  const base = path.basename(module_file);
  if (base === "mod.rs" || base === "lib.rs" || base === "main.rs") {
    return dir;
  }
  return path.join(dir, base.replace(/\.rs$/, ""));
}

/**
 * Resolve a module path against the importing file's own module, preferring
 * its 2018-style child directory and falling back to its own directory so a
 * crate that keeps siblings flat still resolves.
 */
function resolve_local_module(
  module_parts: string[],
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const child_dir = module_child_dir(base_file);
  const from_child = resolve_rust_module_path(child_dir, module_parts, root_folder);
  if (has_file_in_tree(from_child, root_folder)) {
    return from_child;
  }
  return resolve_rust_module_path(
    path.dirname(base_file),
    module_parts,
    root_folder
  );
}

function resolve_from_crate_root(
  module_parts: string[],
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const crate_root = find_rust_crate_root(base_file, root_folder);
  // `use crate::S` names an item of the crate root itself, not a module under
  // it; resolve to the root file so the item is looked up in its exports.
  if (module_parts.length === 0) {
    return crate_root_file(crate_root, root_folder);
  }
  return resolve_rust_module_path(crate_root, module_parts, root_folder);
}

/**
 * The crate root's own file. `lib.rs` wins over `main.rs` for a crate that has
 * both, matching the library-first convention.
 */
function crate_root_file(
  crate_root_dir: string,
  root_folder: FileSystemFolder
): FilePath {
  const lib = path.join(crate_root_dir, "lib.rs") as FilePath;
  if (has_file_in_tree(lib, root_folder)) {
    return lib;
  }
  return path.join(crate_root_dir, "main.rs") as FilePath;
}

/**
 * A `mod.rs` file represents its containing directory, so its parent module
 * lives one directory further up; any other module file shares its directory
 * with its siblings, so its parent module resolves from that same directory.
 * The caller strips the first `super`; each additional leading `super` climbs
 * one more directory — after the first hop we are already in module-directory
 * space, so the mod.rs distinction does not reapply.
 */
function resolve_from_parent(
  module_parts: string[],
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const base_name = path.basename(base_file);
  const current_dir = path.dirname(base_file);

  let parent_dir =
    base_name === "mod.rs" ? path.dirname(current_dir) : current_dir;

  let remaining = module_parts;
  while (remaining[0] === "super") {
    parent_dir = path.dirname(parent_dir);
    remaining = remaining.slice(1);
  }

  // `use super::Item` names an item of the parent module itself; resolve to
  // that module's own file rather than a module beneath it.
  if (remaining.length === 0) {
    return parent_module_file(parent_dir, root_folder);
  }

  return resolve_rust_module_path(parent_dir, remaining, root_folder);
}

/**
 * The file backing the module that owns `module_dir`: its `mod.rs`, or the
 * sibling `<module_dir>.rs` a 2018-style crate uses instead.
 */
function parent_module_file(
  module_dir: string,
  root_folder: FileSystemFolder
): FilePath {
  const mod_rs = path.join(module_dir, "mod.rs") as FilePath;
  if (has_file_in_tree(mod_rs, root_folder)) {
    return mod_rs;
  }
  return `${module_dir}.rs` as FilePath;
}

function resolve_from_current(
  module_parts: string[],
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  // `use self::Item` names an item of this module.
  if (module_parts.length === 0) {
    return base_file;
  }
  return resolve_local_module(module_parts, base_file, root_folder);
}

/**
 * Walk each module segment to a file, trying `module.rs` before `module/mod.rs`.
 * When no segment matches, return the inferred `module.rs` path so callers get a
 * stable target.
 */
function resolve_rust_module_path(
  base_dir: string,
  module_parts: string[],
  root_folder: FileSystemFolder
): FilePath {
  let current_path = base_dir;

  for (let i = 0; i < module_parts.length; i++) {
    const part = module_parts[i];
    const is_last = i === module_parts.length - 1;

    const candidates = [
      path.join(current_path, `${part}.rs`),
      path.join(current_path, part, "mod.rs"),
    ];

    for (const candidate of candidates) {
      if (has_file_in_tree(candidate as FilePath, root_folder)) {
        if (is_last) {
          return candidate as FilePath;
        } else {
          // mod.rs style keeps submodules in the mod.rs directory; module.rs
          // style (Rust 2018+) keeps them in a sibling `module/` directory.
          const is_mod_rs = path.basename(candidate) === "mod.rs";
          current_path = is_mod_rs
            ? path.dirname(candidate)
            : path.join(current_path, part);
          break;
        }
      }
    }
  }

  return path.join(base_dir, `${module_parts.join("/")}.rs`) as FilePath;
}

/**
 * Walk up from the importing file to the crate root, recognized by an adjacent
 * `lib.rs`/`main.rs`, or by a `Cargo.toml` whose `src/` holds one. Falls back to
 * the importing file's own directory when no crate marker is found.
 */
function find_rust_crate_root(
  start_file: FilePath,
  root_folder: FileSystemFolder
): string {
  let current = path.dirname(start_file);

  while (true) {
    if (
      has_file_in_tree(path.join(current, "lib.rs") as FilePath, root_folder) ||
      has_file_in_tree(path.join(current, "main.rs") as FilePath, root_folder)
    ) {
      return current;
    }

    if (
      has_file_in_tree(path.join(current, "Cargo.toml") as FilePath, root_folder)
    ) {
      const src_dir = path.join(current, "src");
      if (
        has_file_in_tree(path.join(src_dir, "lib.rs") as FilePath, root_folder) ||
        has_file_in_tree(path.join(src_dir, "main.rs") as FilePath, root_folder)
      ) {
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

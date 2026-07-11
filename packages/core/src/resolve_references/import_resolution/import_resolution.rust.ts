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
 * Candidate paths are built as absolute paths via `path.join`, but the tree is
 * keyed relative to its root, so strip the root prefix before the lookup.
 */
function file_exists(
  file_path: FilePath,
  root_folder: FileSystemFolder
): boolean {
  const relative = file_path.startsWith(root_folder.path)
    ? path.relative(root_folder.path, file_path)
    : file_path;
  return has_file_in_tree(relative as FilePath, root_folder);
}

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
    const current_dir = path.dirname(importing_file);
    const resolved = resolve_rust_module_path(current_dir, parts, root_folder);

    if (file_exists(resolved, root_folder)) {
      return resolved;
    }

    return import_path as FilePath;
  }
}

function resolve_from_crate_root(
  module_parts: string[],
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const crate_root = find_rust_crate_root(base_file, root_folder);
  return resolve_rust_module_path(crate_root, module_parts, root_folder);
}

/**
 * A `mod.rs` file represents its containing directory, so its parent module
 * lives one directory further up; any other module file shares its directory
 * with its siblings, so its parent module resolves from that same directory.
 */
function resolve_from_parent(
  module_parts: string[],
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const base_name = path.basename(base_file);
  const current_dir = path.dirname(base_file);

  const parent_dir =
    base_name === "mod.rs" ? path.dirname(current_dir) : current_dir;

  return resolve_rust_module_path(parent_dir, module_parts, root_folder);
}

function resolve_from_current(
  module_parts: string[],
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const current_dir = path.dirname(base_file);
  return resolve_rust_module_path(current_dir, module_parts, root_folder);
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
      if (file_exists(candidate as FilePath, root_folder)) {
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
      file_exists(path.join(current, "lib.rs") as FilePath, root_folder) ||
      file_exists(path.join(current, "main.rs") as FilePath, root_folder)
    ) {
      return current;
    }

    if (
      file_exists(path.join(current, "Cargo.toml") as FilePath, root_folder)
    ) {
      const src_dir = path.join(current, "src");
      if (
        file_exists(path.join(src_dir, "lib.rs") as FilePath, root_folder) ||
        file_exists(path.join(src_dir, "main.rs") as FilePath, root_folder)
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

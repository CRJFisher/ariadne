import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import type { FileSystemFolder } from "../file_folders";
import { has_file_in_tree } from "../file_folders";
import type { ModuleResolutionContext } from "./import_resolution";

/**
 * Resolve a TypeScript import path to a file path.
 *
 * Relative imports (`./`, `../`) are probed against the file tree for `.ts`,
 * `.tsx`, `.js`, `.jsx` extensions and `index.*` files. A bare specifier is
 * resolved through the project's specifier index — a tsconfig `paths` alias
 * declared by a config that governs the importing file, or a workspace package
 * name — and stays opaque when the index does not name it, because then it is
 * a genuinely external module.
 *
 * @param import_path - Import path from import statement
 * @param importing_file - Path to file containing the import (absolute or relative to the root folder)
 * @param modules - The project's file tree and specifier index
 * @returns Path to the imported file (relative to the root folder if importing_file is relative, absolute otherwise)
 */
export function resolve_module_path_typescript(
  import_path: string,
  importing_file: FilePath,
  modules: ModuleResolutionContext
): FilePath {
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    return resolve_relative_typescript(
      import_path,
      importing_file,
      modules.root_folder
    );
  }

  return resolve_bare_typescript(import_path, importing_file, modules);
}

/** A specifier index entry that claims a specifier, and how much of it it claims. */
interface SpecifierMatch {
  readonly key: string;
  readonly target: FilePath;
}

/**
 * Resolve a bare specifier through the specifier index: a `paths` alias the
 * importing file's own configs declare first, then the project's package
 * names. The alias target is probed the same way a relative path is, so a
 * directory target lands on its `index.*`.
 *
 * An entry may name a file rather than a directory — a package whose `exports`
 * declares its entry point does. A deeper specifier the index does not list
 * sits beside that file rather than under it, so the remainder joins onto its
 * directory: `@scope/pkg/util` with a `pkg/src/index.ts` entry is
 * `pkg/src/util`.
 */
function resolve_bare_typescript(
  import_path: string,
  importing_file: FilePath,
  modules: ModuleResolutionContext
): FilePath {
  const match =
    governing_alias(import_path, importing_file, modules) ??
    longest_matching_entry(import_path, modules.specifiers.package_roots);
  if (match === null) {
    return import_path as FilePath;
  }

  const { target } = match;
  const remainder = import_path.slice(match.key.length).replace(/^\//, "");
  if (!remainder) {
    return (probe_candidates(target, modules.root_folder) ??
      import_path) as FilePath;
  }

  // Probing decides whether the entry named a file or a directory, which the
  // path alone cannot: a `paths` alias routinely names a file without its
  // extension. A deeper specifier sits beside the file an entry names, and
  // inside a directory it names — probing the entry and taking its parent is
  // both, because a directory probes to its own `index.*`.
  const entry_file = probe_candidates(target, modules.root_folder);
  const join_base = entry_file ? path.dirname(entry_file) : target;

  const found = probe_candidates(
    path.join(join_base, remainder),
    modules.root_folder
  );
  return (found ?? import_path) as FilePath;
}

/**
 * The alias a config governing the importing file gives the specifier, nearest
 * config first. `@/*` is the conventional self-alias, so sibling packages
 * declare the same key against different `src/` directories, and only the
 * config the file sits under says which one this file meant.
 *
 * A config that declares nothing about the specifier is not an answer, so the
 * walk continues past it to the config above — a repo-root config's aliases
 * reach the packages beneath it whether or not they extend it.
 */
function governing_alias(
  import_path: string,
  importing_file: FilePath,
  modules: ModuleResolutionContext
): SpecifierMatch | null {
  const { config_aliases } = modules.specifiers;
  const absolute_file = path.isAbsolute(importing_file)
    ? importing_file
    : path.resolve(modules.root_folder.path, importing_file);

  let directory = path.dirname(absolute_file);
  for (;;) {
    const aliases = config_aliases.get(directory as FilePath);
    const match = aliases
      ? longest_matching_entry(import_path, aliases)
      : null;
    if (match !== null) {
      return match;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
}

/**
 * The entry claiming the longest prefix of the specifier, so `@scope/pkg/sub`
 * prefers a `@scope/pkg/sub` entry over `@scope/pkg`.
 */
function longest_matching_entry(
  import_path: string,
  entries: ReadonlyMap<string, FilePath>
): SpecifierMatch | null {
  let match: SpecifierMatch | null = null;
  for (const [key, target] of entries) {
    const matches = import_path === key || import_path.startsWith(`${key}/`);
    if (matches && key.length > (match === null ? -1 : match.key.length)) {
      match = { key, target };
    }
  }
  return match;
}

/**
 * Probe the file tree for the source a specifier target names: the path
 * itself, each source extension, and the directory's `index.*`. TypeScript's
 * ESM convention writes `.js` on the specifier while the source on disk is
 * `.ts`, so an extensioned specifier probes the TypeScript source first.
 * Returns the absolute path of the first candidate present, else null.
 */
function probe_candidates(
  absolute_base: string,
  root_folder: FileSystemFolder
): string | null {
  const ext = path.extname(absolute_base);
  const base_path_without_ext =
    ext === ".js" || ext === ".mjs" || ext === ".jsx"
      ? absolute_base.slice(0, -ext.length)
      : absolute_base;

  const candidates = [
    ...(ext === ".js" || ext === ".mjs"
      ? [`${base_path_without_ext}.ts`, `${base_path_without_ext}.tsx`]
      : []),
    ...(ext === ".jsx" ? [`${base_path_without_ext}.tsx`] : []),
    absolute_base,
    `${absolute_base}.ts`,
    `${absolute_base}.tsx`,
    `${absolute_base}.js`,
    `${absolute_base}.jsx`,
    path.join(absolute_base, "index.ts"),
    path.join(absolute_base, "index.tsx"),
    path.join(absolute_base, "index.js"),
    ...(ext === ".js" || ext === ".mjs"
      ? [
          path.join(base_path_without_ext, "index.ts"),
          path.join(base_path_without_ext, "index.tsx"),
        ]
      : []),
  ];

  for (const candidate of candidates) {
    const relative_candidate = path.relative(root_folder.path, candidate);
    if (has_file_in_tree(relative_candidate as FilePath, root_folder)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Resolve relative TypeScript import
 *
 * @param relative_path - Relative import path
 * @param base_file - File containing the import
 * @param root_folder - Root of the file system tree
 * @returns Path to the imported file (relative to root_folder if base_file is relative, absolute if base_file is absolute)
 */
function resolve_relative_typescript(
  relative_path: string,
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const is_absolute_path = path.isAbsolute(base_file);

  // The file tree is keyed relative to root_folder.path, so resolution runs in
  // absolute space and converts back to relative at each lookup.
  const absolute_base_file = is_absolute_path
    ? base_file
    : path.resolve(root_folder.path, base_file);
  const base_dir = path.dirname(absolute_base_file);
  const resolved_absolute = path.resolve(base_dir, relative_path);

  // TypeScript's ESM convention writes the `.js` extension on the specifier
  // while the on-disk source is `.ts`, so a `.js`/`.mjs`/`.jsx` specifier is
  // stripped to probe the TypeScript source first.
  const ext = path.extname(resolved_absolute);
  const base_path_without_ext =
    ext === ".js" || ext === ".mjs" || ext === ".jsx"
      ? resolved_absolute.slice(0, -ext.length)
      : resolved_absolute;

  let found_absolute = probe_candidates(resolved_absolute, root_folder);

  // No file matched: infer an extension so downstream stages still get a stable
  // target, preferring the TypeScript source for ESM `.js`/`.jsx` specifiers.
  if (!found_absolute) {
    if (ext === ".js" || ext === ".mjs") {
      found_absolute = `${base_path_without_ext}.ts`;
    } else if (ext === ".jsx") {
      found_absolute = `${base_path_without_ext}.tsx`;
    } else if (!ext || ![".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      found_absolute = `${resolved_absolute}.ts`;
    } else {
      found_absolute = resolved_absolute;
    }
  }

  if (is_absolute_path) {
    return found_absolute as FilePath;
  } else {
    return path.relative(root_folder.path, found_absolute) as FilePath;
  }
}

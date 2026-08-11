/**
 * Module Specifier Index
 *
 * Answers the one question the file tree cannot: which directory a package or
 * crate *name* denotes. Built once per project from the manifests on disk, so
 * a bare specifier (`@nestjs/common`, `sqlx_core::raw_sql`) resolves to a
 * project file instead of staying an opaque string.
 */

import * as path from "path";
import { readFile } from "fs/promises";
import type { FilePath } from "@ariadnejs/types";
import type { FileSystemFolder } from "../file_folders";

export interface ModuleSpecifierIndex {
  /**
   * @language javascript,typescript
   * Specifier or tsconfig `paths` key -> the file or directory it names.
   */
  readonly package_roots: ReadonlyMap<string, FilePath>;

  /**
   * @language rust
   * Crate name, normalised to `_` -> the crate's source root directory.
   */
  readonly crate_roots: ReadonlyMap<string, FilePath>;
}

export const EMPTY_MODULE_SPECIFIER_INDEX: ModuleSpecifierIndex = {
  package_roots: new Map(),
  crate_roots: new Map(),
};

/**
 * Strip comments and trailing commas so a hand-maintained `tsconfig.json`
 * parses. JSONC is the format editors accept for these files, and real
 * projects use it — nest's `paths` block ends with a trailing comma.
 */
export function parse_jsonc(text: string): unknown {
  let out = "";
  let in_string = false;
  let in_line_comment = false;
  let in_block_comment = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (in_line_comment) {
      if (char === "\n") {
        in_line_comment = false;
        out += char;
      }
      continue;
    }
    if (in_block_comment) {
      if (char === "*" && next === "/") {
        in_block_comment = false;
        i++;
      }
      continue;
    }
    if (in_string) {
      out += char;
      if (char === "\\") {
        out += next ?? "";
        i++;
      } else if (char === "\"") {
        in_string = false;
      }
      continue;
    }
    if (char === "\"") {
      in_string = true;
      out += char;
      continue;
    }
    if (char === "/" && next === "/") {
      in_line_comment = true;
      i++;
      continue;
    }
    if (char === "/" && next === "*") {
      in_block_comment = true;
      i++;
      continue;
    }
    out += char;
  }

  // A comma before a closing brace or bracket is legal in JSONC, not in JSON.
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

/**
 * Read every manifest in the tree and index what its names denote. Unreadable
 * or malformed manifests are skipped: an absent entry leaves a specifier
 * opaque, which is the same answer as before the index existed.
 */
export async function build_module_specifier_index(
  root_folder: FileSystemFolder
): Promise<ModuleSpecifierIndex> {
  const package_roots = new Map<string, FilePath>();
  const crate_roots = new Map<string, FilePath>();

  for (const directory of walk_directories(root_folder)) {
    if (directory.files.has("tsconfig.json")) {
      await index_tsconfig_paths(
        path.join(directory.path, "tsconfig.json") as FilePath,
        package_roots
      );
    }
    if (directory.files.has("jsconfig.json")) {
      await index_tsconfig_paths(
        path.join(directory.path, "jsconfig.json") as FilePath,
        package_roots
      );
    }
    if (directory.files.has("package.json")) {
      await index_package_name(directory, package_roots);
    }
    if (directory.files.has("Cargo.toml")) {
      index_crate_root(directory, crate_roots);
    }
  }

  return { package_roots, crate_roots };
}

function* walk_directories(
  folder: FileSystemFolder
): Generator<FileSystemFolder> {
  yield folder;
  for (const child of folder.folders.values()) {
    yield* walk_directories(child);
  }
}

/**
 * A tsconfig `paths` entry maps a specifier to one or more targets; the first
 * target wins, and a trailing `/*` on either side is dropped so the key is the
 * specifier prefix a lookup matches on.
 */
async function index_tsconfig_paths(
  config_file: FilePath,
  package_roots: Map<string, FilePath>
): Promise<void> {
  const config = await read_json_file(config_file);
  if (!is_record(config)) {
    return;
  }
  const compiler_options = config["compilerOptions"];
  if (!is_record(compiler_options)) {
    return;
  }
  const paths = compiler_options["paths"];
  if (!is_record(paths)) {
    return;
  }

  const base_url =
    typeof compiler_options["baseUrl"] === "string"
      ? compiler_options["baseUrl"]
      : ".";
  const config_dir = path.dirname(config_file);

  for (const [specifier, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || typeof targets[0] !== "string") {
      continue;
    }
    const key = specifier.replace(/\/\*$/, "");
    const target = targets[0].replace(/\/\*$/, "");
    package_roots.set(
      key,
      path.resolve(config_dir, base_url, target) as FilePath
    );
  }
}

/**
 * A workspace package's own name denotes its directory, so an import of that
 * name from a sibling package resolves inside the project.
 */
async function index_package_name(
  directory: FileSystemFolder,
  package_roots: Map<string, FilePath>
): Promise<void> {
  const manifest = await read_json_file(
    path.join(directory.path, "package.json") as FilePath
  );
  if (!is_record(manifest)) {
    return;
  }
  const name = manifest["name"];
  if (typeof name !== "string" || package_roots.has(name)) {
    return;
  }
  package_roots.set(name, directory.path);
}

/**
 * A crate's source root is its `src/` directory when it has one, else the
 * manifest's own directory. The crate name comes from the directory rather
 * than the manifest: reading `Cargo.toml` needs a TOML parser, and every crate
 * in the corpora this targets names its directory after itself modulo `-`/`_`.
 */
function index_crate_root(
  directory: FileSystemFolder,
  crate_roots: Map<string, FilePath>
): void {
  const crate_name = path.basename(directory.path).replace(/-/g, "_");
  const src = directory.folders.get("src");
  const root = src ? src.path : directory.path;
  if (!crate_roots.has(crate_name)) {
    crate_roots.set(crate_name, root);
  }
}

async function read_json_file(file: FilePath): Promise<unknown> {
  try {
    return parse_jsonc(await readFile(file, "utf-8"));
  } catch {
    return undefined;
  }
}

function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

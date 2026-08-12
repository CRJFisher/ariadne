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
import { has_file_in_tree } from "../file_folders";

export interface ModuleSpecifierIndex {
  /**
   * @language javascript,typescript
   * Package name, or a subpath it publishes -> the file or directory it names.
   * A declared package name is unique across the project, so it answers the
   * same way for every importing file.
   */
  readonly package_roots: ReadonlyMap<string, FilePath>;

  /**
   * @language javascript,typescript
   * Directory of the config that governs a file -> the tsconfig `paths` key ->
   * the file or directory it names.
   *
   * Aliases are scoped to their declaring config rather than pooled: `@/*` is
   * the conventional self-alias, so every package in a monorepo declares it,
   * each pointing at its own `src/`.
   */
  readonly config_aliases: ReadonlyMap<FilePath, ReadonlyMap<string, FilePath>>;

  /**
   * @language rust
   * Crate name, normalised to `_` -> the crate's source root directory.
   */
  readonly crate_roots: ReadonlyMap<string, FilePath>;
}

export const EMPTY_MODULE_SPECIFIER_INDEX: ModuleSpecifierIndex = {
  package_roots: new Map(),
  config_aliases: new Map(),
  crate_roots: new Map(),
};

/**
 * Strip comments and trailing commas so a hand-maintained `tsconfig.json`
 * parses. JSONC is the format editors accept for these files, and real
 * projects use it — nest's `paths` block ends with a trailing comma.
 */
function parse_jsonc(text: string): unknown {
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

const ALIAS_DECLARING_CONFIGS = ["tsconfig.json", "jsconfig.json"] as const;

/**
 * Read every manifest in the tree and index what its names denote. Unreadable
 * or malformed manifests are skipped: an absent entry leaves a specifier
 * opaque, which is the same answer as before the index existed.
 */
export async function build_module_specifier_index(
  root_folder: FileSystemFolder
): Promise<ModuleSpecifierIndex> {
  const package_roots = new Map<string, FilePath>();
  const config_aliases = new Map<FilePath, Map<string, FilePath>>();
  const crate_roots = new Map<string, FilePath>();
  const parsed_configs: ConfigAliasCache = new Map();

  for (const directory of walk_directories(root_folder)) {
    for (const config_name of ALIAS_DECLARING_CONFIGS) {
      if (directory.files.has(config_name)) {
        await index_config_aliases(
          path.join(directory.path, config_name) as FilePath,
          directory.path,
          config_aliases,
          parsed_configs
        );
      }
    }
    if (directory.files.has("package.json")) {
      await index_package_name(directory, package_roots);
    }
    if (directory.files.has("Cargo.toml")) {
      index_crate_root(directory, crate_roots);
    }
  }

  return { package_roots, config_aliases, crate_roots };
}

/**
 * Directories holding generated, vendored or version-control content. Their
 * manifests describe code the project consumes rather than code it contains,
 * and an installed dependency tree holds thousands of them — each one a
 * serial read before indexing can start.
 *
 * Depth is deliberately unbounded: a workspace package can sit at any depth
 * (`packages/group/deeppkg`), and a cap loses it.
 */
const VENDORED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "target",
  "__pycache__",
]);

function* walk_directories(
  folder: FileSystemFolder
): Generator<FileSystemFolder> {
  yield folder;
  for (const [name, child] of folder.folders) {
    // A dot prefix covers `.git`, and every tool cache that follows its lead.
    if (VENDORED_DIRECTORIES.has(name) || name.startsWith(".")) {
      continue;
    }
    yield* walk_directories(child);
  }
}

/**
 * Index a config's aliases under the directory it governs — the files beneath
 * it — with its own declarations layered over everything it inherits through
 * `extends`.
 */
async function index_config_aliases(
  config_file: FilePath,
  config_dir: FilePath,
  config_aliases: Map<FilePath, Map<string, FilePath>>,
  parsed: ConfigAliasCache
): Promise<void> {
  const aliases = await read_config_aliases(config_file, new Set(), parsed);
  if (aliases.size === 0) {
    return;
  }

  const governed =
    config_aliases.get(config_dir) ?? new Map<string, FilePath>();
  config_aliases.set(config_dir, governed);
  for (const [key, target] of aliases) {
    governed.set(key, target);
  }
}

/**
 * Aliases already read from a config, shared across every leaf that extends it.
 * One shared base config is the whole point of the `extends` layout, so without
 * this it is re-read and re-parsed once per package.
 */
type ConfigAliasCache = Map<FilePath, ReadonlyMap<string, FilePath>>;

/**
 * Every alias a config declares or inherits.
 *
 * `extends` is followed first so the extending config's own `paths` override
 * what it inherits, and each config's `paths` and `baseUrl` are resolved
 * against the directory of the config that *declares* them — a base config two
 * directories up roots its aliases there, not at the leaf.
 *
 * `visited` cuts a cyclic chain and is copied per branch, so two entries of an
 * `extends` array that share a base each still inherit from it; `parsed` is the
 * shared cache that keeps the shared base from being read twice.
 */
async function read_config_aliases(
  config_file: FilePath,
  visited: Set<FilePath>,
  parsed: ConfigAliasCache
): Promise<ReadonlyMap<string, FilePath>> {
  const cached = parsed.get(config_file);
  if (cached) {
    return cached;
  }

  const aliases = new Map<string, FilePath>();
  if (visited.has(config_file)) {
    return aliases;
  }
  visited.add(config_file);

  const config = await read_json_file(config_file);
  if (!is_record(config)) {
    return aliases;
  }

  const config_dir = path.dirname(config_file);
  for (const base_config of base_config_files(config["extends"], config_dir)) {
    for (const [key, target] of await read_config_aliases(
      base_config,
      new Set(visited),
      parsed
    )) {
      aliases.set(key, target);
    }
  }

  for (const [key, target] of declared_aliases(config, config_dir)) {
    aliases.set(key, target);
  }

  parsed.set(config_file, aliases);
  return aliases;
}

/**
 * The config files an `extends` field names, in the order their aliases apply.
 * TypeScript 5 accepts an array, whose later entries override earlier ones, as
 * well as the single-string form. A bare specifier names an npm-published
 * config, so only path-relative entries are followed — a base published by a
 * workspace package therefore contributes nothing, even when its source is in
 * the tree. An entry that does not already end in
 * `.json` names the config without its extension (`../tsconfig.base`), which
 * `path.extname` cannot tell from a real extension.
 */
function base_config_files(
  extends_field: unknown,
  config_dir: string
): FilePath[] {
  const entries =
    typeof extends_field === "string"
      ? [extends_field]
      : Array.isArray(extends_field)
        ? extends_field.filter((entry) => typeof entry === "string")
        : [];

  return entries
    .filter((entry) => entry.startsWith(".") || path.isAbsolute(entry))
    .map((entry) => {
      const with_extension = entry.endsWith(".json") ? entry : `${entry}.json`;
      return path.resolve(config_dir, with_extension) as FilePath;
    });
}

/**
 * A config's own `paths` entries. Each maps a specifier to one or more targets;
 * the first target wins, and a trailing `/*` on either side is dropped so the
 * key is the specifier prefix a lookup matches on.
 */
function declared_aliases(
  config: Record<string, unknown>,
  config_dir: string
): Map<string, FilePath> {
  const aliases = new Map<string, FilePath>();

  const compiler_options = config["compilerOptions"];
  if (!is_record(compiler_options)) {
    return aliases;
  }
  const paths = compiler_options["paths"];
  if (!is_record(paths)) {
    return aliases;
  }

  const base_url =
    typeof compiler_options["baseUrl"] === "string"
      ? compiler_options["baseUrl"]
      : ".";

  for (const [specifier, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || typeof targets[0] !== "string") {
      continue;
    }
    const key = specifier.replace(/\/\*$/, "");
    const target = targets[0].replace(/\/\*$/, "");
    aliases.set(key, path.resolve(config_dir, base_url, target) as FilePath);
  }

  return aliases;
}

/**
 * A workspace package's own name denotes its directory, so an import of that
 * name from a sibling package resolves inside the project.
 *
 * A package that declares `exports` says where each of its entry points really
 * lives, so the name is pointed at that file instead of the directory, and each
 * subpath it publishes (`@scope/pkg/testing`) becomes a key of its own. Without
 * `exports` the name stays on the directory and the specifier resolver probes
 * its `index.*`.
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

  const exports_field = manifest["exports"];
  const root_target = published_target(directory, root_export_entry(exports_field));
  package_roots.set(name, root_target ?? directory.path);

  if (!is_record(exports_field)) {
    return;
  }
  for (const [subpath, value] of Object.entries(exports_field)) {
    if (!subpath.startsWith("./")) {
      continue;
    }
    const key = `${name}/${subpath.slice(2)}`;
    const target = published_target(directory, value);
    if (target && !package_roots.has(key)) {
      package_roots.set(key, target);
    }
  }
}

/**
 * The `exports` entry for the package's own name. A map keyed by subpaths carries
 * it under `"."`; a map with no `.`-prefixed key is Node's sugar for that entry
 * alone, and the keys are conditions. The two forms cannot be mixed, so which
 * one is present decides unambiguously.
 */
function root_export_entry(exports_field: unknown): unknown {
  if (!is_record(exports_field)) {
    return exports_field;
  }
  return Object.keys(exports_field).some((key) => key.startsWith("."))
    ? exports_field["."]
    : exports_field;
}

/**
 * The conditions an `exports` entry may be keyed by, most source-like first: a
 * condition object is a set of alternatives and only one of them can be the file
 * to analyse. `source`, `import` and `module` name original or ESM-built modules
 * where a package publishes them; `require` and `default` name the artefact,
 * which is the answer only when nothing better is declared. `types` ranks last
 * because a `.d.ts` carries declarations and no bodies — but a package that
 * points `types` at real source and `default` at a build it does not ship in the
 * tree has that source as its only reachable entry, and only the last rank can
 * still find it.
 */
const EXPORT_CONDITION_PRECEDENCE = [
  "source",
  "import",
  "module",
  "require",
  "default",
  "types",
] as const;

/**
 * The relative targets an `exports` value names, most source-like first,
 * following nested condition objects. Every candidate is offered rather than
 * only the best-ranked one: a manifest that names a `.d.ts` or a `dist/` build
 * above the source it also declares would otherwise discard the whole entry.
 *
 * A conditional array form (`["./a.js", "./b.js"]`) is not read: it is a
 * fallback list whose members are alternatives, and picking one would be a
 * guess.
 */
function export_target_candidates(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (!is_record(value)) {
    return [];
  }
  return EXPORT_CONDITION_PRECEDENCE.flatMap((condition) =>
    export_target_candidates(value[condition])
  );
}

/**
 * The file an `exports` entry publishes: the first candidate inside the
 * package's own directory that is present in the tree.
 *
 * Containment is a hard guard — `"./evil": "../../../etc/passwd"` names a file
 * the package does not own, and indexing it would let a specifier reach anywhere
 * on disk. (The subtree probe below rejects an escaping path too; the explicit
 * check states the rule rather than leaving it to a side effect.) Presence keeps
 * a manifest that only publishes built artefacts from pointing the specifier at
 * a file that is not there, leaving the package directory to be probed for its
 * `index.*` instead.
 */
function published_target(
  package_directory: FileSystemFolder,
  entry: unknown
): FilePath | undefined {
  const package_dir = package_directory.path;

  for (const target of export_target_candidates(entry)) {
    const resolved = path.resolve(package_dir, target);
    const relative = path.relative(package_dir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      continue;
    }
    if (has_file_in_tree(resolved as FilePath, package_directory)) {
      return resolved as FilePath;
    }
  }

  return undefined;
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

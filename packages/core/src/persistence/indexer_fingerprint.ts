import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "fs";
import { createRequire, isBuiltin } from "module";
import { dirname, extname, join, relative } from "path";
import type TreeSitter from "tree-sitter";
import { parser_for } from "../index_single_file/query_code_tree/parsers";

/**
 * The modules whose output a cached blob is: the parse, the per-file index built
 * from it, and the serialization that writes and restores it. Paths are relative
 * to the package's code root (`src` or `dist`), without an extension.
 */
const INDEX_PRODUCING_MODULES = [
  "project/parse_file",
  "index_single_file/index_single_file",
  "persistence/cached_index",
];

/** The `.scm` queries the index builder reads from disk rather than imports. */
const QUERIES_DIR = join("index_single_file", "query_code_tree", "queries");

const MODULE_PROBES = ["", ".ts", ".js", "/index.ts", "/index.js"];

const fingerprints = new Map<string, string>();

/**
 * The identity of the indexer build a cached index came out of.
 *
 * A cached blob is the output of the parse, `build_index_single_file` and the
 * serializer, not a transcription of the source file, so a blob is valid only
 * for the exact code that produced it. The fingerprint is a hash of that code:
 * every module in the import closure of the index-producing modules, the `.scm`
 * queries they load, and the name and version of every installed package the
 * closure reaches — the tree-sitter binding and its grammars. A workspace
 * package such as `@ariadnejs/types` is not installed, so its modules join the
 * closure as code rather than being pinned by a version that does not move.
 *
 * Any change to what indexing extracts, or to the shape a blob is written in,
 * is a change to one of those files, so it moves the fingerprint without anyone
 * remembering to. A change anywhere else — resolution, the call graph,
 * classification — leaves it, and the cache, untouched.
 *
 * `code_root` is the directory the running build's modules live in: `src` under
 * the test runner and `tsx`, `dist` for the published build. Computed once per
 * root per process.
 */
export function indexer_fingerprint(
  code_root: string = join(__dirname, ".."),
): string {
  let fingerprint = fingerprints.get(code_root);
  if (fingerprint === undefined) {
    fingerprint = compute_fingerprint(realpathSync(code_root));
    fingerprints.set(code_root, fingerprint);
  }
  return fingerprint;
}

function compute_fingerprint(code_root: string): string {
  const file_digests = new Map<string, string>();
  const pinned_packages = new Set<string>();

  const pending = INDEX_PRODUCING_MODULES.map((module_path) =>
    probe_module(join(code_root, module_path), code_root, module_path),
  );
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    const identity = file_identity(file);
    if (file_digests.has(identity)) continue;

    const content = readFileSync(file, "utf-8");
    file_digests.set(identity, digest(content));

    for (const specifier of module_specifiers(file, content)) {
      if (specifier.startsWith(".")) {
        pending.push(probe_module(join(dirname(file), specifier), file, specifier));
        continue;
      }
      if (isBuiltin(specifier)) continue;

      const resolved = realpathSync(createRequire(file).resolve(specifier));
      if (resolved.split(/[\\/]/).includes("node_modules")) {
        const owner = owning_package(resolved);
        pinned_packages.add(`${owner.name}@${owner.version}`);
      } else {
        pending.push(resolved);
      }
    }
  }

  const queries_dir = join(code_root, QUERIES_DIR);
  for (const entry of readdirSync(queries_dir)) {
    if (extname(entry) !== ".scm") continue;
    const file = join(queries_dir, entry);
    file_digests.set(file_identity(file), digest(readFileSync(file, "utf-8")));
  }

  const lines = [
    ...[...file_digests].map(([identity, file_digest]) => `${identity} ${file_digest}`),
    ...pinned_packages,
  ].sort();
  return digest(lines.join("\n")).slice(0, 32);
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * The file a module specifier names, trying the extensions the compiled and the
 * source builds each use. An import the walk cannot follow would silently drop
 * code from the fingerprint, so it is an error rather than a skip.
 */
function probe_module(base: string, importer: string, specifier: string): string {
  for (const suffix of MODULE_PROBES) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  throw new Error(
    `indexer fingerprint: cannot resolve '${specifier}' imported by ${importer}`,
  );
}

/**
 * Every module a file imports, re-exports or requires by a literal specifier —
 * `import`/`export … from` statements, `import x = require(…)`, `require(…)`
 * and `import(…)` calls. Read off the syntax tree so a specifier-shaped string
 * in a comment or literal is never mistaken for an import.
 */
function module_specifiers(file: string, content: string): string[] {
  const language = extname(file) === ".js" ? "javascript" : "typescript";
  const tree = parser_for(language, file).parse(content, undefined, {
    bufferSize: content.length * 2 + 1024,
  });

  const specifiers: string[] = [];
  const add_literal = (node: TreeSitter.SyntaxNode | null) => {
    if (node?.type === "string") specifiers.push(node.text.slice(1, -1));
  };

  for (const node of tree.rootNode.descendantsOfType([
    "import_statement",
    "export_statement",
    "import_require_clause",
  ])) {
    add_literal(node.childForFieldName("source"));
  }
  for (const call of tree.rootNode.descendantsOfType("call_expression")) {
    const callee = call.childForFieldName("function");
    const is_require = callee?.type === "identifier" && callee.text === "require";
    if (is_require || callee?.type === "import") {
      add_literal(call.childForFieldName("arguments")?.namedChild(0) ?? null);
    }
  }
  return specifiers;
}

interface OwningPackage {
  readonly name: string;
  readonly version: string;
  readonly root: string;
}

/** The nearest `package.json` at or above a file, which is the package it ships in. */
function owning_package(file: string): OwningPackage {
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest)) continue;
    const { name, version } = JSON.parse(readFileSync(manifest, "utf-8"));
    if (typeof name === "string" && typeof version === "string") {
      return { name, version, root: dir };
    }
  }
  throw new Error(`indexer fingerprint: no package.json owns ${file}`);
}

/**
 * A file named by its package and its path inside it, so the same build checked
 * out at two locations fingerprints identically.
 */
function file_identity(file: string): string {
  const owner = owning_package(file);
  return `${owner.name}/${relative(owner.root, file).split("\\").join("/")}`;
}

import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { indexer_fingerprint } from "./indexer_fingerprint";

/**
 * A package laid out like `@ariadnejs/core`'s code root: the three
 * index-producing modules, a queries directory, a workspace package linked into
 * `node_modules` the way pnpm links `@ariadnejs/types`, and an installed
 * package standing in for a tree-sitter grammar.
 */
const FIXTURE_FILES: Record<string, string> = {
  "package.json": JSON.stringify({ name: "fixture-core", version: "1.0.0" }),
  "src/project/parse_file.ts": [
    "import { detect_language } from \"../detect_language\";",
    "import grammar from \"fixture-grammar\";",
    "export const parse = () => [detect_language, grammar];",
  ].join("\n"),
  "src/detect_language.ts": "export const detect_language = \"typescript\";",
  "src/index_single_file/index_single_file.ts": "export * from \"./scopes/scopes\";",
  "src/index_single_file/scopes/scopes.ts": [
    "const boundaries = require(\"./boundaries\");",
    "// import { absent } from \"./comment_is_not_an_import\";",
    "const sample = 'import { absent } from \"./string_is_not_an_import\";';",
    "export const scopes = [boundaries, sample];",
  ].join("\n"),
  "src/index_single_file/scopes/boundaries.ts": "export const boundaries = 1;",
  "src/index_single_file/query_code_tree/queries/python.scm": "(function_definition) @definition.function",
  "src/index_single_file/query_code_tree/queries/CAPTURE-SCHEMA.md": "# Captures",
  "src/persistence/cached_index.ts": [
    "import type { SemanticIndex } from \"fixture-types\";",
    "export const serialize = (index: SemanticIndex) => JSON.stringify(index);",
  ].join("\n"),
  "src/resolve_references/resolve.ts": "export const resolve = 1;",
  "workspace_types/package.json": JSON.stringify({ name: "fixture-types", version: "0.0.0", main: "index.js" }),
  "workspace_types/index.js": "exports.module_scope = (location) => \"module:\" + location;",
  "node_modules/fixture-grammar/package.json": JSON.stringify({ name: "fixture-grammar", version: "1.0.0", main: "index.js" }),
  "node_modules/fixture-grammar/index.js": "module.exports = { name: \"grammar\" };",
};

const fixture_roots: string[] = [];

/** The fingerprint of a fresh fixture package, after `edit` rewrites some of its files. */
function fingerprint_of_fixture(edit: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-fingerprint-"));
  fixture_roots.push(root);
  for (const [relative_path, content] of Object.entries({ ...FIXTURE_FILES, ...edit })) {
    const file = path.join(root, relative_path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf-8");
  }
  fs.symlinkSync(
    path.join(root, "workspace_types"),
    path.join(root, "node_modules", "fixture-types"),
    "dir",
  );
  return indexer_fingerprint(path.join(root, "src"));
}

describe("indexer_fingerprint", () => {
  afterEach(() => {
    for (const root of fixture_roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Each fixture lives at its own temporary path, so equal fingerprints also
  // show that where a build is checked out does not enter the hash.
  it("fingerprints the same build identically at two locations", () => {
    expect(fingerprint_of_fixture()).toEqual(fingerprint_of_fixture());
  });

  it("moves when a module the index builder requires changes", () => {
    expect(
      fingerprint_of_fixture({
        "src/index_single_file/scopes/boundaries.ts": "export const boundaries = 2;",
      }),
    ).not.toEqual(fingerprint_of_fixture());
  });

  it("moves when a module of a linked workspace package changes", () => {
    expect(
      fingerprint_of_fixture({
        "workspace_types/index.js": "exports.module_scope = (location) => \"scope:\" + location;",
      }),
    ).not.toEqual(fingerprint_of_fixture());
  });

  it("moves when a query file changes", () => {
    expect(
      fingerprint_of_fixture({
        "src/index_single_file/query_code_tree/queries/python.scm": "(class_definition) @definition.class",
      }),
    ).not.toEqual(fingerprint_of_fixture());
  });

  it("moves when an installed package the closure reaches changes version", () => {
    expect(
      fingerprint_of_fixture({
        "node_modules/fixture-grammar/package.json": JSON.stringify({
          name: "fixture-grammar",
          version: "1.0.1",
          main: "index.js",
        }),
      }),
    ).not.toEqual(fingerprint_of_fixture());
  });

  // An installed package is pinned by its version, so its files are not read.
  it("holds when an installed package's code changes under the same version", () => {
    expect(
      fingerprint_of_fixture({
        "node_modules/fixture-grammar/index.js": "module.exports = { name: \"patched\" };",
      }),
    ).toEqual(fingerprint_of_fixture());
  });

  // Resolution, the call graph and classification do not shape a cached index,
  // so a change to them must leave every warm cache usable.
  it("holds when a module outside the index builder's closure changes", () => {
    expect(
      fingerprint_of_fixture({
        "src/resolve_references/resolve.ts": "export const resolve = 2;",
      }),
    ).toEqual(fingerprint_of_fixture());
  });

  it("holds when a non-query file beside the queries changes", () => {
    expect(
      fingerprint_of_fixture({
        "src/index_single_file/query_code_tree/queries/CAPTURE-SCHEMA.md": "# Captures, revised",
      }),
    ).toEqual(fingerprint_of_fixture());
  });

  // A dropped import would silently leave code out of the hash, so an import
  // the walk cannot follow fails the fingerprint rather than skipping it.
  it("refuses to fingerprint a closure with an import it cannot resolve", () => {
    expect(() =>
      fingerprint_of_fixture({
        "src/index_single_file/scopes/boundaries.ts": "export { gone } from \"./deleted_module\";",
      }),
    ).toThrow(/cannot resolve '\.\/deleted_module' imported by .*boundaries\.ts/);
  });
});

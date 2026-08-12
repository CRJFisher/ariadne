/**
 * Tests for the module specifier index: what a package or crate name denotes.
 */

import { describe, it, expect, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { FilePath } from "@ariadnejs/types";
import {
  build_module_specifier_index,
  parse_jsonc,
} from "./module_specifier_index";
import type { FileSystemFolder } from "../file_folders";

/** The tree shape Project builds, read from a real directory. */
function read_tree(dir: string): FileSystemFolder {
  const folders = new Map<string, FileSystemFolder>();
  const files = new Set<string>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      folders.set(entry.name, read_tree(path.join(dir, entry.name)));
    } else {
      files.add(entry.name);
    }
  }
  return { path: dir as FilePath, folders, files };
}

const temp_dirs: string[] = [];

afterAll(() => {
  for (const dir of temp_dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

/** Write files to a temp dir and return the tree Project would build for it. */
async function index_for(files: Record<string, string>): Promise<{
  package_roots: ReadonlyMap<string, FilePath>;
  config_aliases: ReadonlyMap<FilePath, ReadonlyMap<string, FilePath>>;
  crate_roots: ReadonlyMap<string, FilePath>;
  temp_dir: string;
}> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-spec-index-"));
  temp_dirs.push(temp_dir);
  for (const [relative_path, content] of Object.entries(files)) {
    const abs = path.join(temp_dir, relative_path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }

  const index = await build_module_specifier_index(read_tree(temp_dir));
  return { ...index, temp_dir };
}

/** The aliases the config in `directory` declares over the files beneath it. */
function aliases_governing(
  config_aliases: ReadonlyMap<FilePath, ReadonlyMap<string, FilePath>>,
  directory: string
): ReadonlyMap<string, FilePath> {
  return config_aliases.get(directory as FilePath) ?? new Map();
}

describe("parse_jsonc", () => {
  it("parses a trailing comma before a closing brace", () => {
    expect(parse_jsonc("{ \"a\": 1, }")).toEqual({ a: 1 });
  });

  it("parses line and block comments", () => {
    expect(
      parse_jsonc("{\n  // a comment\n  \"a\": 1, /* inline */ \"b\": 2\n}")
    ).toEqual({ a: 1, b: 2 });
  });

  it("keeps comment-like text inside a string", () => {
    expect(parse_jsonc("{ \"a\": \"http://x\" }")).toEqual({ a: "http://x" });
  });
});

describe("build_module_specifier_index", () => {
  it("indexes a tsconfig paths alias relative to the config that declares it", async () => {
    const { config_aliases, temp_dir } = await index_for({
      "tsconfig.json": `{
  "compilerOptions": {
    "paths": {
      "@nestjs/common": ["./packages/common"],
    },
  },
}`,
      "packages/common/index.ts": "export function mixin() { return 1; }\n",
    });

    expect(aliases_governing(config_aliases, temp_dir).get("@nestjs/common")).toBe(
      path.join(temp_dir, "packages/common")
    );
  });

  it("keys each package's aliases under that package, not one project-wide map", async () => {
    // `@/*` is the conventional self-alias, so every package declares it. One
    // shared map keyed by `@` keeps whichever package the walk reached last.
    const { config_aliases, temp_dir } = await index_for({
      "packages/pkg_a/tsconfig.json": `{
  "compilerOptions": { "paths": { "@/*": ["src/*"] } },
}`,
      "packages/pkg_a/src/index.ts": "export function a() { return 1; }\n",
      "packages/pkg_b/tsconfig.json": `{
  "compilerOptions": { "paths": { "@/*": ["src/*"] } },
}`,
      "packages/pkg_b/src/index.ts": "export function b() { return 2; }\n",
    });

    expect(
      aliases_governing(
        config_aliases,
        path.join(temp_dir, "packages/pkg_a")
      ).get("@")
    ).toBe(path.join(temp_dir, "packages/pkg_a/src"));
    expect(
      aliases_governing(
        config_aliases,
        path.join(temp_dir, "packages/pkg_b")
      ).get("@")
    ).toBe(path.join(temp_dir, "packages/pkg_b/src"));
  });

  it("indexes a workspace package by its declared name", async () => {
    const { package_roots, temp_dir } = await index_for({
      "packages/core/package.json": "{ \"name\": \"@scope/core\" }",
      "packages/core/index.ts": "export function f() { return 1; }\n",
    });

    expect(package_roots.get("@scope/core")).toBe(
      path.join(temp_dir, "packages/core")
    );
  });

  it("indexes a crate's src root under its underscore-normalised name", async () => {
    const { crate_roots, temp_dir } = await index_for({
      "sqlx-core/Cargo.toml": "[package]\nname = \"sqlx-core\"\n",
      "sqlx-core/src/lib.rs": "pub mod raw_sql;\n",
      "sqlx-core/src/raw_sql.rs": "pub fn raw_sql() -> i32 { 1 }\n",
    });

    expect(crate_roots.get("sqlx_core")).toBe(
      path.join(temp_dir, "sqlx-core/src")
    );
  });

  it("leaves an unreadable manifest out rather than failing the build", async () => {
    const { package_roots } = await index_for({
      "package.json": "{ this is not json",
      "index.ts": "export function f() { return 1; }\n",
    });

    expect(package_roots.size).toBe(0);
  });

  describe("tsconfig extends chains", () => {
    it("inherits paths from a base config two directories above the leaf", async () => {
      const { config_aliases, temp_dir } = await index_for({
        "tsconfig.base.json": `{
  "compilerOptions": {
    "baseUrl": "./libs",
    "paths": {
      "@app/shared/*": ["shared/*"],
    },
  },
}`,
        "packages/web/tsconfig.json": "{ \"extends\": \"../../tsconfig.base.json\" }",
        "libs/shared/index.ts": "export function shared() { return 1; }\n",
      });

      // Rooted at the declaring config's baseUrl, not at the leaf's directory,
      // and governing the leaf package the inheriting config sits in.
      expect(
        aliases_governing(
          config_aliases,
          path.join(temp_dir, "packages/web")
        ).get("@app/shared")
      ).toBe(path.join(temp_dir, "libs/shared"));
    });

    it("lets a leaf config override an alias it inherits", async () => {
      const { config_aliases, temp_dir } = await index_for({
        "tsconfig.base.json": `{
  "compilerOptions": {
    "paths": { "@app/lib": ["./base/lib"] },
  },
}`,
        "tsconfig.json": `{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "paths": { "@app/lib": ["./leaf/lib"] },
  },
}`,
        "base/lib/index.ts": "export function base() { return 1; }\n",
        "leaf/lib/index.ts": "export function leaf() { return 1; }\n",
      });

      expect(aliases_governing(config_aliases, temp_dir).get("@app/lib")).toBe(
        path.join(temp_dir, "leaf/lib")
      );
    });

    it("takes the last entry of a TypeScript 5 array extends", async () => {
      const { config_aliases, temp_dir } = await index_for({
        "first.json": `{
  "compilerOptions": { "paths": { "@app/lib": ["./first/lib"] } },
}`,
        "second.json": `{
  "compilerOptions": { "paths": { "@app/lib": ["./second/lib"] } },
}`,
        "tsconfig.json": "{ \"extends\": [\"./first.json\", \"./second.json\"] }",
        "first/lib/index.ts": "export function first() { return 1; }\n",
        "second/lib/index.ts": "export function second() { return 1; }\n",
      });

      expect(aliases_governing(config_aliases, temp_dir).get("@app/lib")).toBe(
        path.join(temp_dir, "second/lib")
      );
    });

    it("adds an extension to an extends entry that omits one", async () => {
      const { config_aliases, temp_dir } = await index_for({
        "tsconfig.base.json": `{
  "compilerOptions": { "paths": { "@app/lib": ["./base/lib"] } },
}`,
        "tsconfig.json": "{ \"extends\": \"./tsconfig.base\" }",
        "base/lib/index.ts": "export function base() { return 1; }\n",
      });

      expect(aliases_governing(config_aliases, temp_dir).get("@app/lib")).toBe(
        path.join(temp_dir, "base/lib")
      );
    });

    it("terminates on a cyclic extends chain", async () => {
      const { config_aliases, temp_dir } = await index_for({
        "tsconfig.json": `{
  "extends": "./tsconfig.other.json",
  "compilerOptions": { "paths": { "@app/leaf": ["./leaf"] } },
}`,
        "tsconfig.other.json": `{
  "extends": "./tsconfig.json",
  "compilerOptions": { "paths": { "@app/other": ["./other"] } },
}`,
        "leaf/index.ts": "export function leaf() { return 1; }\n",
        "other/index.ts": "export function other() { return 1; }\n",
      });

      const aliases = aliases_governing(config_aliases, temp_dir);
      expect(aliases.get("@app/leaf")).toBe(path.join(temp_dir, "leaf"));
      expect(aliases.get("@app/other")).toBe(path.join(temp_dir, "other"));
    });

    it("lets each entry of an extends array inherit from a shared base", async () => {
      // TypeScript gives later array entries precedence, so `b.json` — which
      // declares nothing of its own — must still carry what it inherits.
      const { config_aliases, temp_dir } = await index_for({
        "base.json": `{
  "compilerOptions": { "paths": { "@app/lib": ["./from-base"] } },
}`,
        "a.json": `{
  "extends": "./base.json",
  "compilerOptions": { "paths": { "@app/lib": ["./from-a"] } },
}`,
        "b.json": "{ \"extends\": \"./base.json\" }",
        "tsconfig.json": "{ \"extends\": [\"./a.json\", \"./b.json\"] }",
        "from-base/index.ts": "export function base() { return 1; }\n",
        "from-a/index.ts": "export function a() { return 1; }\n",
      });

      expect(aliases_governing(config_aliases, temp_dir).get("@app/lib")).toBe(
        path.join(temp_dir, "from-base")
      );
    });

    it("skips a base config named by a package specifier even when it is on disk", async () => {
      // Only a path-relative base is followed. The base here is not itself named
      // `tsconfig.json`, so the directory walk does not pick it up independently
      // and nothing but the skip decides the answer.
      const { config_aliases, temp_dir } = await index_for({
        "tsconfig.json": `{
  "extends": "@scope/config/base.json",
  "compilerOptions": { "paths": { "@app/lib": ["./lib"] } },
}`,
        "@scope/config/base.json": `{
  "compilerOptions": { "paths": { "@app/other": ["./other"] } },
}`,
        "lib/index.ts": "export function f() { return 1; }\n",
        "@scope/config/other/index.ts": "export function o() { return 1; }\n",
      });

      const aliases = aliases_governing(config_aliases, temp_dir);
      expect(aliases.get("@app/lib")).toBe(path.join(temp_dir, "lib"));
      expect(aliases.has("@app/other")).toBe(false);
    });

    it("skips an npm-published base config that is not on disk", async () => {
      const { config_aliases, temp_dir } = await index_for({
        "tsconfig.json": `{
  "extends": "@tsconfig/node20/tsconfig.json",
  "compilerOptions": { "paths": { "@app/lib": ["./lib"] } },
}`,
        "lib/index.ts": "export function f() { return 1; }\n",
      });

      expect(aliases_governing(config_aliases, temp_dir).get("@app/lib")).toBe(
        path.join(temp_dir, "lib")
      );
    });
  });

  describe("manifest walk", () => {
    it("leaves manifests in vendored and generated directories out", async () => {
      const { package_roots, config_aliases, crate_roots } = await index_for({
        "node_modules/dep/package.json": "{ \"name\": \"dep\" }",
        "node_modules/dep/tsconfig.json": `{
  "compilerOptions": { "paths": { "@dep/lib": ["./src"] } },
}`,
        "dist/package.json": "{ \"name\": \"built\" }",
        "build/package.json": "{ \"name\": \"built-output\" }",
        "target/vendored-crate/Cargo.toml": "[package]\nname = \"vendored-crate\"\n",
        "__pycache__/package.json": "{ \"name\": \"cached\" }",
        ".yarn/cache/pkg/package.json": "{ \"name\": \"cached-dep\" }",
        "packages/app/package.json": "{ \"name\": \"@scope/app\" }",
        "packages/app/index.ts": "export function f() { return 1; }\n",
      });

      expect([...package_roots.keys()]).toEqual(["@scope/app"]);
      expect(config_aliases.size).toBe(0);
      expect(crate_roots.size).toBe(0);
    });

    it("indexes a workspace package three directories below the root", async () => {
      // The walk is depth-unbounded: a grouped package sits deeper than the
      // conventional `packages/<name>` and still has to be found.
      const { package_roots, config_aliases, temp_dir } = await index_for({
        "packages/group/deeppkg/package.json": "{ \"name\": \"@scope/deep\" }",
        "packages/group/deeppkg/tsconfig.json": `{
  "compilerOptions": { "paths": { "@/*": ["src/*"] } },
}`,
        "packages/group/deeppkg/src/index.ts": "export function f() { return 1; }\n",
      });

      expect(package_roots.get("@scope/deep")).toBe(
        path.join(temp_dir, "packages/group/deeppkg")
      );
      expect(
        aliases_governing(
          config_aliases,
          path.join(temp_dir, "packages/group/deeppkg")
        ).get("@")
      ).toBe(path.join(temp_dir, "packages/group/deeppkg/src"));
    });
  });

  describe("package exports maps", () => {
    it("points a package name at the source its exports declares", async () => {
      const { package_roots, temp_dir } = await index_for({
        "packages/core/package.json": `{
  "name": "@scope/core",
  "exports": { ".": { "import": "./src/index.ts" } }
}`,
        "packages/core/src/index.ts": "export function f() { return 1; }\n",
      });

      expect(package_roots.get("@scope/core")).toBe(
        path.join(temp_dir, "packages/core/src/index.ts")
      );
    });

    it("indexes a subpath export under its own specifier", async () => {
      const { package_roots, temp_dir } = await index_for({
        "packages/core/package.json": `{
  "name": "@scope/pkg",
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing/index.ts"
  }
}`,
        "packages/core/src/index.ts": "export function f() { return 1; }\n",
        "packages/core/src/testing/index.ts": "export function t() { return 1; }\n",
      });

      expect(package_roots.get("@scope/pkg/testing")).toBe(
        path.join(temp_dir, "packages/core/src/testing/index.ts")
      );
    });

    it("takes the most source-like condition of an exports entry", async () => {
      // Both targets exist, so only the precedence order can decide.
      const { package_roots, temp_dir } = await index_for({
        "packages/core/package.json": `{
  "name": "@scope/core",
  "exports": {
    ".": {
      "require": "./dist/index.cjs",
      "import": { "default": "./src/index.ts" }
    }
  }
}`,
        "packages/core/src/index.ts": "export function f() { return 1; }\n",
        "packages/core/dist/index.cjs": "module.exports = {};\n",
      });

      expect(package_roots.get("@scope/core")).toBe(
        path.join(temp_dir, "packages/core/src/index.ts")
      );
    });

    it("falls through to a lower-ranked condition whose target is present", async () => {
      // A manifest that names a `.d.ts` or a build it does not ship still has a
      // source target declared below it.
      const { package_roots, temp_dir } = await index_for({
        "packages/core/package.json": `{
  "name": "@scope/core",
  "exports": {
    ".": { "import": "./dist/index.mjs", "default": "./src/main.ts" }
  }
}`,
        "packages/core/src/main.ts": "export function f() { return 1; }\n",
      });

      expect(package_roots.get("@scope/core")).toBe(
        path.join(temp_dir, "packages/core/src/main.ts")
      );
    });

    it("reads a condition-only exports object as the package's own entry", async () => {
      // `{ "import": … }` with no `.`-prefixed key is Node's sugar for the `"."`
      // entry, and is the shape most modern packages ship.
      const { package_roots, temp_dir } = await index_for({
        "packages/core/package.json": `{
  "name": "@scope/core",
  "exports": { "import": "./src/index.ts", "require": "./dist/index.cjs" }
}`,
        "packages/core/src/index.ts": "export function f() { return 1; }\n",
      });

      expect(package_roots.get("@scope/core")).toBe(
        path.join(temp_dir, "packages/core/src/index.ts")
      );
    });

    it("takes a types-declared source when it is the only target in the tree", async () => {
      // The compiled-package layout: `types` points at source, the runtime
      // condition at a build that is not in the tree. Ranking `types` last still
      // finds the source rather than losing the package.
      const { package_roots, temp_dir } = await index_for({
        "packages/core/package.json": `{
  "name": "@scope/core",
  "exports": { ".": { "types": "./src/index.ts", "default": "./dist/index.js" } }
}`,
        "packages/core/src/index.ts": "export function f() { return 1; }\n",
      });

      expect(package_roots.get("@scope/core")).toBe(
        path.join(temp_dir, "packages/core/src/index.ts")
      );
    });

    it("keeps the package directory when the manifest declares no exports", async () => {
      const { package_roots, temp_dir } = await index_for({
        "packages/core/package.json": "{ \"name\": \"@scope/core\" }",
        "packages/core/index.ts": "export function f() { return 1; }\n",
      });

      expect(package_roots.get("@scope/core")).toBe(
        path.join(temp_dir, "packages/core")
      );
    });

    it("keeps the package directory when exports names only a built artefact", async () => {
      // A manifest publishing `./dist/index.js` describes what it ships, not
      // what is here to analyse; the sources still sit at the package root.
      const { package_roots, temp_dir } = await index_for({
        "packages/core/package.json": `{
  "name": "@scope/core",
  "exports": { ".": "./dist/index.js" }
}`,
        "packages/core/index.ts": "export function f() { return 1; }\n",
      });

      expect(package_roots.get("@scope/core")).toBe(
        path.join(temp_dir, "packages/core")
      );
    });

    it("rejects an exports target that escapes its package directory", async () => {
      const { package_roots, temp_dir } = await index_for({
        "packages/core/package.json": `{
  "name": "@scope/core",
  "exports": {
    ".": "../../outside/index.ts",
    "./evil": "../../../etc/passwd"
  }
}`,
        "packages/core/index.ts": "export function f() { return 1; }\n",
        "outside/index.ts": "export function outside() { return 1; }\n",
      });

      expect(package_roots.get("@scope/core")).toBe(
        path.join(temp_dir, "packages/core")
      );
      expect(package_roots.has("@scope/core/evil")).toBe(false);
    });
  });
});

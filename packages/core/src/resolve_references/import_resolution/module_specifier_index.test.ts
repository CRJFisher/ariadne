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
    const { package_roots, temp_dir } = await index_for({
      "tsconfig.json": `{
  "compilerOptions": {
    "paths": {
      "@nestjs/common": ["./packages/common"],
    },
  },
}`,
      "packages/common/index.ts": "export function mixin() { return 1; }\n",
    });

    expect(package_roots.get("@nestjs/common")).toBe(
      path.join(temp_dir, "packages/common")
    );
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
});

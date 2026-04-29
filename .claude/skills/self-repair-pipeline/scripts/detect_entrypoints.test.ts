import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  attach_unindexed_test_grep_hits,
  collect_unindexed_test_files,
} from "./detect_entrypoints.js";
import type { EnrichedEntryPoint } from "../src/entry_point_types.js";

let tmpdir: string;

async function write(rel: string, content: string): Promise<string> {
  const full = path.join(tmpdir, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
  return full;
}

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "detect-entrypoints-test-"));
});

afterEach(async () => {
  await fs.rm(tmpdir, { recursive: true, force: true });
});

function entry(
  name: string,
  file_path: string,
  start_line: number,
  kind: "function" | "method" | "constructor" = "function",
): EnrichedEntryPoint {
  return {
    name,
    file_path,
    start_line,
    signature: undefined,
    tree_size: 0,
    kind,
    is_exported: true,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
    },
  };
}

describe("collect_unindexed_test_files", () => {
  it("collects files in test directories that aren't already indexed", async () => {
    await write("src/foo.ts", "export function foo() {}\n");
    const test_path = await write("tests/foo.test.ts", "foo();\n");

    const indexed = new Map<string, string>([
      [path.join(tmpdir, "src/foo.ts"), "export function foo() {}\n"],
    ]);
    const out = await collect_unindexed_test_files(tmpdir, indexed, []);
    expect(out.has(test_path)).toBe(true);
    expect(out.has(path.join(tmpdir, "src/foo.ts"))).toBe(false);
  });

  it("ignores files in non-test directories", async () => {
    await write("src/foo.ts", "export function foo() {}\n");
    const out = await collect_unindexed_test_files(tmpdir, new Map(), []);
    expect(out.size).toBe(0);
  });

  it("respects ignore_patterns (gitignore + options.exclude semantics)", async () => {
    const test_path = await write("tests/foo.test.ts", "foo();\n");
    const ignored_path = await write("tests/generated/foo.test.ts", "foo();\n");

    const out = await collect_unindexed_test_files(tmpdir, new Map(), ["generated"]);
    expect(out.has(test_path)).toBe(true);
    expect(out.has(ignored_path)).toBe(false);
  });

  it("skips test files already in the indexed source map", async () => {
    const test_path = await write("tests/foo.test.ts", "foo();\n");
    const indexed = new Map<string, string>([[test_path, "foo();\n"]]);

    const out = await collect_unindexed_test_files(tmpdir, indexed, []);
    expect(out.size).toBe(0);
  });

  it("recognises common test directory names (test/ tests/ __tests__/ spec/)", async () => {
    const a = await write("test/a.test.ts", "x();");
    const b = await write("tests/b.test.ts", "x();");
    const c = await write("__tests__/c.test.ts", "x();");
    const d = await write("spec/d.test.ts", "x();");

    const out = await collect_unindexed_test_files(tmpdir, new Map(), []);
    for (const p of [a, b, c, d]) {
      expect(out.has(p)).toBe(true);
    }
  });
});

describe("attach_unindexed_test_grep_hits", () => {
  it("populates grep_call_sites_unindexed_tests with caller hits", async () => {
    await write("src/foo.ts", "export function foo() {}\n");
    await write("tests/foo.test.ts", "import { foo } from '../src/foo';\nfoo();\n");

    const e = entry("foo", path.join(tmpdir, "src/foo.ts"), 1);
    await attach_unindexed_test_grep_hits(
      [e],
      tmpdir,
      new Map([[path.join(tmpdir, "src/foo.ts"), "export function foo() {}\n"]]),
      new Map(),
      [],
    );
    const hits = e.diagnostics.grep_call_sites_unindexed_tests;
    expect(hits.length).toBe(1);
    expect(hits[0].line).toBe(2);
    expect(hits[0].content).toBe("foo();");
  });

  it("greps constructors by class name (not the constructor symbol's own name)", async () => {
    await write("src/foo.ts", "class Foo {}\n");
    await write("tests/foo.test.ts", "new Foo();\n");

    const ctor_file = path.join(tmpdir, "src/foo.ts");
    const e = entry("constructor", ctor_file, 1, "constructor");
    const class_name_by_position = new Map<string, string>([
      [`${ctor_file}:1`, "Foo"],
    ]);
    await attach_unindexed_test_grep_hits(
      [e],
      tmpdir,
      new Map([[ctor_file, "class Foo {}\n"]]),
      class_name_by_position,
      [],
    );
    const hits = e.diagnostics.grep_call_sites_unindexed_tests;
    expect(hits.length).toBe(1);
    expect(hits[0].content).toBe("new Foo();");
  });

  it("leaves grep_call_sites_unindexed_tests untouched when no test files are present", async () => {
    await write("src/foo.ts", "export function foo() {}\n");
    const e = entry("foo", path.join(tmpdir, "src/foo.ts"), 1);
    await attach_unindexed_test_grep_hits(
      [e],
      tmpdir,
      new Map([[path.join(tmpdir, "src/foo.ts"), "export function foo() {}\n"]]),
      new Map(),
      [],
    );
    expect(e.diagnostics.grep_call_sites_unindexed_tests).toEqual([]);
  });
});

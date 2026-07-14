import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Project } from "../project";
import {
  build_grep_index,
  extract_entry_point_diagnostics,
} from "./extract_entry_point_diagnostics";
import type {
  SymbolName,
  ScopeId,
  FilePath,
  Location,
  CallReference,
} from "@ariadnejs/types";

// ===== Test Helpers =====

/** Branded type helper — avoids verbose `as X` on every string */
const name = (s: string) => s as SymbolName;
const scope = (s: string) => s as ScopeId;
const fp = (s: string) => s as FilePath;

function make_location(file_path: string, start_line: number): Location {
  return {
    file_path: fp(file_path),
    start_line,
    start_column: 0,
    end_line: start_line + 5,
    end_column: 1,
  };
}

// ===== build_grep_index =====

describe("build_grep_index", () => {
  function as_lines(source: string): string[] {
    return source.split("\n");
  }

  it("indexes simple identifier-followed-by-paren calls", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.ts"), as_lines("const x = foo();\nconst y = bar();")],
    ]);

    const index = build_grep_index(lines_by_file, new Map());

    expect(index.get("foo")).toEqual([
      { file_path: "a.ts", line: 1, content: "const x = foo();", captures: [] },
    ]);
    expect(index.get("bar")).toEqual([
      { file_path: "a.ts", line: 2, content: "const y = bar();", captures: [] },
    ]);
  });

  it("collects all occurrences of a repeated name across files", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.ts"), as_lines("foo(); foo();")],
      [fp("b.ts"), as_lines("foo();")],
    ]);

    const index = build_grep_index(lines_by_file, new Map());

    const foo_hits = index.get("foo") ?? [];
    expect(foo_hits).toHaveLength(3);
    expect(foo_hits.map((h) => `${h.file_path}:${h.line}`)).toEqual([
      "a.ts:1",
      "a.ts:1",
      "b.ts:1",
    ]);
  });

  it("ignores identifiers not followed by an open paren", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.ts"), as_lines("const foo = 1;\nfoo.bar;\nfoo[0];")],
    ]);

    const index = build_grep_index(lines_by_file, new Map());

    expect(index.get("foo")).toBeUndefined();
    expect(index.get("bar")).toBeUndefined();
  });

  it("matches across whitespace between name and paren", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.ts"), as_lines("foo  ();\n  bar (x);")],
    ]);

    const index = build_grep_index(lines_by_file, new Map());

    expect(index.get("foo")).toHaveLength(1);
    expect(index.get("bar")).toHaveLength(1);
  });

  it("supports $ and _ in identifiers", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.js"), as_lines("$(selector); _private();")],
    ]);

    const index = build_grep_index(lines_by_file, new Map());

    expect(index.get("$")).toHaveLength(1);
    expect(index.get("_private")).toHaveLength(1);
  });

  it("attaches captures from call_refs_by_file_line when refs exist at the line", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.ts"), as_lines("foo();")],
    ]);
    const refs_at_line: CallReference[] = [
      {
        location: make_location("a.ts", 1),
        name: name("foo"),
        scope_id: scope("s1"),
        call_type: "function",
        resolutions: [],
        is_callback_invocation: false,
      },
    ];
    const call_refs_by_file_line = new Map<FilePath, Map<number, CallReference[]>>([
      [fp("a.ts"), new Map([[1, refs_at_line]])],
    ]);

    const index = build_grep_index(lines_by_file, call_refs_by_file_line);

    expect(index.get("foo")?.[0].captures).toEqual(["@reference.call"]);
  });

  it("returns empty index for no source files", () => {
    const index = build_grep_index(new Map(), new Map());
    expect(index.size).toBe(0);
  });
});

describe("extract_entry_point_diagnostics populates the fault-area disambiguators", () => {
  // The two booleans feed `derive_fault_area`'s diagnosis fallback so the plan
  // engine derives the area without re-grepping. The derivation that consumes
  // them is exhaustively covered in `packages/types/src/ariadne_fault_area.test.ts`;
  // here we prove the extractor stamps the values core actually emits.
  it("stamps both disambiguators on an uncalled function (both false, no callers)", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-diag-"));
    const file = join(root, "orphan.py");
    await writeFile(file, ["def orphan():", "    return 1", ""].join("\n"), "utf8");
    const project = new Project();
    await project.initialize(root as FilePath);
    project.update_file(file as FilePath, ["def orphan():", "    return 1", ""].join("\n"));

    const call_graph = project.get_call_graph();
    const enriched = extract_entry_point_diagnostics(call_graph, project);
    const orphan = enriched.find((e) => e.name === "orphan");
    if (!orphan) throw new Error("expected an enriched entry point named 'orphan'");

    expect(orphan.diagnostics.diagnosis).toEqual("no-textual-callers");
    expect(orphan.diagnostics.grep_call_sites).toEqual([]);
    expect(orphan.diagnostics.has_uncaptured_indexed_grep_hit).toEqual(false);
    expect(orphan.diagnostics.callers_only_in_unindexed_tests).toEqual(false);
  });
});

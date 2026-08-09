import { describe, it, expect } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Project } from "../project";
import {
  build_grep_index,
  extract_entry_point_diagnostics,
} from "./extract_entry_point_diagnostics";
import type {
  EnrichedEntryPoint,
  EntryPointDiagnostics,
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

// ===== Grep-hit qualification =====

/**
 * Index a set of on-disk files as one `Project`. The files are real because
 * import resolution reads the filesystem; a pair of in-memory `update_file`
 * calls resolves nothing and would make every case below pass vacuously.
 */
async function project_from_files(
  files: Record<string, string>,
): Promise<Project> {
  const root = await mkdtemp(join(tmpdir(), "ariadne-grep-qual-"));
  const project = new Project();
  await project.initialize(root as FilePath);
  for (const [relative_path, content] of Object.entries(files)) {
    const absolute_path = join(root, relative_path);
    await mkdir(dirname(absolute_path), { recursive: true });
    await writeFile(absolute_path, content, "utf8");
    project.update_file(absolute_path as FilePath, content);
  }
  return project;
}

function diagnostics_for(
  entry_points: EnrichedEntryPoint[],
  name: string,
  file_suffix: string,
): EntryPointDiagnostics {
  const found = entry_points.filter(
    (e) => e.name === name && e.file_path.endsWith(file_suffix),
  );
  if (found.length !== 1) {
    throw new Error(
      `expected exactly one entry point ${name} in *${file_suffix}, got ${found.length} ` +
        `(entry points: ${entry_points.map((e) => `${e.name}@${e.file_path}`).join(", ")})`,
    );
  }
  return found[0].diagnostics;
}

async function enriched_for(files: Record<string, string>): Promise<EnrichedEntryPoint[]> {
  const project = await project_from_files(files);
  return extract_entry_point_diagnostics(project.get_call_graph(), project);
}

describe("a grep hit on a declaration line is not a call site", () => {
  it("rejects a sibling class's method override (typeorm dropSchema shape)", async () => {
    const enriched = await enriched_for({
      "driver/mysql/MysqlQueryRunner.ts": [
        "export class MysqlQueryRunner {",
        "  async dropSchema(schema_path: string): Promise<void> {",
        "    return;",
        "  }",
        "}",
        "",
      ].join("\n"),
      "driver/aurora/AuroraMysqlQueryRunner.ts": [
        "export class AuroraMysqlQueryRunner {",
        "  async dropSchema(schema_path: string): Promise<void> {",
        "    return;",
        "  }",
        "}",
        "",
      ].join("\n"),
    });

    const mysql = diagnostics_for(enriched, "dropSchema", "/mysql/MysqlQueryRunner.ts");
    expect(mysql.grep_call_sites).toEqual([]);
    expect(mysql.diagnosis).toEqual("no-textual-callers");
    expect(mysql.has_uncaptured_indexed_grep_hit).toEqual(false);

    const aurora = diagnostics_for(enriched, "dropSchema", "/aurora/AuroraMysqlQueryRunner.ts");
    expect(aurora.grep_call_sites).toEqual([]);
    expect(aurora.diagnosis).toEqual("no-textual-callers");
    expect(aurora.has_uncaptured_indexed_grep_hit).toEqual(false);
  });

  it("rejects a same-named `def` in another module (celery pool_shrink shape)", async () => {
    const enriched = await enriched_for({
      "celery/worker/control.py": [
        "def pool_shrink(state, n=1):",
        "    return state",
        "",
      ].join("\n"),
      "celery/concurrency/asynpool.py": [
        "def pool_shrink(state, n=1):",
        "    return state",
        "",
      ].join("\n"),
    });

    const control = diagnostics_for(enriched, "pool_shrink", "control.py");
    expect(control.grep_call_sites).toEqual([]);
    expect(control.diagnosis).toEqual("no-textual-callers");
    expect(control.has_uncaptured_indexed_grep_hit).toEqual(false);
  });

  it("rejects an `async def` override on another class (django aupdate shape)", async () => {
    const enriched = await enriched_for({
      "django/db/models/query.py": [
        "class QuerySet:",
        "    async def aupdate(self, **kwargs):",
        "        return kwargs",
        "",
      ].join("\n"),
      "django/db/models/manager.py": [
        "class Manager:",
        "    async def aupdate(self, **kwargs):",
        "        return kwargs",
        "",
      ].join("\n"),
    });

    const query = diagnostics_for(enriched, "aupdate", "query.py");
    expect(query.grep_call_sites).toEqual([]);
    expect(query.diagnosis).toEqual("no-textual-callers");
    expect(query.has_uncaptured_indexed_grep_hit).toEqual(false);
  });
});

describe("a grep hit inside a comment is not a call site", () => {
  it("rejects a Rust doc comment (tokio initialize_unfilled shape)", async () => {
    const enriched = await enriched_for({
      "tokio/src/io/read_buf.rs": [
        "pub fn initialize_unfilled() -> u32 {",
        "    0",
        "}",
        "",
      ].join("\n"),
      "tokio/src/io/async_fd.rs": [
        "/// Reads into the buffer.",
        "///",
        "/// let unfilled = buf.initialize_unfilled();",
        "pub fn documented() -> u32 {",
        "    1",
        "}",
        "",
      ].join("\n"),
    });

    const target = diagnostics_for(enriched, "initialize_unfilled", "read_buf.rs");
    expect(target.grep_call_sites).toEqual([]);
    expect(target.diagnosis).toEqual("no-textual-callers");
    expect(target.has_uncaptured_indexed_grep_hit).toEqual(false);
  });

  it("rejects line and block comments in TypeScript", async () => {
    const enriched = await enriched_for({
      "src/renderer.ts": [
        "export function render_widget(): number {",
        "  return 1;",
        "}",
        "",
      ].join("\n"),
      "src/notes.ts": [
        "// call render_widget() to draw",
        "/* render_widget() is the entry */",
        "/**",
        " * render_widget() is documented here",
        " */",
        "export const NOTE = 1;",
        "",
      ].join("\n"),
    });

    const target = diagnostics_for(enriched, "render_widget", "renderer.ts");
    expect(target.grep_call_sites).toEqual([]);
    expect(target.diagnosis).toEqual("no-textual-callers");
  });

  it("rejects a Python comment", async () => {
    const enriched = await enriched_for({
      "app/tasks.py": ["def run_task():", "    return 1", ""].join("\n"),
      "app/notes.py": ["# run_task() is scheduled by the beat", "VALUE = 1", ""].join("\n"),
    });

    const target = diagnostics_for(enriched, "run_task", "tasks.py");
    expect(target.grep_call_sites).toEqual([]);
    expect(target.diagnosis).toEqual("no-textual-callers");
  });
});

describe("qualification keeps genuine call sites", () => {
  it("keeps an unresolved call on the same name and flags it uncaptured", async () => {
    const enriched = await enriched_for({
      "celery/worker/control.py": [
        "class Panel:",
        "    def pool_shrink(self, n=1):",
        "        return n",
        "",
      ].join("\n"),
      "celery/app/boot.py": [
        "from celery.worker.control import Panel",
        "",
        "panel = make_panel()",
        "panel.pool_shrink(1)",
        "",
      ].join("\n"),
    });

    const target = diagnostics_for(enriched, "pool_shrink", "control.py");
    expect(target.grep_call_sites.map((h) => h.content)).toEqual([
      "panel.pool_shrink(1)",
    ]);
    expect(target.has_uncaptured_indexed_grep_hit).toEqual(true);
    expect(target.diagnosis).toEqual("callers-not-in-registry");
  });

  it("keeps a call that shares its line with an unrelated declaration", async () => {
    const enriched = await enriched_for({
      "src/target.ts": [
        "export class Registry {",
        "  make_id(): number {",
        "    return 1;",
        "  }",
        "}",
        "",
      ].join("\n"),
      "src/caller.ts": [
        "export const wrap = (obj: any): number => obj.make_id();",
        "",
      ].join("\n"),
    });

    const target = diagnostics_for(enriched, "make_id", "target.ts");
    expect(target.grep_call_sites.map((h) => h.content)).toEqual([
      "export const wrap = (obj: any): number => obj.make_id();",
    ]);
  });
});

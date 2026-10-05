import { describe, it, expect, afterEach } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Project } from "../project";
import {
  build_grep_index,
  extract_entry_point_diagnostics,
  MAX_GREP_HITS,
} from "./extract_entry_point_diagnostics";
import { trace_call_graph } from "../trace_call_graph/trace_call_graph";
import { check_callback_passed_to_invoker } from "./builtins/check_callback-passed-to-invoker";
import { check_dispatch_table_value_registration } from "./builtins/check_dispatch-table-value-registration";
import { derive_fault_area } from "@ariadnejs/types";
import type {
  DeriveFaultAreaInput,
  EnrichedEntryPoint,
  EntryPointDiagnostics,
  Language,
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

  function languages_for(
    lines_by_file: ReadonlyMap<FilePath, string[]>,
  ): Map<FilePath, Language> {
    const out = new Map<FilePath, Language>();
    for (const file_path of lines_by_file.keys()) {
      out.set(file_path, file_path.endsWith(".js") ? "javascript" : "typescript");
    }
    return out;
  }

  it("indexes simple identifier-followed-by-paren calls", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.ts"), as_lines("const x = foo();\nconst y = bar();")],
    ]);

    const index = build_grep_index(lines_by_file, new Map(), languages_for(lines_by_file), new Set());

    expect(index.get("foo")).toEqual([
      { file_path: "a.ts", line: 1, content: "const x = foo();", captures: [] },
    ]);
    expect(index.get("bar")).toEqual([
      { file_path: "a.ts", line: 2, content: "const y = bar();", captures: [] },
    ]);
  });

  it("collects every occurrence of a repeated name across files while under the cap", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.ts"), as_lines("foo(); foo();")],
      [fp("b.ts"), as_lines("foo();")],
    ]);

    const index = build_grep_index(lines_by_file, new Map(), languages_for(lines_by_file), new Set());

    const foo_hits = index.get("foo") ?? [];
    expect(foo_hits).toHaveLength(3);
    expect(foo_hits.map((h) => `${h.file_path}:${h.line}`)).toEqual([
      "a.ts:1",
      "a.ts:1",
      "b.ts:1",
    ]);
  });

  it("stops storing a name at MAX_GREP_HITS, keeping the corpus's first hits", () => {
    // Sixteen occurrences against a ten-hit cap. The cap is applied as the
    // hits arrive, so the eleventh onwards are never built — the index holds
    // exactly what `grep_for_calls` can hand an investigator.
    const eight_calls = (offset: number) =>
      as_lines(Array.from({ length: 8 }, (_, i) => `foo(${offset + i});`).join("\n"));
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.ts"), eight_calls(0)],
      [fp("b.ts"), eight_calls(8)],
    ]);

    const index = build_grep_index(lines_by_file, new Map(), languages_for(lines_by_file), new Set());

    const foo_hits = index.get("foo") ?? [];
    expect(foo_hits).toHaveLength(MAX_GREP_HITS);
    expect(foo_hits.map((h) => `${h.file_path}:${h.line}`)).toEqual([
      "a.ts:1",
      "a.ts:2",
      "a.ts:3",
      "a.ts:4",
      "a.ts:5",
      "a.ts:6",
      "a.ts:7",
      "a.ts:8",
      "b.ts:1",
      "b.ts:2",
    ]);
  });

  it("caps each name independently", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [
        fp("a.ts"),
        as_lines(
          [
            ...Array.from({ length: 12 }, () => "foo();"),
            ...Array.from({ length: 3 }, () => "bar();"),
          ].join("\n"),
        ),
      ],
    ]);

    const index = build_grep_index(lines_by_file, new Map(), languages_for(lines_by_file), new Set());

    expect(index.get("foo")).toHaveLength(MAX_GREP_HITS);
    expect(index.get("bar")).toHaveLength(3);
  });

  it("ignores identifiers not followed by an open paren", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.ts"), as_lines("const foo = 1;\nfoo.bar;\nfoo[0];")],
    ]);

    const index = build_grep_index(lines_by_file, new Map(), languages_for(lines_by_file), new Set());

    expect(index.get("foo")).toBeUndefined();
    expect(index.get("bar")).toBeUndefined();
  });

  it("matches across whitespace between name and paren", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.ts"), as_lines("foo  ();\n  bar (x);")],
    ]);

    const index = build_grep_index(lines_by_file, new Map(), languages_for(lines_by_file), new Set());

    expect(index.get("foo")).toHaveLength(1);
    expect(index.get("bar")).toHaveLength(1);
  });

  it("supports $ and _ in identifiers", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.js"), as_lines("$(selector); _private();")],
    ]);

    const index = build_grep_index(lines_by_file, new Map(), languages_for(lines_by_file), new Set());

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

    const index = build_grep_index(
      lines_by_file,
      call_refs_by_file_line,
      languages_for(lines_by_file),
      new Set(),
    );

    expect(index.get("foo")?.[0].captures).toEqual(["@reference.call"]);
  });

  it("returns empty index for no source files", () => {
    const index = build_grep_index(new Map(), new Map(), new Map(), new Set());
    expect(index.size).toBe(0);
  });

  it("withholds a declaration header even with no definition records", () => {
    const lines_by_file = new Map<FilePath, string[]>([
      [fp("a.ts"), as_lines("export function make_id() {\n  return make_id();\n}")],
    ]);

    const index = build_grep_index(
      lines_by_file,
      new Map(),
      languages_for(lines_by_file),
      new Set(),
    );

    expect(index.get("make_id")).toEqual([
      { file_path: "a.ts", line: 2, content: "return make_id();", captures: [] },
    ]);
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
  });
});

// ===== Grep-hit qualification =====

const temp_roots: string[] = [];

afterEach(async () => {
  await Promise.all(temp_roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/**
 * Index a set of on-disk files as one `Project`, matching how `load_project`
 * builds one so import resolution reads the same filesystem the pipeline does.
 */
async function project_from_files(
  files: Record<string, string>,
): Promise<Project> {
  const root = await mkdtemp(join(tmpdir(), "ariadne-grep-qual-"));
  temp_roots.push(root);
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

const EMPTY_READER = (_: string) => [] as readonly string[];

function entry_for(
  entry_points: EnrichedEntryPoint[],
  name: string,
  file_suffix: string,
): EnrichedEntryPoint {
  const found = entry_points.filter(
    (e) => e.name === name && e.file_path.endsWith(file_suffix),
  );
  if (found.length !== 1) {
    throw new Error(
      `expected exactly one entry point ${name} in *${file_suffix}, got ${found.length} ` +
        `(entry points: ${entry_points.map((e) => `${e.name}@${e.file_path}`).join(", ")})`,
    );
  }
  return found[0];
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

/**
 * Diagnostics over the RAW call graph, as `detect_entrypoints` computes them.
 * `Project.get_call_graph()` has already dropped entries the builtin
 * classifiers claim (a `@property` accessor among them), and those are exactly
 * the rows whose evidence this qualification has to get right.
 */
async function enriched_for(files: Record<string, string>): Promise<EnrichedEntryPoint[]> {
  const project = await project_from_files(files);
  const call_graph = trace_call_graph(
    project.definitions,
    project.resolutions,
    project.get_languages(),
    { include_tests: false },
  );
  return extract_entry_point_diagnostics(call_graph, project);
}

/**
 * The fault-area derivation reads only these fields off the diagnostics, so a
 * qualification change is only proven once the route it produces is asserted —
 * a phantom hit used to force `syntactic_extraction`.
 */
function fault_area_input(diagnostics: EntryPointDiagnostics): DeriveFaultAreaInput {
  return {
    resolution_failure: null,
    diagnosis: diagnostics.diagnosis,
    has_uncaptured_indexed_grep_hit: diagnostics.has_uncaptured_indexed_grep_hit,
  };
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

describe("a grep hit on a declaration line is not a call site, across driver families", () => {
  // typeorm's six QueryRunner overrides: an abstract base plus two concrete
  // drivers, so every name has three declaration lines and no call.
  const TYPEORM_METHODS = [
    "dropSchema",
    "hasSchema",
    "createDatabase",
    "dropPrimaryKey",
    "dropTable",
    "renameTable",
  ] as const;

  function query_runner(class_name: string, abstract_class: boolean): string {
    const keyword = abstract_class ? "abstract class" : "class";
    const body = abstract_class
      ? TYPEORM_METHODS.map((m) => `  abstract ${m}(name: string): Promise<void>;`)
      : TYPEORM_METHODS.flatMap((m) => [
          `  async ${m}(name: string): Promise<void> {`,
          "    return;",
          "  }",
        ]);
    return [`export ${keyword} ${class_name} {`, ...body, "}", ""].join("\n");
  }

  it("rejects every override declaration of the six typeorm driver methods", async () => {
    const enriched = await enriched_for({
      "driver/QueryRunner.ts": query_runner("BaseQueryRunner", true),
      "driver/mysql/MysqlQueryRunner.ts": query_runner("MysqlQueryRunner", false),
      "driver/postgres/PostgresQueryRunner.ts": query_runner("PostgresQueryRunner", false),
    });

    for (const method of TYPEORM_METHODS) {
      const mysql = diagnostics_for(enriched, method, "/mysql/MysqlQueryRunner.ts");
      expect(mysql.grep_call_sites).toEqual([]);
      expect(mysql.diagnosis).toEqual("no-textual-callers");
      expect(mysql.has_uncaptured_indexed_grep_hit).toEqual(false);
      expect(derive_fault_area(fault_area_input(mysql)).area).not.toEqual(
        "syntactic_extraction",
      );
    }
  });

  it("rejects decorated Python declarations (celery control-command shape)", async () => {
    const commands = ["pool_grow", "autoscale", "add_consumer"];
    const module_source = (decorator: string): string =>
      [
        "class Panel:",
        ...commands.flatMap((c) => [
          `    @${decorator}`,
          `    def ${c}(state, n=1):`,
          "        return state",
        ]),
        "",
      ].join("\n");

    const enriched = await enriched_for({
      "celery/worker/control.py": module_source("control_command"),
      "celery/app/control.py": module_source("inspect_command"),
    });

    for (const command of commands) {
      const worker = diagnostics_for(enriched, command, "worker/control.py");
      expect(worker.grep_call_sites).toEqual([]);
      expect(worker.diagnosis).toEqual("no-textual-callers");
      expect(derive_fault_area(fault_area_input(worker)).area).not.toEqual(
        "syntactic_extraction",
      );
    }
  });

  it("rejects a @property declaration on a sibling class (django as_text shape)", async () => {
    const enriched = await enriched_for({
      "django/forms/boundfield.py": [
        "class BoundField:",
        "    @property",
        "    def as_text(self):",
        "        return 1",
        "",
      ].join("\n"),
      "django/forms/widgets.py": [
        "class Widget:",
        "    @property",
        "    def as_text(self):",
        "        return 2",
        "",
      ].join("\n"),
    });

    const bound = diagnostics_for(enriched, "as_text", "boundfield.py");
    expect(bound.grep_call_sites).toEqual([]);
    expect(bound.diagnosis).toEqual("no-textual-callers");
    expect(derive_fault_area(fault_area_input(bound)).area).not.toEqual(
      "syntactic_extraction",
    );
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

  it("rejects a doctest line inside a Python docstring (celery add_consumer shape)", async () => {
    const enriched = await enriched_for({
      "celery/worker/control.py": [
        "def add_consumer(state, queue):",
        "    return queue",
        "",
      ].join("\n"),
      "celery/app/defaults.py": [
        "def panel():",
        "    \"\"\"Control panel.",
        "",
        "    Example:",
        "        >>> add_consumer('queue-name')",
        "    \"\"\"",
        "    return 1",
        "",
      ].join("\n"),
    });

    const target = diagnostics_for(enriched, "add_consumer", "worker/control.py");
    expect(target.grep_call_sites).toEqual([]);
    expect(target.diagnosis).toEqual("no-textual-callers");
    expect(derive_fault_area(fault_area_input(target)).area).not.toEqual(
      "syntactic_extraction",
    );
  });
});

describe("a non-call reference is carried as evidence", () => {
  it("records a dict registration and a bare-name argument (celery shape)", async () => {
    const enriched = await enriched_for({
      "celery/serialization.py": [
        "class Serializer:",
        "    def deserialize(self, data):",
        "        return data",
        "",
      ].join("\n"),
      "celery/events/dumper.py": [
        "class Dumper:",
        "    def on_event(self, event):",
        "        return event",
        "",
      ].join("\n"),
      "celery/app/registry.py": [
        "from celery.serialization import Serializer",
        "from celery.events.dumper import Dumper",
        "",
        "",
        "def install(registry, s: Serializer, dumper: Dumper):",
        "    registry.register(s.deserialize)",
        "    handlers = {'*': dumper.on_event}",
        "    return handlers",
        "",
      ].join("\n"),
    });

    const deserialize = diagnostics_for(enriched, "deserialize", "serialization.py");
    expect(deserialize.grep_call_sites).toEqual([]);
    expect(deserialize.reference_sites.map((s) => s.content)).toEqual([
      "registry.register(s.deserialize)",
    ]);
    expect(deserialize.reference_sites[0].reference_kind).toEqual("property_access");
    expect(deserialize.diagnosis).toEqual("references-without-call-syntax");
    // The area is determinate; the identity of the sites is not, because the
    // index keys on the name's final segment rather than a resolved symbol.
    expect(derive_fault_area(fault_area_input(deserialize))).toEqual({
      area: "entry_point_classification",
      language: undefined,
      needs_judgement: true,
    });

    const on_event = diagnostics_for(enriched, "on_event", "dumper.py");
    expect(on_event.grep_call_sites).toEqual([]);
    expect(on_event.reference_sites.map((s) => s.content)).toEqual([
      "handlers = {'*': dumper.on_event}",
    ]);
    expect(on_event.diagnosis).toEqual("references-without-call-syntax");
  });

  it("fires the two classifiers that could not see their own registry samples", async () => {
    const enriched = await enriched_for({
      "celery/serialization.py": [
        "class Serializer:",
        "    def as_task_v1(self, data):",
        "        return data",
        "",
        "    def on_node_status(self, node, retcode):",
        "        return node",
        "",
      ].join("\n"),
      "celery/worker/consumer.py": [
        "from celery.serialization import Serializer",
        "",
        "",
        "class Consumer:",
        "    def __init__(self, s: Serializer):",
        "        self.task_protocols = {1: s.as_task_v1}",
        "",
        "    def on_node(self, node, retcode, maybe_call):",
        "        return maybe_call(self.on_node_status, node, retcode)",
        "",
      ].join("\n"),
    });

    const as_task_v1 = entry_for(enriched, "as_task_v1", "serialization.py");
    expect(check_dispatch_table_value_registration(as_task_v1, EMPTY_READER, "python")).toBe(
      true,
    );

    const on_node_status = entry_for(enriched, "on_node_status", "serialization.py");
    expect(check_callback_passed_to_invoker(on_node_status, EMPTY_READER, "python")).toBe(
      true,
    );
  });

  it("keeps the one real registration site when many siblings declare the name", async () => {
    // The per-name cap is spent while filling the index. If declaration lines
    // were filtered afterwards, twelve sibling `def render` declarations would
    // consume the whole budget and the genuine registration — indexed later —
    // would never have been admitted at all.
    const files: Record<string, string> = {};
    for (let i = 0; i < 12; i++) {
      files[`widgets/w${i}.py`] = [
        `class Widget${i}:`,
        "    def render(self):",
        "        return 1",
        "",
      ].join("\n");
    }
    files["app/registry.py"] = [
      "from widgets.w0 import Widget0",
      "",
      "",
      "def install(sink, w: Widget0):",
      "    sink.append(w.render)",
      "    return sink",
      "",
    ].join("\n");

    const enriched = await enriched_for(files);

    const render = diagnostics_for(enriched, "render", "widgets/w0.py");
    expect(render.reference_sites.map((s) => s.content)).toEqual([
      "sink.append(w.render)",
    ]);
    expect(render.diagnosis).toEqual("references-without-call-syntax");
  });

  it("does not read a bare same-named local as a caller of a method", async () => {
    // The index keys on a name, not a resolved symbol, so a local `errors = []`
    // would otherwise be published as evidence that a method `errors` is
    // reached — determinate, and wrong.
    const enriched = await enriched_for({
      "django/forms/formsets.py": [
        "class BaseFormSet:",
        "    def errors(self):",
        "        return 1",
        "",
      ].join("\n"),
      "django/forms/models.py": [
        "def collect():",
        "    errors = []",
        "    return errors",
        "",
      ].join("\n"),
    });

    const errors = diagnostics_for(enriched, "errors", "formsets.py");
    expect(errors.reference_sites).toEqual([]);
    expect(errors.diagnosis).toEqual("no-textual-callers");
  });

  it("does not flood reference_sites with whole-expression records", async () => {
    const enriched = await enriched_for({
      "src/holder.py": [
        "class Holder:",
        "    def __init__(self):",
        "        self.value = 1",
        "",
        "    def read(self):",
        "        return self.value",
        "",
      ].join("\n"),
    });

    const read = diagnostics_for(enriched, "read", "holder.py");
    // `return self.value` produces several reference records, including
    // whole-expression text. None of them keys on `read`.
    expect(read.reference_sites).toEqual([]);
    expect(read.diagnosis).toEqual("no-textual-callers");
  });

  it("keeps a resolved call out of reference_sites — it is already a call ref", async () => {
    const enriched = await enriched_for({
      "src/panel.py": [
        "class Panel:",
        "    def shrink(self, n):",
        "        return n",
        "",
      ].join("\n"),
      "src/caller.py": [
        "def go(p):",
        "    return p.shrink(1)",
        "",
      ].join("\n"),
    });

    // The receiver is untyped, so the call never resolves and `shrink` stays a
    // candidate — but the mention is still a CALL, so it belongs to the grep
    // channel and must not be duplicated into the reference channel.
    const shrink = diagnostics_for(enriched, "shrink", "panel.py");
    expect(shrink.grep_call_sites.map((h) => h.content)).toEqual(["return p.shrink(1)"]);
    expect(shrink.reference_sites).toEqual([]);
  });
});

describe("qualification keeps genuine call sites", () => {
  it("keeps a Rust deref that opens the line", async () => {
    const enriched = await enriched_for({
      "src/counter.rs": [
        "pub struct Counter;",
        "impl Counter {",
        "    pub fn borrow_mut(&self) -> u32 {",
        "        1",
        "    }",
        "}",
        "",
      ].join("\n"),
      "src/user.rs": [
        "pub fn bump(c: &mut u32) {",
        "    *c.borrow_mut();",
        "}",
        "",
      ].join("\n"),
    });

    const target = diagnostics_for(enriched, "borrow_mut", "counter.rs");
    expect(target.grep_call_sites.map((h) => h.content)).toEqual(["*c.borrow_mut();"]);
  });

  it("keeps a module-level call the resolver never captured", async () => {
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
    expect(target.grep_call_sites.map((h) => ({ line: h.line, content: h.content, captures: h.captures }))).toEqual([
      { line: 4, content: "panel.pool_shrink(1)", captures: [] },
    ]);
    // Module-level code belongs to no callable body, so the resolver produced
    // no `CallReference` at that line — the hit is genuinely uncaptured.
    expect(target.ariadne_call_refs).toEqual([]);
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

describe("diagnostics evidence is a function of the corpus, not the ingest order", () => {
  async function write_corpus(
    files: readonly (readonly [string, string])[],
  ): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "ariadne-diag-order-"));
    temp_roots.push(root);
    for (const [relative_path, content] of files) {
      const absolute_path = join(root, relative_path);
      await mkdir(dirname(absolute_path), { recursive: true });
      await writeFile(absolute_path, content, "utf8");
    }
    return root;
  }

  async function enriched_in_order(
    root: string,
    files: readonly (readonly [string, string])[],
  ): Promise<EnrichedEntryPoint[]> {
    const project = new Project();
    await project.initialize(root as FilePath);
    for (const [relative_path, content] of files) {
      project.update_file(join(root, relative_path) as FilePath, content);
    }
    const call_graph = trace_call_graph(
      project.definitions,
      project.resolutions,
      project.get_languages(),
      { include_tests: false },
    );
    return extract_entry_point_diagnostics(call_graph, project);
  }

  it("keeps the earliest call sites under the cap whichever order files arrive in", async () => {
    // Sixty same-named call sites against a fifty-site cap: which fifty
    // survive is only well-defined if it is a property of the corpus. Each
    // caller file resolves `helper` to its own local, so the exported one in
    // helper.ts stays an entry point whose evidence is matched by name alone.
    const call_lines = Array.from({ length: 20 }, () => "  helper();").join("\n");
    const caller_file = (suffix: string) =>
      `function helper(): number {\n  return 0;\n}\nfunction drive_${suffix}(): void {\n${call_lines}\n}\n`;
    const files: readonly (readonly [string, string])[] = [
      ["callers/a.ts", caller_file("a")],
      ["callers/b.ts", caller_file("b")],
      ["callers/c.ts", caller_file("c")],
      ["helper.ts", "export function helper(): number {\n  return 1;\n}\n"],
    ];
    const root = await write_corpus(files);

    const forward = await enriched_in_order(root, files);
    const reversed = await enriched_in_order(root, [...files].reverse());

    const entry_forward = entry_for(forward, "helper", "helper.ts");
    const entry_reversed = entry_for(reversed, "helper", "helper.ts");

    expect(entry_forward.diagnostics.ariadne_call_refs).toHaveLength(50);
    expect(entry_forward.diagnostics.grep_call_sites).toHaveLength(10);

    // The fifty retained are the earliest call sites in path order: all of
    // a.ts and b.ts, then the first ten of c.ts.
    const kept_per_file: Record<string, number> = {};
    for (const ref of entry_forward.diagnostics.ariadne_call_refs) {
      const file_key = ref.caller_file.slice(root.length + 1);
      kept_per_file[file_key] = (kept_per_file[file_key] ?? 0) + 1;
    }
    expect(kept_per_file).toEqual({
      "callers/a.ts": 20,
      "callers/b.ts": 20,
      "callers/c.ts": 10,
    });

    expect(entry_forward).toEqual(entry_reversed);
  });
});

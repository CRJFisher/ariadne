import { describe, expect, it, beforeEach } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FilePath, KnownIssuesRegistry } from "@ariadnejs/types";
import { Project } from "../project";
import { enrich_call_graph } from "./enrich_call_graph";
import { extract_entry_point_diagnostics } from "./extract_entry_point_diagnostics";
import { trace_call_graph } from "../trace_call_graph/trace_call_graph";

async function make_project_with(files: Record<string, string>): Promise<{
  project: Project;
  root: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "ariadne-classify-"));
  const project = new Project();
  for (const rel of Object.keys(files)) {
    const dir = join(root, rel.split("/").slice(0, -1).join("/"));
    if (dir !== root) await mkdir(dir, { recursive: true });
    await writeFile(join(root, rel), files[rel], "utf8");
  }
  await project.initialize(root as FilePath);
  for (const [rel, content] of Object.entries(files)) {
    project.update_file(join(root, rel) as FilePath, content);
  }
  return { project, root };
}

describe("enrich_call_graph", () => {
  it("classifies Python framework-invoked dunder methods as dunder_protocol", async () => {
    const { project } = await make_project_with({
      "model.py": [
        "class Model:",
        "    def __str__(self):",
        "        return 'm'",
        "    def __init__(self, name):",
        "        self.name = name",
        "    def used(self):",
        "        return 1",
        "",
        "m = Model('a')",
        "m.used()",
        "",
      ].join("\n"),
    });
    const classified = project.get_classified_entry_points();
    const fp_kinds = new Set(classified.known_false_positives.map((c) => c.classification.kind));
    expect(fp_kinds.has("dunder_protocol")).toBe(true);
    const dunders = classified.known_false_positives.filter(
      (c) => c.classification.kind === "dunder_protocol",
    );
    // __str__ should be classified as dunder_protocol
    expect(dunders.some((c) => c.classification.kind === "dunder_protocol" && c.classification.protocol === "__str__")).toBe(true);
    // __init__ is traceable; should NOT be in known_false_positives
    expect(dunders.every((c) => c.classification.kind !== "dunder_protocol" || c.classification.protocol !== "__init__")).toBe(true);
  });

  it("filters dunders out of Project.get_call_graph().entry_points by default", async () => {
    const { project } = await make_project_with({
      "model.py": [
        "class Model:",
        "    def __repr__(self):",
        "        return 'r'",
        "    def used(self):",
        "        return 1",
        "",
        "Model().used()",
        "",
      ].join("\n"),
    });
    const cg = project.get_call_graph();
    const names = Array.from(cg.nodes.values())
      .filter((n) => cg.entry_points.includes(n.symbol_id))
      .map((n) => n.name as string);
    expect(names).not.toContain("__repr__");
  });

  it("caches EnrichedCallGraph on the Project across calls with the same registry", async () => {
    const { project } = await make_project_with({
      "x.py": "def a():\n    pass\n",
    });
    const c1 = project.get_classified_entry_points();
    const c2 = project.get_classified_entry_points();
    // Same array reference indicates cache hit (no re-enrichment).
    expect(c1.true_entry_points).toBe(c2.true_entry_points);
  });

  it("invalidates the cache when a custom registry is provided", async () => {
    const { project } = await make_project_with({
      "x.py": "def a():\n    pass\n",
    });
    const default_classified = project.get_classified_entry_points();
    const empty_registry: KnownIssuesRegistry = [];
    const empty_classified = project.get_classified_entry_points({ registry: empty_registry });
    expect(default_classified.true_entry_points).not.toBe(empty_classified.true_entry_points);
  });

  it("invalidates the cache after update_file", async () => {
    const { project, root } = await make_project_with({
      "x.py": "def a():\n    pass\n",
    });
    const before = project.get_classified_entry_points();
    project.update_file(join(root, "x.py") as FilePath, "def a():\n    pass\ndef b():\n    pass\n");
    const after = project.get_classified_entry_points();
    expect(before.true_entry_points).not.toBe(after.true_entry_points);
  });

  it("classifies multiple framework-invoked dunder protocols (__repr__, __eq__, __iter__)", async () => {
    const { project } = await make_project_with({
      "model.py": [
        "class Model:",
        "    def __repr__(self):",
        "        return 'r'",
        "    def __eq__(self, other):",
        "        return True",
        "    def __iter__(self):",
        "        return iter([])",
        "    def used(self):",
        "        return 1",
        "",
        "Model().used()",
        "",
      ].join("\n"),
    });
    const classified = project.get_classified_entry_points();
    const dunder_protocols = classified.known_false_positives
      .map((c) => c.classification)
      .filter((cl) => cl.kind === "dunder_protocol")
      .map((cl) => (cl as { kind: "dunder_protocol"; protocol: string }).protocol);
    expect(dunder_protocols).toEqual(
      expect.arrayContaining(["__repr__", "__eq__", "__iter__"]),
    );
  });

  it("does not silently drop entry points when mapping classifier results back to symbol_ids", async () => {
    const { project } = await make_project_with({
      "x.py": [
        "def lonely_a():",
        "    return 1",
        "",
        "def lonely_b():",
        "    return 2",
        "",
        "def lonely_c():",
        "    return 3",
        "",
      ].join("\n"),
    });
    const classified = project.get_classified_entry_points();
    const total = classified.true_entry_points.length + classified.known_false_positives.length;
    // Every raw entry point must surface in exactly one bucket (no drops, no dupes).
    const raw_count = trace_call_graph(project.definitions, project.resolutions, project.get_languages()).entry_points.length;
    expect(total).toBe(raw_count);
  });

  it("respects a custom registry via enrich_call_graph", async () => {
    const { project } = await make_project_with({
      "x.py": "def lonely_function():\n    return 1\n",
    });
    const raw = trace_call_graph(project.definitions, project.resolutions, project.get_languages());
    // Empty registry → all entries are true_entry_points.
    const enriched = enrich_call_graph(raw, project, { registry: [] });
    expect(enriched.classified_entry_points.known_false_positives.length).toBe(0);
    expect(enriched.classified_entry_points.true_entry_points.length).toBeGreaterThan(0);
  });

  it("emits framework_invoked classification with framework and group_id from rule metadata", async () => {
    const { project } = await make_project_with({
      "routes.py": "def handler():\n    return 'ok'\n",
    });
    const raw = trace_call_graph(project.definitions, project.resolutions, project.get_languages());
    const registry: KnownIssuesRegistry = [
      {
        group_id: "flask-route-decorator",
        title: "Flask route handler",
        description: "Handlers registered via @app.route are framework-invoked.",
        status: "permanent",
        languages: ["python"],
        examples: [],
        classifier: {
          function_name: "check_flask_route_decorator",
          min_confidence: 1.0,
        },
        classification: { kind: "framework_invoked", framework: "flask" },
      },
    ];
    const enriched = enrich_call_graph(raw, project, {
      registry,
      builtin_checks: { check_flask_route_decorator: () => true },
    });
    const fps = enriched.classified_entry_points.known_false_positives;
    expect(fps.length).toBeGreaterThan(0);
    for (const fp of fps) {
      if (fp.classification.kind !== "framework_invoked") continue;
      expect(fp.classification.framework).toEqual("flask");
      expect(fp.classification.group_id).toEqual("flask-route-decorator");
    }
  });

  it("emits test_only classification carrying the rule's group_id", async () => {
    const { project } = await make_project_with({
      "tests/test_x.py": "def helper():\n    return 1\n",
    });
    const raw = trace_call_graph(project.definitions, project.resolutions, project.get_languages(), {
      include_tests: true,
    });
    const registry: KnownIssuesRegistry = [
      {
        group_id: "test-only-helpers",
        title: "Test-only helpers",
        description: "Helpers that exist only inside tests/ trees.",
        status: "permanent",
        languages: ["python"],
        examples: [],
        classifier: {
          function_name: "check_test_only_helpers",
          min_confidence: 1.0,
        },
        classification: { kind: "test_only" },
      },
    ];
    const enriched = enrich_call_graph(raw, project, {
      registry,
      builtin_checks: { check_test_only_helpers: () => true },
    });
    const fps = enriched.classified_entry_points.known_false_positives;
    expect(fps.length).toBeGreaterThan(0);
    for (const fp of fps) {
      if (fp.classification.kind !== "test_only") continue;
      expect(fp.classification.group_id).toEqual("test-only-helpers");
    }
  });

  it("emits indirect_only classification with via.type and group_id", async () => {
    const { project } = await make_project_with({
      "x.py": "def callback():\n    return 1\n",
    });
    const raw = trace_call_graph(project.definitions, project.resolutions, project.get_languages());
    const registry: KnownIssuesRegistry = [
      {
        group_id: "function-reference-callback",
        title: "Function reference passed as callback",
        description: "Reached only via a stored callable reference.",
        status: "permanent",
        languages: ["python"],
        examples: [],
        classifier: {
          function_name: "check_function_reference_callback",
          min_confidence: 1.0,
        },
        classification: { kind: "indirect_only" },
      },
    ];
    const enriched = enrich_call_graph(raw, project, {
      registry,
      builtin_checks: { check_function_reference_callback: () => true },
    });
    const fps = enriched.classified_entry_points.known_false_positives;
    expect(fps.length).toBeGreaterThan(0);
    for (const fp of fps) {
      if (fp.classification.kind !== "indirect_only") continue;
      expect(fp.classification.group_id).toEqual("function-reference-callback");
      expect(fp.classification.via.type).toEqual("function_reference");
    }
  });

  it("falls back to framework_invoked + group_id when a rule has no classification metadata", async () => {
    const { project } = await make_project_with({
      "x.py": "def lonely():\n    return 1\n",
    });
    const raw = trace_call_graph(project.definitions, project.resolutions, project.get_languages());
    // No `classification` field on the rule → fallback path in build_classification.
    const registry: KnownIssuesRegistry = [
      {
        group_id: "wip-rule-no-metadata",
        title: "Wip rule",
        description: "Authored before classification metadata was annotated.",
        status: "wip",
        languages: ["python"],
        examples: [],
        classifier: {
          function_name: "check_wip_rule_no_metadata",
          min_confidence: 1.0,
        },
      },
    ];
    const enriched = enrich_call_graph(raw, project, {
      registry,
      builtin_checks: { check_wip_rule_no_metadata: () => true },
    });
    const fps = enriched.classified_entry_points.known_false_positives;
    expect(fps.length).toBeGreaterThan(0);
    for (const fp of fps) {
      if (fp.classification.kind !== "framework_invoked") continue;
      expect(fp.classification.group_id).toEqual("wip-rule-no-metadata");
      expect(fp.classification.framework).toEqual("wip-rule-no-metadata");
    }
  });

  it("throws MissingBuiltinError when a registry builtin rule references a function_name not in the barrel", async () => {
    const { project } = await make_project_with({
      "x.py": "def lonely():\n    return 1\n",
    });
    const raw = trace_call_graph(project.definitions, project.resolutions, project.get_languages());
    const registry: KnownIssuesRegistry = [
      {
        group_id: "bogus-builtin",
        title: "Bogus",
        description: "Points at a function_name not in the generated barrel.",
        status: "permanent",
        languages: ["python"],
        examples: [],
        classifier: {
          function_name: "check_does_not_exist",
          min_confidence: 1.0,
        },
      },
    ];
    expect(() => enrich_call_graph(raw, project, { registry })).toThrow(
      /MissingBuiltinError|check_does_not_exist|barrel/i,
    );
  });
});

/**
 * Evidence-case coverage for task-348: a bound or static method read as a value
 * (passed as an argument, `.bind(this)`, stored in a field) is indirectly
 * reachable and must leave the entry-point set. Assertions run against the raw
 * `trace_call_graph` output so they isolate the reachability arm from registry
 * classification. Each entry-point name set is pinned to the exact output of the
 * real pipeline.
 */
describe("method-as-value indirect reachability (task-348)", () => {
  function entry_point_names(project: Project): string[] {
    const raw = trace_call_graph(project.definitions, project.resolutions, project.get_languages());
    return raw.entry_points
      .map((id) => raw.nodes.get(id)!.name)
      .sort();
  }

  it("Python bound method passed as an argument leaves the entry points", async () => {
    const { project } = await make_project_with({
      "pool.py": [
        "class Registry:",
        "    def register(self, fn):",
        "        self._fn = fn",
        "",
        "class Pool:",
        "    def __init__(self, registry):",
        "        registry.register(self._acquire_connection)",
        "    def _acquire_connection(self):",
        "        return 1",
        "",
        "Pool(Registry())",
        "",
      ].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).not.toContain("_acquire_connection");
    expect(names).toEqual(["register"]);
  });

  it("Python method passed as a value leaves the entry points", async () => {
    const { project } = await make_project_with({
      "graph.py": [
        "class Scheduler:",
        "    def add(self, cb):",
        "        self._cb = cb",
        "",
        "class Graph:",
        "    def __init__(self, scheduler):",
        "        scheduler.add(self.on_node_start)",
        "    def on_node_start(self):",
        "        return 1",
        "",
        "Graph(Scheduler())",
        "",
      ].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).not.toContain("on_node_start");
    expect(names).toEqual(["add"]);
  });

  it("TypeScript bound method via this.method.bind(this) leaves the entry points", async () => {
    const { project } = await make_project_with({
      "logger.ts": [
        "class Logger {",
        "  attach(out: { write: (s: string) => void }) {",
        "    out.write = this.write.bind(this);",
        "  }",
        "  write(s: string) {",
        "    return s;",
        "  }",
        "}",
        "new Logger();",
        "",
      ].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).not.toContain("write");
    expect(names).toEqual(["attach"]);
  });

  it("Python method stored into a field leaves the entry points", async () => {
    const { project } = await make_project_with({
      "engine.py": [
        "class Engine:",
        "    def __init__(self):",
        "        self._processor = self.process",
        "    def process(self):",
        "        return 1",
        "",
        "Engine()",
        "",
      ].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).not.toContain("process");
    expect(names).toEqual([]);
  });

  it("TypeScript method stored into a class field initializer leaves the entry points", async () => {
    const { project } = await make_project_with({
      "engine.ts": [
        "class Engine {",
        "  private _proc = this.process;",
        "  process() {",
        "    return 1;",
        "  }",
        "}",
        "new Engine();",
        "",
      ].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).not.toContain("process");
    expect(names).toEqual([]);
  });

  it("TypeScript function stored in a shorthand object literal leaves the entry points", async () => {
    const { project } = await make_project_with({
      "extract.ts": [
        "function extractValue(s: string) {",
        "  return s.trim();",
        "}",
        "const obj = { extractValue };",
        "",
      ].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).not.toContain("extractValue");
    expect(names).toEqual([]);
  });

  it("TypeScript function returned in a shorthand object and destructured cross-file leaves the entry points", async () => {
    const { project } = await make_project_with({
      "factory.ts": [
        "export function extractValue(s: string) {",
        "  return s.trim();",
        "}",
        "export function make() {",
        "  return { extractValue };",
        "}",
        "",
      ].join("\n"),
      "use.ts": [
        "import { make } from \"./factory\";",
        "const { extractValue } = make();",
        "extractValue(\"hello\");",
        "",
      ].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).not.toContain("extractValue");
  });

  it("JavaScript method stored into a class field initializer leaves the entry points", async () => {
    const { project } = await make_project_with({
      "engine.js": ["class Engine {", "  _proc = this.process;", "  process() {", "    return 1;", "  }", "}", "new Engine();", ""].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).not.toContain("process");
    expect(names).toEqual([]);
  });

  it("JavaScript function stored in a shorthand object literal leaves the entry points", async () => {
    const { project } = await make_project_with({
      "extract.js": ["function extractValue(s) {", "  return s.trim();", "}", "const obj = { extractValue };", ""].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).not.toContain("extractValue");
    expect(names).toEqual([]);
  });

  it("a TypeScript method never referenced as a value stays an entry point", async () => {
    const { project } = await make_project_with({
      "widget.ts": [
        "class Widget {",
        "  used() {",
        "    return this.helper();",
        "  }",
        "  helper() {",
        "    return 1;",
        "  }",
        "  orphan() {",
        "    return 2;",
        "  }",
        "}",
        "new Widget().used();",
        "",
      ].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).toContain("orphan");
    expect(names).toEqual(["orphan", "used"]);
  });

  it("named function passed as an argument stays out of the entry points", async () => {
    const { project } = await make_project_with({
      "events.ts": [
        "function elementMouseOver() {",
        "  return 1;",
        "}",
        "declare const el: { addEventListener: (e: string, f: () => void) => void };",
        "el.addEventListener('x', elementMouseOver);",
        "",
      ].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).not.toContain("elementMouseOver");
    expect(names).toEqual([]);
  });

  // Regression guard for the already-handled closure evidence cases. These
  // exercise the synthetic callback edge in call_resolver (independent of the
  // method-arm change above), not the widened value-reference arm.
  it("inline closures get a synthetic callback edge and stay out of the entry points", async () => {
    const ts = await make_project_with({
      "m.ts": ["export const ys = [1, 2].map((x) => x + 1);", ""].join("\n"),
    });
    expect(entry_point_names(ts.project)).toEqual([]);

    const py = await make_project_with({
      "l.py": ["result = list(map(lambda x: x + 1, [1, 2]))", ""].join("\n"),
    });
    expect(entry_point_names(py.project)).toEqual([]);

    const rs = await make_project_with({
      "lib.rs": ["fn main() {", "    let _ = Some(1).map(|x| x + 1);", "}", ""].join("\n"),
    });
    const rust_names = entry_point_names(rs.project);
    expect(rust_names).not.toContain("<anonymous>");
    expect(rust_names).toEqual(["main"]);
  });

  it("a genuinely dead method whose name is never read stays an entry point", async () => {
    const { project } = await make_project_with({
      "service.py": [
        "class Service:",
        "    def used(self):",
        "        return self.helper()",
        "    def helper(self):",
        "        return 1",
        "    def orphan(self):",
        "        return 2",
        "",
        "Service().used()",
        "",
      ].join("\n"),
    });

    const names = entry_point_names(project);
    expect(names).toContain("orphan");
    expect(names).toEqual(["orphan", "used"]);
  });

  it("classifies the entry points it is handed rather than re-extracting them", async () => {
    // The seam that makes `callers-outside-indexed-corpus` reachable at all.
    // Completing caller evidence touches the filesystem, so it cannot run inside
    // this synchronous pass; the caller runs it and hands the finished entries
    // in. Re-extracting here would silently discard that channel and restore the
    // bug the epic fixed — every out-of-corpus caller reading as no caller.
    const { project } = await make_project_with({
      "service.py": ["def orphan():", "    return 2", ""].join("\n"),
    });
    const call_graph = trace_call_graph(
      project.definitions,
      project.resolutions,
      project.get_languages(),
      { include_tests: false },
    );

    const settled = extract_entry_point_diagnostics(call_graph, project);
    expect(settled).toHaveLength(1);
    settled[0].diagnostics.grep_call_sites_outside_index = [
      {
        file_path: "held_out/caller.py" as FilePath,
        line: 3,
        content: "orphan()",
        captures: [],
      },
    ];
    settled[0].diagnostics.diagnosis = "callers-outside-indexed-corpus";

    const enriched = enrich_call_graph(call_graph, project, { entry_points: settled });

    const orphan = [...enriched.entry_points_by_id.values()].find(
      (e) => e.name === "orphan",
    );
    expect(orphan?.diagnostics.diagnosis).toEqual("callers-outside-indexed-corpus");
    expect(orphan?.diagnostics.grep_call_sites_outside_index.map((h) => h.content)).toEqual([
      "orphan()",
    ]);
  });
});

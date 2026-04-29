import { describe, expect, it, beforeEach } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FilePath, KnownIssuesRegistry } from "@ariadnejs/types";
import { Project } from "../project";
import { enrich_call_graph } from "./enrich_call_graph";
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
    const raw_count = trace_call_graph(project.definitions, project.resolutions).entry_points.length;
    expect(total).toBe(raw_count);
  });

  it("respects a custom registry via enrich_call_graph", async () => {
    const { project } = await make_project_with({
      "x.py": "def lonely_function():\n    return 1\n",
    });
    const raw = trace_call_graph(project.definitions, project.resolutions);
    // Empty registry → all entries are true_entry_points.
    const enriched = enrich_call_graph(raw, project, { registry: [] });
    expect(enriched.classified_entry_points.known_false_positives.length).toBe(0);
    expect(enriched.classified_entry_points.true_entry_points.length).toBeGreaterThan(0);
  });
});

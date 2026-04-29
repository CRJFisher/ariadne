/**
 * End-to-end integration test for the prepare_triage pipeline core.
 *
 * Exercises the two-bucket orchestration — auto-classified, residual — and
 * verifies the `max_count` contract: it caps only the residual bucket, never
 * the already-completed auto-classified entries.
 *
 * Also verifies deterministic selection: running the pipeline twice on
 * identical input produces byte-identical output.
 */

import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prepare_triage, sort_residual_entry_points } from "./prepare_triage.js";
import type { ResidualEntryPoint } from "./build_triage_entries.js";
import { Project, trace_call_graph } from "@ariadnejs/core";
import type {
  CallGraph,
  EnrichedEntryPoint,
  FilePath,
  KnownIssue,
  KnownIssuesRegistry,
} from "@ariadnejs/types";

// ===== Fixtures =====

async function make_project_with(
  files: Record<string, string>,
): Promise<{ project: Project; call_graph: CallGraph }> {
  const root = await mkdtemp(join(tmpdir(), "ariadne-prepare-triage-"));
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
  const call_graph = trace_call_graph(project.definitions, project.resolutions, {
    include_tests: false,
  });
  return { project, call_graph };
}

function predicate_issue(
  group_id: string,
  diagnosis_value: string,
): KnownIssue {
  return {
    group_id,
    title: `Title for ${group_id}`,
    description: `Desc for ${group_id}`,
    status: "permanent",
    languages: ["python"],
    examples: [],
    classifier: {
      kind: "predicate",
      axis: "A",
      expression: { op: "diagnosis_eq", value: diagnosis_value },
      min_confidence: 1.0,
    },
    classification: {
      kind: "framework_invoked",
      framework: "test_framework",
    },
  };
}

function make_entry(overrides: Partial<EnrichedEntryPoint> & { name: string }): EnrichedEntryPoint {
  return {
    file_path: `src/${overrides.name}.ts` as FilePath,
    start_line: 1,
    kind: "function",
    tree_size: 10,
    is_exported: true,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: [],
      diagnosis: "callers-not-in-registry",
    },
    ...overrides,
  };
}

// ===== Tests =====

describe("prepare_triage — two-bucket end-to-end", () => {
  it("max-count caps only the residual bucket; auto_classified entries are always kept in full", async () => {
    // 5 functions with no callers anywhere → diagnosis `no-textual-callers`
    // (matches the auto-classifier predicate).
    const auto_lines: string[] = [];
    for (let i = 0; i < 5; i++) {
      auto_lines.push(`def auto_${i}():`);
      auto_lines.push("    pass");
      auto_lines.push("");
    }
    // 12 functions referenced only inside a Python comment. The grep pass
    // picks up the textual occurrence, but tree-sitter ignores the comment so
    // Ariadne emits no CallReference → diagnosis `callers-not-in-registry`
    // (does NOT match the auto-classifier predicate).
    const residual_lines: string[] = [];
    for (let i = 0; i < 12; i++) {
      residual_lines.push(`def resid_${String(i).padStart(2, "0")}():`);
      residual_lines.push("    pass");
      residual_lines.push("");
    }
    const comment_lines: string[] = [];
    for (let i = 0; i < 12; i++) {
      comment_lines.push(`# resid_${String(i).padStart(2, "0")}()`);
    }

    const code = [...auto_lines, ...residual_lines, ...comment_lines, ""].join("\n");
    const { project, call_graph } = await make_project_with({ "mod.py": code });

    const registry: KnownIssuesRegistry = [
      predicate_issue("match-no-textual-callers", "no-textual-callers"),
    ];

    const report = prepare_triage({
      call_graph,
      project,
      registry,
      max_count: 5,
    });

    expect(report.stats.auto_count).toEqual(5);
    expect(report.stats.residual_total).toEqual(12);
    expect(report.stats.residual_kept).toEqual(5);
    expect(report.entries.length).toEqual(10);

    const auto_signatures = report.entries.slice(0, 5).map((e) => ({
      route: e.route,
      status: e.status,
      auto_classified: e.auto_classified,
      known_source: e.known_source,
    }));
    expect(auto_signatures).toEqual(
      Array(5).fill({
        route: "known-unreachable",
        status: "completed",
        auto_classified: true,
        known_source: "match-no-textual-callers",
      }),
    );
    const residual_signatures = report.entries.slice(5).map((e) => ({
      route: e.route,
      status: e.status,
      auto_classified: e.auto_classified,
      known_source: e.known_source,
    }));
    expect(residual_signatures).toEqual(
      Array(5).fill({
        route: "llm-triage",
        status: "pending",
        auto_classified: false,
        known_source: null,
      }),
    );
  });

  it("residual sampling is deterministic across runs", async () => {
    // 6 residual entries with no auto-classifier match.
    const lines: string[] = [];
    for (let i = 0; i < 6; i++) {
      lines.push(`def fn_${i}():`);
      lines.push("    pass");
      lines.push("");
    }
    const code = [...lines, ""].join("\n");
    const { project, call_graph } = await make_project_with({ "mod.py": code });

    const registry: KnownIssuesRegistry = [];

    const first = prepare_triage({ call_graph, project, registry, max_count: 3 });
    const second = prepare_triage({ call_graph, project, registry, max_count: 3 });

    expect(first.entries.length).toEqual(3);
    expect(first.entries.map((e) => e.name)).toEqual(second.entries.map((e) => e.name));
  });

  it("no max_count keeps every residual entry", async () => {
    const lines: string[] = [];
    for (let i = 0; i < 4; i++) {
      lines.push(`def fn_${i}():`);
      lines.push("    pass");
      lines.push("");
    }
    const code = [...lines, ""].join("\n");
    const { project, call_graph } = await make_project_with({ "mod.py": code });

    const registry: KnownIssuesRegistry = [];

    const report = prepare_triage({ call_graph, project, registry, max_count: null });

    expect(report.stats.residual_total).toEqual(4);
    expect(report.stats.residual_kept).toEqual(4);
    expect(report.entries.length).toEqual(4);
  });

  it("max_count greater than residual_total keeps all residual entries", async () => {
    const lines: string[] = [];
    for (let i = 0; i < 3; i++) {
      lines.push(`def fn_${i}():`);
      lines.push("    pass");
      lines.push("");
    }
    const code = [...lines, ""].join("\n");
    const { project, call_graph } = await make_project_with({ "mod.py": code });

    const registry: KnownIssuesRegistry = [];

    const report = prepare_triage({ call_graph, project, registry, max_count: 20 });

    expect(report.stats.residual_kept).toEqual(3);
    expect(report.entries.length).toEqual(3);
  });
});

describe("sort_residual_entry_points — tie-breaking", () => {
  it("breaks tree_size ties by file_path ascending then start_line ascending", () => {
    const to_residual = (e: EnrichedEntryPoint): ResidualEntryPoint => ({ entry_point: e, classifier_hints: [] });
    const input: ResidualEntryPoint[] = [
      to_residual(make_entry({ name: "x1", file_path: "src/z.ts" as FilePath,     start_line: 10, tree_size: 5 })),
      to_residual(make_entry({ name: "x2", file_path: "src/a.ts" as FilePath,     start_line: 20, tree_size: 5 })),
      to_residual(make_entry({ name: "x3", file_path: "src/a.ts" as FilePath,     start_line: 10, tree_size: 5 })),
      to_residual(make_entry({ name: "x4", file_path: "src/middle.ts" as FilePath, start_line: 1,  tree_size: 9 })),
    ];

    const ordered = sort_residual_entry_points(input);

    expect(ordered.map((r) => r.entry_point.name)).toEqual(["x4", "x3", "x2", "x1"]);
  });
});

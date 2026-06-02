import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  analysis_output_dir,
  triage_results_dir,
  triage_results_path,
  parse_triage_results_path,
  known_issues_registry_path,
  plan_tasks_dir,
  plan_task_path,
  plan_sweeps_dir,
} from "./paths.js";
import { parse_run_id } from "./run_id.js";

// vi.hoisted runs before the `import` statements, so the overrides are set
// before any path function reads them. Proves the lazy env read honors them.
// The triage and plan bases are siblings under `~/.ariadne/`, each with its own
// override.
const TMP_BASE = vi.hoisted(() => {
  const tmp = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-skill-protocol-paths-${process.pid}`;
  process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE = tmp;
  return tmp;
});

const PLAN_BASE = vi.hoisted(() => {
  const tmp = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-skill-protocol-plan-${process.pid}`;
  process.env.ARIADNE_PLAN_DIR_OVERRIDE = tmp;
  return tmp;
});

describe("analysis_output_dir", () => {
  it("composes <override>/analysis_output, honoring the lazy env read", () => {
    expect(analysis_output_dir()).toBe(path.join(TMP_BASE, "analysis_output"));
  });
});

describe("triage_results_path / parse_triage_results_path", () => {
  const run_id = parse_run_id("deadbee-2026-04-28T13-42-07.812Z");

  it("round-trips a path back to its project and run-id", () => {
    const p = triage_results_path("express", run_id);
    expect(p).toBe(path.join(triage_results_dir("express"), `${run_id}.json`));

    const parsed = parse_triage_results_path(p);
    expect(parsed).toEqual({ project: "express", run_id });
  });

  it("recovers the project from an independently-constructed nested path", () => {
    const p = path.join("/some/where", "myproj", "triage_results", `${run_id}.json`);
    expect(parse_triage_results_path(p)).toEqual({ project: "myproj", run_id });
  });

  it("throws when the filename is not a valid run-id", () => {
    const bad = path.join(triage_results_dir("express"), "r1.json");
    expect(() => parse_triage_results_path(bad)).toThrow(/Invalid run-id/);
  });
});

describe("known_issues_registry_path", () => {
  it("resolves to the registry under the repo root located via pnpm-workspace.yaml", () => {
    const p = known_issues_registry_path();
    expect(
      p.endsWith(
        path.join(".claude", "skills", "triage", "known_issues", "registry.json"),
      ),
    ).toBe(true);
    expect(fs.existsSync(p)).toBe(true);
  });
});

describe("plan task-DB paths", () => {
  it("plan_tasks_dir composes <plan-override>/tasks, honoring the lazy env read", () => {
    expect(plan_tasks_dir()).toBe(path.join(PLAN_BASE, "tasks"));
  });

  it("plan_sweeps_dir composes <plan-override>/sweeps", () => {
    expect(plan_sweeps_dir()).toBe(path.join(PLAN_BASE, "sweeps"));
  });

  it("plan_task_path names <plan-override>/tasks/<id>.json", () => {
    expect(plan_task_path("01HXYZ-abc")).toBe(
      path.join(PLAN_BASE, "tasks", "01HXYZ-abc.json"),
    );
  });

  it("plan_task_path composes off plan_tasks_dir", () => {
    expect(plan_task_path("t1")).toBe(path.join(plan_tasks_dir(), "t1.json"));
  });

  it("plan base reads its own override, independent of the triage base", () => {
    expect(plan_tasks_dir().startsWith(TMP_BASE)).toBe(false);
  });
});

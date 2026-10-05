import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  analysis_output_dir,
  repo_root,
  triage_results_dir,
  triage_results_path,
  parse_triage_results_path,
  known_issues_registry_path,
} from "./paths.js";
import { parse_run_id } from "./run_id.js";

// vi.hoisted runs before the `import` statements, so the override is set before
// any path function reads it. Proves the lazy env read honors it.
const TMP_BASE = vi.hoisted(() => {
  const tmp = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-skill-protocol-paths-${process.pid}`;
  process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE = tmp;
  return tmp;
});

describe("repo_root", () => {
  it("resolves the directory holding pnpm-workspace.yaml", () => {
    const root = repo_root();
    expect(path.isAbsolute(root)).toEqual(true);
    expect(fs.existsSync(path.join(root, "pnpm-workspace.yaml"))).toEqual(true);
  });
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

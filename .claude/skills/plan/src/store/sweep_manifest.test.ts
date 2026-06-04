import { describe, expect, it } from "vitest";

import { build_sweep_manifest, type VerifiedRun } from "./sweep_manifest.js";

function run(project: string, run_id: string): VerifiedRun {
  return { project, run_id };
}

describe("build_sweep_manifest", () => {
  it("collects distinct projects and run_ids, sorted", () => {
    const manifest = build_sweep_manifest([
      run("webpack", "r2"),
      run("express", "r1"),
      run("webpack", "r3"),
    ]);
    expect(manifest).toEqual({
      projects: ["express", "webpack"],
      run_ids: ["r1", "r2", "r3"],
    });
  });

  it("includes a project whose run produced zero false-positives (it still parsed = verified)", () => {
    // A zero-FP run is positive evidence the project is clean, so it counts —
    // exactly what lets its stale tasks be recognised as fixed.
    const manifest = build_sweep_manifest([run("clean-proj", "r9")]);
    expect(manifest).toEqual({ projects: ["clean-proj"], run_ids: ["r9"] });
  });

  it("returns empty arrays for no verified runs", () => {
    expect(build_sweep_manifest([])).toEqual({ projects: [], run_ids: [] });
  });
});

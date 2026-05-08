import { describe, it, expect, vi } from "vitest";
import path from "path";
import { build_group_paths } from "./get_group_paths.js";
import type { ResolvedRun } from "../src/triage_state_paths.js";

const TMP_BASE = vi.hoisted(() => {
  const tmp_path = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-get-group-paths-${process.pid}`;
  process.env.ARIADNE_SELF_REPAIR_DIR_OVERRIDE = tmp_path;
  return tmp_path;
});

describe("build_group_paths", () => {
  it("derives run-namespaced paths for results and pass3 from the resolved run", () => {
    const project = "sqlx";
    const run_id = "6956cef-2026-05-06T20-13-03.463Z";
    const run_dir = path.join(TMP_BASE, "triage_state", project, "runs", run_id);
    const state_path = path.join(run_dir, "triage.json");
    const run: ResolvedRun = {
      run_id,
      run_dir,
      state_path,
      manifest_path: path.join(run_dir, "manifest.json"),
    };

    expect(build_group_paths(run)).toEqual({
      run_id,
      state_path,
      results_dir: path.join(run_dir, "results"),
      pass3_dir: path.join(run_dir, "aggregation", "pass3"),
    });
  });
});

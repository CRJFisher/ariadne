import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  get_curated_run,
  is_curated,
  load_state,
  save_state,
  upsert_curated_run,
} from "./curation_state.js";
import type { CuratedRunEntry, CuratorState } from "./types.js";

let tmp_dir: string;
let state_file: string;

beforeEach(async () => {
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "curator-state-"));
  state_file = path.join(tmp_dir, "state.json");
});

afterEach(async () => {
  await fs.rm(tmp_dir, { recursive: true, force: true });
});

function make_entry(run_id: string, overrides: Partial<CuratedRunEntry> = {}): CuratedRunEntry {
  return {
    run_id,
    project: "webpack",
    run_path: `/runs/${run_id}.json`,
    curated_at: "2026-04-21T00:00:00.000Z",
    outcome: {
      qa_groups_checked: 0,
      qa_outliers_found: 0,
      investigated_groups: 0,
      classifiers_proposed: 0,
      backlog_tasks_proposed: [],
      wip_group_example_counts: {},
      success_count: 0,
      failure_count: 0,
      blocked_count: 0,
      failed_groups: [],
    },
    ...overrides,
  };
}

describe("load_state", () => {
  it("returns empty state when file is absent", async () => {
    const state = await load_state(state_file);
    expect(state).toEqual<CuratorState>({ curated_runs: [] });
  });

  it("round-trips a written state", async () => {
    const original: CuratorState = { curated_runs: [make_entry("2026-04-01T00-00-00.000Z")] };
    await save_state(original, state_file);
    const loaded = await load_state(state_file);
    expect(loaded).toEqual(original);
  });
});

describe("save_state", () => {
  it("creates parent directory if missing", async () => {
    const nested = path.join(tmp_dir, "nested", "inner", "state.json");
    await save_state({ curated_runs: [] }, nested);
    const exists = await fs.stat(nested).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});

describe("upsert_curated_run", () => {
  it("appends a new entry", () => {
    const before: CuratorState = { curated_runs: [] };
    const after = upsert_curated_run(before, make_entry("run-a"));
    expect(after.curated_runs.map((e) => e.run_id)).toEqual(["run-a"]);
  });

  it("replaces an existing entry by run_id", () => {
    const before: CuratorState = {
      curated_runs: [make_entry("run-a", { project: "old" }), make_entry("run-b")],
    };
    const replacement = make_entry("run-a", { project: "new" });
    const after = upsert_curated_run(before, replacement);
    expect(after.curated_runs).toHaveLength(2);
    const run_a = after.curated_runs.find((e) => e.run_id === "run-a");
    expect(run_a?.project).toBe("new");
  });

  it("is pure (does not mutate input)", () => {
    const before: CuratorState = { curated_runs: [make_entry("run-a")] };
    upsert_curated_run(before, make_entry("run-b"));
    expect(before.curated_runs).toHaveLength(1);
  });
});

describe("is_curated / get_curated_run", () => {
  const state: CuratorState = { curated_runs: [make_entry("run-x")] };
  it("is_curated returns true for a known run", () => {
    expect(is_curated(state, "run-x")).toBe(true);
  });
  it("is_curated returns false for an unknown run", () => {
    expect(is_curated(state, "run-y")).toBe(false);
  });
  it("get_curated_run returns the entry or null", () => {
    expect(get_curated_run(state, "run-x")?.run_id).toBe("run-x");
    expect(get_curated_run(state, "run-y")).toBeNull();
  });
});

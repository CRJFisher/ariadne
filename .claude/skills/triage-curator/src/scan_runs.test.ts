import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  diff_runs_against_state,
  discover_runs,
  scan_runs,
} from "./scan_runs.js";
import type {
  CuratedRunEntry,
  CuratorState,
  ScanOptions,
  ScanResultItem,
} from "./types.js";

let root: string;
let analysis_output_dir: string;

const DEFAULT_OPTS: ScanOptions = {
  project: null,
  last: null,
  run: null,
  reinvestigate: false,
};

function make_curated(
  run_id: string,
  project: string,
  wip_counts: Record<string, number> = {},
): CuratedRunEntry {
  return {
    run_id,
    project,
    run_path: `/fake/${project}/triage_results/${run_id}.json`,
    curated_at: "2026-04-21T00:00:00.000Z",
    outcome: {
      qa_groups_checked: 0,
      qa_outliers_found: 0,
      investigated_groups: 0,
      classifiers_proposed: 0,
      backlog_tasks_proposed: [],
      wip_group_example_counts: wip_counts,
    },
  };
}

async function seed_run(project: string, run_id: string): Promise<string> {
  const tr_dir = path.join(analysis_output_dir, project, "triage_results");
  await fs.mkdir(tr_dir, { recursive: true });
  const run_path = path.join(tr_dir, `${run_id}.json`);
  await fs.writeFile(run_path, "{}", "utf8");
  return run_path;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "curator-scan-"));
  analysis_output_dir = path.join(root, "analysis_output");
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("discover_runs", () => {
  it("returns empty when analysis_output is absent", async () => {
    const runs = await discover_runs(analysis_output_dir);
    expect(runs).toEqual([]);
  });

  it("finds all triage_results files across projects and sorts chronologically", async () => {
    await seed_run("webpack", "2026-04-16T18-10-16.855Z");
    await seed_run("projections", "2026-03-26T21-04-31.070Z");
    await seed_run("projections", "2026-03-28T14-41-05.888Z");

    const runs = await discover_runs(analysis_output_dir);
    expect(runs.map((r) => r.run_id)).toEqual([
      "2026-03-26T21-04-31.070Z",
      "2026-03-28T14-41-05.888Z",
      "2026-04-16T18-10-16.855Z",
    ]);
    const projections = runs.filter((r) => r.project === "projections");
    expect(projections).toHaveLength(2);
  });

  it("ignores projects that have no triage_results directory", async () => {
    await seed_run("webpack", "run-a");
    const no_tr = path.join(analysis_output_dir, "no-triage-yet", "detect_entrypoints");
    await fs.mkdir(no_tr, { recursive: true });
    await fs.writeFile(path.join(no_tr, "something.json"), "{}", "utf8");
    const runs = await discover_runs(analysis_output_dir);
    expect(runs.map((r) => r.project)).toEqual(["webpack"]);
  });
});

describe("diff_runs_against_state", () => {
  const discovered = [
    { run_id: "r1", project: "p1", run_path: "/p1/r1.json" },
    { run_id: "r2", project: "p1", run_path: "/p1/r2.json" },
    { run_id: "r3", project: "p2", run_path: "/p2/r3.json" },
  ];

  it("returns all runs as 'uncurated' when state is empty", () => {
    const items = diff_runs_against_state(discovered, { curated_runs: [] }, DEFAULT_OPTS, {});
    expect(items.map((i) => i.run_id)).toEqual(["r1", "r2", "r3"]);
    expect(items.every((i) => i.reason === "uncurated")).toBe(true);
  });

  it("returns empty when all runs are already curated", () => {
    const state: CuratorState = {
      curated_runs: discovered.map((d) => make_curated(d.run_id, d.project)),
    };
    const items = diff_runs_against_state(discovered, state, DEFAULT_OPTS, {});
    expect(items).toEqual([]);
  });

  it("returns only un-curated runs (partial state)", () => {
    const state: CuratorState = { curated_runs: [make_curated("r1", "p1")] };
    const items = diff_runs_against_state(discovered, state, DEFAULT_OPTS, {});
    expect(items.map((i) => i.run_id)).toEqual(["r2", "r3"]);
  });

  it("honours --project filter", () => {
    const opts: ScanOptions = { ...DEFAULT_OPTS, project: "p2" };
    const items = diff_runs_against_state(discovered, { curated_runs: [] }, opts, {});
    expect(items.map((i) => i.run_id)).toEqual(["r3"]);
  });

  it("honours --last N filter (keeps most recent)", () => {
    const opts: ScanOptions = { ...DEFAULT_OPTS, last: 2 };
    const items = diff_runs_against_state(discovered, { curated_runs: [] }, opts, {});
    expect(items.map((i) => i.run_id)).toEqual(["r2", "r3"]);
  });

  describe("--reinvestigate", () => {
    it("resurfaces runs where some wip group's example count has grown", () => {
      const state: CuratorState = {
        curated_runs: [
          make_curated("r1", "p1", { "wip-group-a": 3, "wip-group-b": 1 }),
          make_curated("r2", "p1", { "wip-group-a": 3, "wip-group-b": 1 }),
          make_curated("r3", "p2", { "wip-group-a": 5, "wip-group-b": 1 }),
        ],
      };
      const opts: ScanOptions = { ...DEFAULT_OPTS, reinvestigate: true };
      const items = diff_runs_against_state(discovered, state, opts, {
        "wip-group-a": 5,
        "wip-group-b": 1,
      });
      const r1 = items.find((i) => i.run_id === "r1");
      expect(r1?.reason).toBe("reinvestigate");
      expect(r1?.wip_groups_with_growth).toEqual(["wip-group-a"]);
      const r2 = items.find((i) => i.run_id === "r2");
      expect(r2?.wip_groups_with_growth).toEqual(["wip-group-a"]);
      expect(items.find((i) => i.run_id === "r3")).toBeUndefined();
    });

    it("does NOT resurface runs when no wip group grew", () => {
      const state: CuratorState = {
        curated_runs: [
          make_curated("r1", "p1", { "wip-group-a": 3, "wip-group-b": 1 }),
          make_curated("r2", "p1", { "wip-group-a": 3, "wip-group-b": 1 }),
          make_curated("r3", "p2", { "wip-group-a": 3, "wip-group-b": 1 }),
        ],
      };
      const opts: ScanOptions = { ...DEFAULT_OPTS, reinvestigate: true };
      const items = diff_runs_against_state(discovered, state, opts, {
        "wip-group-a": 3,
        "wip-group-b": 1,
      });
      expect(items).toEqual<ScanResultItem[]>([]);
    });

    it("treats a newly-introduced wip group (count > 0, prior absent) as growth", () => {
      const state: CuratorState = {
        curated_runs: [make_curated("r1", "p1", { "wip-group-a": 3 })],
      };
      const opts: ScanOptions = { ...DEFAULT_OPTS, reinvestigate: true };
      const items = diff_runs_against_state(
        [{ run_id: "r1", project: "p1", run_path: "/p1/r1.json" }],
        state,
        opts,
        { "wip-group-a": 3, "wip-group-new": 1 },
      );
      expect(items).toHaveLength(1);
      expect(items[0].wip_groups_with_growth).toEqual(["wip-group-new"]);
    });

    it("still returns un-curated runs alongside reinvestigation candidates", () => {
      const partial_state: CuratorState = {
        curated_runs: [make_curated("r1", "p1", { "wip-group-a": 3 })],
      };
      const opts: ScanOptions = { ...DEFAULT_OPTS, reinvestigate: true };
      const items = diff_runs_against_state(discovered, partial_state, opts, {
        "wip-group-a": 5,
      });
      const reasons = items.map((i) => `${i.run_id}:${i.reason}`);
      expect(reasons).toEqual([
        "r1:reinvestigate",
        "r2:uncurated",
        "r3:uncurated",
      ]);
    });
  });
});

describe("scan_runs end-to-end", () => {
  it("honours --run by short-circuiting discovery", async () => {
    const run_path = await seed_run("webpack", "2026-04-16T18-10-16.855Z");
    const items = await scan_runs(
      { curated_runs: [] },
      { ...DEFAULT_OPTS, run: run_path },
      {},
      analysis_output_dir,
    );
    expect(items).toHaveLength(1);
    expect(items[0].run_id).toBe("2026-04-16T18-10-16.855Z");
    expect(items[0].project).toBe("webpack");
  });

  it("walks analysis_output and applies state diff", async () => {
    await seed_run("webpack", "r-a");
    await seed_run("projections", "r-b");
    const items = await scan_runs({ curated_runs: [] }, DEFAULT_OPTS, {}, analysis_output_dir);
    expect(items.map((i) => i.run_id).sort()).toEqual(["r-a", "r-b"]);
  });
});

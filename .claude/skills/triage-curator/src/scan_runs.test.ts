import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  discover_runs,
  filter_uncurated,
  list_curated_run_ids,
  scan_runs,
} from "./scan_runs.js";
import type { ScanOptions, ScanResultItem } from "./types.js";

let root: string;
let analysis_output_dir: string;
let runs_dir: string;

const DEFAULT_OPTS: ScanOptions = { project: null, last: null, run: null };

async function seed_run(project: string, run_id: string): Promise<string> {
  const tr_dir = path.join(analysis_output_dir, project, "triage_results");
  await fs.mkdir(tr_dir, { recursive: true });
  const run_path = path.join(tr_dir, `${run_id}.json`);
  await fs.writeFile(run_path, "{}", "utf8");
  return run_path;
}

async function mark_curated(run_id: string): Promise<void> {
  const dir = path.join(runs_dir, run_id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "finalized.json"), "{}", "utf8");
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "curator-scan-"));
  analysis_output_dir = path.join(root, "analysis_output");
  runs_dir = path.join(root, "runs");
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("discover_runs", () => {
  it("returns empty when analysis_output is absent", async () => {
    const runs = await discover_runs(analysis_output_dir);
    expect(runs).toEqual<ScanResultItem[]>([]);
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
    expect(runs.filter((r) => r.project === "projections")).toHaveLength(2);
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

describe("list_curated_run_ids", () => {
  it("returns empty set when runs dir is absent", async () => {
    const curated = await list_curated_run_ids(runs_dir);
    expect(curated).toEqual(new Set<string>());
  });

  it("returns only run_ids whose finalized.json sentinel exists", async () => {
    await mark_curated("r1");
    // r2 dir exists (sub-agent outputs landed) but no sentinel.
    await fs.mkdir(path.join(runs_dir, "r2", "qa"), { recursive: true });
    await mark_curated("r3");
    const curated = await list_curated_run_ids(runs_dir);
    expect(curated).toEqual(new Set(["r1", "r3"]));
  });
});

describe("filter_uncurated", () => {
  const discovered: ScanResultItem[] = [
    { run_id: "r1", project: "p1", run_path: "/p1/r1.json" },
    { run_id: "r2", project: "p1", run_path: "/p1/r2.json" },
    { run_id: "r3", project: "p2", run_path: "/p2/r3.json" },
  ];

  it("returns all runs when none are curated", () => {
    const items = filter_uncurated(discovered, new Set(), DEFAULT_OPTS);
    expect(items.map((i) => i.run_id)).toEqual(["r1", "r2", "r3"]);
  });

  it("returns empty when all runs are curated", () => {
    const items = filter_uncurated(discovered, new Set(["r1", "r2", "r3"]), DEFAULT_OPTS);
    expect(items).toEqual<ScanResultItem[]>([]);
  });

  it("returns only un-curated runs (partial state)", () => {
    const items = filter_uncurated(discovered, new Set(["r1"]), DEFAULT_OPTS);
    expect(items.map((i) => i.run_id)).toEqual(["r2", "r3"]);
  });

  it("honours --project filter", () => {
    const items = filter_uncurated(discovered, new Set(), { ...DEFAULT_OPTS, project: "p2" });
    expect(items.map((i) => i.run_id)).toEqual(["r3"]);
  });

  it("honours --last N filter (keeps most recent)", () => {
    const items = filter_uncurated(discovered, new Set(), { ...DEFAULT_OPTS, last: 2 });
    expect(items.map((i) => i.run_id)).toEqual(["r2", "r3"]);
  });
});

describe("scan_runs end-to-end", () => {
  it("honours --run by short-circuiting discovery", async () => {
    const run_path = await seed_run("webpack", "2026-04-16T18-10-16.855Z");
    const items = await scan_runs(
      { ...DEFAULT_OPTS, run: run_path },
      analysis_output_dir,
      runs_dir,
    );
    expect(items).toHaveLength(1);
    expect(items[0].run_id).toBe("2026-04-16T18-10-16.855Z");
    expect(items[0].project).toBe("webpack");
  });

  it("walks analysis_output and filters by sentinel presence", async () => {
    await seed_run("webpack", "r-a");
    await seed_run("projections", "r-b");
    await mark_curated("r-a");
    const items = await scan_runs(DEFAULT_OPTS, analysis_output_dir, runs_dir);
    expect(items.map((i) => i.run_id)).toEqual(["r-b"]);
  });
});

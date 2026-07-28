import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RunId } from "@ariadnejs/skill-protocol";

import {
  discover_runs,
  apply_scan_filters,
  scan_runs,
} from "./scan_runs.js";
import type { ScanOptions, ScanResultItem } from "../types.js";

let root: string;
let analysis_output_dir: string;

const DEFAULT_OPTS: ScanOptions = { project: null, last: null, run: null };

async function seed_run(project: string, run_id: string): Promise<string> {
  const tr_dir = path.join(analysis_output_dir, project, "triage_results");
  await fs.mkdir(tr_dir, { recursive: true });
  const run_path = path.join(tr_dir, `${run_id}.json`);
  await fs.writeFile(run_path, "{}", "utf8");
  return run_path;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "plan-scan-"));
  analysis_output_dir = path.join(root, "analysis_output");
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
    await seed_run("webpack", "abc1234-2026-04-16T18-10-16.855Z");
    await seed_run("projections", "abc1234-2026-03-26T21-04-31.070Z");
    await seed_run("projections", "abc1234-2026-03-28T14-41-05.888Z");

    const runs = await discover_runs(analysis_output_dir);
    expect(runs.map((r) => r.run_id)).toEqual([
      "abc1234-2026-03-26T21-04-31.070Z",
      "abc1234-2026-03-28T14-41-05.888Z",
      "abc1234-2026-04-16T18-10-16.855Z",
    ]);
    expect(runs.filter((r) => r.project === "projections")).toHaveLength(2);
  });

  it("orders by timestamp across commits, not by the leading commit prefix", async () => {
    // Newest run carries the lexically-smallest prefix, oldest the largest, so
    // any ordering that lets the prefix dominate reverses this list.
    await seed_run("webpack", "fff0000-2026-03-26T21-04-31.070Z");
    await seed_run("webpack", "nogit-2026-04-16T18-10-16.855Z");
    await seed_run("webpack", "0001111-2026-05-02T09-15-00.000Z");

    const runs = await discover_runs(analysis_output_dir);
    expect(runs.map((r) => r.run_id)).toEqual([
      "fff0000-2026-03-26T21-04-31.070Z",
      "nogit-2026-04-16T18-10-16.855Z",
      "0001111-2026-05-02T09-15-00.000Z",
    ]);
  });

  it("skips files whose name is not a well-formed run-id", async () => {
    await seed_run("webpack", "abc1234-2026-04-16T18-10-16.855Z");
    // Bare-timestamp file (no commit prefix) must be ignored, not crash the sweep.
    await seed_run("webpack", "2026-04-16T18-10-16.855Z");
    const runs = await discover_runs(analysis_output_dir);
    expect(runs.map((r) => r.run_id)).toEqual(["abc1234-2026-04-16T18-10-16.855Z"]);
  });

  it("ignores projects that have no triage_results directory", async () => {
    await seed_run("webpack", "abc1234-2026-04-16T18-10-16.855Z");
    const no_tr = path.join(analysis_output_dir, "no-triage-yet", "detect_entrypoints");
    await fs.mkdir(no_tr, { recursive: true });
    await fs.writeFile(path.join(no_tr, "something.json"), "{}", "utf8");
    const runs = await discover_runs(analysis_output_dir);
    expect(runs.map((r) => r.project)).toEqual(["webpack"]);
  });
});

describe("apply_scan_filters", () => {
  // Ordered as `discover_runs` returns them: oldest first, so `--last` slices
  // the tail. Prefixes descend as timestamps ascend, so a filter that reordered
  // on the raw id would be caught here too.
  const R1 = "fff0000-2026-03-26T21-04-31.070Z" as RunId;
  const R2 = "aaa1111-2026-03-28T14-41-05.888Z" as RunId;
  const R3 = "0002222-2026-04-16T18-10-16.855Z" as RunId;
  const discovered: ScanResultItem[] = [
    { run_id: R1, project: "p1", run_path: "/p1/r1.json" },
    { run_id: R2, project: "p1", run_path: "/p1/r2.json" },
    { run_id: R3, project: "p2", run_path: "/p2/r3.json" },
  ];

  it("returns every discovered run with no filters", () => {
    const items = apply_scan_filters(discovered, DEFAULT_OPTS);
    expect(items.map((i) => i.run_id)).toEqual([R1, R2, R3]);
  });

  it("honours --project filter", () => {
    const items = apply_scan_filters(discovered, { ...DEFAULT_OPTS, project: "p2" });
    expect(items.map((i) => i.run_id)).toEqual([R3]);
  });

  it("honours --last N filter (keeps most recent)", () => {
    const items = apply_scan_filters(discovered, { ...DEFAULT_OPTS, last: 2 });
    expect(items.map((i) => i.run_id)).toEqual([R2, R3]);
  });
});

describe("scan_runs end-to-end", () => {
  it("honours --run by short-circuiting discovery", async () => {
    const run_path = await seed_run("webpack", "abc1234-2026-04-16T18-10-16.855Z");
    const items = await scan_runs(
      { ...DEFAULT_OPTS, run: run_path },
      analysis_output_dir,
    );
    expect(items).toHaveLength(1);
    expect(items[0].run_id).toBe("abc1234-2026-04-16T18-10-16.855Z");
    expect(items[0].project).toBe("webpack");
  });

  it("walks analysis_output and returns every discovered run", async () => {
    await seed_run("webpack", "aaaaaaa-2026-04-16T18-10-16.855Z");
    await seed_run("projections", "bbbbbbb-2026-04-16T18-10-16.855Z");
    const items = await scan_runs(DEFAULT_OPTS, analysis_output_dir);
    expect(items.map((i) => i.run_id)).toEqual([
      "aaaaaaa-2026-04-16T18-10-16.855Z",
      "bbbbbbb-2026-04-16T18-10-16.855Z",
    ]);
  });
});

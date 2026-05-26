import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  is_curated,
  mark_finalize_started,
  save_outcome,
} from "./curation_outcome.js";
import type { CuratedRunEntry } from "../types.js";

let runs_dir: string;

function fake_outcome(run_id: string): CuratedRunEntry {
  return {
    run_id,
    project: "test-project",
    run_path: `/fake/${run_id}.json`,
    curated_at: "2026-05-26T00:00:00.000Z",
    outcome: {
      investigated_groups: 0,
      classifiers_proposed: 0,
      signal_library_gap_tasks: [],
      ariadne_bug_tasks: [],
      success_count: 0,
      failure_count: 0,
      blocked_count: 0,
      failed_groups: [],
    },
  };
}

beforeEach(async () => {
  runs_dir = await fs.mkdtemp(path.join(os.tmpdir(), "curator-outcome-"));
});

afterEach(async () => {
  await fs.rm(runs_dir, { recursive: true, force: true });
});

describe("is_curated", () => {
  it("returns false when neither sentinel exists", async () => {
    expect(await is_curated("run-1", runs_dir)).toBe(false);
  });

  it("returns true when only the completed sentinel exists", async () => {
    await save_outcome(fake_outcome("run-1"), runs_dir);
    expect(await is_curated("run-1", runs_dir)).toBe(true);
  });

  it("returns true when only the in-progress marker exists", async () => {
    await mark_finalize_started("run-1", "/fake/run-1.json", runs_dir);
    expect(await is_curated("run-1", runs_dir)).toBe(true);
  });
});

describe("save_outcome", () => {
  it("writes the sentinel atomically (only finalized.json remains)", async () => {
    await save_outcome(fake_outcome("run-1"), runs_dir);
    const dir = path.join(runs_dir, "run-1");
    const entries = await fs.readdir(dir);
    expect(entries).toEqual(["finalized.json"]);
    const raw = await fs.readFile(path.join(dir, "finalized.json"), "utf8");
    const parsed = JSON.parse(raw) as CuratedRunEntry;
    expect(parsed.run_id).toBe("run-1");
  });

  it("clears the in-progress marker once the final sentinel lands", async () => {
    await mark_finalize_started("run-1", "/fake/run-1.json", runs_dir);
    const dir = path.join(runs_dir, "run-1");
    expect(await fs.readdir(dir)).toEqual(["finalize_started.json"]);

    await save_outcome(fake_outcome("run-1"), runs_dir);
    expect(await fs.readdir(dir)).toEqual(["finalized.json"]);
  });
});

describe("mark_finalize_started — replay-safety contract", () => {
  it("is_curated short-circuits a re-entry even when the run has not completed", async () => {
    // Simulates the crash-replay path: a previous finalize_run marked the run
    // as started but never reached save_outcome. The next finalize_run MUST
    // see is_curated=true and refuse to re-enter apply_proposals — otherwise
    // observed_count would double-bump.
    await mark_finalize_started("run-1", "/fake/run-1.json", runs_dir);
    expect(await is_curated("run-1", runs_dir)).toBe(true);

    const marker = JSON.parse(
      await fs.readFile(
        path.join(runs_dir, "run-1", "finalize_started.json"),
        "utf8",
      ),
    ) as { run_id: string; run_path: string; started_at: string };
    expect(marker.run_id).toBe("run-1");
    expect(marker.run_path).toBe("/fake/run-1.json");
    expect(typeof marker.started_at).toBe("string");
    expect(marker.started_at.length).toBeGreaterThan(0);
  });

  it("re-running mark_finalize_started overwrites the marker (atomic write)", async () => {
    await mark_finalize_started("run-1", "/fake/run-1.json", runs_dir);
    const before = JSON.parse(
      await fs.readFile(
        path.join(runs_dir, "run-1", "finalize_started.json"),
        "utf8",
      ),
    ) as { started_at: string };

    await new Promise((r) => setTimeout(r, 5));
    await mark_finalize_started("run-1", "/fake/run-1.json", runs_dir);
    const after = JSON.parse(
      await fs.readFile(
        path.join(runs_dir, "run-1", "finalize_started.json"),
        "utf8",
      ),
    ) as { started_at: string };
    expect(after.started_at).not.toBe(before.started_at);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fsSync from "fs";
import path from "path";

import type { RunManifest } from "../triage_state_types.js";
import {
  find_active_runs,
  list_runs,
  read_manifest,
  read_manifest_safe,
} from "./run_discovery.js";

// vi.hoisted runs before all `import` statements, so the env var is set
// before `paths.js` (transitively imported by `run_discovery.js`) reads it.
const TMP = vi.hoisted(() => {
  const tmp_path = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-run-discovery-${process.pid}`;
  process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE = tmp_path;
  return tmp_path;
});

const TRIAGE_STATE = path.join(TMP, "triage_state");

beforeEach(() => {
  fsSync.rmSync(TMP, { recursive: true, force: true });
  fsSync.mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  fsSync.rmSync(TMP, { recursive: true, force: true });
});

function seed_manifest(project: string, run_id: string, overrides: Partial<RunManifest> = {}): void {
  const dir = path.join(TRIAGE_STATE, project, "runs", run_id);
  fsSync.mkdirSync(dir, { recursive: true });
  const manifest: RunManifest = {
    schema_version: 1,
    run_id,
    project_name: project,
    project_path: "/some/path",
    created_at: "2026-04-28T13:42:07.812Z",
    finalized_at: null,
    status: "active",
    source_analysis_path: "",
    source_analysis_run_id: "",
    max_count: 150,
    commit_hash: "abc",
    tp_cache: {
      enabled: true,
      source_run_id: null,
      skipped_count: 0,
      skipped_entry_keys: [],
      stability: null,
    },
    ...overrides,
  };
  fsSync.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
}

describe("read_manifest / read_manifest_safe", () => {
  it("read_manifest returns the parsed manifest", async () => {
    seed_manifest("p", "abc-1");
    const m = await read_manifest("p", "abc-1");
    expect(m.run_id).toBe("abc-1");
  });

  it("read_manifest_safe returns null when manifest is missing", async () => {
    expect(await read_manifest_safe("p", "missing")).toBeNull();
  });

  it("read_manifest throws on schema_version mismatch", async () => {
    seed_manifest("p", "future", { schema_version: 999 });
    await expect(read_manifest("p", "future")).rejects.toThrow(/schema_version 999/);
  });
});

describe("list_runs", () => {
  it("returns empty when project has no runs/ dir", async () => {
    expect(await list_runs("nope")).toEqual([]);
  });

  it("enumerates runs sorted by run-id", async () => {
    seed_manifest("p", "deadbee-2026-04-26T00-00-00.000Z");
    seed_manifest("p", "deadbee-2026-04-28T00-00-00.000Z");
    seed_manifest("p", "feedf00-2026-04-27T00-00-00.000Z");

    const runs = await list_runs("p");
    expect(runs.map((r) => r.run_id)).toEqual([
      "deadbee-2026-04-26T00-00-00.000Z",
      "deadbee-2026-04-28T00-00-00.000Z",
      "feedf00-2026-04-27T00-00-00.000Z",
    ]);
    for (const r of runs) {
      expect(r.manifest).not.toBeNull();
    }
  });

  it("includes runs whose manifest is unreadable with manifest=null", async () => {
    const dir = path.join(TRIAGE_STATE, "p", "runs", "broken-run");
    fsSync.mkdirSync(dir, { recursive: true });
    // No manifest.json file
    const runs = await list_runs("p");
    expect(runs).toHaveLength(1);
    expect(runs[0].manifest).toBeNull();
  });
});

describe("find_active_runs", () => {
  it("returns empty when the project has no runs at all", async () => {
    expect(await find_active_runs("nope")).toEqual([]);
  });

  function seed_state(project: string, run_id: string): void {
    fsSync.writeFileSync(
      path.join(TRIAGE_STATE, project, "runs", run_id, "triage.json"),
      "{}",
    );
  }

  it("returns every active run with the commit it was prepared at", async () => {
    seed_manifest("p", "run-early", { commit_hash: "aaaaaaabbbbbb" });
    seed_state("p", "run-early");
    seed_manifest("p", "run-late", { commit_hash: "cccccccdddddd" });
    seed_state("p", "run-late");

    expect(await find_active_runs("p")).toEqual([
      { run_id: "run-early", short_commit: "aaaaaaa", resumable: true },
      { run_id: "run-late", short_commit: "ccccccc", resumable: true },
    ]);
  });

  it("marks a run interrupted before its state write as not resumable", async () => {
    seed_manifest("p", "run-torn", { commit_hash: "aaaaaaabbbbbb" });

    expect(await find_active_runs("p")).toEqual([
      { run_id: "run-torn", short_commit: "aaaaaaa", resumable: false },
    ]);
  });

  it("reports a null commit for a non-git target", async () => {
    seed_manifest("p", "nogit-run", { commit_hash: null });
    seed_state("p", "nogit-run");

    expect(await find_active_runs("p")).toEqual([
      { run_id: "nogit-run", short_commit: null, resumable: true },
    ]);
  });

  it("excludes finalized and abandoned runs", async () => {
    seed_manifest("p", "run-finalized", { status: "finalized" });
    seed_manifest("p", "run-abandoned", { status: "abandoned" });
    seed_manifest("p", "run-live", { commit_hash: "eeeeeeeffffff" });
    seed_state("p", "run-live");

    expect(await find_active_runs("p")).toEqual([
      { run_id: "run-live", short_commit: "eeeeeee", resumable: true },
    ]);
  });

  it("excludes a run whose manifest is unreadable", async () => {
    fsSync.mkdirSync(path.join(TRIAGE_STATE, "p", "runs", "broken-run"), { recursive: true });

    expect(await find_active_runs("p")).toEqual([]);
  });
});

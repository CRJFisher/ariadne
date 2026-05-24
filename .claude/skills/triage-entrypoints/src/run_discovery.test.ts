import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fsSync from "fs";
import path from "path";

import type { RunManifest } from "./triage_state_types.js";
import { list_runs, read_manifest, read_manifest_safe } from "./run_discovery.js";

// vi.hoisted runs before all `import` statements, so the env var is set
// before `paths.js` (transitively imported by `run_discovery.js`) reads it.
const TMP = vi.hoisted(() => {
  const tmp_path = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-run-discovery-${process.pid}`;
  process.env.ARIADNE_SELF_REPAIR_DIR_OVERRIDE = tmp_path;
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

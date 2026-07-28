import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import * as fsSync from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { active_run_conflict_message } from "./prepare_triage.js";
import type { RunManifest } from "../src/triage_state_types.js";

describe("active_run_conflict_message", () => {
  it("returns null when the project has no active run", () => {
    expect(active_run_conflict_message("tokio", [])).toBeNull();
  });

  it("names the run, its commit, and a runnable command for each remedy", () => {
    const message = active_run_conflict_message("tokio", [
      { run_id: "deadbee-2026-07-28T10-00-00.000Z", short_commit: "deadbee", resumable: true },
    ]);

    expect(message).toContain("project \"tokio\" already has an active run");
    expect(message).toContain("deadbee-2026-07-28T10-00-00.000Z (prepared at commit deadbee)");
    expect(message).toContain(
      "node --import tsx .claude/skills/triage/scripts/get_next_triage_entry.ts " +
        "--project tokio --run-id deadbee-2026-07-28T10-00-00.000Z --count 5",
    );
    expect(message).toContain(
      "node --import tsx .claude/skills/triage/scripts/abandon_run.ts " +
        "--project tokio --run-id deadbee-2026-07-28T10-00-00.000Z",
    );
  });

  it("gives every active run both remedies rather than picking one", () => {
    const message = active_run_conflict_message("tokio", [
      { run_id: "run-a", short_commit: "aaaaaaa", resumable: true },
      { run_id: "run-b", short_commit: "bbbbbbb", resumable: true },
    ]);

    expect(message).toContain("2 active runs");
    for (const run_id of ["run-a", "run-b"]) {
      expect(message).toContain(`get_next_triage_entry.ts --project tokio --run-id ${run_id}`);
      expect(message).toContain(`abandon_run.ts --project tokio --run-id ${run_id}`);
    }
  });

  it("reports an unknown commit for a non-git target rather than omitting it", () => {
    const message = active_run_conflict_message("local", [
      { run_id: "nogit-run", short_commit: null, resumable: true },
    ]);

    expect(message).toContain("nogit-run (prepared at commit unknown)");
  });

  it("offers only abandon for a run interrupted before its state was written", () => {
    const message = active_run_conflict_message("tokio", [
      { run_id: "run-torn", short_commit: "deadbee", resumable: false },
    ]);

    expect(message).toContain("interrupted before its state was written — abandon only");
    expect(message).toContain("Discard the run and start fresh:");
    expect(message).toContain("abandon_run.ts --project tokio --run-id run-torn");
    // Phase 3 resolves through require_run, which demands triage.json, so
    // pointing at it here would be a dead end.
    expect(message).not.toContain("get_next_triage_entry.ts");
  });

  it("offers continuation only for the resumable run when both kinds are live", () => {
    const message = active_run_conflict_message("tokio", [
      { run_id: "run-good", short_commit: "aaaaaaa", resumable: true },
      { run_id: "run-torn", short_commit: "bbbbbbb", resumable: false },
    ]);

    expect(message).toContain("get_next_triage_entry.ts --project tokio --run-id run-good");
    expect(message).not.toContain("get_next_triage_entry.ts --project tokio --run-id run-torn");
    expect(message).toContain("abandon_run.ts --project tokio --run-id run-good");
    expect(message).toContain("abandon_run.ts --project tokio --run-id run-torn");
  });

  it("points at distinct project names rather than a force flag", () => {
    const message = active_run_conflict_message("tokio", [
      { run_id: "run-a", short_commit: "aaaaaaa", resumable: true },
    ]);

    expect(message).toContain("distinct --project names");
    expect(message).not.toContain("--force");
  });
});

/**
 * Drives the real CLI so the guard's wiring is covered, not just its message,
 * and so the recovery loop the refusal prescribes is proven to actually work.
 */
describe("prepare_triage CLI active-run guard", () => {
  const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
  const TMP = path.join(
    process.env.TMPDIR ?? "/tmp",
    `ariadne-test-prepare-guard-${process.pid}`,
  );
  const ANALYSIS_PATH = path.join(TMP, "analysis.json");

  beforeEach(() => {
    fsSync.rmSync(TMP, { recursive: true, force: true });
    fsSync.mkdirSync(TMP, { recursive: true });
    fsSync.writeFileSync(
      ANALYSIS_PATH,
      JSON.stringify({
        project_name: "guarded",
        project_path: path.join(TMP, "no-such-repo"),
        entry_points: [],
      }),
    );
  });

  afterEach(() => {
    fsSync.rmSync(TMP, { recursive: true, force: true });
  });

  /**
   * Writes only `manifest.json` — the shape `prepare_triage` leaves behind when
   * it is interrupted between its manifest write and its state write.
   */
  function seed_manifest(run_id: string, status: RunManifest["status"]): void {
    const dir = path.join(TMP, "triage_state", "guarded", "runs", run_id);
    fsSync.mkdirSync(dir, { recursive: true });
    const manifest: RunManifest = {
      schema_version: 1,
      run_id,
      project_name: "guarded",
      project_path: "/some/path",
      created_at: "2026-07-28T10:00:00.000Z",
      finalized_at: null,
      status,
      source_analysis_path: "",
      source_analysis_run_id: "",
      max_count: 250,
      commit_hash: "deadbeefcafe",
      tp_cache: {
        enabled: true,
        source_run_id: null,
        skipped_count: 0,
        skipped_entry_keys: [],
        stability: null,
      },
    };
    fsSync.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
  }

  function run_script(script: string, args: string[]): { status: number; stderr: string } {
    try {
      execFileSync(process.execPath, ["--import", "tsx", path.join(SCRIPTS, script), ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE: TMP },
      });
      return { status: 0, stderr: "" };
    } catch (error) {
      const failure = error as { status: number; stderr: string };
      return { status: failure.status, stderr: failure.stderr };
    }
  }

  const prepare = (): { status: number; stderr: string } =>
    run_script("prepare_triage.ts", ["--analysis", ANALYSIS_PATH, "--project", "guarded"]);

  it("refuses with exit 1 and names the live run before doing any indexing work", () => {
    seed_manifest("deadbee-2026-07-28T10-00-00.000Z", "active");

    const { status, stderr } = prepare();

    expect(status).toEqual(1);
    expect(stderr).toContain("project \"guarded\" already has an active run");
    // The fixture writes only a manifest, so the run reports as abandon-only.
    expect(stderr).toContain(
      "deadbee-2026-07-28T10-00-00.000Z (prepared at commit deadbee; " +
        "interrupted before its state was written — abandon only)",
    );
    expect(stderr).toContain("abandon_run.ts --project guarded");
  });

  it("proceeds past the guard when the project's only run is finalized", () => {
    seed_manifest("deadbee-2026-07-28T10-00-00.000Z", "finalized");

    const { status, stderr } = prepare();

    expect(stderr).not.toContain("already has an active run");
    // The run is not refused, so it reaches the re-index and fails on the
    // deliberately absent project_path instead.
    expect(status).toEqual(1);
  });

  it("clears a run that owns a manifest but no state file, unblocking the project", () => {
    const run_id = "deadbee-2026-07-28T10-00-00.000Z";
    seed_manifest(run_id, "active");
    expect(prepare().stderr).toContain("already has an active run");

    const abandoned = run_script("abandon_run.ts", [
      "--project",
      "guarded",
      "--run-id",
      run_id,
    ]);

    expect(abandoned.status).toEqual(0);
    expect(prepare().stderr).not.toContain("already has an active run");
  });
});

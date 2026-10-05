/**
 * Fixture tests for the triage_results lint lens. It delegates the envelope
 * contract entirely to `parse_triage_results`, so these tests confirm the lens
 * surfaces exactly what that parser rejects — a stale schema_version, a missing
 * required array, non-JSON — and passes a well-formed v5 envelope.
 */

import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { check_triage_results } from "./check_triage_results.js";

const valid_envelope = JSON.stringify({
  schema_version: 5,
  project_path: "/tmp/project",
  commit_hash: null,
  novel_issues: [],
  classifier_regressions: [],
  confirmed_unreachable: [],
  uncertain: [],
  last_updated: "2026-07-09T00:00:00Z",
});

const SWEEP_TMP = vi.hoisted(() => {
  const tmp_path = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-check-triage-results-${process.pid}`;
  process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE = tmp_path;
  return tmp_path;
});

function seed_run(project: string, run_id: string, contents: string): void {
  const dir = path.join(SWEEP_TMP, "analysis_output", project, "triage_results");
  fsSync.mkdirSync(dir, { recursive: true });
  fsSync.writeFileSync(path.join(dir, `${run_id}.json`), contents);
}

describe("check_triage_results", () => {
  let tmp_dir: string;
  let file_path: string;

  beforeEach(async () => {
    tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "check-triage-results-"));
    file_path = path.join(tmp_dir, "run.json");
  });

  afterEach(async () => {
    await fs.rm(tmp_dir, { recursive: true, force: true });
  });

  it("passes a well-formed v5 envelope", async () => {
    await fs.writeFile(file_path, valid_envelope);
    expect(await check_triage_results({ file_path, project: null, run_id: null })).toEqual({
      ok: true,
      checked: 1,
      issues: [],
    });
  });

  it("fails a stale schema_version", async () => {
    await fs.writeFile(file_path, valid_envelope.replace("\"schema_version\":5", "\"schema_version\":4"));
    const result = await check_triage_results({ file_path, project: null, run_id: null });
    expect(result.ok).toEqual(false);
    expect(result.checked).toEqual(1);
    expect(result.issues.length).toEqual(1);
    expect(result.issues[0].file).toEqual(file_path);
    expect(result.issues[0].error).toContain("schema_version=4 does not match current v5");
  });

  it("fails a missing required array", async () => {
    const missing = JSON.stringify({
      schema_version: 5,
      project_path: "/tmp/project",
      commit_hash: null,
      novel_issues: [],
      classifier_regressions: [],
      confirmed_unreachable: [],
      last_updated: "2026-07-09T00:00:00Z",
    });
    await fs.writeFile(file_path, missing);
    const result = await check_triage_results({ file_path, project: null, run_id: null });
    expect(result.ok).toEqual(false);
    expect(result.issues[0].error).toContain("'uncertain' must be an array");
  });

  it("fails non-JSON content", async () => {
    await fs.writeFile(file_path, "not json at all");
    const result = await check_triage_results({ file_path, project: null, run_id: null });
    expect(result.ok).toEqual(false);
    expect(result.issues[0].error).toContain("invalid JSON");
  });
});

describe("check_triage_results --project sweep", () => {
  beforeEach(() => {
    fsSync.rmSync(SWEEP_TMP, { recursive: true, force: true });
    fsSync.mkdirSync(SWEEP_TMP, { recursive: true });
  });

  afterEach(() => {
    fsSync.rmSync(SWEEP_TMP, { recursive: true, force: true });
  });

  it("sweeps every finalized run and surfaces only the malformed one", async () => {
    seed_run("proj", "aaa1111-2026-07-01T00-00-00.000Z", valid_envelope);
    seed_run("proj", "bbb2222-2026-07-02T00-00-00.000Z", valid_envelope.replace("\"schema_version\":5", "\"schema_version\":4"));
    const result = await check_triage_results({ file_path: null, project: "proj", run_id: null });
    expect(result.ok).toEqual(false);
    expect(result.checked).toEqual(2);
    expect(result.issues.length).toEqual(1);
    expect(result.issues[0].error).toContain("schema_version=4 does not match current v5");
  });

  it("passes when every finalized run is valid", async () => {
    seed_run("proj", "aaa1111-2026-07-01T00-00-00.000Z", valid_envelope);
    seed_run("proj", "bbb2222-2026-07-02T00-00-00.000Z", valid_envelope);
    expect(await check_triage_results({ file_path: null, project: "proj", run_id: null })).toEqual({
      ok: true,
      checked: 2,
      issues: [],
    });
  });

  it("fails a project whose results directory is missing (a likely typo)", async () => {
    const result = await check_triage_results({ file_path: null, project: "nonexistent", run_id: null });
    expect(result.ok).toEqual(false);
    expect(result.checked).toEqual(0);
    expect(result.issues.length).toEqual(1);
    expect(result.issues[0].error).toContain("no triage_results directory for project \"nonexistent\"");
  });

  it("passes an existing results directory that holds no runs yet", async () => {
    fsSync.mkdirSync(path.join(SWEEP_TMP, "analysis_output", "unpublished", "triage_results"), {
      recursive: true,
    });
    expect(await check_triage_results({ file_path: null, project: "unpublished", run_id: null })).toEqual({
      ok: true,
      checked: 0,
      issues: [],
    });
  });
});

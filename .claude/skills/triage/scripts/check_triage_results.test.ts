/**
 * Fixture tests for the triage_results lint lens. It delegates the envelope
 * contract entirely to `parse_triage_results`, so these tests confirm the lens
 * surfaces exactly what that parser rejects — a stale schema_version, a missing
 * required array, non-JSON — and passes a well-formed v5 envelope.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

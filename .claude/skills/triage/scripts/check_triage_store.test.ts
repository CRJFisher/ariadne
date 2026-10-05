/**
 * The lens answers one question — did every triage job finish and publish — and
 * it answers it from the run manifest rather than from the 280 MB state file.
 * These cases pin that shortcut: a finalized-and-published run is reported clean
 * without its state being read, and every way a run can fall short of that is
 * still named.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { check_triage_store } from "./check_triage_store.js";
import {
  manifest_file,
  run_dir,
  state_file,
  triage_results_root,
} from "../src/store/store_layout.js";

const RUN_ID = "468572e-2026-08-23T23-01-31.642Z";
const CORPUS = "/Users/chuck/.ariadne/triage-entrypoints/repos/owner--repo";

describe("check_triage_store", () => {
  let store_dir: string;

  beforeEach(() => {
    store_dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-triage-store-"));
  });

  afterEach(() => {
    fs.rmSync(store_dir, { recursive: true, force: true });
  });

  function seed_manifest(project: string, status: string, corpus = CORPUS): void {
    fs.mkdirSync(run_dir(store_dir, project, RUN_ID), { recursive: true });
    fs.writeFileSync(
      manifest_file(store_dir, project, RUN_ID),
      JSON.stringify({ run_id: RUN_ID, project_name: project, project_path: corpus, status }),
    );
  }

  function seed_state(project: string, phase: string, statuses: readonly string[]): void {
    fs.mkdirSync(run_dir(store_dir, project, RUN_ID), { recursive: true });
    fs.writeFileSync(
      state_file(store_dir, project, RUN_ID),
      JSON.stringify({
        project_name: project,
        project_path: CORPUS,
        phase,
        entries: statuses.map((status, entry_index) => ({ entry_index, status })),
      }),
    );
  }

  function seed_results(project: string): void {
    const dir = triage_results_root(store_dir, project);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${RUN_ID}.json`),
      JSON.stringify({ schema_version: 5, project_path: CORPUS }),
    );
  }

  function problems_for(project: string, deep = false): string[] {
    const health = check_triage_store({ store_dir, deep });
    const found = health.projects.find((p) => p.project_id === project);
    return [...(found?.problems ?? []), ...(found?.runs.flatMap((r) => r.problems) ?? [])];
  }

  it("reports a finished, published run as clean without reading its state", () => {
    seed_manifest("owner--repo", "finalized");
    seed_results("owner--repo");

    const health = check_triage_store({ store_dir, deep: false });

    expect(health.ok).toEqual(true);
    expect(health.projects[0].runs[0].problems).toEqual([]);
    expect(health.projects[0].runs[0].tallies).toEqual(null);
  });

  it("reads the state and tallies entries under --deep", () => {
    seed_manifest("owner--repo", "finalized");
    seed_state("owner--repo", "complete", ["completed", "completed"]);
    seed_results("owner--repo");

    const health = check_triage_store({ store_dir, deep: true });

    expect(health.ok).toEqual(true);
    expect(health.projects[0].runs[0].tallies).toEqual({
      total: 2,
      completed: 2,
      pending: 0,
      failed: 0,
    });
  });

  it("names a finalized run whose published envelope is missing", () => {
    seed_manifest("owner--repo", "finalized");
    seed_state("owner--repo", "complete", ["completed"]);

    expect(problems_for("owner--repo")).toEqual(["results-missing"]);
  });

  it("names a run still held open, with its unfinished entries", () => {
    seed_manifest("owner--repo", "active");
    seed_state("owner--repo", "triage", ["completed", "pending", "pending", "failed"]);

    expect(problems_for("owner--repo")).toEqual([
      "run-still-active",
      "phase-triage",
      "entries-pending-2",
      "entries-failed-1",
      "results-missing",
    ]);
  });

  it("names a run directory left with nothing in it", () => {
    fs.mkdirSync(path.join(run_dir(store_dir, "stub", RUN_ID), "results"), { recursive: true });

    expect(problems_for("stub")).toEqual([
      "unresolved-project-id",
      "missing-manifest",
      "missing-state",
      "results-missing",
    ]);
  });

  it("names a project filed under a legacy id and the id it should carry", () => {
    seed_manifest("repo", "finalized");
    seed_results("repo");

    const health = check_triage_store({ store_dir, deep: false });

    expect(health.ok).toEqual(false);
    expect(health.projects[0].problems).toEqual(["legacy-project-id"]);
    expect(health.projects[0].identity.canonical_project_id).toEqual("owner--repo");
  });

  it("names a project whose published output has no run state behind it", () => {
    seed_results("owner--repo");

    const health = check_triage_store({ store_dir, deep: false });

    expect(health.projects.map((p) => p.project_id)).toEqual(["owner--repo"]);
    expect(health.projects[0].problems).toEqual(["no-runs"]);
  });

  it("reports an empty store as clean", () => {
    expect(check_triage_store({ store_dir, deep: false })).toEqual({
      store_dir,
      projects: [],
      ok: true,
    });
  });
});

/**
 * The manifest decides what travels, so these cases pin the two ways a bundle
 * can be wrong: it carries a project it should not, or it silently drops one it
 * should. Selection is by canonical id against the real target register, which
 * is what lets a project still filed under a legacy id be picked up by the
 * cohort it actually belongs to.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  build_transfer_manifest,
  resolve_payload_paths,
  restrict_health_to_selection,
  select_projects,
} from "./build_transfer_manifest.js";
import { check_triage_store } from "./check_triage_store.js";
import { manifest_file, run_dir, triage_results_root } from "../src/store/store_layout.js";

const RUN_ID = "468572e-2026-08-23T23-01-31.642Z";
const REPOS = "/Users/chuck/.ariadne/triage-entrypoints/repos";

/** A cohort-2 target, a cohort-1 target, and a cohort-2 target stored under a legacy id. */
const COHORT_2 = "puppeteer--puppeteer";
const COHORT_1 = "webpack--webpack";
const LEGACY_COHORT_2 = "-Users-chuck-.ariadne-triage-entrypoints-repos-nodejs--node";

describe("build_transfer_manifest", () => {
  let ariadne_dir: string;
  let store_dir: string;

  beforeEach(() => {
    ariadne_dir = fs.mkdtempSync(path.join(os.tmpdir(), "transfer-manifest-"));
    store_dir = path.join(ariadne_dir, "triage-entrypoints");
  });

  afterEach(() => {
    fs.rmSync(ariadne_dir, { recursive: true, force: true });
  });

  /** Seed one finished run, stored under `project` but describing `corpus`. */
  function seed_run(project: string, corpus: string = project): void {
    const project_path = `${REPOS}/${corpus}`;
    fs.mkdirSync(run_dir(store_dir, project, RUN_ID), { recursive: true });
    fs.writeFileSync(
      manifest_file(store_dir, project, RUN_ID),
      JSON.stringify({ run_id: RUN_ID, project_name: project, project_path, status: "finalized" }),
    );
    const results = triage_results_root(store_dir, project);
    fs.mkdirSync(results, { recursive: true });
    fs.writeFileSync(
      path.join(results, `${RUN_ID}.json`),
      JSON.stringify({ schema_version: 5, project_path }),
    );
  }

  function seed_config(name: string, corpus: string): void {
    const dir = path.join(store_dir, "project_configs");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${name}.json`),
      JSON.stringify({ project_path: `${REPOS}/${corpus}` }),
    );
  }

  function manifest_for(cohorts: Set<number> | null) {
    const selections = select_projects(store_dir, cohorts);
    const health = restrict_health_to_selection(
      check_triage_store({ store_dir, deep: false }),
      selections,
    );
    return build_transfer_manifest(ariadne_dir, health, selections, cohorts);
  }

  describe("selection by cohort", () => {
    it("carries a cohort-2 project and leaves a cohort-1 project behind", () => {
      seed_run(COHORT_2);
      seed_run(COHORT_1);

      // Sorted by store directory name: "puppeteer--puppeteer" before "webpack--webpack".
      expect(select_projects(store_dir, new Set([2]))).toEqual([
        {
          store_project_id: COHORT_2,
          canonical_project_id: COHORT_2,
          cohort: 2,
          included: true,
        },
        {
          store_project_id: COHORT_1,
          canonical_project_id: COHORT_1,
          cohort: 1,
          included: false,
        },
      ]);
    });

    it("carries a cohort-2 project still filed under a legacy id", () => {
      seed_run(LEGACY_COHORT_2, "nodejs--node");

      expect(select_projects(store_dir, new Set([2]))).toEqual([
        {
          store_project_id: LEGACY_COHORT_2,
          canonical_project_id: "nodejs--node",
          cohort: 2,
          included: true,
        },
      ]);
    });

    it("leaves behind a project whose canonical id cannot be recovered", () => {
      fs.mkdirSync(path.join(run_dir(store_dir, "stub", RUN_ID), "results"), { recursive: true });

      expect(select_projects(store_dir, new Set([2]))).toEqual([
        { store_project_id: "stub", canonical_project_id: null, cohort: null, included: false },
      ]);
    });

    it("carries every project when no cohort filter is set", () => {
      seed_run(COHORT_1);
      fs.mkdirSync(path.join(run_dir(store_dir, "stub", RUN_ID), "results"), { recursive: true });

      expect(select_projects(store_dir, null).map((s) => s.included)).toEqual([true, true]);
    });
  });

  describe("payload resolution", () => {
    it("names one state and one output directory per carried project", () => {
      seed_run(COHORT_2);
      seed_run(COHORT_1);

      expect(resolve_payload_paths(ariadne_dir, new Set([2]))).toEqual([
        path.join("triage-entrypoints", "analysis_output", COHORT_2),
        path.join("triage-entrypoints", "triage_state", COHORT_2),
      ]);
    });

    it("names the whole trees when no cohort filter is set", () => {
      seed_run(COHORT_2);
      seed_run(COHORT_1);

      expect(resolve_payload_paths(ariadne_dir, null)).toEqual([
        path.join("triage-entrypoints", "analysis_output"),
        path.join("triage-entrypoints", "triage_state"),
      ]);
    });

    it("selects a config by the corpus it names, not by its own filename", () => {
      seed_config("pytorch", "pytorch--pytorch");
      seed_config("microsoft--vscode", "microsoft--vscode");

      expect(resolve_payload_paths(ariadne_dir, new Set([2]))).toEqual([
        path.join("triage-entrypoints", "project_configs", "microsoft--vscode.json"),
      ]);
    });

    it("carries a config for a cohort-2 target that has never been run", () => {
      seed_run(COHORT_2);
      seed_config("microsoft--vscode", "microsoft--vscode");

      expect(resolve_payload_paths(ariadne_dir, new Set([2]))).toContain(
        path.join("triage-entrypoints", "project_configs", "microsoft--vscode.json"),
      );
    });

    it("picks up a perf investigation by its date-stamped name", () => {
      fs.mkdirSync(path.join(ariadne_dir, "perf-investigation-2026-08-23", "probe"), {
        recursive: true,
      });

      expect(resolve_payload_paths(ariadne_dir, new Set([2]))).toEqual([
        "perf-investigation-2026-08-23",
      ]);
    });

    it("never names the clones, the cache, the plan store, or scratch space", () => {
      seed_run(COHORT_2);
      fs.mkdirSync(path.join(store_dir, "repos", COHORT_2), { recursive: true });
      fs.mkdirSync(path.join(ariadne_dir, "cache", "puppeteer-abc12345"), { recursive: true });
      fs.mkdirSync(path.join(ariadne_dir, "plan", "tasks"), { recursive: true });
      fs.mkdirSync(path.join(ariadne_dir, "skill-analysis"), { recursive: true });
      fs.mkdirSync(path.join(ariadne_dir, "tmp"), { recursive: true });

      const selected = resolve_payload_paths(ariadne_dir, new Set([2]));

      expect(selected).toEqual([
        path.join("triage-entrypoints", "analysis_output", COHORT_2),
        path.join("triage-entrypoints", "triage_state", COHORT_2),
      ]);
    });
  });

  describe("health narrowed to the bundle", () => {
    it("drops a project the bundle does not carry, and its problems with it", () => {
      seed_run(COHORT_2);
      fs.mkdirSync(path.join(run_dir(store_dir, "stub", RUN_ID), "results"), { recursive: true });

      const selections = select_projects(store_dir, new Set([2]));
      const narrowed = restrict_health_to_selection(
        check_triage_store({ store_dir, deep: false }),
        selections,
      );

      expect(narrowed.projects.map((p) => p.project_id)).toEqual([COHORT_2]);
      expect(narrowed.ok).toEqual(true);
    });
  });

  describe("manifest contents", () => {
    it("records the cohorts carried and both sides of the selection", () => {
      seed_run(COHORT_2);
      seed_run(COHORT_1);

      const manifest = manifest_for(new Set([2]));

      expect(manifest.selection.cohorts).toEqual([2]);
      expect(manifest.selection.included.map((s) => s.store_project_id)).toEqual([COHORT_2]);
      expect(manifest.selection.omitted.map((s) => s.store_project_id)).toEqual([COHORT_1]);
    });

    it("names every run the bundle claims and nothing it omits", () => {
      seed_run(COHORT_2);
      seed_run(COHORT_1);

      expect(manifest_for(new Set([2])).store.inventory).toEqual([
        {
          project_id: COHORT_2,
          canonical_project_id: COHORT_2,
          run_ids: [RUN_ID],
        },
      ]);
    });

    it("counts only carried projects toward the legacy-id total", () => {
      seed_run(LEGACY_COHORT_2, "nodejs--node");
      seed_run("webpack", COHORT_1);

      const manifest = manifest_for(new Set([2]));

      expect(manifest.store.legacy_project_ids).toEqual(1);
      expect(manifest.store.projects).toEqual(1);
    });

    it("records the excluded trees with the reason they were left behind", () => {
      seed_run(COHORT_2);
      fs.mkdirSync(path.join(store_dir, "repos"), { recursive: true });
      fs.mkdirSync(path.join(ariadne_dir, "cache"), { recursive: true });
      fs.mkdirSync(path.join(ariadne_dir, "plan"), { recursive: true });

      expect(manifest_for(new Set([2])).excluded.map((tree) => tree.path)).toEqual([
        path.join("triage-entrypoints", "repos"),
        "cache",
        "plan",
      ]);
    });

    it("counts the files and bytes of each payload tree", () => {
      seed_run(COHORT_2);

      const state_tree = manifest_for(new Set([2])).payload.find(
        (tree) => tree.path === path.join("triage-entrypoints", "triage_state", COHORT_2),
      );

      expect(state_tree?.files).toEqual(1);
      expect(state_tree?.bytes).toBeGreaterThan(0);
    });

    it("records the toolchain commit the bundle was written by", () => {
      seed_run(COHORT_2);

      const manifest = manifest_for(new Set([2]));

      expect(manifest.toolchain.git_commit).toMatch(/^[0-9a-f]{40}$/);
      expect(manifest.source.ariadne_dir).toEqual(ariadne_dir);
    });
  });
});

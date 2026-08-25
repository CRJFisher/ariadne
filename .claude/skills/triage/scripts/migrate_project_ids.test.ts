/**
 * The migration moves settled, expensive data, so these cases pin the two
 * properties that make it safe to run unattended: nothing is written unless
 * `--apply` is passed, and anything already occupying a destination stops that
 * move rather than overwriting it. The rest cover what has to travel with a
 * run — its recorded `project_name`, the `source_analysis_path` that would
 * otherwise dangle, and the plan store's evidence attributions.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  apply_project_id_migration,
  plan_project_id_migration,
  rewrite_plan_attributions,
  type MigrateArgs,
} from "./migrate_project_ids.js";
import {
  detect_entrypoints_root,
  manifest_file,
  project_analysis_dir,
  project_config_file,
  project_state_dir,
  run_dir,
  state_file,
  triage_results_root,
} from "../src/store/store_layout.js";

const RUN_ID = "1da3cfa-2026-08-22T21-42-13.867Z";
const OTHER_RUN_ID = "2eb4d5e-2026-08-23T09-00-00.000Z";
const REPOS = "/Users/chuck/.ariadne/triage-entrypoints/repos";
const PATH_SLUG_ID = "-Users-chuck-.ariadne-triage-entrypoints-repos-babel--babel";

describe("migrate_project_ids", () => {
  let store_dir: string;
  let plan_dir: string;

  beforeEach(() => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "migrate-project-ids-"));
    store_dir = path.join(root, "triage-entrypoints");
    plan_dir = path.join(root, "plan");
    fs.mkdirSync(store_dir, { recursive: true });
    fs.mkdirSync(plan_dir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(path.dirname(store_dir), { recursive: true, force: true });
  });

  function args(overrides: Partial<MigrateArgs> = {}): MigrateArgs {
    return { store_dir, plan_dir, apply: false, prune_empty: false, ...overrides };
  }

  /** Seed one finished run exactly as the pipeline writes it. */
  function seed_run(
    project_id: string,
    corpus_name: string,
    run_id: string = RUN_ID,
    detect_stamp = "2026-08-22T21-41-58.723Z",
  ): void {
    const corpus = `${REPOS}/${corpus_name}`;
    fs.mkdirSync(run_dir(store_dir, project_id, run_id), { recursive: true });
    fs.writeFileSync(
      manifest_file(store_dir, project_id, run_id),
      JSON.stringify(
        {
          schema_version: 1,
          run_id,
          project_name: project_id,
          project_path: corpus,
          status: "finalized",
          source_analysis_path: `${store_dir}/analysis_output/${project_id}/detect_entrypoints/${detect_stamp}.json`,
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      state_file(store_dir, project_id, run_id),
      JSON.stringify({ project_name: project_id, project_path: corpus, phase: "complete", entries: [] }, null, 2),
    );

    const detect_dir = detect_entrypoints_root(store_dir, project_id);
    fs.mkdirSync(detect_dir, { recursive: true });
    fs.writeFileSync(path.join(detect_dir, `${detect_stamp}.json`), "{}");

    const results_dir = triage_results_root(store_dir, project_id);
    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(
      path.join(results_dir, `${run_id}.json`),
      JSON.stringify({ schema_version: 5, project_path: corpus }),
    );
  }

  function seed_config(project_id: string, corpus_name: string): void {
    fs.mkdirSync(path.dirname(project_config_file(store_dir, project_id)), { recursive: true });
    fs.writeFileSync(
      project_config_file(store_dir, project_id),
      JSON.stringify({ project_path: `${REPOS}/${corpus_name}` }),
    );
  }

  function read_json(file: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  }

  describe("planning", () => {
    it("maps a path-slug id to the corpus directory name", () => {
      seed_run(PATH_SLUG_ID, "babel--babel");

      const plan = plan_project_id_migration(args());

      expect(plan.id_map).toEqual({ [PATH_SLUG_ID]: "babel--babel" });
      expect(plan.migrations.length).toEqual(1);
      expect(plan.migrations[0].to_project_id).toEqual("babel--babel");
      expect(plan.migrations[0].merges_into_existing).toEqual(false);
      expect(plan.migrations[0].run_moves.map((m) => m.blocked_by_existing)).toEqual([false]);
      expect(plan.migrations[0].analysis_moves.length).toEqual(2);
    });

    it("maps a last-segment id to the owner-qualified id", () => {
      seed_run("webpack", "webpack--webpack");

      expect(plan_project_id_migration(args()).id_map).toEqual({ webpack: "webpack--webpack" });
    });

    it("leaves a project already filed under its canonical id alone", () => {
      seed_run("babel--babel", "babel--babel");

      const plan = plan_project_id_migration(args());

      expect(plan.id_map).toEqual({});
      expect(plan.migrations).toEqual([]);
      expect(plan.skipped).toEqual([]);
    });

    it("reports a corpus outside repos/ as skipped rather than migrating it", () => {
      const project_id = "-Users-chuck-workspace-ariadne";
      fs.mkdirSync(run_dir(store_dir, project_id, RUN_ID), { recursive: true });
      fs.writeFileSync(
        manifest_file(store_dir, project_id, RUN_ID),
        JSON.stringify({ project_name: project_id, project_path: "/Users/chuck/workspace/ariadne" }),
      );

      const plan = plan_project_id_migration(args());

      expect(plan.migrations).toEqual([]);
      expect(plan.skipped).toEqual([{ project_id, verdict: "outside-repos" }]);
    });

    it("flags a project directory that holds nothing at all", () => {
      fs.mkdirSync(path.join(run_dir(store_dir, "stub", RUN_ID), "results"), { recursive: true });

      const plan = plan_project_id_migration(args());

      expect(plan.skipped).toEqual([{ project_id: "stub", verdict: "unresolved" }]);
      expect(plan.empty_project_dirs).toEqual(["stub"]);
    });

    it("refuses two legacy ids that resolve to the same canonical id", () => {
      seed_run("core", "vuejs--core");
      seed_run("-Users-chuck-.ariadne-triage-entrypoints-repos-vuejs--core", "vuejs--core", OTHER_RUN_ID);

      const plan = plan_project_id_migration(args());

      expect(plan.ambiguous).toEqual([
        {
          to_project_id: "vuejs--core",
          from_project_ids: ["-Users-chuck-.ariadne-triage-entrypoints-repos-vuejs--core", "core"],
        },
      ]);
    });
  });

  describe("applying", () => {
    it("moves the run and retargets both references it carries", async () => {
      seed_run(PATH_SLUG_ID, "babel--babel");
      seed_config(PATH_SLUG_ID, "babel--babel");

      const report = await apply_project_id_migration(plan_project_id_migration(args()), {
        prune_empty: false,
      });

      expect(report.blocked).toEqual([]);
      expect(report.runs_moved).toEqual(1);
      expect(report.analysis_files_moved).toEqual(2);
      expect(report.configs_moved).toEqual(1);

      const manifest = read_json(manifest_file(store_dir, "babel--babel", RUN_ID));
      expect(manifest.project_name).toEqual("babel--babel");
      expect(manifest.source_analysis_path).toEqual(
        `${store_dir}/analysis_output/babel--babel/detect_entrypoints/2026-08-22T21-41-58.723Z.json`,
      );
      expect(fs.existsSync(manifest.source_analysis_path as string)).toEqual(true);

      expect(read_json(state_file(store_dir, "babel--babel", RUN_ID)).project_name).toEqual(
        "babel--babel",
      );
      expect(fs.existsSync(project_config_file(store_dir, "babel--babel"))).toEqual(true);
    });

    it("removes the emptied legacy directories", async () => {
      seed_run(PATH_SLUG_ID, "babel--babel");

      await apply_project_id_migration(plan_project_id_migration(args()), { prune_empty: false });

      expect(fs.existsSync(project_state_dir(store_dir, PATH_SLUG_ID))).toEqual(false);
      expect(fs.existsSync(project_analysis_dir(store_dir, PATH_SLUG_ID))).toEqual(false);
    });

    it("merges runs into a canonical directory that already exists", async () => {
      seed_run("webpack--webpack", "webpack--webpack", RUN_ID, "2026-01-01T00-00-00.000Z");
      seed_run("webpack", "webpack--webpack", OTHER_RUN_ID, "2026-02-02T00-00-00.000Z");

      const plan = plan_project_id_migration(args());
      expect(plan.migrations[0].merges_into_existing).toEqual(true);

      const report = await apply_project_id_migration(plan, { prune_empty: false });

      expect(report.blocked).toEqual([]);
      expect(fs.existsSync(run_dir(store_dir, "webpack--webpack", RUN_ID))).toEqual(true);
      expect(fs.existsSync(run_dir(store_dir, "webpack--webpack", OTHER_RUN_ID))).toEqual(true);
      expect(fs.existsSync(project_state_dir(store_dir, "webpack"))).toEqual(false);
    });

    it("blocks a run whose id is already taken at the destination", async () => {
      seed_run("webpack--webpack", "webpack--webpack", RUN_ID, "2026-01-01T00-00-00.000Z");
      seed_run("webpack", "webpack--webpack", RUN_ID, "2026-02-02T00-00-00.000Z");

      const report = await apply_project_id_migration(plan_project_id_migration(args()), {
        prune_empty: false,
      });

      // The shared run id collides twice — on the run directory and on the
      // published envelope named after it. Both are reported, neither is moved.
      expect(report.runs_moved).toEqual(0);
      expect(report.blocked).toEqual([
        `run already present at ${run_dir(store_dir, "webpack--webpack", RUN_ID)}`,
        `published artifact already present at ${path.join(
          triage_results_root(store_dir, "webpack--webpack"),
          `${RUN_ID}.json`,
        )}`,
      ]);
      expect(read_json(manifest_file(store_dir, "webpack", RUN_ID)).project_name).toEqual("webpack");
    });

    it("applies nothing at all when two ids claim one canonical id", async () => {
      seed_run("core", "vuejs--core");
      seed_run("-Users-chuck-.ariadne-triage-entrypoints-repos-vuejs--core", "vuejs--core", OTHER_RUN_ID);

      const report = await apply_project_id_migration(plan_project_id_migration(args()), {
        prune_empty: false,
      });

      expect(report.applied).toEqual(false);
      expect(report.runs_moved).toEqual(0);
      expect(fs.existsSync(project_state_dir(store_dir, "core"))).toEqual(true);
    });

    it("deletes empty project directories only when asked", async () => {
      fs.mkdirSync(path.join(run_dir(store_dir, "stub", RUN_ID), "results"), { recursive: true });
      seed_run(PATH_SLUG_ID, "babel--babel");

      const kept = await apply_project_id_migration(plan_project_id_migration(args()), {
        prune_empty: false,
      });
      expect(kept.pruned_dirs).not.toContain(project_state_dir(store_dir, "stub"));
      expect(fs.existsSync(project_state_dir(store_dir, "stub"))).toEqual(true);

      const pruned = await apply_project_id_migration(plan_project_id_migration(args()), {
        prune_empty: true,
      });
      expect(pruned.pruned_dirs).toContain(project_state_dir(store_dir, "stub"));
      expect(fs.existsSync(project_state_dir(store_dir, "stub"))).toEqual(false);
    });
  });

  describe("plan-store attributions", () => {
    it("rewrites a projects[] membership and a project field, leaving other strings alone", () => {
      const before = {
        projects: ["webpack", "vuejs--core"],
        evidence: [{ project: "webpack", why: "a note mentioning webpack in prose" }],
        fault_area: "webpack",
      };

      const { value, occurrences } = rewrite_plan_attributions(before, {
        webpack: "webpack--webpack",
      });

      expect(occurrences).toEqual(2);
      expect(value).toEqual({
        projects: ["webpack--webpack", "vuejs--core"],
        evidence: [{ project: "webpack--webpack", why: "a note mentioning webpack in prose" }],
        fault_area: "webpack",
      });
    });

    it("rewrites plan files on disk and counts them in the plan", async () => {
      seed_run("webpack", "webpack--webpack");
      fs.mkdirSync(path.join(plan_dir, "tasks"), { recursive: true });
      fs.writeFileSync(
        path.join(plan_dir, "tasks", "pt-1.json"),
        JSON.stringify({ projects: ["webpack"], evidence: [{ project: "webpack" }] }),
      );
      fs.writeFileSync(
        path.join(plan_dir, "sweeps", "..", "manifest.json"),
        JSON.stringify({ projects: ["webpack"] }),
      );

      // Sorted by path: the root manifest first, then the task record.
      const plan = plan_project_id_migration(args());
      expect(plan.plan_rewrites.map((r) => path.relative(plan_dir, r.file))).toEqual([
        "manifest.json",
        path.join("tasks", "pt-1.json"),
      ]);
      expect(plan.plan_rewrites.map((r) => r.occurrences)).toEqual([1, 2]);

      await apply_project_id_migration(plan, { prune_empty: false });

      expect(read_json(path.join(plan_dir, "tasks", "pt-1.json"))).toEqual({
        projects: ["webpack--webpack"],
        evidence: [{ project: "webpack--webpack" }],
      });
    });
  });

  describe("dry run", () => {
    it("writes nothing when the plan is only computed", () => {
      seed_run(PATH_SLUG_ID, "babel--babel");
      const before = fs.readdirSync(path.join(store_dir, "triage_state")).sort();

      plan_project_id_migration(args());

      expect(fs.readdirSync(path.join(store_dir, "triage_state")).sort()).toEqual(before);
      expect(read_json(manifest_file(store_dir, PATH_SLUG_ID, RUN_ID)).project_name).toEqual(
        PATH_SLUG_ID,
      );
    });
  });
});

import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  backlog_comprehension_staging_path,
  backlog_docs_dir,
  backlog_root_dir,
  backlog_tasks_dir,
  get_repo_root,
  plan_dir,
  plan_membership_overrides_path,
  plan_staging_manifest_path,
  plan_sweeps_dir,
  plan_task_path,
  plan_tasks_dir,
} from "./paths.js";

let saved_plan_override: string | undefined;
let saved_backlog_override: string | undefined;

beforeEach(() => {
  saved_plan_override = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  saved_backlog_override = process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
});

afterEach(() => {
  if (saved_plan_override === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_plan_override;
  if (saved_backlog_override === undefined) delete process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
  else process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = saved_backlog_override;
});

describe("plan task-DB paths", () => {
  it("plan_dir honors ARIADNE_PLAN_DIR_OVERRIDE, read lazily", () => {
    process.env.ARIADNE_PLAN_DIR_OVERRIDE = "/tmp/plan-root";
    expect(plan_dir()).toEqual("/tmp/plan-root");
  });

  it("plan_tasks_dir composes <plan-dir>/tasks", () => {
    process.env.ARIADNE_PLAN_DIR_OVERRIDE = "/tmp/plan-root";
    expect(plan_tasks_dir()).toEqual("/tmp/plan-root/tasks");
  });

  it("plan_sweeps_dir composes <plan-dir>/sweeps", () => {
    process.env.ARIADNE_PLAN_DIR_OVERRIDE = "/tmp/plan-root";
    expect(plan_sweeps_dir()).toEqual("/tmp/plan-root/sweeps");
  });

  it("plan_task_path names <plan-dir>/tasks/<id>.json", () => {
    process.env.ARIADNE_PLAN_DIR_OVERRIDE = "/tmp/plan-root";
    expect(plan_task_path("01HXYZ-abc")).toEqual("/tmp/plan-root/tasks/01HXYZ-abc.json");
  });

  it("plan_membership_overrides_path names <plan-dir>/membership_overrides.json", () => {
    process.env.ARIADNE_PLAN_DIR_OVERRIDE = "/tmp/plan-root";
    expect(plan_membership_overrides_path()).toEqual(
      "/tmp/plan-root/membership_overrides.json",
    );
  });
});

describe("plan_staging_manifest_path", () => {
  it("resolves to <plan-dir>/staging/<sweep>/manifest.json under the override", () => {
    process.env.ARIADNE_PLAN_DIR_OVERRIDE = "/tmp/plan-root";
    expect(plan_staging_manifest_path("sweep-7")).toEqual(
      "/tmp/plan-root/staging/sweep-7/manifest.json",
    );
  });
});

describe("backlog_tasks_dir", () => {
  it("honors ARIADNE_BACKLOG_DIR_OVERRIDE", () => {
    process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = "/tmp/fake-backlog";
    expect(backlog_tasks_dir()).toEqual("/tmp/fake-backlog");
  });

  it("falls back to <repo>/backlog/tasks", () => {
    delete process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
    expect(backlog_tasks_dir()).toEqual(path.join(get_repo_root(), "backlog", "tasks"));
  });
});

describe("backlog_root_dir", () => {
  it("collapses onto ARIADNE_BACKLOG_DIR_OVERRIDE so a test scans one temp tree", () => {
    process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = "/tmp/fake-backlog";
    expect(backlog_root_dir()).toEqual("/tmp/fake-backlog");
  });

  it("falls back to <repo>/backlog", () => {
    delete process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
    expect(backlog_root_dir()).toEqual(path.join(get_repo_root(), "backlog"));
  });
});

describe("backlog_docs_dir", () => {
  it("composes <backlog-root>/docs under the override", () => {
    process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = "/tmp/fake-backlog";
    expect(backlog_docs_dir()).toEqual("/tmp/fake-backlog/docs");
  });
});

describe("backlog_comprehension_staging_path", () => {
  it("names <backlog-root>/docs/<slug>.comprehension.html under the override", () => {
    process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = "/tmp/fake-backlog";
    expect(backlog_comprehension_staging_path("scope_construction")).toEqual(
      "/tmp/fake-backlog/docs/scope_construction.comprehension.html",
    );
  });
});

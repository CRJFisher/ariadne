import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  backlog_root_dir,
  backlog_tasks_dir,
  get_repo_root,
  plan_staging_manifest_path,
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

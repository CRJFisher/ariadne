import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fsSync from "fs";
import path from "path";

import {
  list_projects_with_state,
  manifest_path_for,
  read_latest_run_id,
  results_dir_for,
  run_dir_for,
  state_path_for,
  write_latest_run_id,
  clear_latest,
  require_run,
} from "./triage_state_paths.js";

// vi.hoisted runs before all `import` statements, so the env var is set
// before `paths.js` (transitively imported by `triage_state_paths.js`) reads it.
const TMP_BASE = vi.hoisted(() => {
  const tmp_path = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-triage-paths-${process.pid}`;
  process.env.ARIADNE_SELF_REPAIR_DIR_OVERRIDE = tmp_path;
  return tmp_path;
});

const triage_dir = path.join(TMP_BASE, "triage_state");

beforeEach(() => {
  fsSync.rmSync(TMP_BASE, { recursive: true, force: true });
  fsSync.mkdirSync(triage_dir, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  fsSync.rmSync(TMP_BASE, { recursive: true, force: true });
});

function seed_run(project: string, run_id: string): void {
  const run_dir = path.join(triage_dir, project, "runs", run_id);
  fsSync.mkdirSync(path.join(run_dir, "results"), { recursive: true });
  fsSync.writeFileSync(path.join(run_dir, "triage.json"), "{}");
}

describe("path builders", () => {
  it("run_dir_for / state_path_for / manifest_path_for / results_dir_for", () => {
    const project = "express";
    const run_id = "deadbee-2026-04-28T13-42-07.812Z";

    expect(run_dir_for(project, run_id)).toBe(
      path.join(triage_dir, project, "runs", run_id),
    );
    expect(state_path_for(project, run_id)).toBe(
      path.join(triage_dir, project, "runs", run_id, "triage.json"),
    );
    expect(manifest_path_for(project, run_id)).toBe(
      path.join(triage_dir, project, "runs", run_id, "manifest.json"),
    );
    expect(results_dir_for(project, run_id)).toBe(
      path.join(triage_dir, project, "runs", run_id, "results"),
    );
  });
});

describe("LATEST pointer", () => {
  it("read_latest_run_id returns null when absent", () => {
    expect(read_latest_run_id("nope")).toBeNull();
  });

  it("write then read round-trip", () => {
    write_latest_run_id("express", "deadbee-2026-04-28T13-42-07.812Z");
    expect(read_latest_run_id("express")).toBe("deadbee-2026-04-28T13-42-07.812Z");
  });

  it("clear_latest removes the pointer", () => {
    write_latest_run_id("express", "abc-1");
    clear_latest("express");
    expect(read_latest_run_id("express")).toBeNull();
  });

  it("clear_latest is a no-op when pointer is absent", () => {
    expect(() => clear_latest("nope")).not.toThrow();
  });
});

describe("list_projects_with_state", () => {
  it("returns projects whose runs/ directory has at least one run subdir", () => {
    seed_run("express", "abc-1");
    seed_run("mocha", "def-2");
    fsSync.mkdirSync(path.join(triage_dir, "empty"), { recursive: true });
    fsSync.mkdirSync(path.join(triage_dir, "stale", "runs"), { recursive: true });
    expect(list_projects_with_state(triage_dir).sort()).toEqual(["express", "mocha"]);
  });

  it("returns an empty array when triage_dir does not exist", () => {
    expect(list_projects_with_state(path.join(triage_dir, "nope"))).toEqual([]);
  });
});

describe("require_run", () => {
  it("resolves explicit run_id when state file exists", () => {
    seed_run("express", "abc-1");
    const resolved = require_run("express", "abc-1");
    expect(resolved.run_id).toBe("abc-1");
    expect(resolved.state_path).toBe(state_path_for("express", "abc-1"));
  });

  it("falls back to LATEST when run_id is null", () => {
    seed_run("express", "abc-1");
    write_latest_run_id("express", "abc-1");
    const resolved = require_run("express", null);
    expect(resolved.run_id).toBe("abc-1");
  });

  it("exits when LATEST is missing", () => {
    const exit_spy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__exit__:${code ?? 0}`);
    }) as never);
    const stderr_spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      expect(() => require_run("nope", null)).toThrow("__exit__:1");
    } finally {
      exit_spy.mockRestore();
      stderr_spy.mockRestore();
    }
  });

  it("exits when explicit run_id has no state file", () => {
    const exit_spy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__exit__:${code ?? 0}`);
    }) as never);
    const stderr_spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      expect(() => require_run("express", "missing-run")).toThrow("__exit__:1");
    } finally {
      exit_spy.mockRestore();
      stderr_spy.mockRestore();
    }
  });
});

// CLI parser tests live in `cli_args.test.ts`.

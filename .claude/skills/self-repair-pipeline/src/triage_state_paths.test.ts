import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  list_projects_with_state,
  parse_project_arg,
  state_path_for,
} from "./triage_state_paths.js";

let triage_dir: string;

beforeEach(() => {
  triage_dir = fs.mkdtempSync(path.join(os.tmpdir(), "discover-state-"));
});

afterEach(() => {
  fs.rmSync(triage_dir, { recursive: true, force: true });
});

function seed_project(project: string): string {
  const project_dir = path.join(triage_dir, project);
  fs.mkdirSync(project_dir, { recursive: true });
  const state_path = path.join(project_dir, `${project}_triage.json`);
  fs.writeFileSync(state_path, "{}");
  return state_path;
}

describe("state_path_for", () => {
  it("builds the canonical path without checking existence", () => {
    expect(state_path_for(triage_dir, "mocha")).toBe(
      path.join(triage_dir, "mocha", "mocha_triage.json"),
    );
  });
});

describe("list_projects_with_state", () => {
  it("returns only subdirectories that contain a *_triage.json file", () => {
    seed_project("express");
    seed_project("mocha");
    fs.mkdirSync(path.join(triage_dir, "empty"), { recursive: true });
    expect(list_projects_with_state(triage_dir).sort()).toEqual(["express", "mocha"]);
  });

  it("returns an empty array when triage_dir does not exist", () => {
    fs.rmSync(triage_dir, { recursive: true });
    expect(list_projects_with_state(triage_dir)).toEqual([]);
  });
});

describe("parse_project_arg", () => {
  it("returns the project name when --project is present", () => {
    expect(parse_project_arg(["node", "script.ts", "--project", "mocha"], "usage")).toBe("mocha");
  });

  it("ignores unrelated flags", () => {
    expect(
      parse_project_arg(["node", "script.ts", "--count", "5", "--project", "express"], "usage"),
    ).toBe("express");
  });

  it("exits via process.exit(1) when --project is missing", () => {
    const original_exit = process.exit;
    const original_stderr_write = process.stderr.write;
    let exit_code: number | null = null;
    let stderr_captured = "";
    process.exit = ((code?: number) => {
      exit_code = code ?? 0;
      throw new Error("__exit__");
    }) as typeof process.exit;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr_captured += String(chunk);
      return true;
    }) as typeof process.stderr.write;
    try {
      expect(() => parse_project_arg(["node", "script.ts"], "Usage: foo --project <name>")).toThrow(
        "__exit__",
      );
    } finally {
      process.exit = original_exit;
      process.stderr.write = original_stderr_write;
    }
    expect(exit_code).toBe(1);
    expect(stderr_captured).toBe("Usage: foo --project <name>\n");
  });

  it("exits via process.exit(1) when --project value is empty", () => {
    const original_exit = process.exit;
    const original_stderr_write = process.stderr.write;
    process.exit = (() => {
      throw new Error("__exit__");
    }) as typeof process.exit;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      expect(() =>
        parse_project_arg(["node", "script.ts", "--project"], "Usage: foo --project <name>"),
      ).toThrow("__exit__");
    } finally {
      process.exit = original_exit;
      process.stderr.write = original_stderr_write;
    }
  });
});

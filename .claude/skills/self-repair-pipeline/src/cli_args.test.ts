import { describe, it, expect, afterEach, vi } from "vitest";

import { parse_project_arg, parse_run_id_arg } from "./cli_args.js";

afterEach(() => {
  vi.restoreAllMocks();
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
    const exit_spy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__exit__:${code ?? 0}`);
    }) as never);
    const stderr_spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      expect(() => parse_project_arg(["node", "script.ts"], "Usage: foo --project <name>")).toThrow(
        "__exit__:1",
      );
    } finally {
      exit_spy.mockRestore();
      stderr_spy.mockRestore();
    }
  });
});

describe("parse_run_id_arg", () => {
  it("returns the run-id when --run-id is present", () => {
    expect(parse_run_id_arg(["node", "script.ts", "--run-id", "abc-1"])).toBe("abc-1");
  });

  it("returns null when absent", () => {
    expect(parse_run_id_arg(["node", "script.ts", "--project", "express"])).toBeNull();
  });

  it("returns null when --run-id has no value", () => {
    expect(parse_run_id_arg(["node", "script.ts", "--run-id"])).toBeNull();
  });
});

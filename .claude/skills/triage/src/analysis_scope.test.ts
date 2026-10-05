import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_FILES,
  load_analysis_scope,
  read_analysis_scope,
  test_tree_excludes,
} from "./analysis_scope.js";

let tmpdir: string;

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "analysis-scope-test-"));
});

afterEach(async () => {
  await fs.rm(tmpdir, { recursive: true, force: true });
});

describe("read_analysis_scope", () => {
  // `detect_entrypoints` and `prepare_triage` both index through this reader,
  // so a case proved here holds for both scripts by construction — which is
  // the point: the two used to parse the config separately and disagreed on
  // `include_tests`.
  it("carries every scope field off the config", () => {
    expect(
      read_analysis_scope({
        folders: ["src"],
        exclude: ["docs"],
        include_tests: true,
        max_files: 20000,
      }),
    ).toEqual({
      folders: ["src"],
      exclude: ["docs"],
      include_tests: true,
      max_files: 20000,
    });
  });

  it("defaults include_tests to false, exclude to empty, and max_files to the shared cap", () => {
    expect(read_analysis_scope({ folders: ["src"] })).toEqual({
      folders: ["src"],
      exclude: [],
      include_tests: false,
      max_files: DEFAULT_MAX_FILES,
    });
  });

  it("rejects a zero or negative cap rather than treating it as uncapped", () => {
    expect(read_analysis_scope({ max_files: 0 }).max_files).toEqual(DEFAULT_MAX_FILES);
    expect(read_analysis_scope({ max_files: -5 }).max_files).toEqual(DEFAULT_MAX_FILES);
  });

  it("ignores a non-boolean include_tests rather than treating it as set", () => {
    expect(read_analysis_scope({ include_tests: "yes" })).toEqual({
      folders: undefined,
      exclude: [],
      include_tests: false,
      max_files: DEFAULT_MAX_FILES,
    });
  });
});

describe("load_analysis_scope", () => {
  it("reads the same scope from a config file that read_analysis_scope reads from its object", async () => {
    const config = {
      project_path: "/x",
      folders: ["lib"],
      exclude: ["docs"],
      include_tests: true,
      max_files: 5000,
    };
    const config_path = path.join(tmpdir, "project.json");
    await fs.writeFile(config_path, JSON.stringify(config), "utf8");

    expect(load_analysis_scope(config_path)).toEqual(read_analysis_scope(config));
  });

  it("treats an absent config as the whole project with tests suppressed", () => {
    expect(load_analysis_scope(null)).toEqual({
      folders: undefined,
      exclude: [],
      include_tests: false,
      max_files: DEFAULT_MAX_FILES,
    });
  });
});

describe("test_tree_excludes", () => {
  it("names excludes that delete a test tree's call edges", () => {
    expect(
      test_tree_excludes(["tests", "test", "__tests__", "benches", "/tests/"]),
    ).toEqual(["tests", "test", "__tests__", "benches", "/tests/"]);
  });

  it("leaves excludes that are not test trees alone", () => {
    expect(
      test_tree_excludes(["js_tests", "docs", "examples", "tools", "scripts", "baselines"]),
    ).toEqual([]);
  });

  it("matches on a whole directory name, not a substring of one", () => {
    expect(test_tree_excludes(["testing", "latest", "contest"])).toEqual([]);
  });

  it("names a test tree nested inside a multi-segment exclude", () => {
    expect(test_tree_excludes(["src/tests", "tests/unit", "a/benches/b"])).toEqual([
      "src/tests",
      "tests/unit",
      "a/benches/b",
    ]);
  });
});

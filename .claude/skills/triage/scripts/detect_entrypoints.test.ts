import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collect_unindexed_test_files, IGNORED_DIRECTORIES, load_project } from "@ariadnejs/core";
import type { EnrichedEntryPoint } from "@ariadnejs/types";

import { analyze_directory, load_project_config } from "./detect_entrypoints.js";
import { DEFAULT_MAX_FILES, load_analysis_scope } from "../src/analysis_scope.js";

let tmpdir: string;

async function write(rel: string, content: string): Promise<string> {
  const full = path.join(tmpdir, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
  return full;
}

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "detect-entrypoints-test-"));
});

afterEach(async () => {
  await fs.rm(tmpdir, { recursive: true, force: true });
});

/**
 * Run the real `analyze_directory`, so a change to the script's corpus or
 * candidate decisions shows up here. The out-of-index residue is read back
 * separately because the pass mutates the entries it is given rather than
 * returning its file set.
 */
async function analyze(options: {
  exclude?: string[];
  folders?: string[];
  include_tests?: boolean;
}): Promise<{
  indexed: string[];
  entry_points: EnrichedEntryPoint[];
  out_of_index: string[];
}> {
  const exclude = [...IGNORED_DIRECTORIES, ...(options.exclude ?? [])];
  const result = await analyze_directory(tmpdir, {
    include_tests: options.include_tests ?? false,
    folders: options.folders,
    exclude: options.exclude,
  });
  const { project } = await load_project({
    project_path: tmpdir,
    folders: options.folders,
    exclude,
  });
  const residue = await collect_unindexed_test_files(
    tmpdir,
    project.get_file_contents(),
    exclude,
  );
  return {
    indexed: result.indexed_files.map((f) => path.relative(tmpdir, f)).sort(),
    entry_points: result.entry_points,
    out_of_index: [...residue.keys()].map((f) => path.relative(tmpdir, f)).sort(),
  };
}

function entry_point_names(entry_points: readonly EnrichedEntryPoint[]): string[] {
  return entry_points.map((e) => e.name).sort();
}

describe("both harness phases read one scope from the project config", () => {
  // `detect_entrypoints` indexes in phase 1 and `prepare_triage` re-indexes in
  // phase 2. They must reach the same corpus and the same candidate gate from
  // the same config — they used to parse it separately and disagreed on
  // `include_tests`.
  it("agrees on every scope field, including include_tests: true", async () => {
    const config_path = path.join(tmpdir, "project.json");
    await fs.writeFile(
      config_path,
      JSON.stringify({
        project_path: tmpdir,
        project_name: "fixture",
        folders: ["src"],
        exclude: ["docs"],
        include_tests: true,
        max_files: 1234,
      }),
      "utf8",
    );

    const detect_side = await load_project_config(config_path);
    const prepare_side = load_analysis_scope(config_path);

    expect({
      folders: detect_side.folders,
      exclude: detect_side.exclude,
      include_tests: detect_side.include_tests,
      max_files: detect_side.max_files,
    }).toEqual({
      folders: prepare_side.folders,
      exclude: prepare_side.exclude,
      include_tests: prepare_side.include_tests,
      max_files: prepare_side.max_files,
    });
    expect(prepare_side.include_tests).toEqual(true);
  });

  it("gives both phases the same corpus cap when the config names none", async () => {
    const config_path = path.join(tmpdir, "uncapped.json");
    await fs.writeFile(
      config_path,
      JSON.stringify({ project_path: tmpdir, project_name: "fixture" }),
      "utf8",
    );

    const detect_side = await load_project_config(config_path);
    const prepare_side = load_analysis_scope(config_path);

    expect(detect_side.max_files).toEqual(DEFAULT_MAX_FILES);
    expect(prepare_side.max_files).toEqual(DEFAULT_MAX_FILES);
  });
});

describe("the corpus is every discovered file, whatever include_tests says", () => {
  // celery's shape: tests live under `t/`, marked by filename rather than by a
  // test-directory name, so nothing but a corpus filter could have removed them.
  async function write_celery_fixture(): Promise<void> {
    for (const pkg of ["t", "t/unit", "t/unit/app", "t/smoke", "t/integration"]) {
      await write(`${pkg}/__init__.py`, "");
    }
    await write("celery/__init__.py", "");
    await write(
      "celery/worker/__init__.py",
      "",
    );
    await write(
      "celery/worker/control.py",
      "def pool_shrink(state, n=1):\n    return state\n",
    );
    for (const [dir, module] of [
      ["t/unit/app", "test_control"],
      ["t/smoke", "test_smoke"],
      ["t/integration", "test_integration"],
    ]) {
      await write(
        `${dir}/${module}.py`,
        [
          "from celery.worker.control import pool_shrink",
          "",
          "",
          `def ${module}():`,
          "    return pool_shrink(None)",
          "",
        ].join("\n"),
      );
    }
  }

  it("indexes filename-marked test modules and takes the callee off the entry-point set", async () => {
    await write_celery_fixture();

    const production_only = await analyze({});

    expect(production_only.indexed).toContain("t/unit/app/test_control.py");
    expect(production_only.indexed).toContain("t/smoke/test_smoke.py");
    expect(production_only.indexed).toContain("t/integration/test_integration.py");
    expect(entry_point_names(production_only.entry_points)).toEqual([]);
  });

  it("indexes the same files under include_tests true and false", async () => {
    await write_celery_fixture();

    const suppressed = await analyze({ include_tests: false });
    const admitted = await analyze({ include_tests: true });

    expect(admitted.indexed).toEqual(suppressed.indexed);
    // Only candidacy differs: the test callables become reportable, the
    // production callee stays called either way.
    expect(entry_point_names(admitted.entry_points)).toEqual([
      "test_control",
      "test_integration",
      "test_smoke",
    ]);
    expect(entry_point_names(suppressed.entry_points)).toEqual([]);
  });

});

describe("a config exclude is a corpus exclusion, and it costs call edges", () => {
  async function write_django_fixture(): Promise<void> {
    await write(
      "django/db/models/query.py",
      "def adapt_value(value):\n    return value\n",
    );
    await write(
      "tests/queries/test_query.py",
      [
        "from django.db.models.query import adapt_value",
        "",
        "",
        "def test_query():",
        "    return adapt_value(1)",
        "",
      ].join("\n"),
    );
  }

  it("keeps the caller and resolves the callee when the test tree is in the corpus", async () => {
    await write_django_fixture();

    const analysis = await analyze({});

    expect(analysis.indexed).toContain("tests/queries/test_query.py");
    expect(entry_point_names(analysis.entry_points)).toEqual([]);
    // `tests/` is a directory the out-of-index walk does recognise, so an empty
    // residue here means the corpus really did absorb it.
    expect(analysis.out_of_index).toEqual([]);
  });

  it("drops the caller and flags the callee uncalled while `tests` is excluded", async () => {
    await write_django_fixture();

    const analysis = await analyze({ exclude: ["tests"] });

    expect(analysis.indexed).toEqual(["django/db/models/query.py"]);
    expect(entry_point_names(analysis.entry_points)).toEqual(["adapt_value"]);
    // The compensation cannot reach it either: `exclude` is threaded into the
    // out-of-index walk as well, so an excluded caller is invisible to both
    // passes. Sub-task 1.2 stops that threading and re-keys the set to
    // discovered-minus-indexed, at which point this becomes the held-out file.
    expect(analysis.out_of_index).toEqual([]);
  });

  it("keeps sqlalchemy's production `testing` package in the corpus", async () => {
    await write(
      "lib/sqlalchemy/testing/plugin.py",
      "def start_test_class(cls):\n    return cls\n",
    );
    await write(
      "lib/sqlalchemy/engine/base.py",
      [
        "from lib.sqlalchemy.testing.plugin import start_test_class",
        "",
        "",
        "def connect():",
        "    return start_test_class(None)",
        "",
      ].join("\n"),
    );

    // `exclude: ["test"]` is sqlalchemy's real config entry. Anchored on whole
    // segments it removes nothing here; as a substring it swallowed
    // `lib/sqlalchemy/testing/**`, which is production code.
    const analysis = await analyze({ exclude: ["test"] });

    expect(analysis.indexed).toEqual([
      "lib/sqlalchemy/engine/base.py",
      "lib/sqlalchemy/testing/plugin.py",
    ]);
    expect(entry_point_names(analysis.entry_points)).toEqual(["connect"]);
  });
});

describe("attach_unindexed_test_grep_hits", () => {
  it("attaches a caller that a folder scope held out of the corpus", async () => {
    await write("src/foo.ts", "export function foo() {}\n");
    await write("tests/foo.test.ts", "import { foo } from '../src/foo.js';\nfoo();\n");

    const analysis = await analyze({ folders: ["src"] });
    const entry = analysis.entry_points.find((e) => e.name === "foo");
    if (entry === undefined) throw new Error("expected an entry point named foo");

    expect(entry.diagnostics.grep_call_sites_unindexed_tests.map((h) => h.content)).toEqual([
      "foo();",
    ]);
    expect(entry.diagnostics.callers_only_in_unindexed_tests).toEqual(true);
  });

  it("does not read a comment in a held-out file as a caller", async () => {
    await write("src/foo.ts", "export function foo() {}\n");
    await write("tests/foo.test.ts", "// cover foo() one day\n");

    const analysis = await analyze({ folders: ["src"] });
    const entry = analysis.entry_points.find((e) => e.name === "foo");
    if (entry === undefined) throw new Error("expected an entry point named foo");

    expect(entry.diagnostics.grep_call_sites_unindexed_tests).toEqual([]);
    expect(entry.diagnostics.callers_only_in_unindexed_tests).toEqual(false);
  });

  it("greps constructors by class name, not by the constructor symbol's own name", async () => {
    await write("src/foo.ts", "export class Foo {\n  constructor() {}\n}\n");
    await write("tests/foo.test.ts", "new Foo();\n");

    const analysis = await analyze({ folders: ["src"] });
    const entry = analysis.entry_points.find((e) => e.kind === "constructor");
    if (entry === undefined) throw new Error("expected a constructor entry point");

    expect(entry.diagnostics.grep_call_sites_unindexed_tests.map((h) => h.content)).toEqual([
      "new Foo();",
    ]);
  });
});

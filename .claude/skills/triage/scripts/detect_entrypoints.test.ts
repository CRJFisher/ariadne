import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  find_source_files,
  IGNORED_DIRECTORIES,
  load_project,
  trace_call_graph,
} from "@ariadnejs/core";
import type { EnrichedEntryPoint } from "@ariadnejs/types";

import {
  analyze_directory,
  ensure_corpus_checkout,
  github_repo_to_project_id,
  github_url_from_project_id,
  load_project_config,
  recorded_run_commit,
} from "./detect_entrypoints.js";
import { DEFAULT_MAX_FILES, load_analysis_scope } from "../src/analysis_scope.js";
import type { RunManifest } from "../src/triage_state_types.js";

// vi.hoisted runs before every `import`, so the store root is fixed before
// `paths.js` (reached through `run_discovery.js`) reads it: the run manifests
// and `repos/` clones the checkout tests write are never this machine's.
const STORE = vi.hoisted(() => {
  const store = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-detect-entrypoints-${process.pid}`;
  process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE = store;
  return store;
});

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "detect_entrypoints.ts");

let tmpdir: string;

async function write(rel: string, content: string): Promise<string> {
  const full = path.join(tmpdir, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
  return full;
}

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "detect-entrypoints-test-"));
  await fs.rm(STORE, { recursive: true, force: true });
  await fs.mkdir(STORE, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpdir, { recursive: true, force: true });
  await fs.rm(STORE, { recursive: true, force: true });
});

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.com",
      GIT_COMMITTER_NAME: "fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.com",
    },
  }).trim();
}

const OLDER_SOURCE = "def handler():\n    return 1\n";
const NEWER_SOURCE = "def handler():\n    return 2\n";

/**
 * A bare repository standing in for GitHub, with two commits on `main`. The
 * older one is reachable only by sha — the position a run's recorded commit
 * is in once upstream has moved on — so no test touches the network. Built
 * once and only ever fetched from: each git spawn from the test worker costs
 * a few hundred milliseconds.
 */
async function make_upstream(
  upstream_dir: string,
): Promise<{ url: string; older: string; newer: string }> {
  const work = path.join(upstream_dir, "upstream-work");
  const url = path.join(upstream_dir, "upstream.git");
  await fs.mkdir(work, { recursive: true });
  git(["init", "--quiet", "--initial-branch=main"], work);
  await fs.writeFile(path.join(work, "app.py"), OLDER_SOURCE, "utf8");
  git(["add", "app.py"], work);
  git(["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "older"], work);
  const older = git(["rev-parse", "HEAD"], work);
  await fs.writeFile(path.join(work, "app.py"), NEWER_SOURCE, "utf8");
  git(["-c", "commit.gpgsign=false", "commit", "--quiet", "-am", "newer"], work);
  const newer = git(["rev-parse", "HEAD"], work);
  git(["init", "--quiet", "--bare", "--initial-branch=main", url], upstream_dir);
  git(["config", "uploadpack.allowReachableSHA1InWant", "true"], url);
  git(["push", "--quiet", url, "main"], work);
  return { url, older, newer };
}

async function seed_manifest(
  project: string,
  run_id: string,
  created_at: string,
  commit_hash: string | null,
): Promise<void> {
  const dir = path.join(STORE, "triage_state", project, "runs", run_id);
  await fs.mkdir(dir, { recursive: true });
  const manifest: RunManifest = {
    schema_version: 1,
    run_id,
    project_name: project,
    project_path: path.join(STORE, "repos", project),
    created_at,
    finalized_at: null,
    status: "finalized",
    source_analysis_path: "",
    source_analysis_run_id: "",
    max_count: 250,
    commit_hash,
    tp_cache: {
      enabled: true,
      source_run_id: null,
      skipped_count: 0,
      skipped_entry_keys: [],
      stability: null,
    },
  };
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest), "utf8");
}

function run_detect(args: string[]): { status: number; stderr: string } {
  try {
    execFileSync(process.execPath, ["--import", "tsx", SCRIPT, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE: STORE },
    });
    return { status: 0, stderr: "" };
  } catch (error) {
    const failure = error as { status: number; stderr: string };
    return { status: failure.status, stderr: failure.stderr };
  }
}

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
    ...load_analysis_scope(null),
    include_tests: options.include_tests ?? false,
    folders: options.folders,
    exclude: options.exclude ?? [],
  });
  const { project, dropped_files } = await load_project({
    project_path: tmpdir,
    folders: options.folders,
    exclude,
  });
  // Discovered minus indexed, over the same public surfaces the pass itself
  // keys on, so the expectation cannot drift from a private helper's shape.
  const indexed_files = project.get_file_contents();
  const discovered = await find_source_files(tmpdir, tmpdir, []);
  const residue = new Set([
    ...discovered.filter((f) => !indexed_files.has(f)),
    ...dropped_files,
  ]);
  return {
    indexed: result.indexed_files.map((f) => path.relative(tmpdir, f)).sort(),
    entry_points: result.entry_points,
    out_of_index: [...residue].map((f) => path.relative(tmpdir, f)).sort(),
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

    expect(detect_side.scope).toEqual(prepare_side);
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

    expect(detect_side.scope.max_files).toEqual(DEFAULT_MAX_FILES);
    expect(prepare_side.max_files).toEqual(DEFAULT_MAX_FILES);
  });

  it("reaches the same corpus and the same candidate gate from one config", async () => {
    // Reader agreement is not corpus agreement: two phases can parse the same
    // config and still index different files if either applies it differently.
    // This asserts the thing that matters — same file set, same entry points —
    // over a config that exercises both axes at once.
    await write("src/app.py", "def handler():\n    return 1\n");
    await write("src/helper.py", "def helper():\n    return 2\n");
    // The test file defines a callable of its own, so `include_tests` changes
    // the entry-point set and not merely the file set — without it the
    // candidate-gate half of this assertion would hold vacuously.
    await write(
      "tests/test_app.py",
      "from src.app import handler\n\ndef test_handler():\n    return handler()\n",
    );
    await write("docs/conf.py", "def build_docs():\n    return 3\n");

    const config_path = path.join(tmpdir, "both-axes.json");
    await fs.writeFile(
      config_path,
      JSON.stringify({
        project_path: tmpdir,
        project_name: "fixture",
        exclude: ["docs"],
        include_tests: true,
      }),
      "utf8",
    );

    const config = await load_project_config(config_path);
    const detect_side = await analyze_directory(tmpdir, config.scope);

    const prepare_scope = load_analysis_scope(config_path);
    const { project } = await load_project({
      project_path: tmpdir,
      folders: prepare_scope.folders,
      exclude: [...IGNORED_DIRECTORIES, ...prepare_scope.exclude],
      max_files: prepare_scope.max_files,
    });
    const prepare_call_graph = trace_call_graph(
      project.definitions,
      project.resolutions,
      project.get_languages(),
      { include_tests: prepare_scope.include_tests },
    );

    expect(detect_side.indexed_files.map((f) => path.relative(tmpdir, f)).sort()).toEqual(
      [...project.get_file_contents().keys()].map((f) => path.relative(tmpdir, f)).sort(),
    );
    expect(entry_point_names(detect_side.entry_points)).toEqual(
      prepare_call_graph.entry_points
        .map((id) => prepare_call_graph.nodes.get(id)?.name as string)
        .sort(),
    );
    // Non-vacuous: the excluded tree is genuinely out and the test tree is
    // genuinely in, so this would fail if either phase indexed nothing.
    expect(detect_side.indexed_files.map((f) => path.relative(tmpdir, f)).sort()).toEqual([
      "src/app.py",
      "src/helper.py",
      "tests/test_app.py",
    ]);
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
    // The compensation reaches it: the out-of-index walk carries gitignore
    // patterns only, so the very files a config `exclude` held out are the
    // residue it greps. The entry says so rather than reading as uncalled.
    expect(analysis.out_of_index).toEqual(["tests/queries/test_query.py"]);
    const adapt_value = analysis.entry_points.find((e) => e.name === "adapt_value");
    if (adapt_value === undefined) throw new Error("expected adapt_value");
    expect(adapt_value.diagnostics.diagnosis).toEqual("callers-outside-indexed-corpus");
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

describe("complete_caller_evidence", () => {
  it("attaches a caller that a folder scope held out of the corpus", async () => {
    await write("src/foo.ts", "export function foo() {}\n");
    await write("tests/foo.test.ts", "import { foo } from '../src/foo.js';\nfoo();\n");

    const analysis = await analyze({ folders: ["src"] });
    const entry = analysis.entry_points.find((e) => e.name === "foo");
    if (entry === undefined) throw new Error("expected an entry point named foo");

    expect(entry.diagnostics.grep_call_sites_outside_index.map((h) => h.content)).toEqual([
      "foo();",
    ]);
    expect(entry.diagnostics.diagnosis).toEqual("callers-outside-indexed-corpus");
  });

  it("does not read a comment in a held-out file as a caller", async () => {
    await write("src/foo.ts", "export function foo() {}\n");
    await write("tests/foo.test.ts", "// cover foo() one day\n");

    const analysis = await analyze({ folders: ["src"] });
    const entry = analysis.entry_points.find((e) => e.name === "foo");
    if (entry === undefined) throw new Error("expected an entry point named foo");

    expect(entry.diagnostics.grep_call_sites_outside_index).toEqual([]);
    expect(entry.diagnostics.diagnosis).toEqual("no-textual-callers");
  });

  it("greps constructors by class name, not by the constructor symbol's own name", async () => {
    await write("src/foo.ts", "export class Foo {\n  constructor() {}\n}\n");
    await write("tests/foo.test.ts", "new Foo();\n");

    const analysis = await analyze({ folders: ["src"] });
    const entry = analysis.entry_points.find((e) => e.kind === "constructor");
    if (entry === undefined) throw new Error("expected a constructor entry point");

    expect(entry.diagnostics.grep_call_sites_outside_index.map((h) => h.content)).toEqual([
      "new Foo();",
    ]);
  });
});

describe("a GitHub project id keeps both halves of the slug", () => {
  it("qualifies the repo name with its owner", () => {
    expect(github_repo_to_project_id("webpack/webpack")).toEqual("webpack--webpack");
    expect(github_repo_to_project_id("pandas-dev/pandas")).toEqual("pandas-dev--pandas");
  });

  it("separates two repos that share a name under different owners", () => {
    expect(github_repo_to_project_id("vuejs/core")).toEqual("vuejs--core");
    expect(github_repo_to_project_id("home-assistant/core")).toEqual("home-assistant--core");
  });

  it("derives one id from every accepted spelling of the same repo", () => {
    const spellings = [
      "vuejs/core",
      "https://github.com/vuejs/core",
      "https://github.com/vuejs/core.git",
      "git@github.com:vuejs/core",
      "git@github.com:vuejs/core.git",
    ];
    expect(spellings.map(github_repo_to_project_id)).toEqual([
      "vuejs--core",
      "vuejs--core",
      "vuejs--core",
      "vuejs--core",
      "vuejs--core",
    ]);
  });

  it("recovers the clone URL from the id, keeping a double hyphen inside the repo name", () => {
    expect(github_url_from_project_id("vuejs--core")).toEqual("https://github.com/vuejs/core.git");
    expect(github_url_from_project_id("owner--my--repo")).toEqual(
      "https://github.com/owner/my--repo.git",
    );
  });

  it("rejects a clone name that is not owner-qualified", () => {
    expect(() => github_url_from_project_id("core")).toThrow(
      "core is not an <owner>--<repo> clone name",
    );
  });
});

describe("a repos/ clone is put at the commit the run recorded", () => {
  let upstream_dir: string;
  let upstream: { url: string; older: string; newer: string };
  let clone_dir: string;

  beforeAll(async () => {
    upstream_dir = await fs.mkdtemp(path.join(os.tmpdir(), "detect-entrypoints-upstream-"));
    upstream = await make_upstream(upstream_dir);
  });

  afterAll(async () => {
    await fs.rm(upstream_dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    clone_dir = path.join(STORE, "repos", "owner--repo");
  });

  const checkout_at = (commit: string | null, remote_url = upstream.url) =>
    ensure_corpus_checkout({ clone_dir, remote_url, commit, depth: 1 });

  const source_in_clone = () => fs.readFile(path.join(clone_dir, "app.py"), "utf8");

  it("creates an absent clone at the requested sha", async () => {
    const checkout = await checkout_at(upstream.older);

    expect(checkout).toEqual({ local_path: clone_dir, commit_hash: upstream.older });
    expect(git(["rev-parse", "HEAD"], clone_dir)).toEqual(upstream.older);
    expect(await source_in_clone()).toEqual(OLDER_SOURCE);
  });

  it("takes upstream HEAD only when no commit is named", async () => {
    const checkout = await checkout_at(null);

    expect(checkout).toEqual({ local_path: clone_dir, commit_hash: upstream.newer });
    expect(await source_in_clone()).toEqual(NEWER_SOURCE);
  });

  it("moves an existing clone at another commit to the requested sha", async () => {
    await checkout_at(upstream.newer);

    const checkout = await checkout_at(upstream.older);

    expect(checkout).toEqual({ local_path: clone_dir, commit_hash: upstream.older });
    expect(git(["rev-parse", "HEAD"], clone_dir)).toEqual(upstream.older);
    expect(await source_in_clone()).toEqual(OLDER_SOURCE);
  });

  it("leaves a clone already at the requested sha untouched", async () => {
    await checkout_at(upstream.older);
    // A clone pinned by hand holds the sha on a branch; reuse is decided on
    // HEAD's commit, not on how HEAD names it. The edits and the unreachable
    // origin make any checkout or fetch on this path visible.
    git(["checkout", "--quiet", "-b", "pinned"], clone_dir);
    git(["remote", "set-url", "origin", path.join(tmpdir, "nowhere.git")], clone_dir);
    const edited = "def handler():\n    return 'edited'\n";
    await fs.writeFile(path.join(clone_dir, "app.py"), edited, "utf8");
    await fs.writeFile(path.join(clone_dir, "scratch.txt"), "kept", "utf8");

    const checkout = await checkout_at(upstream.older);

    expect(checkout).toEqual({ local_path: clone_dir, commit_hash: upstream.older });
    expect(git(["rev-parse", "--abbrev-ref", "HEAD"], clone_dir)).toEqual("pinned");
    expect(await source_in_clone()).toEqual(edited);
    expect(await fs.readFile(path.join(clone_dir, "scratch.txt"), "utf8")).toEqual("kept");
  });

  it("refuses a sha the remote does not serve, and the next attempt is not confused by what it left", async () => {
    const missing = "0123456789abcdef0123456789abcdef01234567";

    await expect(checkout_at(missing)).rejects.toThrow(missing);

    const checkout = await checkout_at(upstream.older);
    expect(checkout).toEqual({ local_path: clone_dir, commit_hash: upstream.older });
  });

  it("exits non-zero and writes no dump when a config's run commit cannot be fetched", async () => {
    await checkout_at(upstream.newer);
    const config_path = path.join(tmpdir, "owner--repo.json");
    await fs.writeFile(config_path, JSON.stringify({ project_path: clone_dir }), "utf8");
    const missing = "0123456789abcdef0123456789abcdef01234567";

    const run = run_detect(["--config", config_path, "--commit", missing]);

    expect(run.status).toEqual(1);
    expect(run.stderr).toContain(missing);
    expect(git(["rev-parse", "HEAD"], clone_dir)).toEqual(upstream.newer);
    expect(await fs.readdir(STORE)).toEqual(["repos"]);
  }, 60_000);
});

describe("the commit a project's runs recorded", () => {
  it("is the newest run's by creation time, not the run id that sorts last", async () => {
    await seed_manifest(
      "owner--repo",
      "bbbbbbb-2026-06-01T00-00-00.000Z",
      "2026-06-01T00:00:00.000Z",
      "b".repeat(40),
    );
    await seed_manifest(
      "owner--repo",
      "aaaaaaa-2026-07-01T00-00-00.000Z",
      "2026-07-01T00:00:00.000Z",
      "a".repeat(40),
    );

    expect(await recorded_run_commit("owner--repo")).toEqual("a".repeat(40));
  });

  it("is null for a project with no run, and for runs that recorded no commit", async () => {
    expect(await recorded_run_commit("owner--repo")).toEqual(null);

    await seed_manifest(
      "owner--repo",
      "nogit-2026-07-01T00-00-00.000Z",
      "2026-07-01T00:00:00.000Z",
      null,
    );

    expect(await recorded_run_commit("owner--repo")).toEqual(null);
  });
});

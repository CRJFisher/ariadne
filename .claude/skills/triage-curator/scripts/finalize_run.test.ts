import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ast_check_authored_files,
  finalize_run,
  partition_orphan_paths,
} from "./finalize_run.js";
import {
  mark_finalize_started,
  save_outcome,
} from "../src/store/curation_outcome.js";
import type { CuratedRunEntry, TriageResultsFile } from "../src/types.js";

let tmp_root: string;
let runs_dir: string;
let analysis_output_dir: string;
let registry_path: string;
let builtins_dir: string;

const PROJECT = "fixture-proj";
const RUN_ID = "abc1234-2026-05-26T00-00-00.000Z";

function triage_results(): TriageResultsFile {
  return {
    schema_version: 5,
    project_path: "/fake/project",
    commit_hash: "deadbeef",
    novel_issues: [],
    classifier_regressions: [],
    confirmed_unreachable: [],
    uncertain: [],
    last_updated: "2026-05-26T00:00:00.000Z",
  };
}

async function seed_triage_run(triage: TriageResultsFile = triage_results()): Promise<string> {
  const tr_dir = path.join(analysis_output_dir, PROJECT, "triage_results");
  await fs.mkdir(tr_dir, { recursive: true });
  const run_path = path.join(tr_dir, `${RUN_ID}.json`);
  await fs.writeFile(run_path, JSON.stringify(triage, null, 2) + "\n", "utf8");
  return run_path;
}

async function seed_registry(): Promise<void> {
  await fs.writeFile(
    registry_path,
    JSON.stringify({ schema_version: 1, rules: [] }, null, 2) + "\n",
    "utf8",
  );
}

async function write_investigate_response(
  run_id: string,
  group_id: string,
  body: Record<string, unknown>,
): Promise<void> {
  const dir = path.join(runs_dir, run_id, "investigate");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${group_id}.json`),
    JSON.stringify(body, null, 2),
    "utf8",
  );
}

beforeEach(async () => {
  tmp_root = await fs.mkdtemp(path.join(os.tmpdir(), "finalize-run-"));
  runs_dir = path.join(tmp_root, "runs");
  analysis_output_dir = path.join(tmp_root, "analysis_output");
  registry_path = path.join(tmp_root, "registry.json");
  builtins_dir = path.join(tmp_root, "builtins");
  await fs.mkdir(builtins_dir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmp_root, { recursive: true, force: true });
});

describe("finalize_run — sentinel guard (exit code 2)", () => {
  it("refuses to re-apply when finalized.json sentinel exists", async () => {
    const run_path = await seed_triage_run();
    await seed_registry();
    const outcome: CuratedRunEntry = {
      run_id: RUN_ID,
      project: PROJECT,
      run_path,
      curated_at: "2026-05-26T00:00:00.000Z",
      outcome: {
        investigated_groups: 0,
        classifiers_proposed: 0,
        signal_library_gap_tasks: [],
        ariadne_bug_tasks: [],
        success_count: 0,
        failure_count: 0,
        blocked_count: 0,
        failed_groups: [],
      },
    };
    await save_outcome(outcome, runs_dir);

    const result = await finalize_run({
      run_path,
      dry_run: false,
      runs_dir,
      registry_path,
      builtins_dir,
      regenerate_derived_files: async () => [],
    });
    expect(result.exit_code).toBe(2);
    expect(result.summary).toBeNull();
    expect(result.stderr_message).toMatch(/already has a sentinel/);
  });

  it("refuses to re-apply when only the in-progress marker exists (crash-replay safety)", async () => {
    const run_path = await seed_triage_run();
    await seed_registry();
    await mark_finalize_started(RUN_ID, run_path, runs_dir);

    const result = await finalize_run({
      run_path,
      dry_run: false,
      runs_dir,
      registry_path,
      builtins_dir,
      regenerate_derived_files: async () => [],
    });
    expect(result.exit_code).toBe(2);
    expect(result.summary).toBeNull();
    expect(result.stderr_message).toMatch(/already has a sentinel/);
  });

  it("does NOT short-circuit on dry_run even if a sentinel exists", async () => {
    const run_path = await seed_triage_run();
    await seed_registry();
    await mark_finalize_started(RUN_ID, run_path, runs_dir);

    const result = await finalize_run({
      run_path,
      dry_run: true,
      runs_dir,
      registry_path,
      builtins_dir,
      regenerate_derived_files: async () => [],
    });
    expect(result.exit_code).toBe(0);
    expect(result.summary).not.toBeNull();
    expect(result.summary?.dry_run).toBe(true);
  });
});

describe("finalize_run — validate_run_coherence failure (exit code 3)", () => {
  it("refuses to apply proposals when two responses claim the same classifier target", async () => {
    const run_path = await seed_triage_run();
    await seed_registry();

    // Two responses targeting the same classifier file via retargets_to.
    const make_response = (group_id: string): Record<string, unknown> => ({
      group_id,
      reasoning: "",
      proposed_classifier: {
        kind: "builtin",
        function_name: "check_shared",
        min_confidence: 0.9,
      },
      classifier_spec: {
        function_name: "check_shared",
        min_confidence: 0.9,
        combinator: "all",
        checks: [{ op: "language_eq", value: "typescript" }],
        positive_examples: [],
        negative_examples: [],
        description: "",
      },
      retargets_to: "shared-target",
      signal_library_gap: null,
      ariadne_bug: {
        root_cause_category: "other",
        title: "x",
        description: "",
        existing_task_id: null,
      },
      rejected_members: [],
    });
    await write_investigate_response(RUN_ID, "group-a", make_response("group-a"));
    await write_investigate_response(RUN_ID, "group-b", make_response("group-b"));

    const result = await finalize_run({
      run_path,
      dry_run: false,
      runs_dir,
      registry_path,
      builtins_dir,
      regenerate_derived_files: async () => [],
    });
    expect(result.exit_code).toBe(3);
    expect(result.summary).toBeNull();
    expect(result.stderr_message).toMatch(/cross-response coherence violation/);
    expect(result.stderr_message).toMatch(/shared-target/);

    // The registry must be untouched (the guard runs BEFORE any mutation).
    const raw = await fs.readFile(registry_path, "utf8");
    const parsed = JSON.parse(raw) as { rules: unknown[] };
    expect(parsed.rules).toEqual([]);
  });
});

describe("finalize_run — triage-results read failure (exit code 4)", () => {
  it("returns exit 4 with a clear error when the run file is missing", async () => {
    const result = await finalize_run({
      run_path: path.join(analysis_output_dir, PROJECT, "triage_results", "deadbee-2026-05-26T00-00-00.000Z.json"),
      dry_run: false,
      runs_dir,
      registry_path,
      builtins_dir,
      regenerate_derived_files: async () => [],
    });
    expect(result.exit_code).toBe(4);
    expect(result.summary).toBeNull();
    expect(result.stderr_message).toMatch(/finalize_run:/);
  });

  it("returns exit 4 when schema_version does not match", async () => {
    const tr_dir = path.join(analysis_output_dir, PROJECT, "triage_results");
    await fs.mkdir(tr_dir, { recursive: true });
    const run_path = path.join(tr_dir, "feedf00-2026-05-26T00-00-00.000Z.json");
    await fs.writeFile(
      run_path,
      JSON.stringify({ schema_version: 3, novel_issues: [] }),
      "utf8",
    );

    const result = await finalize_run({
      run_path,
      dry_run: false,
      runs_dir,
      registry_path,
      builtins_dir,
      regenerate_derived_files: async () => [],
    });
    expect(result.exit_code).toBe(4);
    expect(result.stderr_message).toMatch(/schema_version=3/);
  });
});

describe("partition_orphan_paths — orphan-cleanup safety", () => {
  it("refuses paths that escape the builtins directory", () => {
    const builtins = "/safe/builtins";
    const { safe_paths, refused_paths } = partition_orphan_paths(
      [
        "/safe/builtins/check_a.ts",
        "/etc/passwd",
        "/safe/builtins/../../escape.ts",
        "/safe/other/check_b.ts",
      ],
      builtins,
    );
    expect(safe_paths).toEqual([path.resolve("/safe/builtins/check_a.ts")]);
    expect(refused_paths.sort()).toEqual(
      [
        "/etc/passwd",
        "/safe/builtins/../../escape.ts",
        "/safe/other/check_b.ts",
      ].sort(),
    );
  });

  it("refuses paths whose basename is not check_*.ts", () => {
    const builtins = "/safe/builtins";
    const { safe_paths, refused_paths } = partition_orphan_paths(
      [
        "/safe/builtins/check_ok.ts",
        "/safe/builtins/index.ts",
        "/safe/builtins/check_wrong.js",
        "/safe/builtins/not_a_check.ts",
      ],
      builtins,
    );
    expect(safe_paths).toEqual([path.resolve("/safe/builtins/check_ok.ts")]);
    expect(refused_paths.sort()).toEqual(
      [
        "/safe/builtins/index.ts",
        "/safe/builtins/check_wrong.js",
        "/safe/builtins/not_a_check.ts",
      ].sort(),
    );
  });
});

describe("ast_check_authored_files — bad output surfaces as failed authoring", () => {
  it("flags files with syntax errors and excludes them from passing", async () => {
    const good_path = path.join(builtins_dir, "check_good.ts");
    const bad_path = path.join(builtins_dir, "check_bad.ts");
    await fs.writeFile(good_path, "export const x = 1;\n", "utf8");
    await fs.writeFile(bad_path, "export const x = ;;;\n", "utf8");

    const result = await ast_check_authored_files({
      "good-group": good_path,
      "bad-group": bad_path,
    });
    expect(Object.keys(result.passing)).toEqual(["good-group"]);
    expect(result.ast_failures).toHaveLength(1);
    expect(result.ast_failures[0].group_id).toBe("bad-group");
    expect(result.ast_failures[0].reason).toMatch(/syntactic diagnostics/);
  });

  it("flags unreadable files as ast_failures", async () => {
    const missing_path = path.join(builtins_dir, "check_missing.ts");
    const result = await ast_check_authored_files({ "missing-group": missing_path });
    expect(result.passing).toEqual({});
    expect(result.ast_failures).toHaveLength(1);
    expect(result.ast_failures[0].reason).toMatch(/unreadable/);
  });
});

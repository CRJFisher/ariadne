/**
 * Fixture integration tests for finalizing a run.
 *
 * The first stages a tmp run directory with a mixed set of investigator
 * verdicts (one each of `tp`, `fp-novel` ×2, `fp-classifier-regression`,
 * `uncertain`) plus an auto-classified registry entry, runs the load+build
 * pipeline `finalize_run` uses, and asserts the published v5 `triage_results`
 * payload exactly. Both `novel_issues[]` and `classifier_regressions[]` are
 * derived from the verdict files — no `novel_issues.json` /
 * `classifier_regressions.jsonl` exists in the run dir. The second runs
 * `finalize_run` itself against a store, sealing the manifest.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { build_finalization_output } from "./output.js";
import type { TriageResultsFile } from "@ariadnejs/skill-protocol";
import { load_verdicts_by_entry_index } from "./verdict_ledger.js";
import { finalize_run } from "./finalize_run.js";
import type {
  EntryPointDiagnostics,
  FilePath,
  SyntacticFeatures,
} from "@ariadnejs/types";
import type {
  RunManifest,
  TriageEntry,
  TriageState,
} from "../triage_state_types.js";
import type { TriageVerdict } from "../verdict/triage_verdict.js";

// Set before `paths.js` reads it at import.
const STORE = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-finalize-${process.pid}`;
  process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE = dir;
  return dir;
});

const PROJECT_PATH = "/projects/sample";

const BASE_SYNTACTIC_FEATURES: SyntacticFeatures = {
  is_new_expression: false,
  is_super_call: false,
  is_optional_chain: false,
  is_awaited: false,
  is_callback_arg: false,
  is_dynamic_dispatch: false,
};

function make_entry(over: Partial<TriageEntry>): TriageEntry {
  const base: TriageEntry = {
    entry_index: 0,
    name: "fn",
    file_path: `${PROJECT_PATH}/src/fn.ts`,
    start_line: 1,
    kind: "function",
    signature: null,
    route: "llm-triage",
    diagnosis: "no-textual-callers",
    known_source: null,
    status: "completed",
    result: null,
    error: null,
    is_exported: true,
    access_modifier: null,
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_outside_index: [],
      reference_sites: [],
      has_uncaptured_indexed_grep_hit: false,
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
    },
    auto_classified: false,
    classifier_hints: [],
    tp_source_run_id: null,
    tp_stability_sample: false,
    retry_count: 0,
  };
  return { ...base, ...over };
}

const NOVEL_DIAGNOSTICS: EntryPointDiagnostics = {
  grep_call_sites: [],
  grep_call_sites_outside_index: [],
  reference_sites: [],
  has_uncaptured_indexed_grep_hit: false,
  ariadne_call_refs: [
    {
      caller_function: "register_routes",
      caller_file: "src/app.ts" as FilePath,
      call_line: 12,
      call_type: "method",
      resolution_count: 0,
      resolved_to: [],
      receiver_kind: "identifier",
      resolution_failure: { stage: "method_lookup", reason: "method_not_on_type", partial_info: {} },
      syntactic_features: BASE_SYNTACTIC_FEATURES,
    },
  ],
  diagnosis: "callers-in-registry-unresolved",
};

let run_dir: string;

beforeEach(async () => {
  run_dir = await fs.mkdtemp(path.join(os.tmpdir(), "finalize-triage-fixture-"));
  await fs.mkdir(path.join(run_dir, "results"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(run_dir, { recursive: true, force: true });
});

async function write_verdict(entry_index: number, verdict: TriageVerdict): Promise<void> {
  await fs.writeFile(
    path.join(run_dir, "results", `${entry_index}.json`),
    JSON.stringify(verdict),
    "utf8",
  );
}

describe("finalize_run", () => {
  const project = "sample";
  const run_id = "abc1234-2026-10-26T00-00-00.000Z";
  const store_run_dir = path.join(STORE, "triage_state", project, "runs", run_id);

  beforeEach(async () => {
    await fs.rm(STORE, { recursive: true, force: true });
    await fs.mkdir(path.join(store_run_dir, "results"), { recursive: true });
    const manifest: RunManifest = {
      schema_version: 1,
      run_id,
      project_name: project,
      project_path: PROJECT_PATH,
      created_at: "2026-10-26T00:00:00.000Z",
      finalized_at: null,
      status: "active",
      source_analysis_path: "/analysis.json",
      source_analysis_run_id: "analysis",
      max_count: 250,
      commit_hash: "abc1234",
      tp_cache: { enabled: false, source_run_id: null, skipped_count: 0, skipped_entry_keys: [], stability: null },
    };
    await fs.writeFile(path.join(store_run_dir, "manifest.json"), JSON.stringify(manifest));
    await fs.writeFile(path.join(STORE, "triage_state", project, "LATEST"), `${run_id}\n`);
  });

  afterEach(async () => {
    await fs.rm(STORE, { recursive: true, force: true });
  });

  async function write_state(phase: TriageState["phase"]): Promise<void> {
    const state: TriageState = {
      project_name: project,
      project_path: PROJECT_PATH,
      phase,
      entries: [make_entry({ entry_index: 0 }), make_entry({ entry_index: 1, status: "failed", error: "no verdict" })],
      created_at: "2026-10-26T00:00:00.000Z",
      updated_at: "2026-10-26T00:00:00.000Z",
    };
    await fs.writeFile(path.join(store_run_dir, "triage.json"), JSON.stringify(state));
  }

  it("publishes the results, seals the manifest and clears LATEST", async () => {
    await write_state("complete");
    const verdict: TriageVerdict = { kind: "tp", member_evidence: { file: "src/fn.ts", line: 1, why: "no callers" } };
    await fs.writeFile(path.join(store_run_dir, "results", "0.json"), JSON.stringify(verdict));

    const finalized = await finalize_run(project, run_id);

    expect(finalized.output_file).toEqual(path.join(STORE, "analysis_output", project, "triage_results", `${run_id}.json`));
    expect(finalized.summary).toEqual({
      total_entries: 2,
      confirmed_unreachable_count: 1,
      novel_issue_count: 0,
      classifier_regression_rule_count: 0,
      classifier_regression_entry_count: 0,
      uncertain_count: 0,
      failed_count: 1,
    });
    const manifest = JSON.parse(await fs.readFile(path.join(store_run_dir, "manifest.json"), "utf8")) as RunManifest;
    expect(manifest.status).toEqual("finalized");
    await expect(fs.access(path.join(STORE, "triage_state", project, "LATEST"))).rejects.toThrow();
  });

  it("refuses a run that has not drained", async () => {
    await write_state("triage");
    await expect(finalize_run(project, run_id)).rejects.toThrow(`run ${run_id} is in phase "triage"; it finalizes only once complete`);
  });
});

describe("build_finalization_output (fixture integration)", () => {
  it("publishes the exact v5 envelope, deriving novel_issues and classifier_regressions from the verdict files", async () => {
    // ===== Triage state =====
    const state: TriageState = {
      project_name: "sample",
      project_path: PROJECT_PATH,
      phase: "complete",
      entries: [
        // Auto-classified registry hit.
        make_entry({
          entry_index: 0,
          name: "auto_classified_handler",
          file_path: `${PROJECT_PATH}/src/auto.ts`,
          start_line: 7,
          route: "known-unreachable",
          known_source: "registry:rule-x",
          auto_classified: true,
        }),
        // LLM-confirmed TP.
        make_entry({
          entry_index: 1,
          name: "lonely_main",
          file_path: `${PROJECT_PATH}/src/lonely.ts`,
          start_line: 3,
          signature: "function lonely_main(): void",
        }),
        // Investigator emitted fp-novel; entry carries a resolution failure.
        make_entry({
          entry_index: 2,
          name: "novel_fp",
          file_path: `${PROJECT_PATH}/src/novel.ts`,
          start_line: 10,
          diagnostics: NOVEL_DIAGNOSTICS,
        }),
        // Investigator emitted fp-novel; entry has no failing call ref.
        make_entry({
          entry_index: 3,
          name: "novel_fp_2",
          file_path: `${PROJECT_PATH}/src/novel2.ts`,
          start_line: 20,
        }),
        // Investigator emitted fp-classifier-regression.
        make_entry({
          entry_index: 4,
          name: "drifty",
          file_path: `${PROJECT_PATH}/src/drifty.ts`,
          start_line: 30,
        }),
        // Investigator emitted uncertain.
        make_entry({
          entry_index: 5,
          name: "ambiguous",
          file_path: `${PROJECT_PATH}/src/ambig.ts`,
          start_line: 40,
        }),
      ],
      created_at: "2026-05-20T00:00:00.000Z",
      updated_at: "2026-05-20T01:00:00.000Z",
    };

    // ===== Per-entry result files (the single source of truth) =====
    await write_verdict(1, {
      kind: "tp",
      member_evidence: { file: "src/lonely.ts", line: 3, why: "no callers" },
    });
    await write_verdict(2, {
      kind: "fp-novel",
      proposed_root_cause: "decorator-route registration",
      evidence_excerpt: "@route('/novel')",
      member_evidence: { file: "src/novel.ts", line: 10, why: "registered via decorator" },
    });
    await write_verdict(3, {
      kind: "fp-novel",
      proposed_root_cause: "callback registration missed",
      evidence_excerpt: "emitter.on('x', novel_fp_2)",
      member_evidence: { file: "src/novel2.ts", line: 20, why: "registered via emitter" },
    });
    await write_verdict(4, {
      kind: "fp-classifier-regression",
      should_have_matched_rule_id: "framework-loader",
      evidence_excerpt: "loader.register(handler)",
      member_evidence: { file: "src/drifty.ts", line: 30, why: "loader entry missed" },
    });
    await write_verdict(5, {
      kind: "uncertain",
      reason: "compounding gaps between resolver and import",
      member_evidence: { file: "src/ambig.ts", line: 40, why: "two plausible paths" },
    });

    // ===== Drive the same load+build path finalize_run uses =====
    const verdicts_by_entry_index = await load_verdicts_by_entry_index(
      path.join(run_dir, "results"),
    );

    const output = build_finalization_output(state, {
      commit_hash: "deadbeefcafebabe",
      project_path: PROJECT_PATH,
      sources: {
        verdicts_by_entry_index,
      },
    });

    // ===== Exact assertion against a typed literal =====
    const expected: TriageResultsFile = {
      schema_version: 5,
      project_path: PROJECT_PATH,
      commit_hash: "deadbeefcafebabe",
      novel_issues: [
        {
          id: "novel-2",
          entry_index: 2,
          member_symbol: { file_path: "src/novel.ts", name: "novel_fp", kind: "function", start_line: 10 },
          member_evidence: { file: "src/novel.ts", line: 10, why: "registered via decorator" },
          proposed_root_cause: "decorator-route registration",
          evidence_excerpt: "@route('/novel')",
          diagnosis: "callers-in-registry-unresolved",
          resolution_failure: { stage: "method_lookup", reason: "method_not_on_type" },
          receiver_kind: "identifier",
          has_uncaptured_indexed_grep_hit: false,
        },
        {
          id: "novel-3",
          entry_index: 3,
          member_symbol: { file_path: "src/novel2.ts", name: "novel_fp_2", kind: "function", start_line: 20 },
          member_evidence: { file: "src/novel2.ts", line: 20, why: "registered via emitter" },
          proposed_root_cause: "callback registration missed",
          evidence_excerpt: "emitter.on('x', novel_fp_2)",
          diagnosis: "no-textual-callers",
          has_uncaptured_indexed_grep_hit: false,
        },
      ],
      classifier_regressions: [
        {
          rule_id: "framework-loader",
          flagged_entries: [
            { entry_index: 4, evidence_excerpt: "loader.register(handler)" },
          ],
        },
      ],
      confirmed_unreachable: [
        {
          entry_index: 0,
          name: "auto_classified_handler",
          file_path: "src/auto.ts",
          start_line: 7,
          kind: "function",
          source: { kind: "registry", group_id: "rule-x" },
          member_evidence: null,
        },
        {
          entry_index: 1,
          name: "lonely_main",
          file_path: "src/lonely.ts",
          start_line: 3,
          kind: "function",
          signature: "function lonely_main(): void",
          source: { kind: "llm-tp" },
          member_evidence: { file: "src/lonely.ts", line: 3, why: "no callers" },
        },
      ],
      uncertain: [
        {
          entry_index: 5,
          name: "ambiguous",
          file_path: "src/ambig.ts",
          start_line: 40,
          kind: "function",
          reason: "compounding gaps between resolver and import",
          member_evidence: { file: "src/ambig.ts", line: 40, why: "two plausible paths" },
        },
      ],
      last_updated: "2026-05-20T01:00:00.000Z",
    };
    expect(output).toEqual(expected);

    // No in-run absorb files are written under the run dir.
    const run_files = await fs.readdir(run_dir);
    expect(run_files.includes("novel_issues.json")).toBe(false);
    expect(run_files.includes("classifier_regressions.jsonl")).toBe(false);
    expect(run_files.includes("coordinator_log.jsonl")).toBe(false);
  });
});

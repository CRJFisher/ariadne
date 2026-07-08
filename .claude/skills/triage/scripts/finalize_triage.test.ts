/**
 * Fixture integration test for `finalize_triage`.
 *
 * Stages a tmp run directory with a mixed set of investigator verdicts (one
 * each of `tp`, `fp-novel` ×2, `fp-classifier-regression`, `uncertain`) plus an
 * auto-classified registry entry, then runs the same load+build pipeline that
 * `finalize_triage.ts` exercises and asserts the published v5 `triage_results`
 * payload exactly via `toEqual`. Both `novel_issues[]` and
 * `classifier_regressions[]` are derived from the verdict files — no
 * `novel_issues.json` / `classifier_regressions.jsonl` exists in the run dir.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { build_finalization_output } from "../src/finalize/output.js";
import type { TriageResultsFile } from "@ariadnejs/skill-protocol";
import { load_verdicts_by_entry_index } from "../src/finalize/verdict_ledger.js";
import type {
  EntryPointDiagnostics,
  FilePath,
  SyntacticFeatures,
} from "@ariadnejs/types";
import type {
  TriageEntry,
  TriageState,
} from "../src/triage_state_types.js";
import type { TriageVerdict } from "../src/verdict/triage_verdict.js";

const PROJECT_PATH = "/projects/sample";

const BASE_SYNTACTIC_FEATURES: SyntacticFeatures = {
  is_new_expression: false,
  is_super_call: false,
  is_optional_chain: false,
  is_awaited: false,
  is_callback_arg: false,
  is_inside_try: false,
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
      grep_call_sites_unindexed_tests: [],
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
    },
    auto_classified: false,
    classifier_hints: [],
    tp_source_run_id: null,
    retry_count: 0,
  };
  return { ...base, ...over };
}

const NOVEL_DIAGNOSTICS: EntryPointDiagnostics = {
  grep_call_sites: [],
  grep_call_sites_unindexed_tests: [],
  has_uncaptured_indexed_grep_hit: false,
  callers_only_in_unindexed_tests: false,
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

describe("finalize_triage (fixture integration)", () => {
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

    // ===== Drive the same load+build path finalize_triage.ts uses =====
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
          callers_only_in_unindexed_tests: false,
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
          callers_only_in_unindexed_tests: false,
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

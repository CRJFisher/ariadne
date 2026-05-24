/**
 * Fixture integration test for `finalize_triage`.
 *
 * Stages a tmp run directory with a mixed set of investigator verdicts (one
 * each of `tp`, `fp-novel-new`, `fp-novel-cited`, `fp-classifier-regression`,
 * `uncertain`) plus an auto-classified registry entry, then runs the same
 * load+build pipeline that `finalize_triage.ts` exercises and asserts the
 * published v4 `triage_results` payload exactly via `toEqual`.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  build_finalization_output,
  load_verdicts_by_entry_index,
  type FinalizationOutput,
} from "../src/build_finalization_output.js";
import {
  aggregate_classifier_regressions,
  read_classifier_regression_records,
} from "../src/classifier_regressions.js";
import { read_novel_issues, write_novel_issues } from "../src/novel_issues.js";
import type {
  TriageEntry,
  TriageState,
} from "../src/triage_state_types.js";
import type { TriageVerdict } from "../src/triage_verdict.js";

const PROJECT_PATH = "/projects/sample";

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
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
    },
    auto_classified: false,
    classifier_hints: [],
    tp_source_run_id: null,
  };
  return { ...base, ...over };
}

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
  it("publishes the exact v4 envelope for a mixed-verdict run", async () => {
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
        // Investigator emitted fp-novel-new.
        make_entry({
          entry_index: 2,
          name: "novel_fp",
          file_path: `${PROJECT_PATH}/src/novel.ts`,
          start_line: 10,
        }),
        // Investigator emitted fp-novel-cited.
        make_entry({
          entry_index: 3,
          name: "cited_fp",
          file_path: `${PROJECT_PATH}/src/cited.ts`,
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

    // ===== Per-entry result files =====
    await write_verdict(1, {
      kind: "tp",
      member_evidence: { file: "src/lonely.ts", line: 3, why: "no callers" },
    });
    await write_verdict(2, {
      kind: "fp-novel-new",
      proposed_root_cause: "decorator-route registration",
      evidence_excerpt: "@route('/novel')",
      member_evidence: { file: "src/novel.ts", line: 10, why: "registered via decorator" },
    });
    await write_verdict(3, {
      kind: "fp-novel-cited",
      novel_issue_id: "decorator-route-registration",
      evidence_excerpt: "@route('/cited')",
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

    // ===== novel_issues.json =====
    await write_novel_issues(path.join(run_dir, "novel_issues.json"), {
      issues: [
        {
          id: "decorator-route-registration",
          canonical_name: "Decorator route registration",
          root_cause: "Handlers reached only via @route decorator",
          citations: [
            { entry_index: 2, evidence_excerpt: "@route('/novel')" },
            { entry_index: 3, evidence_excerpt: "@route('/cited')" },
          ],
        },
      ],
      flagged: [],
    });

    // ===== classifier_regressions.jsonl =====
    await fs.writeFile(
      path.join(run_dir, "classifier_regressions.jsonl"),
      JSON.stringify({
        timestamp: "2026-05-20T00:30:00.000Z",
        entry_index: 4,
        should_have_matched_rule_id: "framework-loader",
        evidence_excerpt: "loader.register(handler)",
        member_evidence: { file: "src/drifty.ts", line: 30, why: "loader entry missed" },
      }) + "\n",
      "utf8",
    );

    // ===== Drive the same load+build path finalize_triage.ts uses =====
    const novel_issues_file = await read_novel_issues(path.join(run_dir, "novel_issues.json"));
    const regression_records = await read_classifier_regression_records(
      path.join(run_dir, "classifier_regressions.jsonl"),
    );
    const verdicts_by_entry_index = await load_verdicts_by_entry_index(
      path.join(run_dir, "results"),
    );

    const output = build_finalization_output(state, {
      commit_hash: "deadbeefcafebabe",
      project_path: PROJECT_PATH,
      sources: {
        novel_issues: novel_issues_file.issues,
        flagged_novel_verdicts: novel_issues_file.flagged,
        classifier_regressions: aggregate_classifier_regressions(regression_records),
        verdicts_by_entry_index,
      },
    });

    // ===== Exact assertion against a typed literal =====
    const expected: FinalizationOutput = {
      schema_version: 4,
      project_path: PROJECT_PATH,
      commit_hash: "deadbeefcafebabe",
      novel_issues: [
        {
          id: "decorator-route-registration",
          canonical_name: "Decorator route registration",
          root_cause: "Handlers reached only via @route decorator",
          citations: [
            { entry_index: 2, evidence_excerpt: "@route('/novel')" },
            { entry_index: 3, evidence_excerpt: "@route('/cited')" },
          ],
        },
      ],
      flagged_novel_verdicts: [],
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
  });
});

/**
 * Per-run `classifier_regressions.jsonl` storage contract.
 *
 * One line per absorbed `fp-classifier-regression` verdict. The triage
 * dispatcher is the single writer: `absorb_verdict.ts` appends a record each
 * time the per-entry investigator emits a regression. `finalize_triage.ts`
 * reads the file, runs the records through `aggregate_classifier_regressions`,
 * and publishes the aggregate into `triage_results/<run-id>.json` for the
 * curator to absorb.
 *
 * Sub-agents never write this file directly; the dispatcher serializes appends
 * via its per-path mutex.
 */

import * as fs from "node:fs/promises";

import type {
  ClassifierRegressionFlag,
  ClassifierRegressionFlaggedEntry,
} from "@ariadnejs/types";

import {
  assert_keys,
  describe,
  expect_object,
  parse_non_empty_string,
} from "./strict_parse.js";
import type { MemberEvidence } from "./triage_verdict.js";

export type { ClassifierRegressionFlag, ClassifierRegressionFlaggedEntry };

export interface ClassifierRegressionRecord {
  timestamp: string;
  entry_index: number;
  should_have_matched_rule_id: string;
  evidence_excerpt: string;
  member_evidence: MemberEvidence;
}

/**
 * Append one regression record. Each call writes exactly one
 * `JSON.stringify(record) + "\n"`. The caller serializes concurrent appends
 * — `absorb_verdict.ts` does this via the per-path mutex it already holds for
 * the novel-issues registry.
 */
export async function append_classifier_regression_record(
  log_path: string,
  record: ClassifierRegressionRecord,
): Promise<void> {
  const line = `${JSON.stringify(record)}\n`;
  await fs.appendFile(log_path, line, "utf8");
}

/**
 * Read every record from the log, strictly validating each line. Returns
 * `[]` when the file does not exist (no regressions absorbed in this run).
 */
export async function read_classifier_regression_records(
  log_path: string,
): Promise<ClassifierRegressionRecord[]> {
  let raw: string;
  try {
    raw = await fs.readFile(log_path, "utf8");
  } catch (err) {
    if (is_enoent(err)) return [];
    throw err;
  }
  const lines = raw.split("\n").filter((l) => l.length > 0);
  return lines.map((line, idx) =>
    parse_classifier_regression_record(JSON.parse(line), `classifier_regressions[${idx}]`),
  );
}

/**
 * Group records by `should_have_matched_rule_id`. The output preserves
 * first-seen order both at the rule level and within each rule's
 * `flagged_entries`, so a replayed finalize against the same log produces a
 * byte-identical aggregate.
 *
 * Pure. Deduplicates on `(rule_id, entry_index)` — the dispatcher's replay
 * guard normally prevents duplicates upstream, but defending here keeps the
 * aggregate stable under partial re-absorbs.
 */
export function aggregate_classifier_regressions(
  records: readonly ClassifierRegressionRecord[],
): ClassifierRegressionFlag[] {
  const by_rule = new Map<string, ClassifierRegressionFlag>();
  for (const record of records) {
    let flag = by_rule.get(record.should_have_matched_rule_id);
    if (flag === undefined) {
      flag = {
        rule_id: record.should_have_matched_rule_id,
        flagged_entries: [],
      };
      by_rule.set(record.should_have_matched_rule_id, flag);
    }
    if (flag.flagged_entries.some((e) => e.entry_index === record.entry_index)) {
      continue;
    }
    flag.flagged_entries.push({
      entry_index: record.entry_index,
      evidence_excerpt: record.evidence_excerpt,
    });
  }
  return [...by_rule.values()];
}

// ===== Internal: parsing =====

function parse_classifier_regression_record(
  raw: unknown,
  ctx: string,
): ClassifierRegressionRecord {
  const obj = expect_object(raw, ctx);
  assert_keys(
    obj,
    ["timestamp", "entry_index", "should_have_matched_rule_id", "evidence_excerpt", "member_evidence"],
    ctx,
  );
  const timestamp = parse_non_empty_string(obj["timestamp"], `${ctx}.timestamp`);
  const entry_index = obj["entry_index"];
  if (typeof entry_index !== "number" || !Number.isInteger(entry_index) || entry_index < 0) {
    throw new Error(
      `${ctx}.entry_index: must be a non-negative integer, got ${describe(entry_index)}`,
    );
  }
  const should_have_matched_rule_id = parse_non_empty_string(
    obj["should_have_matched_rule_id"],
    `${ctx}.should_have_matched_rule_id`,
  );
  const evidence_excerpt = parse_non_empty_string(
    obj["evidence_excerpt"],
    `${ctx}.evidence_excerpt`,
  );
  const member_evidence = parse_member_evidence(
    obj["member_evidence"],
    `${ctx}.member_evidence`,
  );
  return {
    timestamp,
    entry_index,
    should_have_matched_rule_id,
    evidence_excerpt,
    member_evidence,
  };
}

function parse_member_evidence(raw: unknown, ctx: string): MemberEvidence {
  const obj = expect_object(raw, ctx);
  assert_keys(obj, ["file", "line", "why"], ctx);
  const file = parse_non_empty_string(obj["file"], `${ctx}.file`);
  const line = obj["line"];
  if (typeof line !== "number" || !Number.isInteger(line) || line < 1) {
    throw new Error(`${ctx}.line: must be a positive integer, got ${describe(line)}`);
  }
  const why = parse_non_empty_string(obj["why"], `${ctx}.why`);
  return { file, line, why };
}

function is_enoent(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if (!("code" in err)) return false;
  return (err as { code: unknown }).code === "ENOENT";
}

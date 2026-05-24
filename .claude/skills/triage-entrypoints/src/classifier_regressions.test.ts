import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  aggregate_classifier_regressions,
  append_classifier_regression_record,
  read_classifier_regression_records,
  type ClassifierRegressionFlag,
  type ClassifierRegressionRecord,
} from "./classifier_regressions.js";

const FIXED_NOW = "2026-05-22T12:00:00.000Z";

function record(overrides: Partial<ClassifierRegressionRecord>): ClassifierRegressionRecord {
  return {
    timestamp: FIXED_NOW,
    entry_index: 1,
    should_have_matched_rule_id: "rule-a",
    evidence_excerpt: "@route('/x')",
    member_evidence: { file: "src/a.ts", line: 1, why: "should match" },
    ...overrides,
  };
}

describe("classifier_regressions storage", () => {
  let tmp_dir: string;
  let log_path: string;

  beforeEach(async () => {
    tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "regressions-"));
    log_path = path.join(tmp_dir, "classifier_regressions.jsonl");
  });

  afterEach(async () => {
    await fs.rm(tmp_dir, { recursive: true, force: true });
  });

  describe("append + read", () => {
    it("returns [] when the file does not exist", async () => {
      expect(await read_classifier_regression_records(log_path)).toEqual([]);
    });

    it("round-trips a single record", async () => {
      const r = record({ entry_index: 5 });
      await append_classifier_regression_record(log_path, r);
      expect(await read_classifier_regression_records(log_path)).toEqual([r]);
    });

    it("appends multiple records preserving insertion order", async () => {
      const r_a = record({ entry_index: 1, should_have_matched_rule_id: "rule-a" });
      const r_b = record({ entry_index: 2, should_have_matched_rule_id: "rule-b" });
      const r_c = record({ entry_index: 3, should_have_matched_rule_id: "rule-a" });
      await append_classifier_regression_record(log_path, r_a);
      await append_classifier_regression_record(log_path, r_b);
      await append_classifier_regression_record(log_path, r_c);
      const records = await read_classifier_regression_records(log_path);
      expect(records.map((r) => r.entry_index)).toEqual([1, 2, 3]);
    });

    it("rejects malformed JSON lines", async () => {
      await fs.writeFile(log_path, "not-json\n", "utf8");
      await expect(read_classifier_regression_records(log_path)).rejects.toThrow();
    });

    it("rejects records missing required fields", async () => {
      const bad = JSON.stringify({
        timestamp: FIXED_NOW,
        entry_index: 1,
        // missing should_have_matched_rule_id
        evidence_excerpt: "x",
        member_evidence: { file: "a", line: 1, why: "y" },
      });
      await fs.writeFile(log_path, bad + "\n", "utf8");
      await expect(read_classifier_regression_records(log_path)).rejects.toThrow(
        /missing required field/,
      );
    });
  });

  describe("aggregate_classifier_regressions", () => {
    it("groups records by rule_id, preserving first-seen order both at rule and entry level", () => {
      const records: ClassifierRegressionRecord[] = [
        record({ entry_index: 1, should_have_matched_rule_id: "rule-b", evidence_excerpt: "b1" }),
        record({ entry_index: 2, should_have_matched_rule_id: "rule-a", evidence_excerpt: "a1" }),
        record({ entry_index: 3, should_have_matched_rule_id: "rule-b", evidence_excerpt: "b2" }),
        record({ entry_index: 4, should_have_matched_rule_id: "rule-a", evidence_excerpt: "a2" }),
      ];
      const expected: ClassifierRegressionFlag[] = [
        {
          rule_id: "rule-b",
          flagged_entries: [
            { entry_index: 1, evidence_excerpt: "b1" },
            { entry_index: 3, evidence_excerpt: "b2" },
          ],
        },
        {
          rule_id: "rule-a",
          flagged_entries: [
            { entry_index: 2, evidence_excerpt: "a1" },
            { entry_index: 4, evidence_excerpt: "a2" },
          ],
        },
      ];
      expect(aggregate_classifier_regressions(records)).toEqual(expected);
    });

    it("deduplicates (rule_id, entry_index) pairs keeping the first evidence_excerpt", () => {
      const records: ClassifierRegressionRecord[] = [
        record({ entry_index: 1, should_have_matched_rule_id: "rule-a", evidence_excerpt: "first" }),
        record({ entry_index: 1, should_have_matched_rule_id: "rule-a", evidence_excerpt: "second" }),
      ];
      expect(aggregate_classifier_regressions(records)).toEqual([
        {
          rule_id: "rule-a",
          flagged_entries: [{ entry_index: 1, evidence_excerpt: "first" }],
        },
      ]);
    });

    it("returns [] for an empty record list", () => {
      expect(aggregate_classifier_regressions([])).toEqual([]);
    });
  });
});

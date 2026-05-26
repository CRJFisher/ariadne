/**
 * End-to-end fixture for `fp-classifier-regression` (AC#3 of TASK-190.19).
 *
 * Exercises the full in-flight drift chain WITHOUT invoking LLM agents:
 *   1. A narrowed wip classifier rule is seeded in the registry.
 *   2. The dispatcher appends two `ClassifierRegressionRecord`s to the
 *      per-run JSONL (the wire shape produced when a `triage-investigator`
 *      emits `fp-classifier-regression` for two entries the wip rule
 *      should have caught).
 *   3. `aggregate_classifier_regressions` collapses the JSONL into the
 *      `classifier_regressions[]` array embedded in the v4 finalize output.
 *   4. The curator's `apply_proposals` consumes that array and persists
 *      `drift_evidence` rows onto the wip rule.
 *
 * This is the integration anchor for "intentionally narrowed wip classifier
 * → fp-classifier-regression detected end-to-end" — the call-graph and the
 * verdict-emission step are out of scope (those are an LLM's job), but
 * everything from the wire format on is mechanically covered.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  aggregate_classifier_regressions,
  append_classifier_regression_record,
  read_classifier_regression_records,
  type ClassifierRegressionRecord,
} from "@ariadnejs/skill-fs";
import { apply_proposals } from "../apply/apply_proposals.js";
import type { KnownIssue } from "../types.js";

let tmp_dir: string;
let registry_path: string;
let regressions_jsonl: string;

beforeEach(async () => {
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "regression-chain-"));
  registry_path = path.join(tmp_dir, "registry.json");
  regressions_jsonl = path.join(tmp_dir, "classifier_regressions.jsonl");
});

afterEach(async () => {
  await fs.rm(tmp_dir, { recursive: true, force: true });
});

function narrowed_wip_rule(): KnownIssue {
  // A wip rule whose predicate is intentionally narrow — e.g. only matches
  // `@app.route` (exact decorator name), missing aliases like `@router.get`
  // that should belong to the same group.
  return {
    group_id: "decorator-route-handler",
    title: "Decorator-routed handler",
    description: "Handlers registered via routing decorators are missed by the static call graph",
    status: "wip",
    languages: ["python"],
    examples: [],
    classifier: {
      kind: "predicate",
      axis: "A",
      min_confidence: 0.9,
      expression: {
        op: "decorator_matches",
        pattern: "^app\\.route$",
      },
    },
  } satisfies KnownIssue;
}

async function write_registry(rules: KnownIssue[]): Promise<void> {
  const file = { schema_version: 1, rules };
  await fs.writeFile(registry_path, JSON.stringify(file, null, 2) + "\n", "utf8");
}

async function read_registry(): Promise<KnownIssue[]> {
  const raw = await fs.readFile(registry_path, "utf8");
  const parsed = JSON.parse(raw) as { schema_version: number; rules: KnownIssue[] };
  return parsed.rules;
}

describe("classifier-regression chain (AC#3)", () => {
  it("propagates a narrowed wip classifier's regression flags from the per-run JSONL to drift_evidence on the registry", async () => {
    // ── 1. Seed the registry with the narrowed wip rule.
    await write_registry([narrowed_wip_rule()]);

    // ── 2. Dispatcher writes two regression records (one per entry the
    //       investigator flagged as should-have-matched).
    const record_a: ClassifierRegressionRecord = {
      timestamp: "2026-05-24T10:00:00.000Z",
      entry_index: 7,
      should_have_matched_rule_id: "decorator-route-handler",
      evidence_excerpt: "@router.get('/users')",
      member_evidence: {
        file: "src/handlers/users.py",
        line: 42,
        why: "handler registered via @router.get decorator alias",
      },
    };
    const record_b: ClassifierRegressionRecord = {
      timestamp: "2026-05-24T10:00:01.000Z",
      entry_index: 11,
      should_have_matched_rule_id: "decorator-route-handler",
      evidence_excerpt: "@router.post('/items')",
      member_evidence: {
        file: "src/handlers/items.py",
        line: 88,
        why: "handler registered via @router.post decorator alias",
      },
    };
    await append_classifier_regression_record(regressions_jsonl, record_a);
    await append_classifier_regression_record(regressions_jsonl, record_b);

    // ── 3. Finalize reads the JSONL and aggregates into the v4 wire shape.
    const records = await read_classifier_regression_records(regressions_jsonl);
    const aggregate = aggregate_classifier_regressions(records);
    expect(aggregate).toEqual([
      {
        rule_id: "decorator-route-handler",
        flagged_entries: [
          { entry_index: 7, evidence_excerpt: "@router.get('/users')" },
          { entry_index: 11, evidence_excerpt: "@router.post('/items')" },
        ],
      },
    ]);

    // ── 4. Curator absorbs the aggregate and mutates the registry.
    const result = await apply_proposals(
      [],
      {},
      {
        dry_run: false,
        registry_path,
        project: "fixture-project",
        run_id: "fixture-run",
        classifier_regressions: aggregate,
        authored_files_by_group: {},
      },
    );
    expect(result.drift_tagged_groups).toEqual(["decorator-route-handler"]);
    expect(result.skipped_permanent_upserts).toEqual([]);
    expect(result.skipped_fixed_upserts).toEqual([]);

    const on_disk = await read_registry();
    expect(on_disk).toHaveLength(1);
    expect(on_disk[0].group_id).toEqual("decorator-route-handler");
    expect(on_disk[0].drift_detected).toEqual(true);
    expect(on_disk[0].drift_evidence).toEqual([
      { entry_index: 7, evidence_excerpt: "@router.get('/users')" },
      { entry_index: 11, evidence_excerpt: "@router.post('/items')" },
    ]);
  });
});

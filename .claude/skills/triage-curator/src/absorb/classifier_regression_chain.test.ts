/**
 * End-to-end fixture for `fp-classifier-regression`.
 *
 * Exercises the drift chain WITHOUT invoking LLM agents:
 *   1. A narrowed wip classifier rule is seeded in the registry.
 *   2. Two `fp-classifier-regression` verdicts (the shape a `triage-investigator`
 *      emits for two entries the wip rule should have caught) are rolled up by
 *      `aggregate_classifier_regressions` into the `classifier_regressions[]`
 *      array embedded in the finalize output.
 *   3. The curator's `apply_proposals` consumes that array and persists
 *      `drift_evidence` rows onto the wip rule.
 *
 * This is the integration anchor for "intentionally narrowed wip classifier
 * → fp-classifier-regression detected end-to-end" — the call-graph and the
 * verdict-emission step are out of scope (those are an LLM's job), but
 * everything from the published wire shape on is mechanically covered.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  aggregate_classifier_regressions,
  type ClassifierRegressionInput,
} from "@ariadnejs/skill-fs";
import { apply_proposals } from "../apply/apply_proposals.js";
import type { KnownIssue } from "../types.js";

let tmp_dir: string;
let registry_path: string;

beforeEach(async () => {
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "regression-chain-"));
  registry_path = path.join(tmp_dir, "registry.json");
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

describe("classifier-regression chain", () => {
  it("propagates a narrowed wip classifier's regression flags from the published aggregate to drift_evidence on the registry", async () => {
    // ── 1. Seed the registry with the narrowed wip rule.
    await write_registry([narrowed_wip_rule()]);

    // ── 2. Two fp-classifier-regression verdicts (one per entry the
    //       investigator flagged as should-have-matched).
    const inputs: ClassifierRegressionInput[] = [
      {
        entry_index: 7,
        should_have_matched_rule_id: "decorator-route-handler",
        evidence_excerpt: "@router.get('/users')",
      },
      {
        entry_index: 11,
        should_have_matched_rule_id: "decorator-route-handler",
        evidence_excerpt: "@router.post('/items')",
      },
    ];

    // ── 3. Finalize rolls the verdicts up into the published wire shape.
    const aggregate = aggregate_classifier_regressions(inputs);
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

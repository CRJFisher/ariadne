#!/usr/bin/env node
/**
 * Hydrates the context for the `plan-strategist` sub-agent (Pass B).
 *
 * Reads one staged fault-area bucket (Pass A output) and prints it enriched with
 * the area's folder anchor, the closed `AriadneFaultArea` taxonomy (for
 * `other`-bucket handling), and the authoring rules the validator enforces. The
 * agent turns this into a `StrategistPlan` tree.
 *
 * Usage:
 *   node --import tsx get_bucket_context.ts --bucket <bucket-file> --sweep <sweep-id>
 */

import * as fs from "node:fs/promises";

import {
  ARIADNE_FAULT_AREA_FOLDER,
  ARIADNE_FAULT_AREAS,
} from "@ariadnejs/types";

import type { FaultAreaBucket } from "../src/types.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

interface CliArgs {
  bucket_path: string;
  sweep_id: string;
}

function parse_argv(argv: string[]): CliArgs {
  let bucket_path: string | null = null;
  let sweep_id: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--bucket":
        bucket_path = argv[++i];
        break;
      case "--sweep":
        sweep_id = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write("Usage: get_bucket_context --bucket <file> --sweep <id>\n");
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (bucket_path === null || bucket_path.length === 0) throw new Error("--bucket <file> is required");
  if (sweep_id === null || sweep_id.length === 0) throw new Error("--sweep <id> is required");
  return { bucket_path, sweep_id };
}

async function main(): Promise<void> {
  const { bucket_path, sweep_id } = parse_argv(process.argv.slice(2));
  const bucket = JSON.parse(await fs.readFile(bucket_path, "utf8")) as FaultAreaBucket;

  const out = {
    sweep_id,
    fault_area: bucket.fault_area,
    folder_anchor: ARIADNE_FAULT_AREA_FOLDER[bucket.fault_area],
    observed_count: bucket.observed_count,
    projects: bucket.projects,
    source_runs: bucket.source_runs,
    needs_judgement: bucket.needs_judgement,
    descriptions: bucket.descriptions,
    evidence: bucket.evidence,
    taxonomy: ARIADNE_FAULT_AREAS,
    authoring_rules: {
      schema_version_rule: "StrategistPlan.schema_version must equal 1.",
      fault_area_rule:
        `Every node's fault_area must equal this bucket's fault_area '${bucket.fault_area}' ` +
        "(one strategist plan per bucket).",
      tier_ordering_rule:
        "Tiers nest architectural → fault_area → localized; a child's tier must be strictly " +
        "deeper than its parent's. A localized node is a leaf (no children).",
      evidence_index_rule:
        `evidence_indices are positional indexes into evidence[] (0 <= i < ${bucket.evidence.length}); ` +
        "no duplicates within a node. A localized leaf must ground at least one evidence row " +
        "(unless it is the taxonomy-extension task).",
      non_empty_text_rule: "Every node needs a non-empty title and body.",
      other_bucket_rule:
        bucket.fault_area === "other"
          ? "This is an `other` bucket: emit BOTH a node with is_taxonomy_extension=true (add the " +
            "missing folder-anchored area to ariadne_fault_area.ts + derive_fault_area) AND a " +
            "core-fix node grounded in evidence."
          : "is_taxonomy_extension must be false (only `other` buckets extend the taxonomy).",
      classifier_priority_rule:
        "Classifier-script work is the interim mitigation that suppresses the false-positive while a " +
        "high-effort core fix waits; mark it with is_classifier_work=true and never author the classifier " +
        "spec itself. The core fix is the durable deliverable.",
      core_fix_effort_rule:
        "Every core-fix node carries core_fix_effort: a positive integer estimate of the fix's blast radius " +
        `on the scale 1 (single-file edit) / 3 (new function or resolver path) / 5 (new cross-folder resolver pass), ` +
        `GROUNDED by reading the owning folder '${ARIADNE_FAULT_AREA_FOLDER[bucket.fault_area]}' with Read/Grep/Glob ` +
        "to judge what Ariadne already supports — not inferred from the fault pattern alone. Pair it with a " +
        "non-empty core_fix_effort_rationale. A taxonomy-extension or classifier-work node proposes no core fix, " +
        "so it carries core_fix_effort 0 and an empty rationale. You assign no priority or status — a deterministic " +
        "downstream ranker weighs effort against the observed_count/projects benefit signals.",
    },
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(
    `get_bucket_context failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});

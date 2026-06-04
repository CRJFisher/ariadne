import type {
  AriadneFaultArea,
} from "@ariadnejs/types";
import type {
  PlanTaskEvidence,
  PlanTaskTier,
  RunId,
} from "@ariadnejs/skill-protocol";

// ===== Triage results shape (read-only) =====
//
// The published `triage_results/<run-id>.json` wire contract is owned by
// `@ariadnejs/skill-protocol` — the single source of truth shared with the
// producing triage skill. Re-exported here so plan's domain-vocabulary
// imports stay grouped. Pass A reads `novel_issues[]` (every published
// false-positive row) and groups them by `AriadneFaultArea`.

export {
  TRIAGE_RESULTS_SCHEMA_VERSION,
} from "@ariadnejs/skill-protocol";

export type {
  ConfirmedUnreachableSource,
  MemberEvidence,
  NovelIssue,
  PublishedConfirmedUnreachable,
  PublishedEntryRef,
  PublishedUncertain,
  TriageResultsFile,
} from "@ariadnejs/skill-protocol";

// ===== Known-issues registry shape (read-only) =====
//
// Canonical types live in `@ariadnejs/types`. Re-exported here so the impact
// report (the kept registry-ranking substrate) imports its domain vocabulary
// from one place. The plan engine reads the registry only as a dedup/grounding
// signal — it never writes it.

export type {
  KnownIssue,
  KnownIssueExample,
  KnownIssueLanguage,
  KnownIssueStatus,
} from "@ariadnejs/types";

// ===== Scan =====

export interface ScanOptions {
  project: string | null;
  last: number | null;
  run: string | null;
}

export interface ScanResultItem {
  run_id: string;
  project: string;
  run_path: string;
}

/**
 * The per-sweep scan manifest Pass A writes and Pass C reads
 * (`staging/<sweep>/manifest.json`). It records the FULL scanned scope — every
 * project and run_id scanned this sweep, INCLUDING runs that produced zero
 * false-positives and therefore left no bucket. `projects` is the load-bearing
 * field: Pass C reclaims a live orphan as `resolved` only when its `projects[]`
 * ⊆ this `projects` set, so a zero-FP (now-clean) project is exactly what lets
 * its stale tasks be recognised as fixed. `run_ids` is kept for sweep
 * auditability (the otherwise-unrecoverable record of what was scanned).
 */
export interface SweepManifest {
  projects: string[];
  run_ids: string[];
}

// ===== Pass A — fault-area grouping =====

/**
 * One `AriadneFaultArea` bucket produced by Pass A (`group_fault_areas`): every
 * false-positive whose `derive_fault_area` lands on this `fault_area`, with its
 * evidence verbatim and a per-bucket rollup. The strategist (Pass B) refines
 * one bucket into a hierarchical fix-plan tree; Pass C reconciles the tree into
 * `PlanTask` rows.
 *
 * `evidence` is `PlanTaskEvidence`-shaped so it carries everything
 * `derive_fault_area` re-consumes (the area stays re-derivable on read) and
 * flows straight into a `PlanTask`. The strategist references evidence by
 * positional index into this array (`StrategistPlanNode.evidence_indices`).
 */
export interface FaultAreaBucket {
  fault_area: AriadneFaultArea;
  /** One row per false-positive that grouped here; the bucket's index space. */
  evidence: PlanTaskEvidence[];
  /** `=== evidence.length` (one false-positive per evidence row). */
  observed_count: number;
  /** Distinct projects the evidence spans, sorted. */
  projects: string[];
  /** Distinct runs the evidence spans, sorted. */
  source_runs: RunId[];
  /**
   * The escape-hatch free-text descriptions carried by `other`-area rows
   * (`AriadneFaultLocation.description`). Non-empty only when
   * `fault_area === "other"`; the strategist uses them to extend the taxonomy.
   */
  descriptions: string[];
  /**
   * True when ANY member's `derive_fault_area` returned `needs_judgement: true`
   * (the deterministic derivation defaulted and the strategist must decide).
   */
  needs_judgement: boolean;
}

// ===== Pass B — strategist plan (the agent's output contract) =====

/**
 * The schema version of a `StrategistPlan` JSON the `plan-strategist` agent
 * writes. Bumped only on a breaking shape change; the validator and the
 * reconcile engine both pin it.
 */
export const STRATEGIST_PLAN_SCHEMA_VERSION = 1;

/**
 * One node in a strategist's hierarchical fix-plan tree for a single bucket.
 * Maps 1:1 onto a `PlanTask`: `tier`/`title`/`body`/`fault_area` carry over
 * verbatim; `children` becomes `parent_id`/`child_ids` after Pass C mints ids;
 * `evidence_indices` resolves against the bucket's `evidence[]` to the
 * `PlanTaskEvidence` rows that ground this node (and feed its `dedup_key`).
 *
 * The strategist authors prose + structure only — it never mints ids,
 * `dedup_key`s, or `PlanTaskEvidence` rows (those come verbatim from Pass A).
 */
export interface StrategistPlanNode {
  /** Size tier: `architectural` (cross-cutting root) → `fault_area` → `localized` leaf. */
  tier: PlanTaskTier;
  title: string;
  body: string;
  /**
   * The owning fault area. Required & non-null on every node (mirrors
   * `PlanTask.fault_area`). On an `architectural` cross-area root this is the
   * bucket's primary area — the cross-area scope lives in `body` + children.
   */
  fault_area: AriadneFaultArea;
  /**
   * Positional indexes into the bucket's `evidence[]` this node DIRECTLY
   * grounds. A `localized` leaf carries the real indexes; an `architectural` or
   * `fault_area` node MAY carry `[]` and inherit evidence by union from its
   * descendants. A `is_taxonomy_extension` node is grounded in the bucket's
   * `descriptions`, not evidence rows, so it too may carry `[]`.
   */
  evidence_indices: number[];
  /**
   * Marks the taxonomy-extension task an `other` bucket must yield (add the
   * missing folder-anchored area to `ariadne_fault_area.ts` + `derive_fault_area`).
   * Permitted only when the bucket's `fault_area === "other"`.
   */
  is_taxonomy_extension: boolean;
  /**
   * Marks a classifier-script work item. Classifier work is included only as
   * explicitly lower-priority `localized` nodes — the strategist never authors a
   * classifier spec itself.
   */
  is_classifier_work: boolean;
  children: StrategistPlanNode[];
}

/**
 * A strategist's full output for ONE fault-area bucket — a forest of plan nodes
 * (usually a single `architectural` or `fault_area` root, ≥1). Self-contained:
 * carries the bucket's `fault_area` and the `sweep_id` it was dispatched for, so
 * the validator and reconcile engine cross-check against the bucket fed to them.
 */
export interface StrategistPlan {
  schema_version: number;
  fault_area: AriadneFaultArea;
  sweep_id: string;
  roots: StrategistPlanNode[];
}

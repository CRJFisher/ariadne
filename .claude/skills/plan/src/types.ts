import type {
  AriadneFaultArea,
} from "@ariadnejs/types";
import type { RunId } from "@ariadnejs/skill-protocol";
import type { PlanTaskEvidence, PlanTaskTier } from "./store/plan_task.js";

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

// ===== Scan =====

export interface ScanOptions {
  project: string | null;
  last: number | null;
  run: string | null;
}

export interface ScanResultItem {
  run_id: RunId;
  project: string;
  run_path: string;
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
   * Marks a permanent limitation: the group's call relationship is fundamentally
   * unknowable to static analysis, so no core fix is possible and the durable
   * deliverable is a registry classifier (authored downstream by
   * `classifier-author` — the strategist never authors a classifier spec itself).
   * Such a node never exports to the user's `backlog/`.
   */
  is_permanent_limitation: boolean;
  /**
   * The strategist's blast-radius estimate for this node's core fix — a positive
   * integer on the scale 1 (single-file edit) / 3 (new function/resolver path) /
   * 5 (new cross-folder resolver pass), grounded by inspecting the owning
   * `fault_area` folder's current capability. Required on every core-fix node;
   * `0` on a taxonomy-extension or permanent-limitation node (no core fix to
   * size). Pass C carries it verbatim onto the `PlanTask` as the cost axis.
   */
  core_fix_effort: number;
  /** Prose grounding for `core_fix_effort` — required on core-fix nodes, empty when effort is `0`. */
  core_fix_effort_rationale: string;
  children: StrategistPlanNode[];
}

/**
 * One per-member membership verdict — the strategist's judgement of whether the
 * evidence row at `index` genuinely shares this bucket's bulk root cause. Pass A
 * (`derive_fault_area`) buckets deterministically and can mis-route a member; the
 * strategist is the one stage with judgement + code access, so before it plans it
 * reviews each member it was handed.
 *
 * The review is TOTAL (the validator requires one verdict per `evidence[]` index)
 * and CONSISTENT (no node may ground an index whose verdict is not `true`). A
 * non-`true` verdict carries a non-empty `reason`; `suggested_area` names the
 * `AriadneFaultArea` the member should route to instead when the strategist can
 * tell (a confirmed `derive_fault_area` mis-route), and is omitted otherwise.
 *
 * `belongs` is three-valued:
 *   - `true`  — the member shares this bucket's bulk root cause; it grounds work.
 *   - `false` — a confirmed mis-route; it grounds nothing AND writes a standing
 *               membership override so Pass A re-routes/suppresses it next sweep.
 *   - `"unsure"` — grounds nothing THIS sweep but writes NO override, so the
 *               member re-enters review next sweep. The uncommitted middle: it
 *               keeps a genuinely ambiguous member out of the plan without the
 *               unconditional, never-expiring suppression a `false` incurs.
 */
export type MembershipBelonging = boolean | "unsure";

export interface MembershipVerdict {
  /** Positional index into the bucket's `evidence[]`. */
  index: number;
  /** Whether the member shares this bucket's bulk root cause (three-valued). */
  belongs: MembershipBelonging;
  /** Justification; required (non-empty) on any non-`true` verdict. */
  reason: string;
  /** The area the member should route to instead (only on a `false` verdict, when tellable). */
  suggested_area?: AriadneFaultArea;
}

/**
 * A strategist's full output for ONE fault-area bucket — a forest of plan nodes
 * (usually a single `architectural` or `fault_area` root, ≥1). Self-contained:
 * carries the bucket's `fault_area` and the `sweep_id` it was dispatched for, so
 * the validator and reconcile engine cross-check against the bucket fed to them.
 *
 * `membership` is the per-member review over the bucket's `evidence[]` — one
 * verdict per index. Pass C grounds tasks on `belongs: true` members only and
 * records each `belongs: false` decision as an `exclude_member` sweep event + a
 * membership-override record.
 */
export interface StrategistPlan {
  schema_version: number;
  fault_area: AriadneFaultArea;
  sweep_id: string;
  roots: StrategistPlanNode[];
  membership: MembershipVerdict[];
}

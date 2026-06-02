/**
 * The `plan` engine's task-DB record contract — the queryable work item the
 * engine writes to `~/.ariadne/plan/` (firewalled from the user's `backlog/`).
 *
 * This module is type-only: it declares the record shape both the JSON store
 * and the engine agree on, and introduces no I/O and no fault taxonomy of its
 * own. The grouping key `fault_area` is `AriadneFaultArea` from
 * `@ariadnejs/types` (the single source of fault classification); each evidence
 * row carries the COLLAPSED `MemberEvidence {file,line,why}` plus the raw fault
 * diagnostics, kept verbatim so the area stays re-derivable on read via
 * `derive_fault_area`.
 *
 * The raw diagnostics (`diagnosis` and `resolution_failure.{stage,reason}`) are
 * typed as plain `string` — not the published enums — by design: a record
 * persisted by one version and read by a newer one may hold a value this
 * version's enum does not know, and `derive_fault_area` routes such a value to
 * the `other` escape hatch rather than it being a stored type lie.
 */

import type { AriadneFaultArea } from "@ariadnejs/types";

import type { RunId } from "./run_id.js";
import type { MemberEvidence } from "./triage_results.js";

/**
 * Schema version of a stored plan-task record. The store (the JSON
 * `PlanTaskRepository` impl) rejects any mismatch on read. Twin of
 * {@link TRIAGE_RESULTS_SCHEMA_VERSION}; starts at 1 (new artifact).
 */
export const PLAN_TASK_SCHEMA_VERSION = 1;

/**
 * Branded primary key of a plan task — one JSON file per id at
 * `~/.ariadne/plan/tasks/<id>.json`. Branded so a validated id is not confused
 * with an arbitrary string. This contract fixes no id grammar: minting is the
 * store's concern (the single audited `as PlanTaskId` site), mirroring how
 * `build_run_id` owns the run-id grammar. Path helpers accept a plain `string`
 * so a `PlanTaskId` flows in as a subtype without a cast.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export type PlanTaskId = string & { __brand: "PlanTaskId" };

/**
 * Lifecycle state of a plan task. `proposed` and `accepted` are the LIVE set
 * the engine reconciles against by `dedup_key` (a colliding proposal augments a
 * live task instead of duplicating).
 *
 * - `proposed`   engine-emitted this sweep; not yet endorsed.
 * - `accepted`   endorsed by the strategist/user; still live.
 * - `superseded` replaced by another task (see `superseded_by`).
 * - `exported`   promoted into the user's `backlog/` (see `exported_backlog_task`); suppress re-proposal.
 * - `abandoned`  dropped; no longer actionable.
 */
export type PlanTaskStatus =
  | "proposed"
  | "accepted"
  | "superseded"
  | "exported"
  | "abandoned";

/**
 * Size tier of a task in the hierarchical plan tree. The engine emits one node
 * per tier: `architectural` (cross-area root) → `fault_area` (one
 * {@link AriadneFaultArea} group) → `localized` (a single concrete fix leaf).
 */
export type PlanTaskTier = "architectural" | "fault_area" | "localized";

/**
 * One false-positive grounding a plan task, sourced from a published
 * `triage_results` `novel_issues[]` row. Carries the investigator's
 * `member_evidence`, its `project`/`run_id` provenance, and the raw fault
 * diagnostics — `diagnosis` plus the optional `resolution_failure {stage,
 * reason}` (the destructured `resolution_stage`/`resolution_reason`, grouped as
 * in `NovelIssue` because the pair is present or absent together). The raw
 * diagnostics are kept verbatim so the fault area is re-derivable via
 * `derive_fault_area`; absent `resolution_failure` is the diagnosis-fallback
 * derivation path.
 */
export interface PlanTaskEvidence {
  member_evidence: MemberEvidence;
  project: string;
  run_id: RunId;
  diagnosis: string;
  resolution_failure?: { stage: string; reason: string };
}

/**
 * A plan task — one node in the engine's hierarchical, size-tiered plan tree,
 * stored as one JSON file per `id`. The whole record is total (no optional
 * fields): hierarchy links and lifecycle pointers use `| null` so the store
 * never distinguishes missing from null.
 */
export interface PlanTask {
  /** Stored schema version; the store rejects a mismatch on read. */
  schema_version: number;
  /** Branded primary key; names the `tasks/<id>.json` file. */
  id: PlanTaskId;
  /** Size tier in the plan tree. */
  tier: PlanTaskTier;
  /** Hierarchy link up; `null` at the architectural root. */
  parent_id: PlanTaskId | null;
  /** Hierarchy links down; empty at a localized leaf. */
  child_ids: PlanTaskId[];
  /** Short human-readable proposal title. */
  title: string;
  /** Full proposal text / plan body. */
  body: string;
  /** Grouping key (from `@ariadnejs/types`); routes the fix to the owning core folder. */
  fault_area: AriadneFaultArea;
  /** The false-positives this task is grounded in; merged on augment. */
  evidence: PlanTaskEvidence[];
  /** How many times this issue was observed across runs; bumped on augment. */
  observed_count: number;
  /** Distinct projects the evidence spans. */
  projects: string[];
  /** Distinct runs the evidence spans. */
  source_runs: RunId[];
  /** Lifecycle state. */
  status: PlanTaskStatus;
  /** Set iff `status === "superseded"`; the replacement task. */
  superseded_by: PlanTaskId | null;
  /** Set iff `status === "exported"`; the user `backlog/` task id this was promoted to. */
  exported_backlog_task: string | null;
  /**
   * Stable reconciliation key: a content hash of `fault_area` joined with the
   * lexicographically sorted SET of this task's evidence `"<file>:<line>"`
   * strings (deduplicated before sorting). Two proposals with the same fault
   * area touching the same call sites produce the same key and so reconcile
   * (augment) instead of duplicating. The key is a function of `fault_area` +
   * the evidence location set ONLY — never of `title`, `body`, `tier`,
   * `status`, the rollups, or provenance — so a re-sweep over the same runs is
   * idempotent even though augment mutates evidence and bumps rollups. This is
   * exact-overlap reconciliation only (no fuzzy/subset matching). The hash
   * algorithm is owned by the store; this field stores its output.
   */
  dedup_key: string;
  /** Sweep id that first created this task (names a `sweeps/<id>.jsonl` log). */
  created_in_sweep: string;
  /** Sweep id of the most recent augment/change. */
  updated_in_sweep: string;
  /** Identifier of the strategist/agent that authored or last edited this task. */
  strategist: string;
}

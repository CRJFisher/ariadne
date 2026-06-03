/**
 * The `plan` engine's task-DB record contract — the queryable work item the
 * engine writes to `~/.ariadne/plan/` (firewalled from the user's `backlog/`).
 *
 * This module is type-only: it declares the record shape both the JSON store
 * and the engine agree on, and introduces no I/O and no fault taxonomy of its
 * own. The grouping key `fault_area` is `AriadneFaultArea` from
 * `@ariadnejs/types` (the single source of fault classification); each evidence
 * row carries the COLLAPSED `MemberEvidence {file,line,why}` plus the full raw
 * fault signal `derive_fault_area` consumes, kept verbatim so the area stays
 * re-derivable on read: `derive_fault_area(evidence)` recomputes it. The
 * persisted `fault_area` is the grouping key for queries; re-derivation is what
 * keeps it correct when the taxonomy/folder map changes, so nothing derived is
 * trusted as immutable.
 *
 * The raw signal (`diagnosis` and `resolution_failure.{stage,reason}`) is typed
 * as plain `string` — not the published enums — by design: a record persisted
 * by one version and read by a newer one may hold a value this version's enum
 * does not know, and `derive_fault_area` routes such a value to the `other`
 * escape hatch rather than it being a stored type lie.
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
 * `triage_results` `novel_issues[]` row: `member_evidence` is the row's
 * evidence verbatim; `project` and `run_id` come from the enclosing
 * `TriageResultsFile` (its `project_path` and the run's id), not the row. The
 * row's `proposed_root_cause`/`evidence_excerpt`/`receiver_kind` are
 * intentionally not carried — they ground the strategist's prose, not the area.
 *
 * The remaining fields are EXACTLY `derive_fault_area`'s `DeriveFaultAreaInput`,
 * so `derive_fault_area(evidence)` recomputes the area with no adapter:
 * `diagnosis` plus `resolution_failure` (`null`, not absent, when no failure
 * was emitted — the diagnosis-fallback path) and the two disambiguator booleans
 * that path consults. The booleans are the signals 190.22.9 threads onto the
 * published `NovelIssue`; storing them here is what makes full re-derivation
 * possible — without them the coverage-gap and deterministic-extraction
 * branches collapse. (`language` is omitted: it is not carried upstream and is
 * an optional `derive_fault_area` input, so its absence is well-formed.)
 */
export interface PlanTaskEvidence {
  member_evidence: MemberEvidence;
  project: string;
  run_id: RunId;
  diagnosis: string;
  resolution_failure: { stage: string; reason: string } | null;
  has_uncaptured_indexed_grep_hit: boolean;
  callers_only_in_unindexed_tests: boolean;
}

/**
 * A plan task — one node in the engine's hierarchical, size-tiered plan tree,
 * stored as one JSON file per `id`. The whole record is total (no optional
 * fields, here or in `PlanTaskEvidence`): hierarchy links and lifecycle
 * pointers use `| null` so the store never distinguishes missing from null.
 *
 * The engine (190.22.10) populates every field; the store (190.22.8) persists
 * and queries the record and rejects a `schema_version` mismatch on read. The
 * store derives nothing — `fault_area` and `dedup_key` arrive already computed.
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
   * Stable reconciliation key, computed ONCE when the task is minted: a content
   * hash of `fault_area` joined with the lexicographically sorted SET of the
   * MINTING PROPOSAL's evidence `"<file>:<line>"` strings (deduplicated before
   * sorting). It is stored immutably — augment merges new evidence and bumps
   * the rollups but NEVER recomputes the key, so a later re-sweep of the same
   * proposal still hashes to the same value and matches via
   * `find_by_dedup_key`. Inputs are `fault_area` + that location set ONLY —
   * never `title`, `body`, `tier`, `status`, the rollups, or provenance. This
   * is exact-overlap reconciliation only (no fuzzy/subset matching): a proposal
   * whose evidence set differs at all gets a different key and a new task. The
   * engine computes the key from a canonical recipe (190.22.10) that must be
   * stable across a store's sweeps; this field stores its output.
   */
  dedup_key: string;
  /**
   * Id of the sweep that first created this task. A sweep is one plan-engine
   * pass over ≥1 finalized runs; the id names its `sweeps/<id>.jsonl` log and
   * is minted by the engine (190.22.10), distinct from a `RunId`.
   */
  created_in_sweep: string;
  /** Id of the sweep that last augmented or changed this task. */
  updated_in_sweep: string;
  /**
   * Who authored or last edited this task — the plan engine's strategist agent
   * identity (e.g. its model id or a fixed agent slug), stamped by the engine.
   */
  strategist: string;
  /**
   * True for an interim classifier-script work item — a workaround that routes
   * triage around the false-positive until the core fix lands. These are
   * explicitly lower-priority than the core fix; a consumer (the export adapter,
   * a DB query) orders core-fix tasks ahead of classifier-work tasks by this
   * flag. The core fix is always the real deliverable.
   */
  is_classifier_work: boolean;
}

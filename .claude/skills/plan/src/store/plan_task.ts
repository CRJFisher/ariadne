/**
 * The `plan` engine's task-DB record contract — the queryable work item the
 * engine writes to `~/.ariadne/plan/` (never the user's `backlog/`).
 *
 * This module is type-only: it declares the record shape both the JSON store
 * and the engine agree on, plus the store's query filter (`PlanTaskQuery`) and
 * sweep-event log entry (`PlanSweepEvent`); it introduces no I/O and no fault
 * taxonomy of its own. The grouping key `fault_area` is `AriadneFaultArea` from
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
import type { MemberEvidence, MemberSymbol, RunId } from "@ariadnejs/skill-protocol";

/**
 * Schema version of a stored plan-task record. The store
 * (`JsonPlanTaskRepository`) rejects any mismatch on read. Twin of
 * `TRIAGE_RESULTS_SCHEMA_VERSION`; starts at 1 (new artifact).
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
 * Lifecycle state of a plan task. `proposed` is the sole LIVE state the engine
 * reconciles against by `dedup_key` (a colliding proposal augments a live task
 * instead of duplicating). Every other state is terminal — a terminal task is
 * never matched, augmented, or re-orphaned by a later sweep.
 *
 * - `proposed`   engine-emitted this sweep; the live, exportable state.
 * - `superseded` folded into a replacement task (see `superseded_by`); the
 *                replacement carries its own evidence, so a superseded record
 *                keeps its vanished locations rather than donating them.
 * - `exported`   promoted into the user's `backlog/` (see `exported_backlog_task`); suppress re-proposal.
 * - `resolved`   the grounding false-positives no longer appear in newer swept
 *                runs (the underlying bug appears fixed). A sweep marks a live
 *                orphan `resolved` only when every project in its `projects[]`
 *                was scanned this sweep, so a partial-scope sweep never falsely
 *                resolves a task whose projects it did not cover. Distinct from
 *                `superseded`, where a replacement task exists.
 */
export type PlanTaskStatus =
  | "proposed"
  | "superseded"
  | "exported"
  | "resolved";

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
  /**
   * Stable identity of the flagged entry point this evidence row is about,
   * carried verbatim from the published `NovelIssue`. Two consumers key on it,
   * with DIFFERENT drift behavior: `compute_dedup_key` hashes its `(file_path,
   * name, kind)` token (no `start_line`), so a task survives its members' line
   * shifts across sweeps; the reconcile pass's membership-override store keys on
   * the full 4-tuple INCLUDING `start_line`, so a line-shifted member re-enters
   * that review rather than surviving. Distinct from the `member_evidence`
   * call-site `file:line`, which grounds evidence union (two call sites are
   * distinct evidence): this names the FLAGGED MEMBER, that names the call site.
   */
  member_symbol: MemberSymbol;
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
   * MINTING PROPOSAL's `(file_path, name, kind)` MEMBER tokens (deduplicated
   * before sorting). It is stored immutably — augment merges new evidence and
   * bumps the rollups but NEVER recomputes the key, so a later re-sweep of the
   * same proposal still hashes to the same value and matches via
   * `find_by_dedup_key`. Inputs are `fault_area` + that member set ONLY — never
   * `title`, `body`, `tier`, `status`, the rollups, provenance, or the call-site
   * `file:line`. Keying on the flagged member rather than the call site makes
   * the key drift-tolerant to line shifts (a member that only moves down its
   * file keeps its key); the residual cost is that a member which changes FILE
   * or NAME re-keys. This is exact-overlap reconciliation only (no fuzzy/subset
   * matching): a proposal whose member set differs at all gets a different key
   * and a new task. The engine computes the key from a canonical recipe
   * (`compute_dedup_key`) that must be stable across a store's sweeps; this
   * field stores its output.
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
   * True for a permanent limitation: the grounding call relationship is
   * fundamentally unknowable to static analysis, so no core fix is possible and
   * the durable deliverable is a registry classifier authored downstream by
   * `classifier-author`. Such a task never exports to the user's `backlog/` —
   * the export selector excludes it structurally — and `prioritize` step 3a
   * reads this flag as its routing default (permanent → `classifier-author`,
   * otherwise → `refactor-investigator`), with the human as final adjudicator.
   */
  is_permanent_limitation: boolean;
  /**
   * The strategist's estimate of how much complexity a core fix would add to
   * Ariadne — the fix's blast radius — as a positive integer on the strategist's
   * authored scale (1 = a single-file edit; 3 = a new function/resolver path;
   * 5 = a new cross-folder resolver pass). It is the cost axis paired with the
   * benefit rollups (`observed_count`, `projects`, `source_runs`); the user weighs
   * the two when choosing what to promote. The strategist grounds the estimate
   * by inspecting the owning `fault_area` folder's current capability, and a
   * sweep adopts the fresh estimate on augment (a fix's cost is re-judged as the
   * folder evolves). It is `0` on a node that proposes no core fix — a
   * taxonomy-extension task or a permanent-limitation task — where blast radius
   * is not meaningful.
   *
   * Each tier's estimate stands on its own and is NOT additive across tiers: a
   * `localized` leaf sizes one concrete fix, while a parent (`fault_area` /
   * `architectural`) sizes the blast radius of that whole subtree's upgrade — not
   * the sum of its leaves.
   */
  core_fix_effort: number;
  /** The strategist's prose grounding for `core_fix_effort` (empty when effort is `0`). */
  core_fix_effort_rationale: string;
}

/**
 * Filter for `JsonPlanTaskRepository.query`. Every field is optional; absent
 * fields match everything and supplied fields are AND-ed (the in-memory filter
 * contract the store applies after `readdir` + parse).
 */
export interface PlanTaskQuery {
  fault_area?: AriadneFaultArea;
  status?: PlanTaskStatus;
  tier?: PlanTaskTier;
  parent_id?: PlanTaskId;
  dedup_key?: string;
}

/**
 * One entry in a sweep's append-only `sweeps/<sweep_id>.jsonl` log, recording a
 * reconciliation decision. The sweep id is NOT carried on the event — it is
 * passed separately to `JsonPlanTaskRepository.append_sweep_event` (it names
 * the log file). Discriminated on `kind`:
 *
 * - `create`    a fresh task was minted this sweep.
 * - `augment`   an existing live task matched by `dedup_key`; evidence merged.
 * - `supersede` one task was folded into a replacement (mirrors `superseded_by`).
 * - `combine`   several tasks were combined into one. On the records this is
 *               supersede-fan-in: each `merged_ids` task gets
 *               `status: "superseded"` with `superseded_by = into_id`; the
 *               event captures the N→1 grouping as a single log entry.
 * - `resolve`   a live orphan's grounding false-positives no longer recur in
 *               newer swept runs; the record moves to `status: "resolved"`. No
 *               replacement pointer — the bug vanished rather than moved — so
 *               unlike `supersede` the event names only the resolved task.
 *               `dedup_key` is carried for log-side correlation, matching `create`.
 * - `export`    a task was promoted to the user `backlog/` (mirrors `exported_backlog_task`).
 * - `exclude_member` the strategist judged a member NOT to belong in the
 *               `fault_area` bucket it was routed into, so no task this sweep is
 *               grounded on it. The audit entry for the membership review:
 *               `member` is the excluded member's stable identity, `reason` the
 *               strategist's justification, and `suggested_area` the area it
 *               should route to instead (`null` when the strategist could not
 *               tell). A non-null `suggested_area` is a confirmed
 *               `derive_fault_area` mis-route — the correction signal.
 */
export type PlanSweepEvent =
  | { kind: "create"; task_id: PlanTaskId; dedup_key: string }
  | {
      kind: "augment";
      task_id: PlanTaskId;
      dedup_key: string;
      added_evidence: PlanTaskEvidence[];
    }
  | { kind: "supersede"; superseded_id: PlanTaskId; superseded_by: PlanTaskId }
  | { kind: "combine"; merged_ids: PlanTaskId[]; into_id: PlanTaskId }
  | { kind: "resolve"; task_id: PlanTaskId; dedup_key: string }
  | { kind: "export"; task_id: PlanTaskId; backlog_task: string }
  | {
      kind: "exclude_member";
      fault_area: AriadneFaultArea;
      member: MemberSymbol;
      reason: string;
      suggested_area: AriadneFaultArea | null;
    };

/**
 * The `PlanTaskRepository` interface — the swap-seam the `plan` engine calls to
 * read and write its task-DB, plus the `PlanSweepEvent` log the engine appends
 * per sweep.
 *
 * This is type-only and performs no I/O. The JSON-on-disk implementation lives
 * in the `plan` skill; a SQLite/vector store is a later drop-in behind these
 * exact signatures. `PlanSweepEvent` lives here, not with the record, because
 * it is a repository-method argument — the `PlanTask` record never embeds one;
 * the sweep log is a separate `sweeps/<sweep_id>.jsonl` artifact (see
 * {@link plan_sweeps_dir} for its on-disk location, {@link plan_task_path} for
 * the per-task file).
 */

import type { AriadneFaultArea } from "@ariadnejs/types";

import type {
  PlanTask,
  PlanTaskEvidence,
  PlanTaskId,
  PlanTaskStatus,
  PlanTaskTier,
} from "./plan_task.js";

/**
 * Filter for {@link PlanTaskRepository.query}. Every field is optional; absent
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
 * passed separately to {@link PlanTaskRepository.append_sweep_event} (it names
 * the log file). Discriminated on `kind`:
 *
 * - `create`    a fresh task was minted this sweep.
 * - `augment`   an existing live task matched by `dedup_key`; evidence merged.
 * - `supersede` one task was replaced by another (mirrors `superseded_by`).
 * - `combine`   several tasks were combined into one. On the records this is
 *               supersede-fan-in: each `merged_ids` task gets
 *               `status: "superseded"` with `superseded_by = into_id`; the
 *               event captures the N→1 grouping as a single log entry.
 * - `export`    a task was promoted to the user `backlog/` (mirrors `exported_backlog_task`).
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
  | { kind: "export"; task_id: PlanTaskId; backlog_task: string };

/**
 * The access seam the `plan` engine calls. All methods are async (the JSON
 * store is filesystem-backed). The engine reconciles within the DB: it computes
 * a proposal's `dedup_key` (the canonical recipe in `PlanTask.dedup_key`),
 * looks it up via {@link PlanTaskRepository.find_by_dedup_key}, and augments a
 * live match instead of creating a duplicate. The store never computes the key
 * — it matches on the stored string.
 */
export interface PlanTaskRepository {
  /** Fetch one task by id; `null` when absent (a readdir miss is normal). */
  get(id: PlanTaskId): Promise<PlanTask | null>;
  /** All tasks matching the (AND-ed) filter. */
  query(filter: PlanTaskQuery): Promise<PlanTask[]>;
  /** The tasks whose `parent_id === id` (hierarchy walk down). */
  children_of(id: PlanTaskId): Promise<PlanTask[]>;
  /**
   * All tasks sharing `key` — an array, not a single task, so the engine can
   * pick the live (`proposed`/`accepted`) row among a key that also carries a
   * superseded one.
   */
  find_by_dedup_key(key: string): Promise<PlanTask[]>;
  /** Upsert one task (one JSON file). */
  put(task: PlanTask): Promise<void>;
  /** Upsert many tasks (one JSON file each). */
  put_many(tasks: PlanTask[]): Promise<void>;
  /** Append one event to `sweeps/<sweep_id>.jsonl` (the engine-minted sweep id). */
  append_sweep_event(sweep_id: string, event: PlanSweepEvent): Promise<void>;
}

/**
 * Pure selection of the `PlanTask` rows an export run promotes. Two selection
 * modes, mirroring the adapter's CLI:
 *
 *   - **explicit** (`ids` non-empty): exactly those task ids; unknown ids are
 *     reported as `missing_ids`. The filter flags are ignored — naming an id IS
 *     the selection.
 *   - **filtered** (`ids` empty): every task matching `status` (default
 *     `proposed`), and — when supplied — `fault_area` and `priority`. `priority`
 *     maps to `is_classifier_work`: `core` → core-fix rows, `classifier` →
 *     interim classifier-work rows.
 *
 * Only LIVE work is exportable: a task must be `proposed` or `accepted`
 * ({@link EXPORTABLE_STATUSES}). Terminal states (`superseded`, `resolved`,
 * `exported`) are retired work the engine no longer tracks as actionable, so
 * promoting them into the user's backlog is always a mistake — a filter typo
 * (`--status resolved`) or an explicit `--id` naming a retired row is reported
 * as `skipped_non_exportable`, never written. This also closes a duplicate-write
 * path: two live tasks never share a `dedup_key` (the reconciler augments rather
 * than duplicates), so once terminal rows are excluded no two selected rows can
 * collide on a key.
 *
 * Idempotency is enforced here, not at the write: a candidate is skipped when it
 * is already `exported`, OR when a backlog task already carries its `dedup_key`
 * (the loop-closure link the export adapter stamps and the reconciler reads).
 * The second guard is what makes a re-run a no-op even if a prior run crashed
 * after writing the backlog file but before flipping the DB row — `dedup_key`,
 * not the DB status alone, is the dedup authority.
 */

import type { AriadneFaultArea } from "@ariadnejs/types";
import type { PlanTask, PlanTaskStatus } from "@ariadnejs/skill-protocol";

/** The live states a task may be promoted from; terminal states are retired work and never exportable. */
export const EXPORTABLE_STATUSES: ReadonlySet<PlanTaskStatus> = new Set<PlanTaskStatus>([
  "proposed",
  "accepted",
]);

/** Which `is_classifier_work` partition `--priority` selects. */
export type ExportPriority = "core" | "classifier";

export interface ExportSelectors {
  status: PlanTaskStatus;
  fault_area: AriadneFaultArea | null;
  priority: ExportPriority | null;
  ids: string[];
}

/** A candidate dropped because it is already promoted, with the backlog id it maps to. */
export interface SkippedExport {
  id: string;
  backlog_task: string;
}

/** A candidate dropped because its lifecycle state is terminal (retired work, not exportable). */
export interface SkippedNonExportable {
  id: string;
  status: PlanTaskStatus;
}

export interface ExportSelection {
  /** The rows to write, sorted by id for deterministic backlog-id assignment. */
  selected: PlanTask[];
  skipped_already_exported: SkippedExport[];
  /** Rows named in explicit mode whose terminal status makes them non-exportable. */
  skipped_non_exportable: SkippedNonExportable[];
  /** Ids requested via the explicit mode that no task matches. */
  missing_ids: string[];
}

/**
 * Compute the export selection from the full task set, the selectors, and the
 * map of `dedup_key → backlog id` already present in the user's backlog (from
 * `read_exported_backlog_keys`).
 */
export function select_exportable_tasks(
  all_tasks: PlanTask[],
  selectors: ExportSelectors,
  exported_dedup_keys: Map<string, string>,
): ExportSelection {
  const candidates: PlanTask[] = [];
  const missing_ids: string[] = [];

  if (selectors.ids.length > 0) {
    const by_id = new Map<string, PlanTask>(all_tasks.map((t) => [t.id, t]));
    for (const id of selectors.ids) {
      const task = by_id.get(id);
      if (task === undefined) missing_ids.push(id);
      else candidates.push(task);
    }
  } else {
    for (const task of all_tasks) {
      if (task.status !== selectors.status) continue;
      if (selectors.fault_area !== null && task.fault_area !== selectors.fault_area) continue;
      if (selectors.priority !== null) {
        const want_classifier = selectors.priority === "classifier";
        if (task.is_classifier_work !== want_classifier) continue;
      }
      candidates.push(task);
    }
  }

  const selected: PlanTask[] = [];
  const skipped_already_exported: SkippedExport[] = [];
  const skipped_non_exportable: SkippedNonExportable[] = [];
  for (const task of candidates) {
    if (task.status === "exported" && task.exported_backlog_task !== null) {
      skipped_already_exported.push({ id: task.id, backlog_task: task.exported_backlog_task });
      continue;
    }
    if (!EXPORTABLE_STATUSES.has(task.status)) {
      skipped_non_exportable.push({ id: task.id, status: task.status });
      continue;
    }
    const backlog_id = exported_dedup_keys.get(task.dedup_key);
    if (backlog_id !== undefined) {
      skipped_already_exported.push({ id: task.id, backlog_task: backlog_id });
      continue;
    }
    selected.push(task);
  }
  selected.sort((a, b) => a.id.localeCompare(b.id));

  return { selected, skipped_already_exported, skipped_non_exportable, missing_ids };
}

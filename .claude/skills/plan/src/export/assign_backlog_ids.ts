/**
 * Pure assignment of nested backlog task ids over a selected set of `PlanTask`
 * rows. The plan engine emits a three-tier tree per change group —
 * `architectural` (root) → `fault_area` (group node) → `localized` (concrete
 * fix leaf) — linked by `parent_id`. The export adapter mirrors that tree
 * faithfully into the user's `backlog/` decimal-id convention: a root becomes a
 * fresh top-level id (`TASK-347`), and every descendant takes a dotted child id
 * under its parent (`TASK-347.1`, `TASK-347.1.2`), carrying a `parent_task_id`
 * link the tracker reads.
 *
 * The tree is reconstructed from `parent_id` RESTRICTED TO THE SELECTED SET: a
 * row whose `parent_id` is null, or whose parent was not selected this run,
 * becomes its own top-level root. This keeps a partial selection (e.g. only some
 * leaves of a group) well-formed — every selected row still gets an id and no
 * child ever points at an absent parent.
 *
 * Deterministic ordering: roots are ordered by `id`; siblings are ordered
 * core-fix before interim classifier work, then by descending `observed_count`
 * (higher-impact fixes first), then by `id`. The 1-based sibling position drives
 * both the dotted suffix and the `ordinal` field (× 1000, matching the tracker's
 * convention) so backlog.md renders siblings in the same order regardless of
 * decimal string-sort quirks (`.10` vs `.2`).
 */

import type { PlanTask } from "../store/plan_task.js";

export interface BacklogIdAssignment {
  /** Dotted backlog id WITHOUT the `TASK-` prefix: `"347"`, `"347.1"`, `"347.1.2"`. */
  backlog_id: string;
  /** The parent task's dotted backlog id, or `null` at a top-level root. */
  parent_backlog_id: string | null;
  /** 1-based sibling position × 1000 for tracker display order; `null` at a root. */
  ordinal: number | null;
}

/** Order siblings: core fixes ahead of classifier work, higher impact first, then by id. */
function compare_siblings(a: PlanTask, b: PlanTask): number {
  const classifier_rank = Number(a.is_classifier_work) - Number(b.is_classifier_work);
  if (classifier_rank !== 0) return classifier_rank;
  if (a.observed_count !== b.observed_count) return b.observed_count - a.observed_count;
  return a.id.localeCompare(b.id);
}

/**
 * Assign a nested backlog id to every selected task. `first_top_level_id` is the
 * next free top-level integer (from `next_backlog_task_id`); the i-th root takes
 * `first_top_level_id + i`. Returns a map keyed by `PlanTask.id`; every input row
 * is present in the result.
 */
export function assign_backlog_ids(
  selected: PlanTask[],
  first_top_level_id: number,
): Map<string, BacklogIdAssignment> {
  const by_id = new Map<string, PlanTask>(selected.map((task) => [task.id, task]));

  // Children of each selected row, plus the roots (no selected parent), keyed by parent id.
  const children_of = new Map<string, PlanTask[]>();
  const roots: PlanTask[] = [];
  for (const task of selected) {
    const has_selected_parent = task.parent_id !== null && by_id.has(task.parent_id);
    if (!has_selected_parent) {
      roots.push(task);
      continue;
    }
    const siblings = children_of.get(task.parent_id as string) ?? [];
    siblings.push(task);
    children_of.set(task.parent_id as string, siblings);
  }

  const assignments = new Map<string, BacklogIdAssignment>();

  function assign_subtree(task: PlanTask, backlog_id: string, parent_backlog_id: string | null, ordinal: number | null): void {
    assignments.set(task.id, { backlog_id, parent_backlog_id, ordinal });
    const children = (children_of.get(task.id) ?? []).slice().sort(compare_siblings);
    children.forEach((child, index) => {
      const position = index + 1;
      assign_subtree(child, `${backlog_id}.${position}`, backlog_id, position * 1000);
    });
  }

  roots
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((root, index) => {
      assign_subtree(root, String(first_top_level_id + index), null, null);
    });

  return assignments;
}

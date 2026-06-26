/**
 * Pure renderer that turns an `AuthoredBacklogTask` into the user `backlog/` task
 * file the export adapter writes — the only place the prioritize pipeline's
 * artifacts are translated into the user's tracker format.
 *
 * The body is the architect's authored imperative work plan (`description_md` +
 * `acceptance_criteria`), transformed from the verified `refactor_plan.md`. The
 * `primaries` `PlanTask`s — one per source change group collapsed into this task
 * (a single group for an ordinary epic, several for a consolidated cluster) —
 * contribute only the loop-closure frontmatter, never body prose. The renderer
 * persists nothing — the adapter owns the single write into `backlog/`.
 *
 * The frontmatter stamps two list link fields that close the engine's dedup loop,
 * one entry per source group so a consolidated epic records every group it
 * graduated, not just one:
 *   - `plan_dedup_keys` — the VERBATIM `PlanTask.dedup_key` of each source row.
 *     The reconciler's read-only backlog dedup (`src/store/backlog_dedup.ts`) maps
 *     every entry back to this task to recognise already-promoted work and
 *     suppress re-proposal. The field name and the verbatim values are a fixed
 *     contract; never rename or transform them.
 *   - `plan_source_tasks` — each source `PlanTask.id`, for human traceability.
 */

import type { PlanTask } from "../store/plan_task.js";
import type { AuthoredBacklogTask } from "./task_assignment.js";

/** Backlog priority stamped from the task's role: a core fix outranks interim classifier work. */
export type BacklogPriority = "high" | "medium";

/**
 * A core-fix task is the real deliverable → `high`; an interim classifier-script
 * work item is explicitly lower-priority → `medium`. This is the same ordering
 * the engine encodes in `is_classifier_work` (core-fix tasks ahead of
 * classifier-work tasks).
 */
export function derive_backlog_priority(is_classifier_work: boolean): BacklogPriority {
  return is_classifier_work ? "medium" : "high";
}

/**
 * A filesystem-safe dash slug for the task filename. Strips characters that are
 * unsafe in a filename (`/ \ : * ? " < > |`) and any bracketed prefix, folds
 * whitespace to single dashes, and trims leading/trailing dashes. Mirrors the
 * `task-<id> - <slug>.md` backlog convention.
 */
export function slugify_title(title: string): string {
  return title
    .replace(/[/\\:*?"<>|[\]]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The backlog task filename: `task-<backlog_id> - <slug>.md` (lowercase `task-`, matching the tracker). */
export function backlog_task_filename(backlog_id: string, title: string): string {
  return `task-${backlog_id} - ${slugify_title(title)}.md`;
}

/**
 * Quote a YAML scalar that may carry `[`, `:`, or other flow-significant
 * characters. The title is authored free text, so newlines/tabs are escaped to
 * their C-style forms (which a YAML double-quoted scalar accepts) rather than
 * emitted literally, where they would split the `title:` line and corrupt the
 * frontmatter block.
 */
function yaml_double_quote(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

/** The full backlog task file the adapter writes: filename + markdown content. */
export interface RenderedBacklogTask {
  filename: string;
  content: string;
}

/**
 * Render one `AuthoredBacklogTask` into a complete backlog task file. The task
 * carries absolute backlog ids (already remapped). `primaries` are the source
 * `PlanTask`s whose `dedup_key`/`id` close the loop (one per collapsed source
 * group), whose `fault_area`s become the labels, and whose `is_classifier_work`
 * sets the priority — a core fix outranks classifier work, so the task is `high`
 * unless every source row is classifier work. `created_date` is passed in
 * (`YYYY-MM-DD HH:mm`) so the renderer stays pure and deterministic.
 */
export function render_backlog_task(
  task: AuthoredBacklogTask,
  primaries: PlanTask[],
  created_date: string,
): RenderedBacklogTask {
  const sources = primaries.slice().sort((a, b) => a.id.localeCompare(b.id));
  const priority = derive_backlog_priority(sources.every((p) => p.is_classifier_work));
  const fault_area_labels = [...new Set(sources.map((p) => p.fault_area))];

  const frontmatter = [
    "---",
    `id: TASK-${task.backlog_id}`,
    `title: ${yaml_double_quote(task.title)}`,
    "status: To Do",
    "assignee: []",
    `created_date: ${yaml_double_quote(created_date)}`,
    "labels:",
    "  - plan-export",
    ...fault_area_labels.map((fault_area) => `  - ${fault_area}`),
    "dependencies: []",
    ...(task.parent_backlog_id !== null ? [`parent_task_id: TASK-${task.parent_backlog_id}`] : []),
    `priority: ${priority}`,
    ...(task.ordinal !== null ? [`ordinal: ${task.ordinal}`] : []),
    "plan_dedup_keys:",
    ...sources.map((p) => `  - ${p.dedup_key}`),
    "plan_source_tasks:",
    ...sources.map((p) => `  - ${p.id}`),
    "---",
  ].join("\n");

  const acceptance_block = task.acceptance_criteria
    .map((item, index) => `- [ ] #${index + 1} ${item}`)
    .join("\n");

  const content =
    [
      frontmatter,
      "",
      "## Description",
      "",
      "<!-- SECTION:DESCRIPTION:BEGIN -->",
      "",
      task.description_md.trimEnd(),
      "",
      "<!-- SECTION:DESCRIPTION:END -->",
      "",
      "## Acceptance Criteria",
      "",
      "<!-- AC:BEGIN -->",
      "",
      acceptance_block,
      "",
      "<!-- AC:END -->",
    ].join("\n") + "\n";

  return { filename: backlog_task_filename(task.backlog_id, task.title), content };
}

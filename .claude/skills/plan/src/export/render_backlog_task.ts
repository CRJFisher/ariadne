/**
 * Pure renderers that turn a `PlanTask` row into the user `backlog/` task file
 * the export adapter writes — the only place the plan engine's vocabulary is
 * translated into the user's tracker format. They reuse the task's
 * ALREADY-rendered `title`/`body` (produced by `render_task_*` at mint time in
 * `build_plan_tasks`); the adapter never re-renders from a `StrategistPlanNode`
 * (a `PlanTask` carries none). The renderers persist nothing themselves — the
 * adapter script owns the single firewall-crossing write.
 *
 * The frontmatter stamps two link fields that close the engine's dedup loop:
 *   - `plan_dedup_key` — the VERBATIM `PlanTask.dedup_key`. The reconciler's
 *     read-only backlog dedup (`src/store/backlog_dedup.ts`) keys on exactly
 *     this field to recognise already-promoted work and suppress re-proposal.
 *     The name and value are a fixed contract; never rename or transform them.
 *   - `plan_source_task` — the source `PlanTask.id`, for human traceability.
 */

import type { PlanTask } from "@ariadnejs/skill-protocol";

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
 * unsafe in a filename (`/ \ : * ? " < > |`) and the area-prefix brackets a
 * `PlanTask.title` carries (`[name_resolution] …`), folds whitespace to single
 * dashes, and trims leading/trailing dashes. Mirrors the existing
 * `task-<id> - <slug>.md` backlog convention.
 */
export function slugify_title(title: string): string {
  return title
    .replace(/[/\\:*?"<>|[\]]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The backlog task filename: `task-<numeric_id> - <slug>.md` (lowercase `task-`, matching the tracker). */
export function backlog_task_filename(numeric_id: number, title: string): string {
  return `task-${numeric_id} - ${slugify_title(title)}.md`;
}

/**
 * The two backlog body regions split out of a `PlanTask.body`. `render_task_body`
 * emits, in one string: free prose, `## Observations`, `## Evidence`, then a
 * `## Acceptance criteria` checklist. The backlog file keeps these in two
 * HTML-comment-delimited regions, so the adapter relocates (never re-renders):
 * everything before the acceptance heading becomes the Description region; the
 * checklist items become the Acceptance Criteria region.
 */
export interface BodySplit {
  /** Prose + Observations + Evidence — everything before `## Acceptance criteria`. */
  description_md: string;
  /** The checklist item texts (the `- [ ]` prefix stripped), re-numbered by the renderer. */
  acceptance_items: string[];
}

const ACCEPTANCE_HEADING = /^## Acceptance criteria\s*$/m;
const CHECKLIST_ITEM = /^- \[ \] (.+)$/;

/**
 * Split a rendered `PlanTask.body` into its Description prose and the acceptance
 * checklist items. A body with no acceptance heading (a hand-edited or future
 * shape) puts everything in Description with no items — never a throw, since the
 * dedup/firewall contract depends only on frontmatter, not on the body shape.
 */
export function split_rendered_body(body: string): BodySplit {
  const match = ACCEPTANCE_HEADING.exec(body);
  if (match === null) {
    return { description_md: body.trimEnd(), acceptance_items: [] };
  }
  const description_md = body.slice(0, match.index).trimEnd();
  const after = body.slice(match.index + match[0].length);
  const acceptance_items: string[] = [];
  for (const line of after.split("\n")) {
    const item = CHECKLIST_ITEM.exec(line);
    if (item !== null) acceptance_items.push(item[1]);
  }
  return { description_md, acceptance_items };
}

/** Quote a YAML scalar that may carry `[`, `:`, or other flow-significant characters. */
function yaml_double_quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

/** The full backlog task file the adapter writes: filename + markdown content. */
export interface RenderedBacklogTask {
  filename: string;
  content: string;
}

/**
 * Render one `PlanTask` into a complete backlog task file. The `numeric_id` is
 * minted by the adapter (a fresh top-level backlog id); `created_date` is passed
 * in (`YYYY-MM-DD HH:mm`) so the renderer stays pure and deterministic.
 */
export function render_backlog_task(
  task: PlanTask,
  numeric_id: number,
  created_date: string,
): RenderedBacklogTask {
  const { description_md, acceptance_items } = split_rendered_body(task.body);
  const priority = derive_backlog_priority(task.is_classifier_work);

  const frontmatter = [
    "---",
    `id: TASK-${numeric_id}`,
    `title: ${yaml_double_quote(task.title)}`,
    "status: To Do",
    "assignee: []",
    `created_date: ${yaml_double_quote(created_date)}`,
    "labels:",
    "  - plan-export",
    `  - ${task.fault_area}`,
    "dependencies: []",
    `priority: ${priority}`,
    `plan_dedup_key: ${task.dedup_key}`,
    `plan_source_task: ${task.id}`,
    "---",
  ].join("\n");

  const acceptance_block = acceptance_items
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
      description_md,
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

  return { filename: backlog_task_filename(numeric_id, task.title), content };
}

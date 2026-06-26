/**
 * The `task_assignment.json` contract — `refactor-task-architect`'s output and
 * the export adapter's only source of backlog-task content.
 *
 * The architect reads a change group's verified `refactor_plan.md` and emits one
 * `AuthoredBacklogTask` per backlog task the group should become: an imperative
 * work plan (title + body + acceptance criteria) transformed from the
 * investigation, with the genuinely-separate downstream adaptations split into
 * sub-tasks. Each authored task also lists the `PlanTask` rows that collapse into
 * it (`plan_task_ids`), so the export adapter can flip every source row to
 * `exported` and stamp the dedup link from the primary row.
 *
 * The backlog card body is the architect's authored prose — never the cheap,
 * pre-investigation `PlanTask.body` the plan engine minted. That is the whole
 * point of the prioritize step: the task IS the transformation of the
 * investigation, not a copy of the routing-time hypothesis.
 *
 * Ids are authored RELATIVE (root = `"1"`, sub-tasks `"1.1"`, `"1.2"`); the
 * adapter resolves them to absolute backlog ids at export time via
 * `remap_authored_task`.
 */

/** One backlog task the architect authors from the refactor plan. */
export interface AuthoredBacklogTask {
  /** Dotted backlog id: relative as authored (`"1"`, `"1.1"`), absolute after remap (`"347"`, `"347.1"`). */
  backlog_id: string;
  /** The parent task's dotted id, or `null` at a top-level root. */
  parent_backlog_id: string | null;
  /** 1-based sibling position × 1000 for tracker display order; `null` at a root. */
  ordinal: number | null;
  /** Imperative task title (no `[area]` prefix). */
  title: string;
  /** Imperative work-plan body (markdown), transformed from the refactor plan. */
  description_md: string;
  /** Acceptance-criteria item texts; rendered as a numbered checklist. */
  acceptance_criteria: string[];
  /**
   * Every `PlanTask` id that collapses into this backlog task. All are flipped to
   * `exported`; the architectural rows (one per collapsed source group) supply the
   * card's `plan_dedup_keys`/`plan_source_tasks` frontmatter lists. Non-empty.
   */
  plan_task_ids: string[];
}

const RELATIVE_ID_RE = /^\d+(?:\.\d+)*$/;

function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Replace the leading (relative-root) segment of a dotted id with the absolute first id. */
function remap_id(id: string, first_id: number): string {
  const parts = id.split(".");
  parts[0] = String(first_id);
  return parts.join(".");
}

/** Resolve a relative authored task (root = `"1"`) to absolute backlog ids. */
export function remap_authored_task(task: AuthoredBacklogTask, first_id: number): AuthoredBacklogTask {
  return {
    ...task,
    backlog_id: remap_id(task.backlog_id, first_id),
    parent_backlog_id: task.parent_backlog_id !== null ? remap_id(task.parent_backlog_id, first_id) : null,
  };
}

/**
 * Parse and validate a `task_assignment.json` string into absolute-id authored
 * tasks. `source_label` prefixes every error so a malformed file names itself.
 * Throws on any structural violation — the contract is strict because a silent
 * default would mint a malformed backlog card.
 */
export function parse_task_assignment(
  raw: string,
  first_id: number,
  source_label: string,
): AuthoredBacklogTask[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${source_label}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!is_record(parsed) || !Array.isArray(parsed.tasks)) {
    throw new Error(`${source_label}: must be an object with a "tasks" array`);
  }
  return parsed.tasks.map((entry, index) =>
    remap_authored_task(validate_task(entry, index, source_label), first_id),
  );
}

function validate_task(entry: unknown, index: number, source_label: string): AuthoredBacklogTask {
  const at = `${source_label}: tasks[${index}]`;
  if (!is_record(entry)) throw new Error(`${at} must be an object`);

  const { backlog_id, parent_backlog_id, ordinal, title, description_md, acceptance_criteria, plan_task_ids } =
    entry;

  if (typeof backlog_id !== "string" || !RELATIVE_ID_RE.test(backlog_id)) {
    throw new Error(`${at}.backlog_id must be a dotted-decimal id (e.g. "1" or "1.2"), got ${JSON.stringify(backlog_id)}`);
  }
  if (parent_backlog_id !== null && (typeof parent_backlog_id !== "string" || !RELATIVE_ID_RE.test(parent_backlog_id))) {
    throw new Error(`${at}.parent_backlog_id must be a dotted-decimal id or null`);
  }
  if (ordinal !== null && ordinal !== undefined && typeof ordinal !== "number") {
    throw new Error(`${at}.ordinal must be a number or null`);
  }
  if (typeof title !== "string" || title.trim() === "") {
    throw new Error(`${at}.title must be a non-empty string`);
  }
  if (typeof description_md !== "string" || description_md.trim() === "") {
    throw new Error(`${at}.description_md must be a non-empty string`);
  }
  if (!Array.isArray(acceptance_criteria) || !acceptance_criteria.every((x): x is string => typeof x === "string")) {
    throw new Error(`${at}.acceptance_criteria must be an array of strings`);
  }
  if (
    !Array.isArray(plan_task_ids) ||
    plan_task_ids.length === 0 ||
    !plan_task_ids.every((x): x is string => typeof x === "string")
  ) {
    throw new Error(`${at}.plan_task_ids must be a non-empty array of plan task id strings`);
  }

  return {
    backlog_id,
    parent_backlog_id: parent_backlog_id ?? null,
    ordinal: ordinal ?? null,
    title,
    description_md,
    acceptance_criteria,
    plan_task_ids,
  };
}

import { PLAN_TASK_SCHEMA_VERSION, type PlanTask } from "./plan_task.js";

/**
 * The read boundary of the JSON plan task-store: parse one stored
 * `tasks/<id>.json` string into a {@link PlanTask}. Twin of
 * `parse_triage_results` — it validates shape and `schema_version`, not the deep
 * evidence rows (the engine is the only legitimate writer of these files, so
 * deep validation is its concern, not the store's).
 *
 * Throws if the payload is not an object or the `schema_version` does not equal
 * {@link PLAN_TASK_SCHEMA_VERSION}, plus a single field-kind rule: validate
 * exactly the fields whose wrong kind would fail *silently* downstream, and
 * trust everything else to the sole engine writer. Two such failure modes
 * exist, so two lists:
 *
 *   - {@link REQUIRED_STRING_FIELDS} — the strings the store keys or filters on.
 *     A non-string here mis-routes a query or dedup lookup with no error.
 *   - {@link REQUIRED_ARRAY_FIELDS} — the arrays a consumer iterates. A non-array
 *     here throws far from the store, in the engine's `.map`/`.length`.
 *   - {@link REQUIRED_BOOLEAN_FIELDS} — the booleans a consumer branches on for a
 *     safety guarantee. A missing `is_permanent_limitation` (a stale pre-rename
 *     row) reads as falsy, which would silently export a permanent-limitation
 *     row to `backlog/` — the exact outcome the export exclusion forbids.
 *
 * Fields outside these lists (`title`, `body`, `created_in_sweep`, `strategist`,
 * the nullable links, `observed_count`) are returned verbatim: a wrong kind
 * there is a harmless passthrough the engine owns, so guarding it would be
 * surplus — the same altitude as `parse_triage_results` deferring deep-row
 * validation to its producer.
 */

/** The strings the store keys or filters on; a wrong kind silently mis-routes a query. */
const REQUIRED_STRING_FIELDS: readonly (keyof PlanTask)[] = [
  "id",
  "tier",
  "fault_area",
  "status",
  "dedup_key",
];

/** The arrays a consumer iterates; a wrong kind throws far from the store. Twin of triage's `REQUIRED_ARRAYS`. */
const REQUIRED_ARRAY_FIELDS: readonly (keyof PlanTask)[] = [
  "child_ids",
  "evidence",
  "projects",
  "source_runs",
];

/** The booleans a consumer branches on for a safety guarantee; a missing one reads falsy and silently mis-routes. */
const REQUIRED_BOOLEAN_FIELDS: readonly (keyof PlanTask)[] = ["is_permanent_limitation"];

export function parse_plan_task(source_label: string, text: string): PlanTask {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${source_label}: invalid JSON — ${msg}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${source_label}: expected an object, got ${describe(parsed)}`);
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.schema_version !== PLAN_TASK_SCHEMA_VERSION) {
    throw new Error(
      `${source_label}: schema_version=${String(obj.schema_version)} does not match ` +
        `current v${PLAN_TASK_SCHEMA_VERSION}. Re-mint the task or remove the stale file.`,
    );
  }
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof obj[field] !== "string") {
      throw new Error(
        `${source_label}: '${String(field)}' must be a string (got ${describe(obj[field])})`,
      );
    }
  }
  for (const field of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(obj[field])) {
      throw new Error(
        `${source_label}: '${String(field)}' must be an array (got ${describe(obj[field])})`,
      );
    }
  }
  for (const field of REQUIRED_BOOLEAN_FIELDS) {
    if (typeof obj[field] !== "boolean") {
      throw new Error(
        `${source_label}: '${String(field)}' must be a boolean (got ${describe(obj[field])}). Re-mint the task or remove the stale file.`,
      );
    }
  }
  return parsed as PlanTask;
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

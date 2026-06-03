import { PLAN_TASK_SCHEMA_VERSION, type PlanTask } from "@ariadnejs/skill-protocol";

/**
 * The read boundary of the JSON plan task-store: parse one stored
 * `tasks/<id>.json` string into a {@link PlanTask}. Twin of
 * `parse_triage_results` — it validates shape and `schema_version`, not the deep
 * evidence rows (the engine is the only legitimate writer of these files, so
 * deep validation is its concern, not the store's).
 *
 * Throws if the payload is not an object, the `schema_version` does not equal
 * {@link PLAN_TASK_SCHEMA_VERSION}, or a primary-key / queryable field is the
 * wrong kind — so a corrupt or stale file can never silently mis-filter a query
 * or mis-key a dedup lookup.
 */

/** Non-null string fields the store keys or filters on; a wrong kind would mis-route a query. */
const REQUIRED_STRING_FIELDS: readonly (keyof PlanTask)[] = [
  "id",
  "tier",
  "fault_area",
  "status",
  "dedup_key",
];

/** Required arrays the store returns on round-trip; the twin of triage's `REQUIRED_ARRAYS`. */
const REQUIRED_ARRAY_FIELDS: readonly (keyof PlanTask)[] = [
  "child_ids",
  "evidence",
  "projects",
  "source_runs",
];

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
  return parsed as PlanTask;
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

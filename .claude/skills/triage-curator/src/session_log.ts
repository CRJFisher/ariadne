import type {
  InvestigatorFailureCategory,
  InvestigatorSessionLog,
  InvestigatorSessionStatus,
} from "./types.js";

const FAILURE_CATEGORIES = new Set<InvestigatorFailureCategory>([
  "group_incoherent",
  "pattern_unclear",
  "classifier_infeasible",
  "registry_conflict",
  "permanent_locked",
  "other",
]);

const STATUSES = new Set<InvestigatorSessionStatus>([
  "success",
  "failure",
  "blocked_missing_signal",
]);

export interface SessionLogParseError {
  error: string;
}

/**
 * Shape + invariant check for investigator-written session logs. This is the
 * LLM boundary — the sub-agent writes the JSON; the validator (step 4.25) runs
 * this before finalize touches the file. Finalize trusts shape after validation.
 *
 * Required field invariants:
 *   status="failure"  → failure_category + failure_details non-null
 *   status="blocked_missing_signal" → mode-specific checks in the main validator
 */
export function parse_investigator_session_log(
  raw: unknown,
): InvestigatorSessionLog | SessionLogParseError {
  if (typeof raw !== "object" || raw === null) {
    return { error: "session log is not an object" };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.group_id !== "string" || obj.group_id.length === 0) {
    return { error: "session log: group_id must be a non-empty string" };
  }
  if (obj.mode !== "residual" && obj.mode !== "promoted") {
    return { error: "session log: mode must be 'residual' or 'promoted'" };
  }
  if (typeof obj.status !== "string" || !STATUSES.has(obj.status as InvestigatorSessionStatus)) {
    return { error: "session log: status must be success|failure|blocked_missing_signal" };
  }
  const status = obj.status as InvestigatorSessionStatus;
  if (typeof obj.reasoning !== "string") {
    return { error: "session log: reasoning must be a string" };
  }

  let failure_category: InvestigatorFailureCategory | null;
  if (obj.failure_category === null || obj.failure_category === undefined) {
    failure_category = null;
  } else if (
    typeof obj.failure_category === "string" &&
    FAILURE_CATEGORIES.has(obj.failure_category as InvestigatorFailureCategory)
  ) {
    failure_category = obj.failure_category as InvestigatorFailureCategory;
  } else {
    return { error: "session log: failure_category must be null or a known category" };
  }

  const failure_details = obj.failure_details;
  if (failure_details !== null && typeof failure_details !== "string") {
    return { error: "session log: failure_details must be a string or null" };
  }
  const success_summary = obj.success_summary;
  if (success_summary !== null && typeof success_summary !== "string") {
    return { error: "session log: success_summary must be a string or null" };
  }
  if (
    typeof obj.entries_examined_count !== "number" ||
    !Number.isInteger(obj.entries_examined_count) ||
    obj.entries_examined_count < 0
  ) {
    return { error: "session log: entries_examined_count must be a non-negative integer" };
  }
  if (typeof obj.timestamp !== "string" || obj.timestamp.length === 0) {
    return { error: "session log: timestamp must be a non-empty ISO-8601 string" };
  }

  if (status === "failure") {
    if (failure_category === null) {
      return { error: "session log: status='failure' requires non-null failure_category" };
    }
    if (failure_details === null || failure_details.length === 0) {
      return { error: "session log: status='failure' requires non-empty failure_details" };
    }
  }

  return {
    group_id: obj.group_id,
    mode: obj.mode,
    status,
    reasoning: obj.reasoning,
    failure_category,
    failure_details: (failure_details as string | null) ?? null,
    success_summary: (success_summary as string | null) ?? null,
    entries_examined_count: obj.entries_examined_count,
    timestamp: obj.timestamp,
  };
}

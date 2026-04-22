import type {
  InvestigateResponse,
  InvestigatorFailureCategory,
  InvestigatorSessionActions,
  InvestigatorSessionLog,
  InvestigatorSessionStatus,
} from "./types.js";

import type { ParseError } from "./apply_proposals.js";

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

const CLASSIFIER_KINDS = new Set<"predicate" | "builtin" | "none">([
  "predicate",
  "builtin",
  "none",
]);

export function parse_investigator_session_log(
  raw: unknown,
): InvestigatorSessionLog | ParseError {
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
    return {
      error:
        "session log: status must be 'success', 'failure', or 'blocked_missing_signal'",
    };
  }
  const status = obj.status as InvestigatorSessionStatus;

  if (typeof obj.reasoning !== "string") {
    return { error: "session log: reasoning must be a string" };
  }

  const failure_category_raw = obj.failure_category;
  let failure_category: InvestigatorFailureCategory | null;
  if (failure_category_raw === null || failure_category_raw === undefined) {
    failure_category = null;
  } else if (
    typeof failure_category_raw === "string" &&
    FAILURE_CATEGORIES.has(failure_category_raw as InvestigatorFailureCategory)
  ) {
    failure_category = failure_category_raw as InvestigatorFailureCategory;
  } else {
    return {
      error:
        "session log: failure_category must be null or one of group_incoherent, pattern_unclear, classifier_infeasible, registry_conflict, permanent_locked, other",
    };
  }

  const failure_details = obj.failure_details;
  if (failure_details !== null && typeof failure_details !== "string") {
    return { error: "session log: failure_details must be a string or null" };
  }

  const success_summary = obj.success_summary;
  if (success_summary !== null && typeof success_summary !== "string") {
    return { error: "session log: success_summary must be a string or null" };
  }

  const actions_result = parse_actions(obj.actions);
  if ("error" in actions_result) return actions_result;

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

  const log: InvestigatorSessionLog = {
    group_id: obj.group_id,
    mode: obj.mode,
    status,
    reasoning: obj.reasoning,
    failure_category,
    failure_details: (failure_details as string | null) ?? null,
    success_summary: (success_summary as string | null) ?? null,
    actions: actions_result.value,
    entries_examined_count: obj.entries_examined_count,
    timestamp: obj.timestamp,
  };

  const invariant_error = check_status_invariants(log);
  if (invariant_error !== null) return { error: invariant_error };

  return log;
}

function parse_actions(
  raw: unknown,
): { value: InvestigatorSessionActions } | ParseError {
  if (typeof raw !== "object" || raw === null) {
    return { error: "session log: actions must be an object" };
  }
  const obj = raw as Record<string, unknown>;

  const kind_raw = obj.classifier_kind;
  let classifier_kind: InvestigatorSessionActions["classifier_kind"];
  if (kind_raw === null || kind_raw === undefined) {
    classifier_kind = null;
  } else if (typeof kind_raw === "string" && CLASSIFIER_KINDS.has(kind_raw as "predicate" | "builtin" | "none")) {
    classifier_kind = kind_raw as "predicate" | "builtin" | "none";
  } else {
    return {
      error: "session log: actions.classifier_kind must be null, 'predicate', 'builtin', or 'none'",
    };
  }

  if (typeof obj.backlog_ref_emitted !== "boolean") {
    return { error: "session log: actions.backlog_ref_emitted must be a boolean" };
  }

  if (
    typeof obj.new_signals_needed_count !== "number" ||
    !Number.isInteger(obj.new_signals_needed_count) ||
    obj.new_signals_needed_count < 0
  ) {
    return {
      error: "session log: actions.new_signals_needed_count must be a non-negative integer",
    };
  }

  if (typeof obj.classifier_spec_emitted !== "boolean") {
    return {
      error: "session log: actions.classifier_spec_emitted must be a boolean",
    };
  }

  return {
    value: {
      classifier_kind,
      backlog_ref_emitted: obj.backlog_ref_emitted,
      new_signals_needed_count: obj.new_signals_needed_count,
      classifier_spec_emitted: obj.classifier_spec_emitted,
    },
  };
}

/**
 * Status-specific required-field invariants. See types.ts comments on
 * InvestigatorSessionStatus for semantics.
 */
function check_status_invariants(log: InvestigatorSessionLog): string | null {
  if (log.status === "failure") {
    if (log.failure_category === null) {
      return "session log: status='failure' requires non-null failure_category";
    }
    if (log.failure_details === null || log.failure_details.length === 0) {
      return "session log: status='failure' requires non-empty failure_details";
    }
  }
  if (log.status === "success") {
    if (log.actions.classifier_kind === null || log.actions.classifier_kind === "none") {
      return "session log: status='success' requires actions.classifier_kind of 'predicate' or 'builtin'";
    }
  }
  if (log.status === "blocked_missing_signal") {
    if (log.actions.classifier_kind !== "none") {
      return "session log: status='blocked_missing_signal' requires actions.classifier_kind='none'";
    }
    if (log.actions.new_signals_needed_count === 0) {
      return "session log: status='blocked_missing_signal' requires new_signals_needed_count > 0";
    }
  }
  return null;
}

export interface SessionResponseMismatch {
  group_id: string;
  field: string;
  session_value: string;
  response_value: string;
}

/**
 * Verify the session log's `actions` fields agree with the corresponding
 * InvestigateResponse. Mismatches do not block apply — they are surfaced in
 * the finalize summary as a sub-agent bug signal.
 */
export function cross_check_session_against_response(
  log: InvestigatorSessionLog,
  response: InvestigateResponse,
): SessionResponseMismatch[] {
  const mismatches: SessionResponseMismatch[] = [];
  const response_kind = response.proposed_classifier?.kind ?? null;
  if (log.actions.classifier_kind !== response_kind) {
    mismatches.push({
      group_id: log.group_id,
      field: "classifier_kind",
      session_value: String(log.actions.classifier_kind),
      response_value: String(response_kind),
    });
  }
  const response_backlog_emitted = response.backlog_ref !== null;
  if (log.actions.backlog_ref_emitted !== response_backlog_emitted) {
    mismatches.push({
      group_id: log.group_id,
      field: "backlog_ref_emitted",
      session_value: String(log.actions.backlog_ref_emitted),
      response_value: String(response_backlog_emitted),
    });
  }
  if (log.actions.new_signals_needed_count !== response.new_signals_needed.length) {
    mismatches.push({
      group_id: log.group_id,
      field: "new_signals_needed_count",
      session_value: String(log.actions.new_signals_needed_count),
      response_value: String(response.new_signals_needed.length),
    });
  }
  const response_spec_emitted = response.classifier_spec !== null;
  if (log.actions.classifier_spec_emitted !== response_spec_emitted) {
    mismatches.push({
      group_id: log.group_id,
      field: "classifier_spec_emitted",
      session_value: String(log.actions.classifier_spec_emitted),
      response_value: String(response_spec_emitted),
    });
  }
  return mismatches;
}

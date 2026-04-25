/**
 * Step 4.25 validation — runs over every investigator response AFTER Task()
 * dispatch and BEFORE Step 4.5 authoring. Boundary check on LLM-produced JSON:
 *
 *   - Unknown SignalCheck ops (renderer would die mid-render)
 *   - `response.group_id` rename without an explicit retarget declaration
 *   - `retargets_to` pointing at a non-existent registry entry
 *   - Retarget responses carrying `positive_examples` that index the wrong group
 *   - `positive_examples` / `negative_examples` out-of-range vs source group
 *   - `kind: "none"` proposals with no missing-signal claim and no session-log
 *     failure category (silent dead-end)
 *   - Two responses targeting the same classifier file (silent overwrite)
 *
 * The module is pure and test-focused: no I/O. The companion script
 * `scripts/validate_responses.ts` handles file-system loading.
 */

import { validate_spec_example_indexes } from "./apply_proposals.js";
import type {
  AriadneBug,
  AriadneRootCauseCategory,
  BuiltinClassifierSpec,
  ClassifierSpecProposal,
  FalsePositiveGroup,
  IntrospectionGap,
  InvestigateResponse,
  InvestigatorSessionLog,
  KnownIssue,
  SignalCheck,
} from "./types.js";
import { ARIADNE_ROOT_CAUSE_CATEGORIES, SIGNAL_CHECK_OPS } from "./types.js";

const TASK_ID_PATTERN = /^TASK-[0-9]+(?:\.[0-9]+)*$/;

export type ValidationIssueCode =
  | "shape_error"
  | "group_id_mismatch"
  | "retargets_to_missing_entry"
  | "retarget_must_not_carry_examples"
  | "example_index_out_of_range"
  | "kind_none_no_signals_no_failure"
  | "missing_ariadne_bug"
  | "target_conflict";

export interface ValidationIssue {
  group_id: string;
  response_path: string;
  code: ValidationIssueCode;
  message: string;
}

export interface ValidationInput {
  /** Group id derived from the response filename. Used to check group_id renames. */
  dispatch_group_id: string;
  /** Absolute path of the response JSON — surfaces in error messages. */
  response_path: string;
  /** JSON.parse'd content of the response file (raw, pre-shape-validated). */
  response_raw: unknown;
  /** Source-group view from the triage run; null when the dispatch group is absent. */
  source_group: FalsePositiveGroup | null;
  /** Current registry — needed to verify `retargets_to` references an existing entry. */
  registry: KnownIssue[];
  /** Sibling `<group>.session.json`, if present; null otherwise. */
  session_log: InvestigatorSessionLog | null;
}

export function validate_response(inp: ValidationInput): ValidationIssue[] {
  const parsed = parse_response_shape(inp.response_raw);
  if ("error" in parsed) {
    return [
      {
        group_id: inp.dispatch_group_id,
        response_path: inp.response_path,
        code: "shape_error",
        message: parsed.error,
      },
    ];
  }

  const issues: ValidationIssue[] = [];

  if (parsed.group_id !== inp.dispatch_group_id) {
    issues.push({
      group_id: inp.dispatch_group_id,
      response_path: inp.response_path,
      code: "group_id_mismatch",
      message:
        `response.group_id='${parsed.group_id}' does not match dispatch group ` +
        `'${inp.dispatch_group_id}'. To extend an existing registry entry, keep ` +
        `group_id='${inp.dispatch_group_id}' and set ` +
        "retargets_to='<existing-registry-group-id>' instead of renaming.",
    });
  }

  if (parsed.retargets_to !== null) {
    const exists = inp.registry.some((r) => r.group_id === parsed.retargets_to);
    if (!exists) {
      issues.push({
        group_id: inp.dispatch_group_id,
        response_path: inp.response_path,
        code: "retargets_to_missing_entry",
        message: `retargets_to='${parsed.retargets_to}' does not match any existing registry group_id`,
      });
    }
    if (parsed.classifier_spec !== null) {
      const pos = parsed.classifier_spec.positive_examples.length;
      const neg = parsed.classifier_spec.negative_examples.length;
      if (pos > 0 || neg > 0) {
        issues.push({
          group_id: inp.dispatch_group_id,
          response_path: inp.response_path,
          code: "retarget_must_not_carry_examples",
          message:
            `retarget response has positive_examples (${pos}) and/or negative_examples (${neg}). ` +
            `Those indices reference the source group '${parsed.group_id}', but the upsert ` +
            `lands on '${parsed.retargets_to}' — leave both arrays empty when retargeting.`,
        });
      }
    }
  } else if (parsed.classifier_spec !== null && inp.source_group !== null) {
    const index_errors = validate_spec_example_indexes(parsed, {
      [parsed.group_id]: inp.source_group.entries.length,
    });
    for (const err of index_errors) {
      issues.push({
        group_id: inp.dispatch_group_id,
        response_path: inp.response_path,
        code: "example_index_out_of_range",
        message: err,
      });
    }
  }

  if (parsed.proposed_classifier?.kind === "none") {
    const has_gap = parsed.introspection_gap !== null;
    const has_failure =
      inp.session_log?.status === "failure" &&
      inp.session_log.failure_category !== null;
    if (!has_gap && !has_failure) {
      issues.push({
        group_id: inp.dispatch_group_id,
        response_path: inp.response_path,
        code: "kind_none_no_signals_no_failure",
        message:
          "proposed_classifier.kind='none' but response carries no introspection_gap " +
          "and session log has no failure_category — this is a silent dead-end. " +
          "Either declare the introspection gap (introspection_gap.signals_needed[]) " +
          "or record a failure_category in the session log.",
      });
    }
  }

  const proposes_workaround =
    parsed.proposed_classifier !== null && parsed.proposed_classifier.kind !== "none";
  if (proposes_workaround && parsed.ariadne_bug === null) {
    issues.push({
      group_id: inp.dispatch_group_id,
      response_path: inp.response_path,
      code: "missing_ariadne_bug",
      message:
        "proposed_classifier is a working classifier but ariadne_bug is null. " +
        "A classifier is a workaround; the resolver-level bug must also be filed " +
        "(or attached to an existing_task_id). Populate ariadne_bug with " +
        "root_cause_category, title, and description.",
    });
  }

  return issues;
}

/**
 * One validated response paired with the dispatch metadata needed to report
 * cross-response conflicts. `parsed` is null when shape validation failed —
 * those responses are excluded from coherence checks (the per-response
 * shape_error already surfaces them).
 */
export interface RunCoherenceInput {
  dispatch_group_id: string;
  response_path: string;
  parsed: InvestigateResponse | null;
}

/**
 * Check invariants spanning the full set of responses in a run. Today: no two
 * responses may claim the same classifier target. Render writes to
 * `check_<target>.ts`, so sharing a target silently overwrites both the file
 * and the registry entry.
 */
export function validate_run_coherence(
  inputs: RunCoherenceInput[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const by_target = new Map<string, RunCoherenceInput[]>();
  for (const i of inputs) {
    if (i.parsed === null) continue;
    const target = i.parsed.retargets_to ?? i.parsed.group_id;
    const list = by_target.get(target) ?? [];
    list.push(i);
    by_target.set(target, list);
  }
  for (const [target, claimants] of by_target) {
    if (claimants.length <= 1) continue;
    const sources = claimants.map((c) => `'${c.dispatch_group_id}'`).join(", ");
    for (const c of claimants) {
      issues.push({
        group_id: c.dispatch_group_id,
        response_path: c.response_path,
        code: "target_conflict",
        message:
          `classifier target '${target}' is claimed by ${claimants.length} responses (${sources}). ` +
          "Renders collide on the same `.ts` file and registry upserts silently overwrite. " +
          "Pick one response to own the target; the others must re-investigate with a different " +
          "retargets_to value or drop retargets_to entirely.",
      });
    }
  }
  return issues;
}

// ===== Shape validation (LLM boundary) =====

interface ShapeError {
  error: string;
}

const DEFAULT_MIN_CONFIDENCE = 0.9;

/**
 * Shape + XOR check on an investigator-written JSON response. This is the LLM
 * boundary — finalize trusts the shape after validation passes, so this is the
 * one place the response structure is fully validated.
 */
export function parse_response_shape(raw: unknown): InvestigateResponse | ShapeError {
  if (typeof raw !== "object" || raw === null) {
    return { error: "investigate response is not an object" };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.group_id !== "string" || obj.group_id.length === 0) {
    return { error: "response: group_id must be a non-empty string" };
  }
  if (typeof obj.reasoning !== "string") {
    return { error: "response: reasoning must be a string" };
  }

  let retargets_to: string | null;
  if (obj.retargets_to === undefined || obj.retargets_to === null) {
    retargets_to = null;
  } else if (typeof obj.retargets_to === "string" && obj.retargets_to.length > 0) {
    retargets_to = obj.retargets_to;
  } else {
    return { error: "response: retargets_to must be a non-empty string when present" };
  }

  const classifier_result = parse_classifier_proposal(obj.proposed_classifier);
  if ("error" in classifier_result) return classifier_result;

  if (!("introspection_gap" in obj)) {
    return {
      error:
        "response: introspection_gap field is required (set to null when no signal gap exists)",
    };
  }
  const gap_result = parse_introspection_gap(obj.introspection_gap);
  if ("error" in gap_result) return gap_result;

  if (!("ariadne_bug" in obj)) {
    return {
      error:
        "response: ariadne_bug field is required (set to null when no resolver bug applies)",
    };
  }
  const bug_result = parse_ariadne_bug(obj.ariadne_bug);
  if ("error" in bug_result) return bug_result;

  const spec_result = parse_classifier_spec(obj.classifier_spec, classifier_result.value);
  if ("error" in spec_result) return spec_result;

  return {
    group_id: obj.group_id,
    proposed_classifier: classifier_result.value,
    classifier_spec: spec_result.value,
    retargets_to,
    introspection_gap: gap_result.value,
    ariadne_bug: bug_result.value,
    reasoning: obj.reasoning,
  };
}

function parse_classifier_proposal(
  raw: unknown,
): { value: ClassifierSpecProposal | null } | ShapeError {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== "object") {
    return { error: "proposed_classifier must be an object or null" };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.kind !== "none" && obj.kind !== "builtin") {
    return { error: "proposed_classifier.kind must be 'none' or 'builtin'" };
  }
  if (obj.kind === "none") return { value: { kind: "none" } };

  const min_confidence = parse_min_confidence(obj.min_confidence);
  if (typeof min_confidence !== "number") return min_confidence;
  if (typeof obj.function_name !== "string" || obj.function_name.length === 0) {
    return { error: "proposed_classifier: kind='builtin' requires a non-empty 'function_name'" };
  }
  return { value: { kind: "builtin", function_name: obj.function_name, min_confidence } };
}

function parse_min_confidence(raw: unknown): number | ShapeError {
  if (raw === undefined) return DEFAULT_MIN_CONFIDENCE;
  if (typeof raw !== "number") {
    return { error: "min_confidence must be a number" };
  }
  if (raw < 0 || raw > 1) {
    return { error: "min_confidence must be in [0, 1]" };
  }
  return raw;
}

function parse_introspection_gap(
  raw: unknown,
): { value: IntrospectionGap | null } | ShapeError {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== "object") {
    return { error: "introspection_gap must be an object or null" };
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.signals_needed)) {
    return { error: "introspection_gap.signals_needed must be an array" };
  }
  for (const [idx, s] of obj.signals_needed.entries()) {
    if (typeof s !== "string" || s.length === 0) {
      return {
        error: `introspection_gap.signals_needed[${idx}] must be a non-empty string`,
      };
    }
  }
  const signals_needed = obj.signals_needed as string[];
  if (signals_needed.length === 0) {
    return {
      error:
        "introspection_gap.signals_needed must be non-empty — drop introspection_gap to null if no signals are missing",
    };
  }
  if (typeof obj.title !== "string" || obj.title.length === 0) {
    return { error: "introspection_gap.title must be a non-empty string" };
  }
  if (typeof obj.description !== "string") {
    return { error: "introspection_gap.description must be a string" };
  }
  return {
    value: { signals_needed, title: obj.title, description: obj.description },
  };
}

function parse_ariadne_bug(raw: unknown): { value: AriadneBug | null } | ShapeError {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== "object") {
    return { error: "ariadne_bug must be an object or null" };
  }
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.root_cause_category !== "string" ||
    !ARIADNE_ROOT_CAUSE_CATEGORIES.includes(obj.root_cause_category as AriadneRootCauseCategory)
  ) {
    return {
      error:
        `ariadne_bug.root_cause_category must be one of: ${ARIADNE_ROOT_CAUSE_CATEGORIES.join(", ")}`,
    };
  }
  const root_cause_category = obj.root_cause_category as AriadneRootCauseCategory;
  if (typeof obj.title !== "string" || obj.title.length === 0) {
    return { error: "ariadne_bug.title must be a non-empty string" };
  }
  if (typeof obj.description !== "string") {
    return { error: "ariadne_bug.description must be a string" };
  }
  let existing_task_id: string | null;
  if (obj.existing_task_id === undefined || obj.existing_task_id === null) {
    existing_task_id = null;
  } else if (typeof obj.existing_task_id !== "string") {
    return { error: "ariadne_bug.existing_task_id must be a string or null" };
  } else if (!TASK_ID_PATTERN.test(obj.existing_task_id)) {
    return {
      error:
        `ariadne_bug.existing_task_id '${obj.existing_task_id}' must match ${TASK_ID_PATTERN.source}`,
    };
  } else {
    existing_task_id = obj.existing_task_id;
  }
  return {
    value: {
      root_cause_category,
      title: obj.title,
      description: obj.description,
      existing_task_id,
    },
  };
}

function parse_classifier_spec(
  raw: unknown,
  proposed: ClassifierSpecProposal | null,
): { value: BuiltinClassifierSpec | null } | ShapeError {
  const requires_spec = proposed?.kind === "builtin";
  if (raw === null || raw === undefined) {
    if (requires_spec) {
      return { error: "classifier_spec required when proposed_classifier.kind='builtin'" };
    }
    return { value: null };
  }
  if (!requires_spec) {
    return { error: "classifier_spec must be null unless proposed_classifier.kind='builtin'" };
  }
  if (typeof raw !== "object") {
    return { error: "classifier_spec must be an object" };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.function_name !== "string" || obj.function_name.length === 0) {
    return { error: "classifier_spec.function_name must be a non-empty string" };
  }
  if (obj.function_name !== proposed.function_name) {
    return { error: "classifier_spec.function_name must equal proposed_classifier.function_name" };
  }
  const min_confidence = parse_min_confidence(obj.min_confidence);
  if (typeof min_confidence !== "number") return min_confidence;
  if (obj.combinator !== "all" && obj.combinator !== "any") {
    return { error: "classifier_spec.combinator must be 'all' or 'any'" };
  }
  if (!Array.isArray(obj.checks)) {
    return { error: "classifier_spec.checks must be an array" };
  }
  const checks: SignalCheck[] = [];
  for (const [idx, c] of obj.checks.entries()) {
    const check_result = parse_signal_check(c, idx);
    if ("error" in check_result) return check_result;
    checks.push(check_result.value);
  }
  const positive = parse_example_indexes(obj.positive_examples, "positive_examples");
  if ("error" in positive) return positive;
  const negative = parse_example_indexes(obj.negative_examples, "negative_examples");
  if ("error" in negative) return negative;
  if (typeof obj.description !== "string") {
    return { error: "classifier_spec.description must be a string" };
  }
  return {
    value: {
      function_name: obj.function_name,
      min_confidence,
      combinator: obj.combinator,
      checks,
      positive_examples: positive.value,
      negative_examples: negative.value,
      description: obj.description,
    },
  };
}

const LANGUAGE_VALUES = new Set(["typescript", "javascript", "python", "rust"]);

function parse_signal_check(raw: unknown, idx: number): { value: SignalCheck } | ShapeError {
  if (typeof raw !== "object" || raw === null) {
    return { error: `checks[${idx}] must be an object` };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.op !== "string") {
    return { error: `checks[${idx}].op must be a string` };
  }
  const prefix = `checks[${idx}]`;
  const s = (field: string): { ok: string } | ShapeError => {
    const v = obj[field];
    if (typeof v !== "string") return { error: `${prefix}.${field} must be a string` };
    return { ok: v };
  };
  const int = (field: string): { ok: number } | ShapeError => {
    const v = obj[field];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
      return { error: `${prefix}.${field} must be a non-negative integer` };
    }
    return { ok: v };
  };

  switch (obj.op) {
    case "diagnosis_eq": {
      const r = s("value");
      if ("error" in r) return r;
      return { value: { op: "diagnosis_eq", value: r.ok } };
    }
    case "language_eq": {
      if (typeof obj.value !== "string" || !LANGUAGE_VALUES.has(obj.value)) {
        return { error: `${prefix}.value must be typescript|javascript|python|rust` };
      }
      // Narrowed by LANGUAGE_VALUES membership check.
      const value = obj.value as "typescript" | "javascript" | "python" | "rust";
      return { value: { op: "language_eq", value } };
    }
    case "syntactic_feature_eq": {
      const name = s("name");
      if ("error" in name) return name;
      if (name.ok.length === 0) {
        return { error: `${prefix}.name must be a non-empty string` };
      }
      if (
        typeof obj.value !== "string" &&
        typeof obj.value !== "number" &&
        typeof obj.value !== "boolean"
      ) {
        return { error: `${prefix}.value must be a string, number, or boolean` };
      }
      return { value: { op: "syntactic_feature_eq", name: name.ok, value: obj.value } };
    }
    case "grep_line_regex": {
      const r = s("pattern");
      if ("error" in r) return r;
      try {
        new RegExp(r.ok);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        return { error: `${prefix}.pattern is not a valid regex — ${reason}` };
      }
      return { value: { op: "grep_line_regex", pattern: r.ok } };
    }
    case "decorator_matches": {
      const r = s("pattern");
      if ("error" in r) return r;
      try {
        new RegExp(r.ok);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        return { error: `${prefix}.pattern is not a valid regex — ${reason}` };
      }
      return { value: { op: "decorator_matches", pattern: r.ok } };
    }
    case "has_capture_at_grep_hit": {
      const r = s("capture_name");
      if ("error" in r) return r;
      return { value: { op: "has_capture_at_grep_hit", capture_name: r.ok } };
    }
    case "missing_capture_at_grep_hit": {
      const r = s("capture_name");
      if ("error" in r) return r;
      return { value: { op: "missing_capture_at_grep_hit", capture_name: r.ok } };
    }
    case "receiver_kind_eq": {
      const r = s("value");
      if ("error" in r) return r;
      return { value: { op: "receiver_kind_eq", value: r.ok } };
    }
    case "resolution_failure_reason_eq": {
      const r = s("value");
      if ("error" in r) return r;
      return { value: { op: "resolution_failure_reason_eq", value: r.ok } };
    }
    case "callers_count_at_least": {
      const r = int("n");
      if ("error" in r) return r;
      return { value: { op: "callers_count_at_least", n: r.ok } };
    }
    case "callers_count_at_most": {
      const r = int("n");
      if ("error" in r) return r;
      return { value: { op: "callers_count_at_most", n: r.ok } };
    }
    case "file_path_matches": {
      const r = s("pattern");
      if ("error" in r) return r;
      try {
        new RegExp(r.ok);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        return { error: `${prefix}.pattern is not a valid regex — ${reason}` };
      }
      return { value: { op: "file_path_matches", pattern: r.ok } };
    }
    case "name_matches": {
      const r = s("pattern");
      if ("error" in r) return r;
      try {
        new RegExp(r.ok);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        return { error: `${prefix}.pattern is not a valid regex — ${reason}` };
      }
      return { value: { op: "name_matches", pattern: r.ok } };
    }
    case "grep_hits_all_intra_file": {
      if (typeof obj.value !== "boolean") {
        return { error: `${prefix}.value must be boolean` };
      }
      return { value: { op: "grep_hits_all_intra_file", value: obj.value } };
    }
    case "grep_hit_neighbourhood_matches": {
      const p = s("pattern");
      if ("error" in p) return p;
      const w = obj.window;
      if (typeof w !== "number" || !Number.isInteger(w) || w <= 0) {
        return { error: `${prefix}.window must be a positive integer` };
      }
      try {
        new RegExp(p.ok);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        return { error: `${prefix}.pattern is not a valid regex — ${reason}` };
      }
      return {
        value: { op: "grep_hit_neighbourhood_matches", pattern: p.ok, window: w },
      };
    }
    case "definition_feature_eq": {
      const name = s("name");
      if ("error" in name) return name;
      if (typeof obj.value !== "boolean") {
        return { error: `${prefix}.value must be boolean` };
      }
      return { value: { op: "definition_feature_eq", name: name.ok, value: obj.value } };
    }
    case "accessor_kind_eq": {
      if (
        obj.value !== "getter" &&
        obj.value !== "setter" &&
        obj.value !== "none"
      ) {
        return { error: `${prefix}.value must be "getter" | "setter" | "none"` };
      }
      return { value: { op: "accessor_kind_eq", value: obj.value } };
    }
    case "has_unindexed_test_caller": {
      if (typeof obj.value !== "boolean") {
        return { error: `${prefix}.value must be boolean` };
      }
      return { value: { op: "has_unindexed_test_caller", value: obj.value } };
    }
    default:
      return {
        error: `${prefix}.op '${obj.op}' is not a known SignalCheck op (allowed: ${SIGNAL_CHECK_OPS.join(", ")})`,
      };
  }
}

function parse_example_indexes(raw: unknown, field: string): { value: number[] } | ShapeError {
  if (!Array.isArray(raw)) {
    return { error: `classifier_spec.${field} must be an array` };
  }
  const out: number[] = [];
  const seen = new Set<number>();
  for (const [idx, v] of raw.entries()) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
      return { error: `classifier_spec.${field}[${idx}] must be a non-negative integer` };
    }
    if (seen.has(v)) {
      return { error: `classifier_spec.${field}[${idx}] is a duplicate entry index (${v})` };
    }
    seen.add(v);
    out.push(v);
  }
  return { value: out };
}

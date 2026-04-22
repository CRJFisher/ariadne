import * as fs from "node:fs/promises";

import { DRIFT_OUTLIER_RATE_THRESHOLD } from "./detect_drift.js";
import { error_code } from "./errors.js";
import {
  cross_check_session_against_response,
  type SessionResponseMismatch,
} from "./session_log.js";
import type {
  BacklogRefProposal,
  BuiltinClassifierSpec,
  ClassifierAxis,
  ClassifierSpecProposal,
  FalsePositiveGroup,
  InvestigateResponse,
  InvestigatorSessionLog,
  KnownIssue,
  QaResponse,
  SignalCheck,
} from "./types.js";
import { SIGNAL_CHECK_OPS } from "./types.js";

// ===== Response-shape validation =====

export interface ParseError {
  error: string;
}

export function parse_qa_response(raw: unknown): QaResponse | ParseError {
  if (typeof raw !== "object" || raw === null) {
    return { error: "QA response is not an object" };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.group_id !== "string" || obj.group_id.length === 0) {
    return { error: "QA response: group_id must be a non-empty string" };
  }
  if (!Array.isArray(obj.outliers)) {
    return { error: "QA response: outliers must be an array" };
  }
  for (const [idx, o] of obj.outliers.entries()) {
    if (typeof o !== "object" || o === null) {
      return { error: `QA response: outliers[${idx}] is not an object` };
    }
    const oo = o as Record<string, unknown>;
    if (typeof oo.entry_index !== "number" || !Number.isInteger(oo.entry_index)) {
      return { error: `QA response: outliers[${idx}].entry_index must be an integer` };
    }
    if (typeof oo.reason !== "string") {
      return { error: `QA response: outliers[${idx}].reason must be a string` };
    }
  }
  if (typeof obj.notes !== "string") {
    return { error: "QA response: notes must be a string" };
  }
  return {
    group_id: obj.group_id,
    outliers: obj.outliers.map((o) => {
      const oo = o as Record<string, unknown>;
      return { entry_index: oo.entry_index as number, reason: oo.reason as string };
    }),
    notes: obj.notes,
  };
}

export function parse_investigate_response(raw: unknown): InvestigateResponse | ParseError {
  if (typeof raw !== "object" || raw === null) {
    return { error: "investigate response is not an object" };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.group_id !== "string" || obj.group_id.length === 0) {
    return { error: "investigate response: group_id must be a non-empty string" };
  }

  const classifier_result = parse_classifier_proposal(obj.proposed_classifier);
  if ("error" in classifier_result) return classifier_result;

  const backlog_result = parse_backlog_ref(obj.backlog_ref);
  if ("error" in backlog_result) return backlog_result;

  if (!Array.isArray(obj.new_signals_needed)) {
    return { error: "investigate response: new_signals_needed must be an array" };
  }
  for (const [idx, s] of obj.new_signals_needed.entries()) {
    if (typeof s !== "string") {
      return { error: `investigate response: new_signals_needed[${idx}] must be a string` };
    }
  }

  if (typeof obj.reasoning !== "string") {
    return { error: "investigate response: reasoning must be a string" };
  }

  let retargets_to: string | null;
  if (obj.retargets_to === undefined || obj.retargets_to === null) {
    retargets_to = null;
  } else if (typeof obj.retargets_to === "string" && obj.retargets_to.length > 0) {
    retargets_to = obj.retargets_to;
  } else {
    return {
      error: "investigate response: retargets_to must be a non-empty string when present",
    };
  }

  const new_signals_needed = obj.new_signals_needed.filter(
    (s): s is string => typeof s === "string",
  );

  // A backlog ticket is only an acceptable substitute for a working classifier
  // when the investigator has identified a missing-signal blocker. The dispatcher
  // enforces this so sub-agents cannot fall back to "file a ticket" on groups
  // that are tractable with existing signals.
  if (backlog_result.value !== null && new_signals_needed.length === 0) {
    return {
      error:
        "investigate response: backlog_ref only permitted when new_signals_needed is non-empty",
    };
  }

  const spec_result = parse_classifier_spec(
    obj.classifier_spec,
    classifier_result.value,
  );
  if ("error" in spec_result) return spec_result;

  return {
    group_id: obj.group_id,
    proposed_classifier: classifier_result.value,
    backlog_ref: backlog_result.value,
    new_signals_needed,
    classifier_spec: spec_result.value,
    retargets_to,
    reasoning: obj.reasoning,
  };
}

const DEFAULT_MIN_CONFIDENCE = 0.9;

/**
 * Mirrors `ClassifierSpec` in self-repair-pipeline. Enforces the XOR
 * between `builtin` (requires `function_name`) and `predicate` (requires
 * `axis` + `expression`); rejects fields belonging to the other branch.
 */
function parse_classifier_proposal(
  raw: unknown,
): { value: ClassifierSpecProposal | null } | ParseError {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== "object") {
    return { error: "proposed_classifier must be an object or null" };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.kind !== "none" && obj.kind !== "builtin" && obj.kind !== "predicate") {
    return { error: "proposed_classifier.kind must be 'none', 'builtin', or 'predicate'" };
  }

  if (obj.kind === "none") {
    if (obj.function_name !== undefined || obj.expression !== undefined || obj.axis !== undefined) {
      return {
        error:
          "proposed_classifier: kind='none' must not carry function_name, expression, or axis",
      };
    }
    return { value: { kind: "none" } };
  }

  const min_confidence = parse_min_confidence(obj.min_confidence);
  if (typeof min_confidence !== "number") return min_confidence;

  if (obj.kind === "builtin") {
    if (obj.expression !== undefined || obj.axis !== undefined) {
      return {
        error: "proposed_classifier: kind='builtin' must not carry 'expression' or 'axis'",
      };
    }
    if (typeof obj.function_name !== "string" || obj.function_name.length === 0) {
      return { error: "proposed_classifier: kind='builtin' requires a non-empty 'function_name'" };
    }
    return {
      value: { kind: "builtin", function_name: obj.function_name, min_confidence },
    };
  }

  // predicate
  if (obj.function_name !== undefined) {
    return { error: "proposed_classifier: kind='predicate' must not carry 'function_name'" };
  }
  if (obj.axis !== "A" && obj.axis !== "B" && obj.axis !== "C") {
    return { error: "proposed_classifier: kind='predicate' requires axis 'A', 'B', or 'C'" };
  }
  if (obj.expression === undefined || obj.expression === null) {
    return { error: "proposed_classifier: kind='predicate' requires 'expression'" };
  }
  return {
    value: {
      kind: "predicate",
      axis: obj.axis as ClassifierAxis,
      expression: obj.expression,
      min_confidence,
    },
  };
}

function parse_min_confidence(raw: unknown): number | ParseError {
  if (raw === undefined) return DEFAULT_MIN_CONFIDENCE;
  if (typeof raw !== "number") {
    return { error: "proposed_classifier.min_confidence must be a number" };
  }
  if (raw < 0 || raw > 1) {
    return { error: "proposed_classifier.min_confidence must be in [0, 1]" };
  }
  return raw;
}

function parse_backlog_ref(raw: unknown): { value: BacklogRefProposal | null } | ParseError {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== "object") return { error: "backlog_ref must be an object or null" };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.title !== "string" || obj.title.length === 0) {
    return { error: "backlog_ref.title must be a non-empty string" };
  }
  if (typeof obj.description !== "string") {
    return { error: "backlog_ref.description must be a string" };
  }
  return { value: { title: obj.title, description: obj.description } };
}

/**
 * `classifier_spec` must be non-null when `proposed_classifier.kind === "builtin"`
 * and null otherwise. Validates spec shape against `BuiltinClassifierSpec`.
 */
function parse_classifier_spec(
  raw: unknown,
  proposed_classifier: ClassifierSpecProposal | null,
): { value: BuiltinClassifierSpec | null } | ParseError {
  const requires_spec = proposed_classifier?.kind === "builtin";
  if (raw === null || raw === undefined) {
    if (requires_spec) {
      return {
        error:
          "investigate response: classifier_spec must be provided when proposed_classifier.kind === 'builtin'",
      };
    }
    return { value: null };
  }
  if (!requires_spec) {
    return {
      error:
        "investigate response: classifier_spec must be null unless proposed_classifier.kind === 'builtin'",
    };
  }
  if (typeof raw !== "object") {
    return { error: "classifier_spec must be an object" };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.function_name !== "string" || obj.function_name.length === 0) {
    return { error: "classifier_spec.function_name must be a non-empty string" };
  }
  if (obj.function_name !== proposed_classifier.function_name) {
    return {
      error:
        "classifier_spec.function_name must equal proposed_classifier.function_name",
    };
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
  const positive_result = parse_example_indexes(obj.positive_examples, "positive_examples");
  if ("error" in positive_result) return positive_result;
  const negative_result = parse_example_indexes(obj.negative_examples, "negative_examples");
  if ("error" in negative_result) return negative_result;
  if (typeof obj.description !== "string") {
    return { error: "classifier_spec.description must be a string" };
  }
  return {
    value: {
      function_name: obj.function_name,
      min_confidence,
      combinator: obj.combinator,
      checks,
      positive_examples: positive_result.value,
      negative_examples: negative_result.value,
      description: obj.description,
    },
  };
}

function parse_signal_check(
  raw: unknown,
  idx: number,
): { value: SignalCheck } | ParseError {
  if (typeof raw !== "object" || raw === null) {
    return { error: `classifier_spec.checks[${idx}] must be an object` };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.op !== "string") {
    return { error: `classifier_spec.checks[${idx}].op must be a string` };
  }
  const prefix = `classifier_spec.checks[${idx}]`;
  switch (obj.op) {
    case "diagnosis_eq": {
      if (typeof obj.value !== "string") {
        return { error: `${prefix}.value must be a string` };
      }
      return { value: { op: "diagnosis_eq", value: obj.value } };
    }
    case "language_eq": {
      if (
        obj.value !== "typescript" &&
        obj.value !== "javascript" &&
        obj.value !== "python" &&
        obj.value !== "rust"
      ) {
        return {
          error: `${prefix}.value must be 'typescript', 'javascript', 'python', or 'rust'`,
        };
      }
      return { value: { op: "language_eq", value: obj.value } };
    }
    case "syntactic_feature_eq": {
      if (typeof obj.name !== "string" || obj.name.length === 0) {
        return { error: `${prefix}.name must be a non-empty string` };
      }
      if (
        typeof obj.value !== "string" &&
        typeof obj.value !== "number" &&
        typeof obj.value !== "boolean"
      ) {
        return { error: `${prefix}.value must be a string, number, or boolean` };
      }
      return {
        value: {
          op: "syntactic_feature_eq",
          name: obj.name,
          value: obj.value,
        },
      };
    }
    case "grep_line_regex": {
      if (typeof obj.pattern !== "string") {
        return { error: `${prefix}.pattern must be a string` };
      }
      return { value: { op: "grep_line_regex", pattern: obj.pattern } };
    }
    case "decorator_matches": {
      if (typeof obj.pattern !== "string") {
        return { error: `${prefix}.pattern must be a string` };
      }
      return { value: { op: "decorator_matches", pattern: obj.pattern } };
    }
    case "has_capture_at_grep_hit": {
      if (typeof obj.capture_name !== "string") {
        return { error: `${prefix}.capture_name must be a string` };
      }
      return {
        value: { op: "has_capture_at_grep_hit", capture_name: obj.capture_name },
      };
    }
    case "missing_capture_at_grep_hit": {
      if (typeof obj.capture_name !== "string") {
        return { error: `${prefix}.capture_name must be a string` };
      }
      return {
        value: {
          op: "missing_capture_at_grep_hit",
          capture_name: obj.capture_name,
        },
      };
    }
    case "receiver_kind_eq": {
      if (typeof obj.value !== "string") {
        return { error: `${prefix}.value must be a string` };
      }
      return { value: { op: "receiver_kind_eq", value: obj.value } };
    }
    case "resolution_failure_reason_eq": {
      if (typeof obj.value !== "string") {
        return { error: `${prefix}.value must be a string` };
      }
      return {
        value: { op: "resolution_failure_reason_eq", value: obj.value },
      };
    }
    case "callers_count_at_least": {
      if (typeof obj.n !== "number" || !Number.isInteger(obj.n) || obj.n < 0) {
        return { error: `${prefix}.n must be a non-negative integer` };
      }
      return { value: { op: "callers_count_at_least", n: obj.n } };
    }
    case "callers_count_at_most": {
      if (typeof obj.n !== "number" || !Number.isInteger(obj.n) || obj.n < 0) {
        return { error: `${prefix}.n must be a non-negative integer` };
      }
      return { value: { op: "callers_count_at_most", n: obj.n } };
    }
    case "file_path_matches": {
      if (typeof obj.pattern !== "string") {
        return { error: `${prefix}.pattern must be a string` };
      }
      return { value: { op: "file_path_matches", pattern: obj.pattern } };
    }
    case "name_matches": {
      if (typeof obj.pattern !== "string") {
        return { error: `${prefix}.pattern must be a string` };
      }
      return { value: { op: "name_matches", pattern: obj.pattern } };
    }
    default:
      return {
        error: `${prefix}.op '${obj.op}' is not a known SignalCheck op (allowed: ${SIGNAL_CHECK_OPS.join(", ")})`,
      };
  }
}

function parse_example_indexes(
  raw: unknown,
  field: string,
): { value: number[] } | ParseError {
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
      return {
        error: `classifier_spec.${field}[${idx}] is a duplicate entry index (${v})`,
      };
    }
    seen.add(v);
    out.push(v);
  }
  return { value: out };
}

// ===== Drift tagging =====

/**
 * For each QA response whose outlier rate meets the drift threshold, flip
 * `drift_detected` to true on the matching registry entry. Pure.
 */
export function mark_drift_in_registry(
  registry: KnownIssue[],
  qa: QaResponse[],
  member_counts: Record<string, number>,
): { updated: KnownIssue[]; drift_tagged_groups: string[] } {
  const drifting = new Set<string>();
  for (const r of qa) {
    const n = member_counts[r.group_id] ?? 0;
    if (n <= 0) continue;
    if (r.outliers.length / n >= DRIFT_OUTLIER_RATE_THRESHOLD) {
      drifting.add(r.group_id);
    }
  }
  const updated = registry.map((issue) =>
    drifting.has(issue.group_id) ? { ...issue, drift_detected: true } : issue,
  );
  return { updated, drift_tagged_groups: [...drifting] };
}

// ===== Orchestrator =====

export interface FailedAuthoring {
  group_id: string;
  reason: string;
}

export interface SpecValidationFailure {
  group_id: string;
  reason: string;
}

export interface ApplyOptions {
  dry_run: boolean;
  registry_path: string;
  /**
   * Map of group_id → absolute path to the authored `check_<group_id>.ts` file
   * written in Step 4.5 by the main agent. The dispatcher requires a readable
   * file at this path before upserting the registry entry for a builtin
   * classifier. Predicate-kind proposals are not keyed here.
   */
  authored_files_by_group: Record<string, string>;
  /**
   * Session logs written alongside each InvestigateResponse. Optional: finalize
   * hydrates them when present so that the summary can surface failed groups.
   */
  session_logs?: InvestigatorSessionLog[];
  /**
   * Groups from the source triage run, keyed by group_id. Used to derive
   * `languages` on new registry upserts when the classifier spec does not
   * already declare a language gate. Optional because some callers
   * (e.g. unit tests that exercise drift only) don't have the full triage view.
   */
  triage_groups?: Record<string, FalsePositiveGroup>;
}

export interface ApplyResult {
  /** Group IDs whose authored file was validated and registry entry upserted. */
  authored_files: string[];
  /**
   * Group IDs whose builtin classifier could not be landed: the authored file
   * is missing, unreadable, or failed an upstream invariant check.
   */
  failed_authoring: FailedAuthoring[];
  /**
   * Group IDs whose classifier_spec carried example indexes inconsistent with
   * the source group (out-of-range against `group.entries.length`). Registry
   * upsert is skipped so a manual review can repair the spec.
   */
  spec_validation_failures: SpecValidationFailure[];
  registry_upserts: string[];
  /**
   * Group IDs whose upsert was skipped because the existing registry entry has
   * `status: "permanent"`. Surfaces promotion attempts that should instead be
   * routed to a human-authored backlog task.
   */
  skipped_permanent_upserts: string[];
  drift_tagged_groups: string[];
  backlog_tasks_to_create: BacklogRefProposal[];
  new_signals_needed: string[];
  /** Per-field disagreements between session log and investigate response. */
  session_response_mismatches: SessionResponseMismatch[];
}

/**
 * Apply curator proposals. In `dry_run` mode no registry mutation is written;
 * the returned `ApplyResult` describes exactly what *would* have happened.
 *
 * Source authoring (`check_<group_id>.ts`) happens in Step 4.5, before this
 * function is called. This function only validates that the authored file
 * exists on disk, then upserts the registry entry referencing it.
 *
 * Backlog task creation is not performed here (MCP is only available in the
 * Claude harness) — callers read `backlog_tasks_to_create` and invoke
 * `mcp__backlog__task_create` themselves.
 */
export async function apply_proposals(
  qa: QaResponse[],
  inv: InvestigateResponse[],
  member_counts: Record<string, number>,
  opts: ApplyOptions,
): Promise<ApplyResult> {
  const registry = await read_registry(opts.registry_path);

  const { updated: after_drift, drift_tagged_groups } = mark_drift_in_registry(
    registry,
    qa,
    member_counts,
  );

  // Validate authored files exist and classifier_spec example indexes reference
  // real entries in the source group. Either violation blocks the registry
  // upsert for that group — the dispatcher refuses to point the registry at a
  // classifier whose file is absent or whose spec contradicts the group it
  // claims to describe.
  const failed_authoring: FailedAuthoring[] = [];
  const spec_validation_failures: SpecValidationFailure[] = [];
  const authored_files: string[] = [];
  const rejected_builtin_groups = new Set<string>();
  // The authored-files map is keyed by the TARGET group id the renderer wrote
  // to — `retargets_to ?? group_id` — so lookups here must use the same
  // derivation. Without this, retargeted responses would silently fail the
  // "no authored classifier file" check even though their file exists.
  for (const r of inv) {
    if (r.proposed_classifier?.kind !== "builtin") continue;
    const spec_errors = validate_spec_example_indexes(r, member_counts);
    if (spec_errors.length > 0) {
      for (const reason of spec_errors) {
        spec_validation_failures.push({ group_id: r.group_id, reason });
      }
      rejected_builtin_groups.add(r.group_id);
      continue;
    }
    const authored_key = r.retargets_to ?? r.group_id;
    const authored_path = opts.authored_files_by_group[authored_key];
    if (authored_path === undefined || authored_path.length === 0) {
      failed_authoring.push({
        group_id: r.group_id,
        reason: `no authored classifier file recorded for key '${authored_key}'`,
      });
      rejected_builtin_groups.add(r.group_id);
      continue;
    }
    const readable = await is_readable(authored_path);
    if (!readable) {
      failed_authoring.push({
        group_id: r.group_id,
        reason: `authored classifier file is missing or unreadable: ${authored_path}`,
      });
      rejected_builtin_groups.add(r.group_id);
      continue;
    }
    authored_files.push(authored_path);
  }

  const registry_upserts: string[] = [];
  const skipped_permanent_upserts: string[] = [];
  let next_registry = after_drift;
  for (const r of inv) {
    if (r.proposed_classifier === null) continue;
    if (rejected_builtin_groups.has(r.group_id)) continue;
    const target_group_id = r.retargets_to ?? r.group_id;
    const existing = next_registry.find((e) => e.group_id === target_group_id);
    let languages: string[];
    if (existing !== undefined) {
      // Upserting against an existing entry — languages field is not touched.
      languages = existing.languages;
    } else {
      languages = derive_languages_for_upsert(
        r,
        opts.triage_groups?.[r.group_id],
      );
      if (languages.length === 0) {
        spec_validation_failures.push({
          group_id: r.group_id,
          reason:
            `cannot derive languages for new registry entry '${target_group_id}': ` +
            `classifier_spec has no language_eq check and the source group's ` +
            `member file paths carry no recognizable extension (.ts/.tsx/.js/.jsx/.mjs/.cjs/.py/.rs)`,
        });
        continue;
      }
    }
    const { registry: after_upsert, skipped_permanent } = upsert_classifier(
      next_registry,
      target_group_id,
      r.proposed_classifier,
      languages,
    );
    if (skipped_permanent) {
      skipped_permanent_upserts.push(target_group_id);
      continue;
    }
    next_registry = after_upsert;
    registry_upserts.push(target_group_id);
  }

  const registry_mutated =
    drift_tagged_groups.length > 0 || registry_upserts.length > 0;
  if (!opts.dry_run && registry_mutated) {
    await fs.writeFile(
      opts.registry_path,
      JSON.stringify(next_registry, null, 2) + "\n",
      "utf8",
    );
  }

  const backlog_tasks_to_create = inv
    .map((r) => r.backlog_ref)
    .filter((b): b is BacklogRefProposal => b !== null);

  const new_signals_needed = [
    ...new Set(inv.flatMap((r) => r.new_signals_needed)),
  ];

  const session_response_mismatches = cross_check_all_sessions(
    opts.session_logs ?? [],
    inv,
  );

  return {
    authored_files,
    failed_authoring,
    spec_validation_failures,
    registry_upserts,
    skipped_permanent_upserts,
    drift_tagged_groups,
    backlog_tasks_to_create,
    new_signals_needed,
    session_response_mismatches,
  };
}

/**
 * Verify every `positive_examples` / `negative_examples` index is in-range
 * against the source group's entries. Returns a list of human-readable
 * violations (empty when the spec is consistent).
 *
 * A group missing from `member_counts` is treated as "no entries observed";
 * any referenced example is therefore out-of-range. An investigator emitting
 * classifier_spec for a group not in the source triage output is itself a bug.
 */
export function validate_spec_example_indexes(
  inv: InvestigateResponse,
  member_counts: Record<string, number>,
): string[] {
  const spec = inv.classifier_spec;
  if (spec === null) return [];
  const size = member_counts[inv.group_id] ?? 0;
  const errors: string[] = [];
  for (const idx of spec.positive_examples) {
    if (idx < 0 || idx >= size) {
      errors.push(
        `classifier_spec.positive_examples contains index ${idx} but group has ${size} entries`,
      );
    }
  }
  for (const idx of spec.negative_examples) {
    if (idx < 0 || idx >= size) {
      errors.push(
        `classifier_spec.negative_examples contains index ${idx} but group has ${size} entries`,
      );
    }
  }
  return errors;
}

async function is_readable(file_path: string): Promise<boolean> {
  try {
    await fs.access(file_path, fs.constants.R_OK);
    return true;
  } catch (err) {
    if (error_code(err) === "ENOENT" || error_code(err) === "EACCES") return false;
    throw err;
  }
}

function cross_check_all_sessions(
  logs: InvestigatorSessionLog[],
  inv: InvestigateResponse[],
): SessionResponseMismatch[] {
  const by_group = new Map(inv.map((r) => [r.group_id, r]));
  const mismatches: SessionResponseMismatch[] = [];
  for (const log of logs) {
    const response = by_group.get(log.group_id);
    if (response === undefined) continue;
    mismatches.push(...cross_check_session_against_response(log, response));
  }
  return mismatches;
}

async function read_registry(registry_path: string): Promise<KnownIssue[]> {
  const raw = await fs.readFile(registry_path, "utf8");
  return JSON.parse(raw) as KnownIssue[];
}

interface UpsertOutcome {
  registry: KnownIssue[];
  skipped_permanent: boolean;
}

/**
 * Extract `language_eq` values from a builtin classifier spec; empty when the
 * spec has no language gate or is null (predicate / kind: "none").
 */
function declared_languages(spec: BuiltinClassifierSpec | null): string[] {
  if (spec === null) return [];
  const out: string[] = [];
  for (const c of spec.checks) {
    if (c.op === "language_eq") out.push(c.value);
  }
  return [...new Set(out)];
}

/** Map file extension to a registry language token. */
function language_from_file_path(file_path: string): string | null {
  if (file_path.endsWith(".ts") || file_path.endsWith(".tsx")) return "typescript";
  if (
    file_path.endsWith(".js") ||
    file_path.endsWith(".jsx") ||
    file_path.endsWith(".mjs") ||
    file_path.endsWith(".cjs")
  ) {
    return "javascript";
  }
  if (file_path.endsWith(".py")) return "python";
  if (file_path.endsWith(".rs")) return "rust";
  return null;
}

/** Observed languages across a group's entries, inferred from file extensions. */
function observed_languages(group: FalsePositiveGroup | undefined): string[] {
  if (group === undefined) return [];
  const langs = new Set<string>();
  for (const e of group.entries) {
    const lang = language_from_file_path(e.file_path);
    if (lang !== null) langs.add(lang);
  }
  return [...langs];
}

/**
 * Derive the `languages` field for a new registry entry. Prefers the
 * classifier spec's own `language_eq` gate (authoritative); falls back to the
 * source group's observed file extensions. Returns an empty array when
 * neither source yields anything — the caller must reject the upsert in that
 * case rather than write an invalid registry entry.
 */
export function derive_languages_for_upsert(
  response: InvestigateResponse,
  group: FalsePositiveGroup | undefined,
): string[] {
  const from_spec = declared_languages(response.classifier_spec);
  if (from_spec.length > 0) return from_spec;
  return observed_languages(group);
}

function upsert_classifier(
  registry: KnownIssue[],
  group_id: string,
  proposal: ClassifierSpecProposal,
  languages: string[],
): UpsertOutcome {
  const existing_idx = registry.findIndex((e) => e.group_id === group_id);
  if (existing_idx === -1) {
    const placeholder: KnownIssue = {
      group_id,
      title: group_id,
      description: "Proposed by triage-curator investigator — fill in before enabling.",
      status: "wip",
      languages,
      examples: [],
      classifier: proposal,
    };
    return { registry: [...registry, placeholder], skipped_permanent: false };
  }

  const existing = registry[existing_idx];

  // Permanent entries are protected from curator overwrite. Promotion flow
  // should route these to a human-authored backlog task instead.
  if (existing.status === "permanent") {
    return { registry, skipped_permanent: true };
  }

  const next = [...registry];
  // Overwriting with kind:"none" is a "retire" action. Flip status to wip
  // and set drift_detected so the next scan surfaces it for human review,
  // rather than leaving a silently neutered classifier in place.
  if (proposal.kind === "none") {
    next[existing_idx] = {
      ...existing,
      classifier: proposal,
      status: "wip",
      drift_detected: true,
    };
  } else {
    next[existing_idx] = { ...existing, classifier: proposal };
  }
  return { registry: next, skipped_permanent: false };
}

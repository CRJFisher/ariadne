/**
 * Loader and schema validator for the known-issues registry.
 *
 * Registry source of truth: `.claude/skills/self-repair-pipeline/known_issues/registry.json`.
 * The validator walks every entry, checks shape and enum values, and walks every
 * predicate expression so that unknown `op` values are rejected.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFINITION_FEATURE_NAMES,
  SYNTACTIC_FEATURE_NAMES,
  type DefinitionFeatureName,
  type SyntacticFeatureName,
  PREDICATE_OPERATORS,
  type ClassifierSpec,
  type KnownIssue,
  type KnownIssueLanguage,
  type KnownIssueStatus,
  type KnownIssuesRegistry,
  type PredicateExpr,
  type PredicateOperator,
} from "@ariadnejs/types";

// ===== Constants =====

const VALID_STATUSES: ReadonlySet<KnownIssueStatus> = new Set<KnownIssueStatus>([
  "permanent",
  "wip",
  "fixed",
]);

const VALID_LANGUAGES: ReadonlySet<KnownIssueLanguage> = new Set<KnownIssueLanguage>([
  "typescript",
  "javascript",
  "python",
  "rust",
]);

const VALID_AXES: ReadonlySet<"A" | "B" | "C"> = new Set(["A", "B", "C"] as const);

const VALID_OPERATORS: ReadonlySet<PredicateOperator> = new Set(PREDICATE_OPERATORS);

const VALID_SYNTACTIC_FEATURE_NAMES: ReadonlySet<SyntacticFeatureName> = new Set(
  SYNTACTIC_FEATURE_NAMES,
);

const VALID_DEFINITION_FEATURE_NAMES: ReadonlySet<DefinitionFeatureName> = new Set(
  DEFINITION_FEATURE_NAMES,
);

const VALID_ACCESSOR_KIND_VALUES: ReadonlySet<"getter" | "setter" | "none"> = new Set([
  "getter",
  "setter",
  "none",
]);

const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

// ===== Loader =====

export function get_registry_file_path(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "known_issues", "registry.json");
}

export function load_registry(): KnownIssuesRegistry {
  const raw = fs.readFileSync(get_registry_file_path(), "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new RegistryValidationError(`registry.json is not valid JSON: ${reason}`);
  }
  validate_registry(parsed);
  return parsed;
}

// ===== Validation =====

export class RegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryValidationError";
  }
}

/**
 * Validates a registry. Throws `RegistryValidationError` on the first problem
 * found. Narrows `value` to `KnownIssuesRegistry` on success.
 */
export function validate_registry(value: unknown): asserts value is KnownIssuesRegistry {
  if (!Array.isArray(value)) {
    throw new RegistryValidationError("registry must be a JSON array");
  }
  const seen_group_ids = new Set<string>();
  const seen_function_names = new Map<string, string>();
  for (let i = 0; i < value.length; i++) {
    const at = `[${i}]`;
    const entry = value[i];
    validate_entry(entry, at);
    if (seen_group_ids.has(entry.group_id)) {
      throw new RegistryValidationError(`${at}: duplicate group_id "${entry.group_id}"`);
    }
    seen_group_ids.add(entry.group_id);
    // Builtin function_names must be unique because the generated barrel
    // imports them as identifiers — collisions would surface as cryptic TS
    // compile errors. Catch them at registry-load time instead.
    if (entry.classifier.kind === "builtin") {
      const fn = entry.classifier.function_name;
      const prior = seen_function_names.get(fn);
      if (prior !== undefined) {
        throw new RegistryValidationError(
          `${at}: builtin function_name "${fn}" already used by group_id "${prior}"`,
        );
      }
      seen_function_names.set(fn, entry.group_id);
    }
  }
}

function validate_entry(entry: unknown, at: string): asserts entry is KnownIssue {
  if (typeof entry !== "object" || entry === null) {
    throw new RegistryValidationError(`${at}: entry must be an object`);
  }
  const record = entry as Record<string, unknown>;

  require_string(record, "group_id", at);
  require_kebab_case(record["group_id"] as string, `${at}.group_id`);
  // All subsequent errors carry the group_id so curators don't need to count
  // array positions to find the offending entry.
  const at_id = `${at}(group_id="${record["group_id"] as string}")`;

  require_string(record, "title", at_id);
  require_string(record, "description", at_id);

  require_enum(record, "status", VALID_STATUSES, at_id);

  if (!Array.isArray(record["languages"])) {
    throw new RegistryValidationError(`${at_id}.languages: must be an array`);
  }
  if (record["languages"].length === 0) {
    throw new RegistryValidationError(`${at_id}.languages: must not be empty`);
  }
  for (const lang of record["languages"]) {
    if (typeof lang !== "string" || !VALID_LANGUAGES.has(lang as KnownIssueLanguage)) {
      throw new RegistryValidationError(
        `${at_id}.languages: invalid language "${String(lang)}" (allowed: ${[...VALID_LANGUAGES].join(", ")})`,
      );
    }
  }

  if ("backlog_task" in record && record["backlog_task"] !== undefined) {
    if (typeof record["backlog_task"] !== "string") {
      throw new RegistryValidationError(`${at_id}.backlog_task: must be a string`);
    }
    if (!/^TASK-[0-9]+(?:\.[0-9]+)*$/.test(record["backlog_task"])) {
      throw new RegistryValidationError(
        `${at_id}.backlog_task: must match "TASK-<id>" with digits and optional dotted suffixes (got "${record["backlog_task"]}")`,
      );
    }
  }

  validate_examples(record["examples"], `${at_id}.examples`);
  validate_classifier_spec(record["classifier"], `${at_id}.classifier`);

  validate_optional_curator_fields(record, at_id);
}

function validate_examples(value: unknown, at: string): void {
  if (!Array.isArray(value)) {
    throw new RegistryValidationError(`${at}: must be an array`);
  }
  for (let i = 0; i < value.length; i++) {
    const e = value[i];
    if (typeof e !== "object" || e === null) {
      throw new RegistryValidationError(`${at}[${i}]: must be an object`);
    }
    const record = e as Record<string, unknown>;
    require_string(record, "file", `${at}[${i}]`);
    require_number(record, "line", `${at}[${i}]`);
    require_string(record, "snippet", `${at}[${i}]`);
  }
}

const BUILTIN_FUNCTION_NAME = /^[a-z_][a-z0-9_]*$/;

function validate_classifier_spec(value: unknown, at: string): asserts value is ClassifierSpec {
  if (typeof value !== "object" || value === null) {
    throw new RegistryValidationError(`${at}: must be an object`);
  }
  const record = value as Record<string, unknown>;
  const kind = record["kind"];
  if (kind === "none") {
    const extra = Object.keys(record).filter((k) => k !== "kind");
    if (extra.length > 0) {
      throw new RegistryValidationError(
        `${at}: kind="none" must not carry extra fields (got: ${extra.join(", ")})`,
      );
    }
    return;
  }
  if (kind === "predicate") {
    const axis = record["axis"];
    if (typeof axis !== "string" || !VALID_AXES.has(axis as "A" | "B" | "C")) {
      throw new RegistryValidationError(
        `${at}.axis: must be "A", "B", or "C" (got "${String(axis)}")`,
      );
    }
    require_confidence(record["min_confidence"], `${at}.min_confidence`);
    validate_predicate_expr(record["expression"], `${at}.expression`);
    return;
  }
  if (kind === "builtin") {
    const function_name = record["function_name"];
    if (typeof function_name !== "string" || function_name.length === 0) {
      throw new RegistryValidationError(
        `${at}.function_name: must be a non-empty string`,
      );
    }
    if (!BUILTIN_FUNCTION_NAME.test(function_name)) {
      throw new RegistryValidationError(
        `${at}.function_name: must match /^[a-z_][a-z0-9_]*$/ (got "${function_name}")`,
      );
    }
    require_confidence(record["min_confidence"], `${at}.min_confidence`);
    const extra = Object.keys(record).filter(
      (k) => k !== "kind" && k !== "function_name" && k !== "min_confidence",
    );
    if (extra.length > 0) {
      throw new RegistryValidationError(
        `${at}: kind="builtin" must not carry extra fields (got: ${extra.join(", ")})`,
      );
    }
    return;
  }
  throw new RegistryValidationError(
    `${at}.kind: must be "none" | "predicate" | "builtin" (got "${String(kind)}")`,
  );
}

/**
 * Walks a predicate expression tree. Every node must carry an `op` from
 * {@link PREDICATE_OPERATORS}; unknown operators are rejected here.
 */
export function validate_predicate_expr(value: unknown, at: string): asserts value is PredicateExpr {
  if (typeof value !== "object" || value === null) {
    throw new RegistryValidationError(`${at}: must be an object`);
  }
  const record = value as Record<string, unknown>;
  const op = record["op"];
  if (typeof op !== "string" || !VALID_OPERATORS.has(op as PredicateOperator)) {
    throw new RegistryValidationError(
      `${at}.op: unknown operator "${String(op)}" (allowed: ${[...VALID_OPERATORS].join(", ")})`,
    );
  }
  switch (op as PredicateOperator) {
    case "all":
    case "any": {
      if (!Array.isArray(record["of"])) {
        throw new RegistryValidationError(`${at}.of: must be an array for op="${op}"`);
      }
      for (let i = 0; i < record["of"].length; i++) {
        validate_predicate_expr(record["of"][i], `${at}.of[${i}]`);
      }
      return;
    }
    case "not": {
      validate_predicate_expr(record["of"], `${at}.of`);
      return;
    }
    case "diagnosis_eq":
    case "language_eq":
    case "resolution_failure_reason_eq":
    case "receiver_kind_eq":
      require_string(record, "value", at);
      return;
    case "decorator_matches":
    case "grep_line_regex": {
      require_string(record, "pattern", at);
      const pattern = record["pattern"] as string;
      try {
        // Pre-compile once at load time so classifier evaluation is hot-path
        // cheap and invalid patterns surface immediately.
        record["compiled_pattern"] = new RegExp(pattern);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        throw new RegistryValidationError(
          `${at}.pattern: invalid regex for op="${op}" — ${reason}`,
        );
      }
      return;
    }
    case "has_capture_at_grep_hit":
    case "missing_capture_at_grep_hit":
      require_string(record, "capture_name", at);
      return;
    case "syntactic_feature_eq":
      require_string(record, "name", at);
      if (!VALID_SYNTACTIC_FEATURE_NAMES.has(record["name"] as SyntacticFeatureName)) {
        throw new RegistryValidationError(
          `${at}.name: unknown syntactic feature "${String(record["name"])}" (allowed: ${[...VALID_SYNTACTIC_FEATURE_NAMES].join(", ")})`,
        );
      }
      if (typeof record["value"] !== "boolean") {
        throw new RegistryValidationError(`${at}.value: must be boolean for op="syntactic_feature_eq"`);
      }
      return;
    case "grep_hits_all_intra_file":
    case "has_unindexed_test_caller":
      if (typeof record["value"] !== "boolean") {
        throw new RegistryValidationError(`${at}.value: must be boolean for op="${op}"`);
      }
      return;
    case "grep_hit_neighbourhood_matches": {
      require_string(record, "pattern", at);
      const window = record["window"];
      if (typeof window !== "number" || !Number.isInteger(window) || window <= 0) {
        throw new RegistryValidationError(
          `${at}.window: must be a positive integer for op="grep_hit_neighbourhood_matches"`,
        );
      }
      try {
        record["compiled_pattern"] = new RegExp(record["pattern"] as string);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        throw new RegistryValidationError(
          `${at}.pattern: invalid regex for op="grep_hit_neighbourhood_matches" — ${reason}`,
        );
      }
      return;
    }
    case "definition_feature_eq":
      require_string(record, "name", at);
      if (!VALID_DEFINITION_FEATURE_NAMES.has(record["name"] as DefinitionFeatureName)) {
        throw new RegistryValidationError(
          `${at}.name: unknown definition feature "${String(record["name"])}" (allowed: ${[...VALID_DEFINITION_FEATURE_NAMES].join(", ")})`,
        );
      }
      if (typeof record["value"] !== "boolean") {
        throw new RegistryValidationError(`${at}.value: must be boolean for op="definition_feature_eq"`);
      }
      return;
    case "accessor_kind_eq":
      if (
        typeof record["value"] !== "string" ||
        !VALID_ACCESSOR_KIND_VALUES.has(record["value"] as "getter" | "setter" | "none")
      ) {
        throw new RegistryValidationError(
          `${at}.value: must be "getter" | "setter" | "none" (got "${String(record["value"])}")`,
        );
      }
      return;
  }
}

function validate_optional_curator_fields(record: Record<string, unknown>, at: string): void {
  if ("observed_count" in record && record["observed_count"] !== undefined) {
    const v = record["observed_count"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
      throw new RegistryValidationError(`${at}.observed_count: must be a non-negative integer`);
    }
  }
  if ("observed_projects" in record && record["observed_projects"] !== undefined) {
    if (!Array.isArray(record["observed_projects"])) {
      throw new RegistryValidationError(`${at}.observed_projects: must be an array`);
    }
    for (const p of record["observed_projects"]) {
      if (typeof p !== "string") {
        throw new RegistryValidationError(`${at}.observed_projects: entries must be strings`);
      }
    }
  }
  if ("last_seen_run" in record && record["last_seen_run"] !== undefined) {
    if (typeof record["last_seen_run"] !== "string") {
      throw new RegistryValidationError(`${at}.last_seen_run: must be a string`);
    }
  }
}

// ===== Small helpers =====

function require_string(record: Record<string, unknown>, key: string, at: string): void {
  const v = record[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new RegistryValidationError(`${at}.${key}: must be a non-empty string`);
  }
}

function require_number(record: Record<string, unknown>, key: string, at: string): void {
  const v = record[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new RegistryValidationError(`${at}.${key}: must be a number`);
  }
}

function require_enum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T>,
  at: string,
): void {
  const v = record[key];
  if (typeof v !== "string" || !allowed.has(v as T)) {
    throw new RegistryValidationError(
      `${at}.${key}: must be one of ${[...allowed].join(", ")} (got "${String(v)}")`,
    );
  }
}

function require_confidence(value: unknown, at: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RegistryValidationError(`${at}: must be a number`);
  }
  if (value < 0 || value > 1) {
    throw new RegistryValidationError(`${at}: must be in [0, 1] (got ${value})`);
  }
}

function require_kebab_case(value: string, at: string): void {
  if (!KEBAB_CASE.test(value)) {
    throw new RegistryValidationError(`${at}: must be kebab-case (got "${value}")`);
  }
}

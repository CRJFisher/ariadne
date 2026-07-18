/**
 * Canonical catalog of Ariadne's known failure modes. Stored on disk as
 * `.claude/skills/triage/known_issues/registry.json` and consumed
 * by the `auto_classify` pipeline stage and by the plan skill.
 *
 * Orthogonal to the dead-code whitelist read by the `detect_dead_code` Stop
 * hook — that lives at `~/.ariadne/triage-entrypoints/known_entrypoints/<pkg>.json`
 * and is a separate, human-maintained list of legitimate entry points. The
 * triage never reads or writes that whitelist.
 */

export type KnownIssueStatus = "permanent" | "wip" | "fixed";

export type KnownIssueLanguage = "typescript" | "javascript" | "python" | "rust";

export interface KnownIssueExample {
  file: string;
  line: number;
  snippet: string;
}

export interface KnownIssue {
  /** Canonical identifier, kebab-case. */
  group_id: string;
  title: string;
  description: string;
  status: KnownIssueStatus;
  languages: KnownIssueLanguage[];
  /** Links this issue → work prioritization. Absent when no backlog task exists. */
  backlog_task?: string;
  examples: KnownIssueExample[];
  classifier: ClassifierSpec;
  /**
   * Public-facing classification kind that this rule produces when it matches.
   * Drives the `EntryPointClassification` value returned to library consumers
   * via `Project.get_classified_entry_points()`. Permanent-registry rules
   * carry this; wip rules MAY omit it (defaults to `framework_invoked` keyed
   * by the rule's `group_id`).
   *
   * The registry-side `classifier` field is the *match mechanism* (a builtin
   * check). `classification` is the *user-facing label*. Two distinct
   * concerns; keeping them separate lets a single check function drive
   * different public labels.
   */
  classification?: KnownIssueClassificationMeta;
  // Cross-run observation rollups, human-maintained in the registry; never used for matching.
  observed_count?: number;
  observed_projects?: string[];
  last_seen_run?: string;
  /** Set by the human when a per-entry `fp-classifier-regression` verdict lands against this rule. */
  drift_detected?: boolean;
  /**
   * Per-citation evidence accumulated alongside `drift_detected`. Each row is
   * a per-entry triage-investigator's `fp-classifier-regression` verdict,
   * surfaced through the triage run's `classifier_regressions`
   * aggregate. Append-only across runs so the human promotion reviewer can
   * see every flag that recommended re-investigation.
   */
  drift_evidence?: DriftEvidence[];
}

export interface DriftEvidence {
  /** Entry index from the triage run's per-entry triage state that produced the verdict. */
  entry_index: number;
  /** Short evidence snippet (decorator, call site) the investigator captured. */
  evidence_excerpt: string;
}

/**
 * One rule's flagged entries from a single triage run's `classifier_regressions`
 * aggregate. Mirrors the on-disk JSONL record shape emitted by the per-entry
 * triage-investigator's `fp-classifier-regression` verdict, grouped by
 * `rule_id` for the human's drift-absorb path.
 */
export interface ClassifierRegressionFlag {
  rule_id: string;
  flagged_entries: ClassifierRegressionFlaggedEntry[];
}

export interface ClassifierRegressionFlaggedEntry {
  entry_index: number;
  evidence_excerpt: string;
}

/**
 * Metadata about how a registry rule should be reported in
 * `EntryPointClassification`. Decoupled from `EntryPointClassification` so
 * the registry doesn't carry per-match fields (e.g. `protocol: entry.name`)
 * that only exist at evaluation time.
 */
export type KnownIssueClassificationMeta =
  | { kind: "framework_invoked"; framework: string }
  | { kind: "dunder_protocol" }
  | { kind: "test_only" }
  | { kind: "indirect_only" };

/**
 * A hand-authored TypeScript check function living at
 * `classify_entry_points/builtins/check_<group_id>.ts`. The orchestrator looks
 * up `function_name` in the barrel `classify_entry_points/builtins/index.ts`
 * and calls it directly. Every catalog entry carries exactly one — there is no
 * "no classifier yet" or "retired classifier" state: a rule whose underlying
 * bug is fixed is deleted from the registry (git history is the audit trail),
 * not marked in place.
 *
 * `min_confidence` ∈ [0, 1] is the score threshold a match must meet.
 */
export interface ClassifierSpec {
  function_name: string;
  min_confidence: number;
}

/** In-memory list of known issues. Loaders return this shape regardless of wire format. */
export type KnownIssuesRegistry = KnownIssue[];

/** Current schema version for the on-disk registry file. */
export const KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION = 1 as const;
export type KnownIssuesRegistrySchemaVersion = typeof KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION;

/**
 * Wire format for `registry.json` on disk and for the bundled permanent
 * slice. Carrying `schema_version` separately from the in-memory array shape
 * means future field changes can be detected by loaders without forcing
 * downstream consumers to thread the version through.
 */
export interface KnownIssuesRegistryFile {
  schema_version: KnownIssuesRegistrySchemaVersion;
  rules: KnownIssue[];
}

/**
 * Select the rules that belong in core's bundled permanent slice: every
 * `status: "permanent"` rule qualifies — each carries a real builtin
 * classifier by construction. The core loader (`validate_permanent_slice`)
 * enforces the same filter at load time. Source order is preserved so
 * regeneration diffs stay minimal.
 */
export function select_permanent_slice_rules(
  rules: readonly KnownIssue[],
): KnownIssue[] {
  return rules.filter((rule) => rule.status === "permanent");
}

const PERMANENT_SLICE_MODULE_HEADER =
  "// AUTO-GENERATED slice of the known-issues registry — do not edit by hand.\n" +
  "// Source of truth: .claude/skills/triage/known_issues/registry.json\n" +
  "// Regenerated from the source registry when its permanent slice changes.\n" +
  "\n" +
  "import type { KnownIssuesRegistryFile } from \"@ariadnejs/types\";\n" +
  "\n";

/**
 * Render the bundled permanent-slice module (`registry_permanent_data.ts` in
 * core) from a full registry rule array: filter via
 * {@link select_permanent_slice_rules}, wrap in the `{ schema_version, rules }`
 * envelope with `schema_version` copied verbatim, and emit the typed `.ts`
 * module text. Pure and byte-deterministic —
 * `registry_permanent_data.sync.test.ts` asserts the committed slice equals
 * this render of the source registry.
 *
 * This produces a TypeScript module, never registry-JSON bytes; the registry
 * write-boundary fence (`registry_writers.test.ts`) does not apply to it.
 */
export function render_permanent_slice_module(
  schema_version: KnownIssuesRegistrySchemaVersion,
  rules: readonly KnownIssue[],
): string {
  const file: KnownIssuesRegistryFile = {
    schema_version,
    rules: select_permanent_slice_rules(rules),
  };
  return (
    PERMANENT_SLICE_MODULE_HEADER +
    "export const PERMANENT_REGISTRY_FILE: KnownIssuesRegistryFile = " +
    JSON.stringify(file, null, 2) +
    ";\n"
  );
}

/**
 * Parse the JSON wire format of `registry.json` and return the inner rule
 * array. Verifies the envelope shape and the `schema_version` field; deep
 * shape validation of individual rules is the loader's responsibility.
 */
export function parse_known_issues_registry_json(raw: string): KnownIssue[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`registry.json is not valid JSON: ${reason}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("registry.json must be a JSON object with `schema_version` and `rules`");
  }
  const record = parsed as Record<string, unknown>;
  if (record["schema_version"] !== KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION) {
    throw new Error(
      `registry.json: schema_version mismatch (expected ${KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION}, got ${String(record["schema_version"])})`,
    );
  }
  if (!Array.isArray(record["rules"])) {
    throw new Error("registry.json: `rules` must be an array");
  }
  return record["rules"] as KnownIssue[];
}

/**
 * Serialize an in-memory rule array to the canonical on-disk JSON format,
 * wrapping in the `{ schema_version, rules }` envelope and producing a
 * trailing newline so the file diffs cleanly.
 */
export function serialize_known_issues_registry_json(rules: readonly KnownIssue[]): string {
  const file: KnownIssuesRegistryFile = {
    schema_version: KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
    rules: [...rules],
  };
  return JSON.stringify(file, null, 2) + "\n";
}

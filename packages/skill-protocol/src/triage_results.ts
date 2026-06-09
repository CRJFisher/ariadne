/**
 * The canonical published `triage_results/<run-id>.json` wire contract — the
 * single source of truth shared by the producer (`triage`) and the consumer
 * (`plan`).
 *
 * The producer's finalize step builds this from the per-entry verdict files
 * (one `novel_issues[]` row per `fp-novel` verdict, no merge); the consumer
 * reads it back through the same strict parser declared here, so both sides
 * validate identically.
 *
 * The deterministic core fault diagnostics carried on each false-positive row
 * (`diagnosis`, `resolution_failure`, `receiver_kind`, and the two
 * `derive_fault_area` disambiguator booleans) reuse the enums already published
 * by `@ariadnejs/types` — this module introduces no new fault taxonomy. The two
 * booleans are carried verbatim so the `plan` engine can re-derive the
 * `AriadneFaultArea` with real values rather than collapsing to `false/false`.
 */

import { readFile } from "node:fs/promises";

import type {
  ClassifierRegressionFlag,
  EntryPointDiagnostics,
  ReceiverKind,
  ResolutionFailure,
} from "@ariadnejs/types";

/** Schema version of the published artifact. Readers reject any mismatch. */
export const TRIAGE_RESULTS_SCHEMA_VERSION = 5;

/**
 * The per-entry investigator's named evidence: the call site that proves the
 * verdict, with a one-line rationale.
 */
export interface MemberEvidence {
  file: string;
  line: number;
  why: string;
}

/**
 * The stable identity of the flagged entry point a false-positive row is about
 * — the "member" the `plan` engine reviews for bucket membership and keys its
 * membership-override store on. It is the coordinate tuple the triage TP cache
 * already treats as a cross-machine match key: `(file_path, name, kind,
 * start_line)`, with `file_path` relative to `project_path` so it is portable.
 *
 * `(file_path, name, kind)` is the drift-stable core; `start_line` is the
 * same-name/overload collision-breaker and still moves when surrounding lines
 * shift. This is the most stable identity the entry-point → triage → plan
 * pipeline carries: a fully line-drift-immune symbol-graph identity would
 * require columns + end-line that core's entry-point extraction does not track.
 */
export interface MemberSymbol {
  file_path: string;
  name: string;
  kind: "function" | "method" | "constructor";
  start_line: number;
}

/**
 * One published false-positive row, built one-per-`fp-novel`-verdict at
 * finalize. Carries the investigator-authored evidence verbatim plus the
 * deterministic core fault diagnostics attached from the entry's
 * `EntryPointDiagnostics`. `id` is deterministic, keyed by `entry_index`.
 *
 * `resolution_failure` is the `{ stage, reason }` subset of the failing call
 * site's `ResolutionFailure`; `receiver_kind` is present only when that call
 * site is a method call.
 *
 * `has_uncaptured_indexed_grep_hit` and `callers_only_in_unindexed_tests` are
 * copied verbatim from the entry's `EntryPointDiagnostics`. They are the two
 * disambiguators `derive_fault_area` consults on its diagnosis-fallback path:
 * without them the `coverage_config` and deterministic-`syntactic_extraction`
 * branches collapse. They are required (the producer always has them from
 * `EntryPointDiagnostics`), so the `plan` engine never has to invent `false`.
 */
export interface NovelIssue {
  id: string;
  entry_index: number;
  /**
   * Stable identity of the flagged entry point this row is about — the
   * coordinate tuple the `plan` engine keys membership decisions and its
   * override store on. Built at finalize from the entry, `file_path` relative
   * to `project_path`.
   */
  member_symbol: MemberSymbol;
  member_evidence: MemberEvidence;
  proposed_root_cause: string;
  evidence_excerpt: string;
  diagnosis: EntryPointDiagnostics["diagnosis"];
  resolution_failure?: {
    stage: ResolutionFailure["stage"];
    reason: ResolutionFailure["reason"];
  };
  receiver_kind?: ReceiverKind;
  has_uncaptured_indexed_grep_hit: boolean;
  callers_only_in_unindexed_tests: boolean;
}

/**
 * Identifier fields shared by every entry-shaped row in the published output.
 * `file_path` is relative to `project_path` so the TP cache match key
 * (`name, file_path, kind, start_line`) is stable across machines.
 */
export interface PublishedEntryRef {
  entry_index: number;
  name: string;
  file_path: string;
  start_line: number;
  kind: "function" | "method" | "constructor";
  signature?: string;
}

/**
 * Why an entry landed in `confirmed_unreachable[]`. Discriminated by `kind` so
 * consumers can exhaustively switch and the `registry:<group_id>` case carries
 * its parameter structurally instead of via string parsing.
 */
export type ConfirmedUnreachableSource =
  | { kind: "llm-tp" }
  | { kind: "previously-confirmed-tp" }
  | { kind: "registry"; group_id: string };

/**
 * One row in `confirmed_unreachable[]`. Carries identifiers for the TP cache
 * plus the investigator's `member_evidence` when the verdict came from an LLM
 * pass. Auto-classified rows (registry hits, previously-confirmed-TP reuse)
 * have `member_evidence: null` — no investigator visited the entry.
 */
export interface PublishedConfirmedUnreachable extends PublishedEntryRef {
  source: ConfirmedUnreachableSource;
  member_evidence: MemberEvidence | null;
}

/**
 * One row in `uncertain[]` — investigator could not reduce the entry to a
 * single verdict. Always carries `member_evidence` and `reason`.
 */
export interface PublishedUncertain extends PublishedEntryRef {
  reason: string;
  member_evidence: MemberEvidence;
}

export interface TriageResultsFile {
  /** Schema version of this published artifact. Required; readers reject mismatches. */
  schema_version: number;
  /**
   * Absolute path to the target repo at run time. Consumers resolve
   * `file_path` against this to read source. Travels with the run-id and
   * `commit_hash` so the artifact is self-contained.
   */
  project_path: string;
  /** Full HEAD commit hash for the target repo at run time, or `null` for non-git projects. */
  commit_hash: string | null;
  /**
   * Self-contained false-positive rows, one per `fp-novel` verdict file. Each
   * carries the investigator's evidence plus the deterministic core fault
   * diagnostics. Built at finalize; never merged.
   */
  novel_issues: NovelIssue[];
  /**
   * Per-rule aggregate of every `fp-classifier-regression` verdict the
   * per-entry investigator emitted in this run, derived from the verdict files.
   */
  classifier_regressions: ClassifierRegressionFlag[];
  confirmed_unreachable: PublishedConfirmedUnreachable[];
  uncertain: PublishedUncertain[];
  last_updated: string;
}

/**
 * Top-level required arrays. The parser checks each is present and is an
 * array; deeper row validation is the consumer's concern (a v5 producer is the
 * only legitimate writer of these files).
 */
const REQUIRED_ARRAYS: readonly (keyof TriageResultsFile)[] = [
  "novel_issues",
  "classifier_regressions",
  "confirmed_unreachable",
  "uncertain",
];

/**
 * Parse a published triage-results JSON string. Throws if the payload is not
 * an object, the `schema_version` does not equal
 * {@link TRIAGE_RESULTS_SCHEMA_VERSION}, or any required top-level array is
 * missing — so producer and consumer reject malformed/stale files identically.
 */
export function parse_triage_results(
  source_label: string,
  text: string,
): TriageResultsFile {
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
  if (obj.schema_version !== TRIAGE_RESULTS_SCHEMA_VERSION) {
    throw new Error(
      `${source_label}: schema_version=${String(obj.schema_version)} does not match ` +
        `current v${TRIAGE_RESULTS_SCHEMA_VERSION}. Re-finalize the run or remove the stale file.`,
    );
  }
  for (const field of REQUIRED_ARRAYS) {
    if (!Array.isArray(obj[field])) {
      throw new Error(
        `${source_label}: '${String(field)}' must be an array (got ${describe(obj[field])})`,
      );
    }
  }
  return parsed as TriageResultsFile;
}

/** Read a published triage-results file from disk and parse it strictly. */
export async function read_triage_results_file(
  file_path: string,
): Promise<TriageResultsFile> {
  const text = await readFile(file_path, "utf8");
  return parse_triage_results(file_path, text);
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

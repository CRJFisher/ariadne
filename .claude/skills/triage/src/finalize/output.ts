/**
 * Convert completed TriageState into the published v5 `triage_results/<run-id>.json`.
 *
 * The per-entry verdict files under `results/` are the single source of truth.
 * `build_finalization_output` reads them (already loaded into
 * `verdicts_by_entry_index`) and:
 *   - builds `novel_issues[]` one-per-`fp-novel`-verdict (no merge), each row
 *     carrying the investigator's evidence plus the deterministic core fault
 *     diagnostics attached from the entry's `EntryPointDiagnostics`;
 *   - derives `classifier_regressions[]` by rolling up the
 *     `fp-classifier-regression` verdicts per `should_have_matched_rule_id`;
 *   - partitions `tp` / `uncertain` verdicts into `confirmed_unreachable[]` /
 *     `uncertain[]`.
 *
 * File paths in entry-shaped sections are published relative to
 * `project_path` so the artifact is portable across machines and worktrees
 * (and so the TP cache match key stays stable across hosts).
 */

import type { EntryPointDiagnostics } from "@ariadnejs/types";
import {
  aggregate_classifier_regressions,
  type ClassifierRegressionInput,
} from "./classifier_regressions.js";
import {
  TRIAGE_RESULTS_SCHEMA_VERSION,
  type ConfirmedUnreachableSource,
  type NovelIssue,
  type PublishedConfirmedUnreachable,
  type PublishedEntryRef,
  type PublishedUncertain,
  type TriageResultsFile,
} from "@ariadnejs/skill-protocol";
import type { TriageVerdict } from "../verdict/triage_verdict.js";
import type { TriageEntry, TriageState } from "../triage_state_types.js";
import { relativize } from "../store/paths.js";

// ===== Build inputs (producer-private) =====

export interface FinalizationSources {
  /** Per-entry verdicts keyed by `entry_index`. Auto-classified entries are absent. */
  verdicts_by_entry_index: Map<number, TriageVerdict>;
}

export interface FinalizationContext {
  /** HEAD commit hash recorded for provenance. May be null for non-git projects. */
  commit_hash: string | null;
  /** Absolute project path. Used to relativize entry `file_path` values and published verbatim. */
  project_path: string;
  sources: FinalizationSources;
}

export interface FinalizationSummary {
  total_entries: number;
  confirmed_unreachable_count: number;
  novel_issue_count: number;
  classifier_regression_rule_count: number;
  classifier_regression_entry_count: number;
  uncertain_count: number;
  failed_count: number;
}

// ===== Pure Functions =====

function entry_ref(entry: TriageEntry, project_path: string): PublishedEntryRef {
  const kind = entry.kind;
  if (kind !== "function" && kind !== "method" && kind !== "constructor") {
    throw new Error(
      `build_finalization_output: unexpected kind "${kind}" for ${entry.name} (${entry.file_path})`,
    );
  }
  const ref: PublishedEntryRef = {
    entry_index: entry.entry_index,
    name: entry.name,
    file_path: relativize(entry.file_path, project_path),
    start_line: entry.start_line,
    kind,
  };
  if (entry.signature !== null) {
    ref.signature = entry.signature;
  }
  return ref;
}

/**
 * Attach the deterministic core fault diagnostics to a published FP row. The
 * `diagnosis` enum and the `has_uncaptured_indexed_grep_hit` disambiguator are
 * always present, copied verbatim from the entry's `EntryPointDiagnostics` so
 * the `plan` engine re-derives the fault area with real values rather than
 * `false`. `resolution_failure` (narrowed to `{ stage, reason }`) and
 * `receiver_kind` come from the first call site that carries a resolution
 * failure — the resolver's own observation of where it gave up. `receiver_kind`
 * is emitted only when that call site is a method call (function/constructor
 * sites have `receiver_kind === "none"`).
 */
function attach_fault_diagnostics(
  diagnostics: EntryPointDiagnostics,
): Pick<
  NovelIssue,
  | "diagnosis"
  | "resolution_failure"
  | "receiver_kind"
  | "has_uncaptured_indexed_grep_hit"
> {
  const result: Pick<
    NovelIssue,
    | "diagnosis"
    | "resolution_failure"
    | "receiver_kind"
    | "has_uncaptured_indexed_grep_hit"
  > = {
    diagnosis: diagnostics.diagnosis,
    has_uncaptured_indexed_grep_hit: diagnostics.has_uncaptured_indexed_grep_hit,
  };
  const failing = diagnostics.ariadne_call_refs.find(
    (ref) => ref.resolution_failure !== null,
  );
  if (failing === undefined || failing.resolution_failure === null) return result;
  const failure = failing.resolution_failure;
  result.resolution_failure = { stage: failure.stage, reason: failure.reason };
  if (failing.call_type === "method" && failing.receiver_kind !== "none") {
    result.receiver_kind = failing.receiver_kind;
  }
  return result;
}

/**
 * Build the published v5 output from the run's per-entry verdict files.
 *
 * The function is pure: callers (`finalize_triage.ts`) load the per-entry
 * verdict files first and pass them in via `FinalizationContext.sources`.
 */
export function build_finalization_output(
  state: TriageState,
  context: FinalizationContext,
): TriageResultsFile {
  const confirmed_unreachable: PublishedConfirmedUnreachable[] = [];
  const uncertain: PublishedUncertain[] = [];
  const novel_issues: NovelIssue[] = [];
  const regression_inputs: ClassifierRegressionInput[] = [];

  for (const entry of state.entries) {
    if (entry.status === "failed") continue;
    // `state.phase === "complete"` is the precondition for finalize; a pending
    // entry at this point is a dispatcher bug, not a recoverable state.
    if (entry.status === "pending") {
      throw new Error(
        `build_finalization_output: entry ${entry.entry_index} (${entry.name}) is still pending; refusing to finalize.`,
      );
    }

    if (entry.route === "known-unreachable") {
      if (entry.known_source === null) {
        throw new Error(
          `build_finalization_output: entry ${entry.entry_index} (${entry.name}) has route=known-unreachable but no known_source — classifier output is inconsistent.`,
        );
      }
      confirmed_unreachable.push({
        ...entry_ref(entry, context.project_path),
        source: parse_known_source(entry.known_source),
        member_evidence: null,
      });
      continue;
    }

    // route === "llm-triage"; verdict comes from the per-entry result file.
    const verdict = context.sources.verdicts_by_entry_index.get(entry.entry_index);
    if (verdict === undefined) {
      throw new Error(
        `build_finalization_output: entry ${entry.entry_index} (${entry.name}) is completed on the llm-triage route but has no verdict in results/. ` +
          "Re-run the per-entry investigator (get_next_triage_entry) for this entry before finalizing.",
      );
    }

    switch (verdict.kind) {
      case "tp":
        confirmed_unreachable.push({
          ...entry_ref(entry, context.project_path),
          source: { kind: "llm-tp" },
          member_evidence: verdict.member_evidence,
        });
        break;
      case "uncertain":
        uncertain.push({
          ...entry_ref(entry, context.project_path),
          reason: verdict.reason,
          member_evidence: verdict.member_evidence,
        });
        break;
      case "fp-novel": {
        // Reuse `entry_ref` so the member identity shares the same kind check and
        // `project_path`-relative `file_path` the published entry rows use.
        const ref = entry_ref(entry, context.project_path);
        novel_issues.push({
          id: `novel-${entry.entry_index}`,
          entry_index: entry.entry_index,
          member_symbol: {
            file_path: ref.file_path,
            name: ref.name,
            kind: ref.kind,
            start_line: ref.start_line,
          },
          member_evidence: verdict.member_evidence,
          proposed_root_cause: verdict.proposed_root_cause,
          evidence_excerpt: verdict.evidence_excerpt,
          ...attach_fault_diagnostics(entry.diagnostics),
        });
        break;
      }
      case "fp-classifier-regression":
        regression_inputs.push({
          should_have_matched_rule_id: verdict.should_have_matched_rule_id,
          entry_index: entry.entry_index,
          evidence_excerpt: verdict.evidence_excerpt,
        });
        break;
    }
  }

  return {
    schema_version: TRIAGE_RESULTS_SCHEMA_VERSION,
    project_path: context.project_path,
    commit_hash: context.commit_hash,
    novel_issues,
    classifier_regressions: aggregate_classifier_regressions(regression_inputs),
    confirmed_unreachable,
    uncertain,
    last_updated: state.updated_at,
  };
}

export function build_finalization_summary(
  state: TriageState,
  output: TriageResultsFile,
): FinalizationSummary {
  const failed_count = state.entries.filter((e) => e.status === "failed").length;

  const classifier_regression_entry_count = output.classifier_regressions.reduce(
    (sum, flag) => sum + flag.flagged_entries.length,
    0,
  );

  return {
    total_entries: state.entries.length,
    confirmed_unreachable_count: output.confirmed_unreachable.length,
    novel_issue_count: output.novel_issues.length,
    classifier_regression_rule_count: output.classifier_regressions.length,
    classifier_regression_entry_count,
    uncertain_count: output.uncertain.length,
    failed_count,
  };
}

// ===== Internal: provenance =====

const REGISTRY_PREFIX = "registry:";

function parse_known_source(known_source: string): ConfirmedUnreachableSource {
  if (known_source === "previously-confirmed-tp") return { kind: "previously-confirmed-tp" };
  if (known_source.startsWith(REGISTRY_PREFIX)) {
    const group_id = known_source.slice(REGISTRY_PREFIX.length);
    if (group_id.length === 0) {
      throw new Error(
        `build_finalization_output: known_source '${known_source}' has an empty group_id`,
      );
    }
    return { kind: "registry", group_id };
  }
  throw new Error(
    `build_finalization_output: unrecognised known_source '${known_source}'. Expected 'previously-confirmed-tp' or 'registry:<group_id>'.`,
  );
}

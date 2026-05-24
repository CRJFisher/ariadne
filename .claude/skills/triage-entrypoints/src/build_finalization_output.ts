/**
 * Convert completed TriageState into the published v4 `triage_results/<run-id>.json`.
 *
 * Sources:
 *   - per-run `novel_issues.json`            → `novel_issues`
 *   - per-run `classifier_regressions.jsonl` → `classifier_regressions`
 *   - per-entry verdict files under `results/`+ the triage state itself
 *                                            → `confirmed_unreachable`, `uncertain`
 *
 * File paths in entry-shaped sections are published relative to
 * `project_path` so the artifact is portable across machines and worktrees
 * (and so the TP cache match key stays stable across hosts).
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { ClassifierRegressionFlag } from "./classifier_regressions.js";
import type { NovelIssue, FlaggedVerdict } from "./novel_issues.js";
import { parse_triage_verdict, type MemberEvidence, type TriageVerdict } from "./triage_verdict.js";
import type { TriageEntry, TriageState } from "./triage_state_types.js";

export const FINALIZATION_OUTPUT_SCHEMA_VERSION = 4;

// ===== Output Types =====

/**
 * Identifier fields shared by every entry-shaped row in the published output.
 * `file_path` is relative to `project_path` so the TP cache match key
 * (`name, file_path, kind, start_line`) is stable across machines.
 */
interface PublishedEntryRef {
  entry_index: number;
  name: string;
  file_path: string;
  start_line: number;
  kind: "function" | "method" | "constructor";
  signature?: string;
}

/**
 * Why an entry landed in `confirmed_unreachable[]`. Discriminated by `kind` so
 * consumers can exhaustively switch and so the `registry:<group_id>` case
 * carries its parameter structurally instead of via string parsing.
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
 * single verdict. Always carries `member_evidence` and `reason` because the
 * source verdict (`kind: "uncertain"`) requires them.
 */
export interface PublishedUncertain extends PublishedEntryRef {
  reason: string;
  member_evidence: MemberEvidence;
}

export interface FinalizationOutput {
  schema_version: number;
  /**
   * Absolute path to the target repo at run time. Consumers (curator, diff_runs)
   * resolve `file_path` against this to read source. Travels with the run-id and
   * the commit_hash to make the artifact self-contained.
   */
  project_path: string;
  /** Full HEAD commit hash for the target repo at run time, or `null` for non-git projects. */
  commit_hash: string | null;
  /**
   * Consolidated novel issues registered against this run, as written by the
   * dispatcher into `novel_issues.json`. The curator's promotion path reads
   * this list verbatim.
   */
  novel_issues: NovelIssue[];
  /**
   * Flagged novel verdicts the coordinator could not assign (ambiguous merge
   * candidates). Published so the curator's human-review surface can pick them
   * up without grepping `coordinator_log.jsonl`.
   */
  flagged_novel_verdicts: FlaggedVerdict[];
  /**
   * Per-rule aggregate of every `fp-classifier-regression` verdict the per-entry
   * investigator emitted in this run. The curator's drift-absorb path consumes
   * this and marks the named wip rows as drifting (see
   * `.claude/rules/classifier-lifecycle.md`).
   */
  classifier_regressions: ClassifierRegressionFlag[];
  confirmed_unreachable: PublishedConfirmedUnreachable[];
  uncertain: PublishedUncertain[];
  last_updated: string;
}

export interface FinalizationSources {
  novel_issues: NovelIssue[];
  flagged_novel_verdicts: FlaggedVerdict[];
  classifier_regressions: ClassifierRegressionFlag[];
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
  novel_citation_count: number;
  classifier_regression_rule_count: number;
  classifier_regression_entry_count: number;
  uncertain_count: number;
  failed_count: number;
}

// ===== Pure Functions =====

function relativize(file_path: string, project_path: string): string {
  if (!path.isAbsolute(file_path)) return file_path;
  return path.relative(project_path, file_path);
}

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
 * Build the published v4 output from the run's resolved sources.
 *
 * The function is pure: callers (`finalize_triage.ts`) load `novel_issues.json`,
 * the classifier-regressions log, and the per-entry verdict files first and
 * pass them in via `FinalizationContext.sources`.
 */
export function build_finalization_output(
  state: TriageState,
  context: FinalizationContext,
): FinalizationOutput {
  const confirmed_unreachable: PublishedConfirmedUnreachable[] = [];
  const uncertain: PublishedUncertain[] = [];

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
          "Re-run the dispatcher's absorb pass before finalizing.",
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
      // fp-novel-new / fp-novel-cited are already captured in novel_issues.
      // fp-classifier-regression is already captured in classifier_regressions.
      case "fp-novel-new":
      case "fp-novel-cited":
      case "fp-classifier-regression":
        break;
    }
  }

  // Cross-source consistency: every novel-issue citation and every classifier
  // regression entry_index must map to a matching verdict kind. A mismatch
  // means the dispatcher absorbed a verdict but the per-entry file holds a
  // contradictory one (or vice versa) — silently double-publishing would
  // confuse downstream consumers.
  assert_citations_consistent(
    context.sources.novel_issues,
    context.sources.verdicts_by_entry_index,
  );
  assert_classifier_regressions_consistent(
    context.sources.classifier_regressions,
    context.sources.verdicts_by_entry_index,
  );

  return {
    schema_version: FINALIZATION_OUTPUT_SCHEMA_VERSION,
    project_path: context.project_path,
    commit_hash: context.commit_hash,
    novel_issues: context.sources.novel_issues,
    flagged_novel_verdicts: context.sources.flagged_novel_verdicts,
    classifier_regressions: context.sources.classifier_regressions,
    confirmed_unreachable,
    uncertain,
    last_updated: state.updated_at,
  };
}

export function build_finalization_summary(
  state: TriageState,
  output: FinalizationOutput,
): FinalizationSummary {
  const failed_count = state.entries.filter((e) => e.status === "failed").length;

  const novel_citation_count = output.novel_issues.reduce(
    (sum, issue) => sum + issue.citations.length,
    0,
  );
  const classifier_regression_entry_count = output.classifier_regressions.reduce(
    (sum, flag) => sum + flag.flagged_entries.length,
    0,
  );

  return {
    total_entries: state.entries.length,
    confirmed_unreachable_count: output.confirmed_unreachable.length,
    novel_issue_count: output.novel_issues.length,
    novel_citation_count,
    classifier_regression_rule_count: output.classifier_regressions.length,
    classifier_regression_entry_count,
    uncertain_count: output.uncertain.length,
    failed_count,
  };
}

// ===== Per-entry verdict loader =====

/**
 * Load and parse every per-entry result file in `results_dir`, returning a map
 * keyed by `entry_index`. Files whose name is not a positive integer or
 * `<integer>.json` are skipped. Each file is parsed strictly via
 * `parse_triage_verdict`; a malformed file aborts the load with a clear error
 * so a finalize never silently drops verdicts.
 */
/**
 * Strict non-negative-integer filename: rejects `-3.json`, `01.json`,
 * `5.5.json`, ` 5.json`, `5.json.bak`, and any other shape outside the
 * dispatcher's `<entry_index>.json` contract. Shared with `merge_results.ts`
 * so the absorb-time gate and the finalize-time gate cannot diverge.
 */
export const VERDICT_FILE_BASENAME = /^(0|[1-9]\d*)$/;

export async function load_verdicts_by_entry_index(
  results_dir: string,
): Promise<Map<number, TriageVerdict>> {
  const out = new Map<number, TriageVerdict>();
  let files: string[];
  try {
    files = await fs.readdir(results_dir);
  } catch (err) {
    if (is_enoent(err)) return out;
    throw err;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const basename = file.slice(0, -".json".length);
    if (!VERDICT_FILE_BASENAME.test(basename)) continue;
    const entry_index = Number.parseInt(basename, 10);
    const file_path = path.join(results_dir, file);
    const raw = await fs.readFile(file_path, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${file_path}: invalid JSON — ${message}`);
    }
    out.set(entry_index, parse_triage_verdict(parsed));
  }
  return out;
}

function is_enoent(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if (!("code" in err)) return false;
  return (err as { code: unknown }).code === "ENOENT";
}

// ===== Internal: provenance + cross-source consistency =====

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

function assert_citations_consistent(
  issues: readonly NovelIssue[],
  verdicts: ReadonlyMap<number, TriageVerdict>,
): void {
  const mismatches: string[] = [];
  for (const issue of issues) {
    for (const citation of issue.citations) {
      const verdict = verdicts.get(citation.entry_index);
      if (verdict === undefined) {
        mismatches.push(
          `novel_issue '${issue.id}' cites entry ${citation.entry_index} but no verdict file is present`,
        );
        continue;
      }
      if (verdict.kind !== "fp-novel-new" && verdict.kind !== "fp-novel-cited") {
        mismatches.push(
          `novel_issue '${issue.id}' cites entry ${citation.entry_index} (verdict.kind='${verdict.kind}'); expected fp-novel-new or fp-novel-cited`,
        );
      }
    }
  }
  if (mismatches.length > 0) {
    throw new Error(
      `build_finalization_output: novel-issue citations are inconsistent with per-entry verdicts:\n  - ${mismatches.join("\n  - ")}`,
    );
  }
}

function assert_classifier_regressions_consistent(
  regressions: readonly { rule_id: string; flagged_entries: readonly { entry_index: number; evidence_excerpt: string }[] }[],
  verdicts: ReadonlyMap<number, TriageVerdict>,
): void {
  const mismatches: string[] = [];
  for (const flag of regressions) {
    for (const entry of flag.flagged_entries) {
      const verdict = verdicts.get(entry.entry_index);
      if (verdict === undefined) {
        mismatches.push(
          `classifier_regression '${flag.rule_id}' flags entry ${entry.entry_index} but no verdict file is present`,
        );
        continue;
      }
      if (verdict.kind !== "fp-classifier-regression") {
        mismatches.push(
          `classifier_regression '${flag.rule_id}' flags entry ${entry.entry_index} (verdict.kind='${verdict.kind}'); expected fp-classifier-regression`,
        );
      }
    }
  }
  if (mismatches.length > 0) {
    throw new Error(
      `build_finalization_output: classifier-regression flags are inconsistent with per-entry verdicts:\n  - ${mismatches.join("\n  - ")}`,
    );
  }
}

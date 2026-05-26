/**
 * Dispatcher absorb path for one per-entry `TriageVerdict`.
 *
 * Routing:
 *   - `tp` | `uncertain` — absorbed directly; no coordinator call, no
 *     persistent write.
 *   - `fp-classifier-regression` — absorbed directly; appends a record to the
 *     per-run `classifier_regressions.jsonl` so `finalize_triage` can
 *     aggregate `should_have_matched_rule_id`s into the published
 *     `classifier_regressions` slice. No coordinator call.
 *   - `fp-novel-new` | `fp-novel-cited` — invoke the `triage-coordinator`
 *     sub-agent synchronously; apply its decision via
 *     `apply_coordinator_decision`; persist atomically; append to the
 *     coordinator log.
 *
 * Crash-safety invariants:
 *
 * - **Single-writer per path.** A process-local mutex serializes overlapping
 *   absorbs against the same `novel_issues_path`, eliminating the
 *   read-modify-write race that `atomic_write_file` alone does not protect
 *   against. Sufficient for the declared deployment (one dispatcher process
 *   per run); cross-process safety would require an OS lock.
 *
 * - **Verdict re-parsed at the boundary.** The static type would let a
 *   malformed object pass; `parse_triage_verdict` rejects shape violations
 *   before any I/O so a corrupt result file cannot silently land in the
 *   registry.
 *
 * - **Replay guard.** If `entry_index` already appears in any issue's
 *   citations or in `flagged`, the absorb short-circuits as a no-op. Replays
 *   after a partial failure are safe even when `register_new` is non-trivially
 *   idempotent at the mutator layer.
 *
 * - **Coordinator failures degrade to flag.** Any throw from the coordinator
 *   callback is caught and synthesized as a `flag` decision with the error
 *   message in `reason`. Every novel verdict therefore produces exactly one
 *   log entry, regardless of whether the agent succeeded.
 *
 * - **Log before file write.** The decision is appended to the JSONL log
 *   before `novel_issues.json` is rewritten. A crash between the two leaves
 *   the audit trail intact; a replay re-reads the (unchanged) registry, the
 *   replay guard fires only if the prior absorb had completed, and otherwise
 *   the coordinator is consulted again. Duplicate log entries on the same
 *   `(entry_index, timestamp)` are recoverable by curator dedupe.
 */

import {
  append_classifier_regression_record,
  type ClassifierRegressionRecord,
} from "@ariadnejs/skill-fs";
import {
  find_flagged,
  find_issue_citing,
  read_novel_issues,
  write_novel_issues,
  type NovelIssue,
  type NovelIssuesFile,
} from "./novel_issues.js";
import {
  apply_coordinator_decision,
  type AppliedOutcome,
} from "./coordinator_apply_decision.js";
import {
  append_coordinator_log_entry,
  type CoordinatorLogEntry,
} from "./coordinator_log.js";
import type { CoordinatorDecision } from "./coordinator_decision.js";
import {
  render_coordinator_prompt,
  type RenderCoordinatorPromptInput,
} from "./coordinator_prompt.js";
import {
  parse_triage_verdict,
  type NovelVerdict,
  type TriageVerdict,
} from "../verdict/triage_verdict.js";

/**
 * Coordinator callback: the bridge that turns a rendered prompt into a parsed
 * decision. Production wires this to a `Task` invocation of the
 * `triage-coordinator` sub-agent (parsing the raw text output via
 * `parse_coordinator_decision`); tests inject a deterministic mock.
 *
 * The callback receives both the structured input and the rendered string —
 * production uses the string for the sub-agent call; tests inspect the
 * structured input.
 */
export type CoordinatorFn = (
  input: RenderCoordinatorPromptInput,
  prompt: string,
) => Promise<CoordinatorDecision>;

export interface AbsorbVerdictOptions {
  novel_issues_path: string;
  coordinator_log_path: string;
  /**
   * Per-run append-only log of every `fp-classifier-regression` verdict
   * absorbed. Read by `finalize_triage` to publish the
   * `classifier_regressions` slice.
   */
  classifier_regressions_path: string;
  coordinator: CoordinatorFn;
  /** Clock for log timestamps. Required to keep absorbs deterministic in
   *  tests; production callers pass `() => new Date().toISOString()`. */
  now: () => string;
}

export interface AbsorbResultDirect {
  kind: "tp" | "uncertain";
}

export interface AbsorbResultRegression {
  kind: "fp-classifier-regression";
}

export interface AbsorbResultReplay {
  kind: NovelVerdict["kind"];
  outcome: "replayed-citation" | "replayed-flag";
  novel_issues: NovelIssuesFile;
}

interface AbsorbResultCoordinatedBase {
  kind: NovelVerdict["kind"];
  novel_issues: NovelIssuesFile;
  /** What the coordinator returned, before any dispatcher downgrade. */
  coordinator_decision: CoordinatorDecision;
  /** What was actually applied to `novel_issues.json` (may differ from
   *  `coordinator_decision` when the dispatcher downgraded — e.g. unknown
   *  `merge_into` id, or coordinator throw). */
  applied_decision: CoordinatorDecision;
}

export type AbsorbResultMerged = AbsorbResultCoordinatedBase & {
  outcome: "merged";
};

export type AbsorbResultRegistered = AbsorbResultCoordinatedBase & {
  outcome: "registered";
  registered_issue: NovelIssue;
};

export type AbsorbResultFlagged = AbsorbResultCoordinatedBase & {
  outcome: "flagged";
};

export type AbsorbVerdictResult =
  | AbsorbResultDirect
  | AbsorbResultRegression
  | AbsorbResultReplay
  | AbsorbResultMerged
  | AbsorbResultRegistered
  | AbsorbResultFlagged;

/**
 * Absorb a single per-entry verdict. See module doc for invariants.
 */
export async function absorb_verdict(
  entry_index: number,
  verdict: TriageVerdict,
  opts: AbsorbVerdictOptions,
): Promise<AbsorbVerdictResult> {
  const parsed = parse_triage_verdict(verdict);
  switch (parsed.kind) {
    case "tp":
    case "uncertain":
      return { kind: parsed.kind };
    case "fp-classifier-regression":
      await with_path_lock(opts.classifier_regressions_path, async () => {
        const record: ClassifierRegressionRecord = {
          timestamp: opts.now(),
          entry_index,
          should_have_matched_rule_id: parsed.should_have_matched_rule_id,
          evidence_excerpt: parsed.evidence_excerpt,
          member_evidence: parsed.member_evidence,
        };
        await append_classifier_regression_record(
          opts.classifier_regressions_path,
          record,
        );
      });
      return { kind: parsed.kind };
    case "fp-novel-new":
    case "fp-novel-cited":
      return await with_path_lock(opts.novel_issues_path, () =>
        absorb_novel_verdict(entry_index, parsed, opts),
      );
  }
}

async function absorb_novel_verdict(
  entry_index: number,
  verdict: NovelVerdict,
  opts: AbsorbVerdictOptions,
): Promise<AbsorbVerdictResult> {
  const current = await read_novel_issues(opts.novel_issues_path);

  // Replay guard — if this entry was already absorbed in a prior pass, return
  // the cached state without invoking the coordinator or writing anything.
  const prior_citation = find_issue_citing(current, entry_index);
  if (prior_citation !== null) {
    return {
      kind: verdict.kind,
      outcome: "replayed-citation",
      novel_issues: current,
    };
  }
  const prior_flag = find_flagged(current, entry_index);
  if (prior_flag !== null) {
    return {
      kind: verdict.kind,
      outcome: "replayed-flag",
      novel_issues: current,
    };
  }

  const prompt_input: RenderCoordinatorPromptInput = {
    entry_index,
    verdict,
    current,
  };
  const prompt = render_coordinator_prompt(prompt_input);
  const coordinator_decision = await call_coordinator(opts.coordinator, prompt_input, prompt);
  const outcome = apply_coordinator_decision(
    current,
    entry_index,
    verdict,
    coordinator_decision,
  );

  await persist_outcome({
    entry_index,
    verdict,
    coordinator_decision,
    outcome,
    novel_issues_path: opts.novel_issues_path,
    coordinator_log_path: opts.coordinator_log_path,
    now: opts.now,
  });

  return build_result(verdict, current, coordinator_decision, outcome);
}

async function call_coordinator(
  coordinator: CoordinatorFn,
  input: RenderCoordinatorPromptInput,
  prompt: string,
): Promise<CoordinatorDecision> {
  try {
    return await coordinator(input, prompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      kind: "flag",
      reason: `coordinator threw: ${message}`,
    };
  }
}

interface PersistInput {
  entry_index: number;
  verdict: NovelVerdict;
  coordinator_decision: CoordinatorDecision;
  outcome: AppliedOutcome;
  novel_issues_path: string;
  coordinator_log_path: string;
  now: () => string;
}

async function persist_outcome(input: PersistInput): Promise<void> {
  // Order: log first, then registry. A crash between leaves the audit trail
  // intact; the replay guard catches the case where the registry write
  // already completed in a prior pass.
  const log_entry: CoordinatorLogEntry = {
    timestamp: input.now(),
    entry_index: input.entry_index,
    verdict: input.verdict,
    decision: input.outcome.applied_decision,
  };
  await append_coordinator_log_entry(input.coordinator_log_path, log_entry);
  await write_novel_issues(input.novel_issues_path, input.outcome.next);
}

function build_result(
  verdict: NovelVerdict,
  current: NovelIssuesFile,
  coordinator_decision: CoordinatorDecision,
  outcome: AppliedOutcome,
): AbsorbVerdictResult {
  const base = {
    kind: verdict.kind,
    novel_issues: outcome.next,
    coordinator_decision,
    applied_decision: outcome.applied_decision,
  };
  switch (outcome.kind) {
    case "merged":
      return { ...base, outcome: "merged" };
    case "registered":
      return {
        ...base,
        outcome: "registered",
        registered_issue: outcome.registered_issue,
      };
    case "flagged":
      return { ...base, outcome: "flagged" };
  }
}

// ===== Process-local path mutex =====

const path_locks = new Map<string, Promise<unknown>>();

/**
 * Serialize async operations against a single path. Each new caller chains
 * onto the prior lock holder's promise; the chain self-cleans when the queue
 * empties.
 */
async function with_path_lock<T>(
  path: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prior = path_locks.get(path) ?? Promise.resolve();
  const current = prior.then(fn, fn);
  path_locks.set(path, current);
  try {
    return await current;
  } finally {
    if (path_locks.get(path) === current) {
      path_locks.delete(path);
    }
  }
}

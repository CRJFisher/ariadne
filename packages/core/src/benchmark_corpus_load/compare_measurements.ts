/**
 * The comparisons the harness allows, and the ones it refuses.
 *
 * Two refusals, each bought at a price that is recorded with the rule so the
 * next reader does not have to re-buy it.
 *
 * A row taken against tree-sitter 0.21.1 is not comparable with one taken
 * against 0.25.0. Two measurement worktrees silently resolved the old
 * grammars from hoisted copies, and the roughly forty grammar test failures
 * both runs dismissed as environmental were the grammars themselves.
 *
 * A ratio may not cross a session or a machine. One arm producing
 * byte-identical structural output measured 777.6 s, 801.3 s and 1,019.4 s in
 * three sessions on the same hardware. A speedup taken by dividing into
 * another session's number was wrong by 40%: an export-gate repair was
 * reported at 2.202x and measured 1.570x once an independent verifier built
 * their own interleaved control arm. So a speedup is only ever computed
 * between a candidate and a control that ran interleaved with it, in the same
 * session, on the same machine.
 */

import { round_to_hundredth, type MeasurementRow } from "./measurement_row";

const CROSS_SESSION_EVIDENCE =
  "identical computation measured 777.6 s, 801.3 s and 1,019.4 s in three sessions with byte-identical structural output, and a cross-session speedup claim was wrong by 40% (2.202x claimed, 1.570x against a same-session control)";

const GRAMMAR_EVIDENCE =
  "two measurement worktrees silently resolved tree-sitter 0.21.1 / tree-sitter-typescript 0.21.2 from hoisted copies instead of 0.25.0 / 0.23.2, and the ~40 grammar failures both runs called environmental were exactly that";

const CORPUS_EVIDENCE =
  "vscode's `src/` corpus costs 510.3 s of CPU and its repository root costs 1,653.9 s; the two answer the ten-minute question differently and are never divided into one another";

export interface ComparabilityVerdict {
  readonly comparable: boolean;
  /** Empty when the rows may be compared; otherwise every reason they may not. */
  readonly refusals: readonly string[];
}

/**
 * Whether two rows describe the same measurable thing well enough to be put
 * side by side at all — same grammars, same corpus, same file set, same
 * ingest order.
 */
export function check_rows_comparable(
  baseline: MeasurementRow,
  candidate: MeasurementRow,
): ComparabilityVerdict {
  const refusals: string[] = [];

  if (
    baseline.environment.tree_sitter_version !==
    candidate.environment.tree_sitter_version
  ) {
    refusals.push(
      `tree-sitter differs (${baseline.environment.tree_sitter_version} vs ${candidate.environment.tree_sitter_version}) — ${GRAMMAR_EVIDENCE}`,
    );
  }
  if (
    baseline.environment.tree_sitter_typescript_version !==
    candidate.environment.tree_sitter_typescript_version
  ) {
    refusals.push(
      `tree-sitter-typescript differs (${baseline.environment.tree_sitter_typescript_version} vs ${candidate.environment.tree_sitter_typescript_version}) — ${GRAMMAR_EVIDENCE}`,
    );
  }
  if (
    baseline.fingerprint.schema_version !== candidate.fingerprint.schema_version
  ) {
    refusals.push(
      `fingerprint schema differs (${baseline.fingerprint.schema_version} vs ${candidate.fingerprint.schema_version}) — the members behind these digests are not the same kind of thing`,
    );
  }
  if (baseline.corpus.predicate !== candidate.corpus.predicate) {
    refusals.push(
      `corpus predicate differs (${baseline.corpus.predicate} vs ${candidate.corpus.predicate}) — ${CORPUS_EVIDENCE}`,
    );
  }
  if (baseline.corpus.corpus_name !== candidate.corpus.corpus_name) {
    refusals.push(
      `corpus differs (${baseline.corpus.corpus_name} vs ${candidate.corpus.corpus_name}) — ${CORPUS_EVIDENCE}`,
    );
  }
  if (baseline.corpus.corpus_commit !== candidate.corpus.corpus_commit) {
    refusals.push(
      `corpus commit differs (${baseline.corpus.corpus_commit} vs ${candidate.corpus.corpus_commit}) — a row without its corpus commit is not a measurement`,
    );
  }
  if (baseline.file_counts.offered !== candidate.file_counts.offered) {
    refusals.push(
      `file count differs (${baseline.file_counts.offered} vs ${candidate.file_counts.offered}) — the dropped-file set alone grows from 1 to 3 to 8 files across n=100/120/200`,
    );
  }
  return { comparable: refusals.length === 0, refusals };
}

export function assert_rows_comparable(
  baseline: MeasurementRow,
  candidate: MeasurementRow,
): void {
  const verdict = check_rows_comparable(baseline, candidate);
  if (!verdict.comparable) {
    throw new Error(
      `Refusing to compare ${baseline.arm} with ${candidate.arm}:\n  - ${verdict.refusals.join("\n  - ")}`,
    );
  }
}

/**
 * Whether a ratio may be taken between two rows: everything
 * `check_rows_comparable` requires, plus the same session and the same machine.
 */
export function check_ratio_admissible(
  baseline: MeasurementRow,
  candidate: MeasurementRow,
): ComparabilityVerdict {
  const refusals = [...check_rows_comparable(baseline, candidate).refusals];

  if (baseline.ingest_order !== candidate.ingest_order) {
    refusals.push(
      `ingest order differs (${baseline.ingest_order} vs ${candidate.ingest_order}) — compare orders through the fingerprint, not through the clock`,
    );
  }
  if (
    baseline.environment.session_id !== candidate.environment.session_id
  ) {
    refusals.push(
      `rows come from different measurement sessions (${baseline.environment.session_id} vs ${candidate.environment.session_id}) — ${CROSS_SESSION_EVIDENCE}`,
    );
  }
  if (baseline.environment.machine !== candidate.environment.machine) {
    refusals.push(
      `rows come from different machines (${baseline.environment.machine} vs ${candidate.environment.machine}) — absolute CPU is machine-bound`,
    );
  }
  if (baseline.environment.hostname !== candidate.environment.hostname) {
    refusals.push(
      `rows come from different hosts (${baseline.environment.hostname} vs ${candidate.environment.hostname}) — absolute CPU is machine-bound`,
    );
  }

  return { comparable: refusals.length === 0, refusals };
}

export interface SampleSummary {
  readonly run_count: number;
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  /** `(max - min) / mean`, as a percentage. */
  readonly spread_pct: number;
  /** Coefficient of variation, as a percentage. */
  readonly cv_pct: number;
}

/**
 * Summarize repeated measurements of one arm. Two runs is the floor: a single
 * figure hides that peak RSS varies by up to 61% run to run on one arm and one
 * input.
 */
export function summarize_samples(
  values: readonly number[],
  label: string,
): SampleSummary {
  if (values.length < 2) {
    throw new Error(
      `${label} needs at least 2 runs to be reported; got ${values.length}. A single figure hides a spread that reaches 61% on peak RSS.`,
    );
  }
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) /
    values.length;
  return {
    run_count: values.length,
    mean: round_to_hundredth(mean),
    min: round_to_hundredth(min),
    max: round_to_hundredth(max),
    spread_pct: round_to_hundredth(((max - min) / mean) * 100),
    cv_pct: round_to_hundredth((Math.sqrt(variance) / mean) * 100),
  };
}

export function summarize_peak_rss(
  rows: readonly MeasurementRow[],
): SampleSummary {
  return summarize_samples(
    rows.map((row) => row.peak_rss_mb),
    "peak RSS",
  );
}

export function summarize_cpu_seconds(
  rows: readonly MeasurementRow[],
): SampleSummary {
  return summarize_samples(
    rows.map((row) => (row.cpu_user_ms + row.cpu_system_ms) / 1000),
    "CPU seconds",
  );
}

export interface ControlledSpeedup {
  readonly control: SampleSummary;
  readonly candidate: SampleSummary;
  /** Control CPU over candidate CPU. Above 1.0 means the candidate is faster. */
  readonly speedup: number;
  readonly session_id: string;
}

/**
 * The only admissible speedup: a candidate arm divided into a control arm that
 * ran interleaved with it, in the same session, on the same machine, over the
 * same corpus and grammars.
 */
export function measure_speedup_against_control(
  control_rows: readonly MeasurementRow[],
  candidate_rows: readonly MeasurementRow[],
): ControlledSpeedup {
  if (control_rows.length === 0 || candidate_rows.length === 0) {
    throw new Error(
      "A speedup needs rows on both sides; a candidate without an interleaved control arm is not a measurement",
    );
  }

  const refusals = new Set<string>();
  for (const control of control_rows) {
    for (const candidate of candidate_rows) {
      for (const refusal of check_ratio_admissible(control, candidate).refusals) {
        refusals.add(refusal);
      }
    }
  }
  if (refusals.size > 0) {
    throw new Error(
      `Refusing to compute a speedup:\n  - ${[...refusals].join("\n  - ")}`,
    );
  }

  const control = summarize_cpu_seconds(control_rows);
  const candidate = summarize_cpu_seconds(candidate_rows);
  return {
    control,
    candidate,
    speedup: round_to_hundredth(control.mean / candidate.mean),
    session_id: control_rows[0].environment.session_id,
  };
}

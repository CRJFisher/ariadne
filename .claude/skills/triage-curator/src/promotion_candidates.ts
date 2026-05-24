/**
 * `wip → permanent` candidate analysis. Pure aggregation over the registry +
 * cross-run `group_match_history` slices. Emits one `PromotionCandidate` per
 * `wip` rule with an authored classifier that survives the hard vetoes, plus
 * a score combining stability evidence.
 *
 * Numbers are calibrated against today's actual registry (the only currently-
 * observed permanent rule has `observed_count=12, projects=1`, so the gate
 * cohort is genuinely small). Re-tune by recomputing percentiles once
 * cross-run match history accumulates.
 */
import type { DriftEvidenceSource, KnownIssue } from "./types.js";
import type { PromotionCandidate } from "./types.js";

export const PROMOTION_SCORE_CUTOFF = 0.9;

const OBSERVED_COUNT_TARGET = 10;
const OBSERVED_PROJECTS_TARGET = 2;
const RUNS_OBSERVED_TARGET = 2;

const WEIGHT_OBSERVED_COUNT = 0.4;
const WEIGHT_OBSERVED_PROJECTS = 0.3;
const WEIGHT_RUNS_OBSERVED = 0.3;
const BONUS_LLM_CROSS_VERIFICATION = 0.1;

/** Per-group cross-run match history aggregated from finalized.json files. */
export interface GroupMatchHistorySummary {
  group_id: string;
  match_count_total: number;
  llm_attributed_total: number;
  runs_observed_in: number;
}

/**
 * Combine per-run match histories into per-group cross-run totals. Each
 * input row represents one run's accounting for one group_id; the same
 * group_id can appear in many input rows (one per run that saw it).
 */
export function summarize_match_history(
  per_run: ReadonlyArray<{
    group_id: string;
    match_count: number;
    llm_attributed_count: number;
  }>,
): Map<string, GroupMatchHistorySummary> {
  const by_group = new Map<string, GroupMatchHistorySummary>();
  for (const row of per_run) {
    if (row.match_count === 0 && row.llm_attributed_count === 0) continue;
    let summary = by_group.get(row.group_id);
    if (summary === undefined) {
      summary = {
        group_id: row.group_id,
        match_count_total: 0,
        llm_attributed_total: 0,
        runs_observed_in: 0,
      };
      by_group.set(row.group_id, summary);
    }
    summary.match_count_total += row.match_count;
    summary.llm_attributed_total += row.llm_attributed_count;
    summary.runs_observed_in += 1;
  }
  return by_group;
}

/**
 * Per-source breakdown of a rule's `drift_evidence[]` rows. Both signals
 * coexist on the same rule; the renderer surfaces them as separate columns so
 * the human reviewer can weight `in-flight` (per-entry sharp verdict) above
 * `qa-sample` (statistical lagging signal) when deciding `wip → permanent`.
 */
export interface DriftEvidenceCounts {
  in_flight: number;
  qa_sample: number;
}

export function count_drift_evidence_by_source(
  issue: KnownIssue,
): DriftEvidenceCounts {
  const counts: DriftEvidenceCounts = { in_flight: 0, qa_sample: 0 };
  const evidence = issue.drift_evidence ?? [];
  for (const row of evidence) {
    // Exhaustive over `DriftEvidenceSource`. Adding a new variant upstream
    // raises a TS error on the unreachable line below until this branch is
    // updated — prevents silent mis-attribution to one of the existing buckets.
    const source: DriftEvidenceSource = row.source;
    switch (source) {
      case "in-flight":
        counts.in_flight += 1;
        break;
      case "qa-sample":
        counts.qa_sample += 1;
        break;
      default: {
        const _exhaustive: never = source;
        void _exhaustive;
      }
    }
  }
  return counts;
}

/**
 * Score one rule on the 0..1+ scale. The base components (observed count,
 * project breadth, run history) sum to 1.0 when all targets are met; the
 * LLM-cross-verification bonus pushes overshoots above 1.0 so a robustly
 * verified rule sorts above one barely meeting the gate.
 */
export function score_candidate(
  issue: KnownIssue,
  history: GroupMatchHistorySummary | null,
): { score: number; vetoes: string[] } {
  const vetoes: string[] = [];

  if (issue.classifier.kind === "none") {
    vetoes.push("no classifier authored");
  }
  if (!issue.backlog_task) {
    vetoes.push("missing backlog_task");
  }
  if (issue.drift_detected === true) {
    vetoes.push("classifier drifting (drift_detected=true)");
  }

  const observed_count = issue.observed_count ?? 0;
  const observed_projects = (issue.observed_projects ?? []).length;
  const runs_observed = history?.runs_observed_in ?? 0;
  const llm_total = history?.llm_attributed_total ?? 0;

  const score =
    WEIGHT_OBSERVED_COUNT * Math.min(observed_count / OBSERVED_COUNT_TARGET, 1) +
    WEIGHT_OBSERVED_PROJECTS *
      Math.min(observed_projects / OBSERVED_PROJECTS_TARGET, 1) +
    WEIGHT_RUNS_OBSERVED * Math.min(runs_observed / RUNS_OBSERVED_TARGET, 1) +
    (llm_total > 0 ? BONUS_LLM_CROSS_VERIFICATION : 0);

  return { score, vetoes };
}

/**
 * Walk a registry and emit one `PromotionCandidate` per `wip` rule whose
 * classifier is authored AND whose score reaches the cutoff. Vetoed rules
 * that pass the score threshold are included with their vetoes attached, so
 * humans see why the rule cannot promote despite strong evidence.
 *
 * Rules with `classifier.kind === "none"` are excluded entirely — they have
 * no classifier to ship; surfacing them as candidates would be misleading.
 */
export function aggregate_promotion_candidates(
  registry: ReadonlyArray<KnownIssue>,
  match_history_summary: Map<string, GroupMatchHistorySummary>,
): PromotionCandidate[] {
  const candidates: PromotionCandidate[] = [];
  for (const issue of registry) {
    if (issue.status !== "wip") continue;
    if (issue.classifier.kind === "none") continue;
    const history = match_history_summary.get(issue.group_id) ?? null;
    const { score, vetoes } = score_candidate(issue, history);
    if (score < PROMOTION_SCORE_CUTOFF) continue;
    const drift_counts = count_drift_evidence_by_source(issue);
    candidates.push({
      group_id: issue.group_id,
      classifier_kind: issue.classifier.kind,
      observed_count: issue.observed_count ?? 0,
      observed_projects_count: (issue.observed_projects ?? []).length,
      runs_observed_in: history?.runs_observed_in ?? 0,
      match_count_total: history?.match_count_total ?? 0,
      llm_attributed_total: history?.llm_attributed_total ?? 0,
      drift_detected: issue.drift_detected ?? false,
      drift_in_flight_count: drift_counts.in_flight,
      drift_qa_sample_count: drift_counts.qa_sample,
      backlog_task: issue.backlog_task ?? null,
      score,
      vetoes,
    });
  }
  candidates.sort((a, b) => b.score - a.score || a.group_id.localeCompare(b.group_id));
  return candidates;
}

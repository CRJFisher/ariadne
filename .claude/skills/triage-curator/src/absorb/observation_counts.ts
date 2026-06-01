/**
 * Compute per-registry-group observation counts from a triage_results file.
 *
 * The curator's `bump_observed_stats` pass increments `observed_count` for
 * every registry entry whose `group_id` is observed in the run. Observations
 * come from two sources:
 *
 *   - `novel_issues[]`           a registered novel issue with the same id as
 *                                the registry entry; each published row is one
 *                                false-positive entry, so it counts as one
 *                                observation.
 *   - `confirmed_unreachable[]`  rows whose `source.kind === "registry"`;
 *                                each row counts as one observation for the
 *                                named `group_id`.
 *
 * Both sources key on the registry's `group_id`. A novel issue that has
 * already been promoted into the registry will appear in `novel_issues[]`
 * with its slug `id` matching the registry `group_id`; first-time novel
 * issues (not yet registered) are skipped by `bump_observed_stats` and
 * surface via the puller as promote-novel dispatches instead.
 */

import type { TriageResultsFile } from "../types.js";

export function compute_observation_counts(
  triage: TriageResultsFile,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of triage.novel_issues) {
    counts[issue.id] = (counts[issue.id] ?? 0) + 1;
  }
  for (const entry of triage.confirmed_unreachable) {
    if (entry.source.kind !== "registry") continue;
    const group_id = entry.source.group_id;
    counts[group_id] = (counts[group_id] ?? 0) + 1;
  }
  return counts;
}

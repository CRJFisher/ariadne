/**
 * Novel-group scanner: closes the D2 gap from TASK-190.16.10 by consuming the
 * `novel:` group_id prefix emitted by the triage-investigator.
 *
 * The investigator emits `novel:<kebab-case>` when it identifies a detection
 * gap that is not already in the known-issues registry. Those group_ids appear
 * in `triage_results.json` as `false_positive_groups[<novel:...>]`. This
 * module aggregates those observations across finalized curator runs, and at
 * or above `PROMOTION_THRESHOLD` distinct observed members, mints a `wip`
 * placeholder in the registry so the classifier authoring flow picks it up on
 * the next run.
 *
 * Pure aggregation functions live here; the CLI wrapper is in
 * `scripts/promote_novel_groups.ts`.
 */

import type {
  KnownIssue as SelfRepairKnownIssue,
  KnownIssueLanguage,
} from "../../self-repair-pipeline/src/known_issues_types.js";
import type { TriageResultsFile } from "./types.js";

export const NOVEL_PREFIX = "novel:";

/** Minimum distinct member count (file_path + start_line) required to promote. */
export const PROMOTION_THRESHOLD = 5;

/**
 * Per-novel-group-id aggregation across runs. Key is the full `novel:…`
 * identifier as emitted by the investigator.
 */
export interface NovelAggregate {
  group_id: string;
  /** Distinct (file_path, start_line) pairs observed across all runs. */
  distinct_member_count: number;
  /** Projects in which this novel group has been observed at least once. */
  observed_projects: string[];
  /** Representative first observation — seeds the placeholder `examples[]`. */
  sample_entry: { file_path: string; start_line: number; name: string };
  /** Distinct file extensions observed — seeds `languages[]`. */
  languages: KnownIssueLanguage[];
  /** Most recent run_id that observed this group. */
  last_seen_run: string;
  /** Title/root_cause hint from the most recent observation. */
  title_hint: string;
}

interface ObservedMember {
  file_path: string;
  start_line: number;
  name: string;
}

interface AggregateAcc {
  group_id: string;
  members: Map<string, ObservedMember>;
  projects: Set<string>;
  languages: Set<KnownIssueLanguage>;
  last_seen_run: string;
  title_hint: string;
  first_member: ObservedMember | null;
}

export interface RunTriageInput {
  run_id: string;
  project: string;
  triage: TriageResultsFile;
}

function member_key(entry: { file_path: string; start_line: number }): string {
  return `${entry.file_path}:${entry.start_line}`;
}

function language_from_file_path(file_path: string): KnownIssueLanguage | null {
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

/**
 * Fold a list of (run, project, triage-result) tuples into a deterministic
 * `NovelAggregate[]`. Runs are expected to be pre-sorted ASC by `run_id` so
 * `last_seen_run` and `title_hint` reflect the most recent observation.
 */
export function aggregate_novel_groups(runs: RunTriageInput[]): NovelAggregate[] {
  const acc = new Map<string, AggregateAcc>();
  for (const run of runs) {
    for (const [group_id, group] of Object.entries(run.triage.false_positive_groups)) {
      if (!group_id.startsWith(NOVEL_PREFIX)) continue;
      let entry = acc.get(group_id);
      if (entry === undefined) {
        entry = {
          group_id,
          members: new Map(),
          projects: new Set(),
          languages: new Set(),
          last_seen_run: run.run_id,
          title_hint: group.root_cause,
          first_member: null,
        };
        acc.set(group_id, entry);
      }
      entry.last_seen_run = run.run_id;
      entry.title_hint = group.root_cause;
      entry.projects.add(run.project);
      for (const m of group.entries) {
        const key = member_key(m);
        if (!entry.members.has(key)) {
          const observed: ObservedMember = {
            file_path: m.file_path,
            start_line: m.start_line,
            name: m.name,
          };
          entry.members.set(key, observed);
          if (entry.first_member === null) entry.first_member = observed;
        }
        const lang = language_from_file_path(m.file_path);
        if (lang !== null) entry.languages.add(lang);
      }
    }
  }
  const out: NovelAggregate[] = [];
  for (const entry of acc.values()) {
    if (entry.first_member === null) continue;
    out.push({
      group_id: entry.group_id,
      distinct_member_count: entry.members.size,
      observed_projects: [...entry.projects].sort(),
      sample_entry: entry.first_member,
      languages: [...entry.languages].sort(),
      last_seen_run: entry.last_seen_run,
      title_hint: entry.title_hint,
    });
  }
  out.sort((a, b) => a.group_id.localeCompare(b.group_id));
  return out;
}

/**
 * Filter aggregates eligible for promotion: threshold reached AND not already
 * present in the registry (registry presence wins regardless of prefix —
 * upstream may have adopted the novel id verbatim).
 */
export function filter_promotable(
  aggregates: NovelAggregate[],
  registry: SelfRepairKnownIssue[],
  threshold: number = PROMOTION_THRESHOLD,
): NovelAggregate[] {
  const existing = new Set(registry.map((r) => r.group_id));
  return aggregates.filter(
    (a) => a.distinct_member_count >= threshold && !existing.has(a.group_id),
  );
}

/**
 * Build a `wip` registry placeholder for a promotable novel aggregate. The
 * classifier is `{ kind: "none" }` — next run's investigator will author the
 * real classifier via the existing curator flow.
 */
export function build_wip_placeholder(aggregate: NovelAggregate): SelfRepairKnownIssue {
  return {
    group_id: aggregate.group_id,
    title: aggregate.title_hint.length > 0 ? aggregate.title_hint : aggregate.group_id,
    description:
      "Auto-promoted from residual triage observations. The investigator has " +
      "flagged this pattern as a novel detection gap at least " +
      `${aggregate.distinct_member_count} times across ${aggregate.observed_projects.length} ` +
      "project(s). A classifier has not yet been authored — the next curator " +
      "run will dispatch an investigator to write one.",
    status: "wip",
    languages: aggregate.languages.length > 0 ? aggregate.languages : ["typescript"],
    examples: [
      {
        file: aggregate.sample_entry.file_path,
        line: aggregate.sample_entry.start_line,
        snippet: aggregate.sample_entry.name,
      },
    ],
    classifier: { kind: "none" },
    observed_count: aggregate.distinct_member_count,
    observed_projects: aggregate.observed_projects,
    last_seen_run: aggregate.last_seen_run,
  };
}

/**
 * Merge promotable aggregates into the registry. Pure: returns
 * `{ next, promoted }` without writing to disk. Aggregates whose group_id is
 * already in the registry are silently skipped (filter_promotable's job).
 */
export function apply_promotions(
  registry: SelfRepairKnownIssue[],
  promotable: NovelAggregate[],
): { next: SelfRepairKnownIssue[]; promoted: string[] } {
  if (promotable.length === 0) return { next: registry, promoted: [] };
  const placeholders = promotable.map(build_wip_placeholder);
  return {
    next: [...registry, ...placeholders],
    promoted: promotable.map((p) => p.group_id),
  };
}

/**
 * Convenience wrapper: threshold-filter, mint placeholders, return the merged
 * registry alongside a `PromotionSummary` the CLI prints.
 */
export interface PromotionSummary {
  promoted: NovelAggregate[];
  below_threshold: NovelAggregate[];
  already_in_registry: NovelAggregate[];
}

export function summarize_promotions(
  aggregates: NovelAggregate[],
  registry: SelfRepairKnownIssue[],
  threshold: number = PROMOTION_THRESHOLD,
): PromotionSummary {
  const existing = new Set(registry.map((r) => r.group_id));
  const promoted: NovelAggregate[] = [];
  const below_threshold: NovelAggregate[] = [];
  const already_in_registry: NovelAggregate[] = [];
  for (const a of aggregates) {
    if (existing.has(a.group_id)) already_in_registry.push(a);
    else if (a.distinct_member_count >= threshold) promoted.push(a);
    else below_threshold.push(a);
  }
  return { promoted, below_threshold, already_in_registry };
}

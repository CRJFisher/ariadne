/**
 * Impact report: ranks known-issues registry entries by observed_count and
 * emits a deterministic markdown report. Intended for human review — not
 * consumed by any downstream script.
 *
 * Inputs:
 *   - The registry (post-curation snapshot)
 *   - A "prior" snapshot of `group_id → observed_count` that lets the report
 *     highlight groups that crossed an impact threshold since the last run.
 *     Pass an empty map when no prior exists.
 *
 * Output: markdown string with four sections (top N, per-language, per-project,
 * new-since-last-report delta).
 */

import type { KnownIssue } from "./types.js";

export interface ImpactReportInput {
  registry: KnownIssue[];
  prior_counts: Record<string, number>;
  top_n: number;
  /** ISO timestamp embedded in the report header. */
  generated_at: string;
}

/**
 * Row rendered in the top-N table. Holds the raw numeric fields so the markdown
 * renderer and any JSON consumer share one shape.
 */
export interface ImpactRow {
  group_id: string;
  title: string;
  status: string;
  observed_count: number;
  observed_projects: string[];
  languages: string[];
  backlog_task: string | null;
  delta_since_prior: number;
}

export function build_impact_rows(registry: KnownIssue[], prior_counts: Record<string, number>): ImpactRow[] {
  return registry.map((issue) => {
    const current = issue.observed_count ?? 0;
    const prior = prior_counts[issue.group_id] ?? 0;
    return {
      group_id: issue.group_id,
      title: issue.title,
      status: issue.status,
      observed_count: current,
      observed_projects: issue.observed_projects ?? [],
      languages: issue.languages,
      backlog_task: issue.backlog_task ?? null,
      delta_since_prior: current - prior,
    };
  });
}

function compare_rows_by_impact(a: ImpactRow, b: ImpactRow): number {
  if (b.observed_count !== a.observed_count) return b.observed_count - a.observed_count;
  return a.group_id.localeCompare(b.group_id);
}

export function rank_top_n(rows: ImpactRow[], n: number): ImpactRow[] {
  const observed = rows.filter((r) => r.observed_count > 0);
  return [...observed].sort(compare_rows_by_impact).slice(0, n);
}

export function group_by_language(rows: ImpactRow[]): Array<{ language: string; total: number; rows: ImpactRow[] }> {
  const by_lang = new Map<string, ImpactRow[]>();
  for (const row of rows) {
    if (row.observed_count <= 0) continue;
    for (const lang of row.languages) {
      const bucket = by_lang.get(lang);
      if (bucket === undefined) {
        by_lang.set(lang, [row]);
      } else {
        bucket.push(row);
      }
    }
  }
  const keys = [...by_lang.keys()].sort();
  return keys.map((language) => {
    const lang_rows = by_lang.get(language) ?? [];
    return {
      language,
      total: lang_rows.reduce((sum, r) => sum + r.observed_count, 0),
      rows: [...lang_rows].sort(compare_rows_by_impact),
    };
  });
}

export function group_by_project(rows: ImpactRow[]): Array<{ project: string; total: number; rows: ImpactRow[] }> {
  const by_proj = new Map<string, ImpactRow[]>();
  for (const row of rows) {
    if (row.observed_count <= 0) continue;
    for (const project of row.observed_projects) {
      const bucket = by_proj.get(project);
      if (bucket === undefined) {
        by_proj.set(project, [row]);
      } else {
        bucket.push(row);
      }
    }
  }
  const keys = [...by_proj.keys()].sort();
  return keys.map((project) => {
    const proj_rows = by_proj.get(project) ?? [];
    return {
      project,
      total: proj_rows.reduce((sum, r) => sum + r.observed_count, 0),
      rows: [...proj_rows].sort(compare_rows_by_impact),
    };
  });
}

export function filter_new_since_prior(rows: ImpactRow[], prior_counts: Record<string, number>): ImpactRow[] {
  const newly = rows.filter((r) => {
    const had_prior = prior_counts[r.group_id] !== undefined && prior_counts[r.group_id] > 0;
    return !had_prior && r.observed_count > 0;
  });
  return newly.sort(compare_rows_by_impact);
}

function render_top_n_table(rows: ImpactRow[]): string {
  if (rows.length === 0) return "_No entries with observed_count > 0._\n";
  const header = "| # | group_id | title | observed | projects | status | backlog |";
  const sep = "| -: | -------- | ----- | -------: | -------- | ------ | ------- |";
  const body = rows
    .map((row, i) => {
      const projects = row.observed_projects.length === 0 ? "—" : row.observed_projects.join(", ");
      const backlog = row.backlog_task ?? "—";
      return `| ${i + 1} | \`${row.group_id}\` | ${row.title} | ${row.observed_count} | ${projects} | ${row.status} | ${backlog} |`;
    })
    .join("\n");
  return [header, sep, body].join("\n") + "\n";
}

function render_per_language(
  buckets: Array<{ language: string; total: number; rows: ImpactRow[] }>,
): string {
  if (buckets.length === 0) return "_No observed groups._\n";
  const parts: string[] = [];
  for (const bucket of buckets) {
    parts.push(`### ${bucket.language} (${bucket.total})`);
    parts.push("");
    parts.push(render_top_n_table(bucket.rows));
  }
  return parts.join("\n");
}

function render_per_project(
  buckets: Array<{ project: string; total: number; rows: ImpactRow[] }>,
): string {
  if (buckets.length === 0) return "_No observed groups._\n";
  const parts: string[] = [];
  for (const bucket of buckets) {
    parts.push(`### ${bucket.project} (${bucket.total})`);
    parts.push("");
    parts.push(render_top_n_table(bucket.rows));
  }
  return parts.join("\n");
}

function render_delta(rows: ImpactRow[]): string {
  if (rows.length === 0) return "_No groups appeared for the first time since the prior snapshot._\n";
  return render_top_n_table(rows);
}

export function render_impact_report(input: ImpactReportInput): string {
  const rows = build_impact_rows(input.registry, input.prior_counts);
  const top = rank_top_n(rows, input.top_n);
  const per_language = group_by_language(rows);
  const per_project = group_by_project(rows);
  const delta = filter_new_since_prior(rows, input.prior_counts);

  const total_observed = rows.reduce((sum, r) => sum + r.observed_count, 0);
  const groups_with_observations = rows.filter((r) => r.observed_count > 0).length;

  return [
    "# Self-repair impact report",
    "",
    `- Generated: ${input.generated_at}`,
    `- Registry entries: ${input.registry.length}`,
    `- Groups observed at least once: ${groups_with_observations}`,
    `- Total observed false-positive entries: ${total_observed}`,
    "",
    `## Top ${input.top_n} by observed_count`,
    "",
    render_top_n_table(top),
    "## Per-language breakdown",
    "",
    render_per_language(per_language),
    "## Per-project breakdown",
    "",
    render_per_project(per_project),
    "## New since prior snapshot",
    "",
    render_delta(delta),
  ].join("\n");
}

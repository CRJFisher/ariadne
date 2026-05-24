#!/usr/bin/env node
/**
 * Analyze the registry + recent finalized runs and print the list of `wip`
 * rules that meet the `wip → permanent` promotion criteria. Read-only:
 * never mutates `registry.json`.
 *
 * The human reviews the printed table, decides whether to flip a rule's
 * `status` to `"permanent"` (hand-edit `registry.json`), then runs
 * `pnpm sync-permanent-rules` to regenerate the bundled core slice.
 *
 * Usage:
 *   node --import tsx find_promotion_candidates.ts [--json]
 */
import * as fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { parse_known_issues_registry_json } from "@ariadnejs/types";

import { get_registry_file_path } from "../src/paths.js";
import {
  aggregate_promotion_candidates,
  summarize_match_history,
} from "../src/promotion_candidates.js";
import { discover_runs } from "../src/scan_runs.js";
import type { PromotionCandidate, TriageResultsFile } from "../src/types.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  json: boolean;
}

function parse_argv(argv: string[]): CliArgs {
  let json = false;
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return { json };
}

/**
 * Walk recent finalized runs and emit one per-run match-history row per
 * (run, group_id). Each row is reconstructed from `confirmed_unreachable[]`
 * entries with `source.kind === "registry"` — one `match_count` increment
 * per row. Per-source drift breakdown for each rule's history is read from
 * the registry entry's `drift_evidence[]` field directly, not from this
 * per-run aggregate.
 */
async function load_recent_match_history(): Promise<
  { group_id: string; match_count: number; llm_attributed_count: number }[]
> {
  const runs = await discover_runs();
  const rows: {
    group_id: string;
    match_count: number;
    llm_attributed_count: number;
  }[] = [];
  for (const run of runs) {
    const text = await fs.readFile(run.run_path, "utf8");
    const triage = JSON.parse(text) as Partial<TriageResultsFile>;
    const confirmed = triage.confirmed_unreachable ?? [];
    const per_group = new Map<string, number>();
    for (const entry of confirmed) {
      if (entry.source.kind !== "registry") continue;
      const id = entry.source.group_id;
      per_group.set(id, (per_group.get(id) ?? 0) + 1);
    }
    for (const [group_id, match_count] of per_group) {
      rows.push({ group_id, match_count, llm_attributed_count: 0 });
    }
  }
  return rows;
}

/**
 * Render the per-candidate table emitted to stdout. The `drift_inf` and
 * `drift_qa` columns are the per-source split of `drift_evidence[]` —
 * in-flight rows are the per-entry investigator's sharp regression verdicts,
 * qa-sample rows are the curator QA loop's statistical drift signal. Two
 * columns instead of one boolean so the human reviewer can weight them
 * (an in-flight row counts more than a qa-sample row of equal count).
 */
export function format_table(candidates: readonly PromotionCandidate[]): string {
  if (candidates.length === 0) {
    return (
      "No promotion candidates found.\n" +
      "With current registry data, no `wip` rule meets the minimum stability criteria.\n" +
      "See `.claude/rules/classifier-lifecycle.md` (when present) or the promotion-criteria comments\n" +
      "in `.claude/skills/triage-curator/src/promotion_candidates.ts` for the gate definition.\n"
    );
  }
  const header = [
    "group_id",
    "kind",
    "obs",
    "proj",
    "runs",
    "match",
    "llm",
    "drift_inf",
    "drift_qa",
    "task",
    "score",
    "vetoes",
  ];
  const rows = candidates.map((c) => [
    c.group_id,
    c.classifier_kind,
    String(c.observed_count),
    String(c.observed_projects_count),
    String(c.runs_observed_in),
    String(c.match_count_total),
    String(c.llm_attributed_total),
    String(c.drift_in_flight_count),
    String(c.drift_qa_sample_count),
    c.backlog_task ?? "(none)",
    c.score.toFixed(2),
    c.vetoes.length === 0 ? "" : c.vetoes.join(", "),
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const fmt = (cells: string[]): string =>
    cells.map((cell, i) => cell.padEnd(widths[i])).join("  ");
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  return [fmt(header), sep, ...rows.map(fmt)].join("\n") + "\n";
}

async function main(): Promise<void> {
  const args = parse_argv(process.argv.slice(2));
  const registry_text = await fs.readFile(get_registry_file_path(), "utf8");
  const registry = parse_known_issues_registry_json(registry_text);
  const per_run_history = await load_recent_match_history();
  const summary = summarize_match_history(per_run_history);
  const candidates = aggregate_promotion_candidates(registry, summary);

  if (args.json) {
    process.stdout.write(JSON.stringify({ candidates }, null, 2) + "\n");
  } else {
    process.stdout.write(format_table(candidates));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(
      `find_promotion_candidates failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}

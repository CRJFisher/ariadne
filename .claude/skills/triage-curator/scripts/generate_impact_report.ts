#!/usr/bin/env node
/**
 * Emit an impact-report markdown from the current known-issues registry and an
 * optional prior-counts snapshot (produced by a previous run of this script).
 *
 * Usage:
 *   node --import tsx generate_impact_report.ts [--top-n <n>] [--prior <path>] [--out <path>] [--snapshot <path>]
 *
 * Flags:
 *   --top-n     Top-N count for the ranked table (default 20)
 *   --prior     JSON file of `{ [group_id]: prior_observed_count }` used for the
 *               "New since prior snapshot" section. Absent → every observed
 *               group shows up in that section.
 *   --out       Write the markdown to this path (in addition to stdout).
 *   --snapshot  Write the current `{ [group_id]: observed_count }` map to this
 *               path. Pass the same path as `--prior` on the next run to diff.
 */

import * as fs from "node:fs/promises";

import { parse_known_issues_registry_json } from "@ariadnejs/types";
import { render_impact_report } from "../src/impact_report.js";
import { get_registry_file_path } from "../src/paths.js";
import type { KnownIssue } from "../src/types.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  top_n: number;
  prior_path: string | null;
  out_path: string | null;
  snapshot_path: string | null;
}

function parse_argv(argv: string[]): CliArgs {
  let top_n = 20;
  let prior_path: string | null = null;
  let out_path: string | null = null;
  let snapshot_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--top-n":
        top_n = parseInt(argv[++i], 10);
        break;
      case "--prior":
        prior_path = argv[++i];
        break;
      case "--out":
        out_path = argv[++i];
        break;
      case "--snapshot":
        snapshot_path = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: generate_impact_report [--top-n <n>] [--prior <path>] [--out <path>] [--snapshot <path>]\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isFinite(top_n) || top_n <= 0) throw new Error("--top-n must be a positive integer");
  return { top_n, prior_path, out_path, snapshot_path };
}

async function load_prior(prior_path: string | null): Promise<Record<string, number>> {
  if (prior_path === null) return {};
  const raw = await fs.readFile(prior_path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`--prior ${prior_path} must be a JSON object`);
  }
  const out: Record<string, number> = {};
  for (const [group_id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`--prior entry for '${group_id}' must be a finite number`);
    }
    out[group_id] = value;
  }
  return out;
}

function snapshot_counts(registry: KnownIssue[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const issue of registry) {
    if ((issue.observed_count ?? 0) > 0) out[issue.group_id] = issue.observed_count ?? 0;
  }
  return out;
}

async function main(): Promise<void> {
  const args = parse_argv(process.argv.slice(2));

  const registry_path = get_registry_file_path();
  const registry = parse_known_issues_registry_json(
    await fs.readFile(registry_path, "utf8"),
  ) as unknown as KnownIssue[];
  const prior_counts = await load_prior(args.prior_path);

  const markdown = render_impact_report({
    registry,
    prior_counts,
    top_n: args.top_n,
    generated_at: new Date().toISOString(),
  });

  if (args.out_path !== null) {
    await fs.writeFile(args.out_path, markdown, "utf8");
  }
  if (args.snapshot_path !== null) {
    await fs.writeFile(
      args.snapshot_path,
      JSON.stringify(snapshot_counts(registry), null, 2) + "\n",
      "utf8",
    );
  }
  process.stdout.write(markdown);
}

main().catch((err) => {
  process.stderr.write(
    `generate_impact_report failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

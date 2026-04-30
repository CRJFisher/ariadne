#!/usr/bin/env node
/**
 * Sweep the known-issues registry for entries without a linked backlog task
 * and emit task-creation proposals as JSON. Also flags entries whose
 * `observed_count` has changed since the prior snapshot so the main agent can
 * refresh their task body.
 *
 * Usage:
 *   node --import tsx propose_backlog_tasks.ts [--prior <path>] [--out <path>] [--snapshot <path>]
 *
 * Flags:
 *   --prior     JSON file of `{ [group_id]: prior_observed_count }` used to
 *               detect which linked-task bodies need refreshing. Absent →
 *               every linked entry with observations is marked for update.
 *   --out       Write the proposals JSON to this path (in addition to stdout).
 *   --snapshot  Write the current `{ [group_id]: observed_count }` map to this
 *               path. Pass the same path as `--prior` on the next sweep.
 */

import * as fs from "node:fs/promises";

import {
  parse_known_issues_registry_json,
  type KnownIssue as SelfRepairKnownIssue,
} from "@ariadnejs/types";
import { get_registry_file_path } from "../src/paths.js";
import { propose_backlog_tasks } from "../src/propose_backlog_tasks.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  prior_path: string | null;
  out_path: string | null;
  snapshot_path: string | null;
}

function parse_argv(argv: string[]): CliArgs {
  let prior_path: string | null = null;
  let out_path: string | null = null;
  let snapshot_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
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
          "Usage: propose_backlog_tasks [--prior <path>] [--out <path>] [--snapshot <path>]\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { prior_path, out_path, snapshot_path };
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

function snapshot_counts(registry: SelfRepairKnownIssue[]): Record<string, number> {
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
  );
  const prior_counts = await load_prior(args.prior_path);

  const result = propose_backlog_tasks({ registry, prior_counts });

  const output = JSON.stringify(result, null, 2) + "\n";
  if (args.out_path !== null) {
    await fs.writeFile(args.out_path, output, "utf8");
  }
  if (args.snapshot_path !== null) {
    await fs.writeFile(
      args.snapshot_path,
      JSON.stringify(snapshot_counts(registry), null, 2) + "\n",
      "utf8",
    );
  }
  process.stdout.write(output);
}

main().catch((err) => {
  process.stderr.write(
    `propose_backlog_tasks failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

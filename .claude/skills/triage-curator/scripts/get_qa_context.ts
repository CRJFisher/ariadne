#!/usr/bin/env node
/**
 * Hydrates the context for the `triage-curator-qa` sub-agent.
 *
 * The main agent passes pointers (`--group`, `--run`). This script loads the
 * v4 triage_results JSON, samples up to ~10 of the entries the upstream triage-entrypoints
 * classified as `confirmed_unreachable` via the named registry rule, attaches
 * each one's source excerpt, looks up the registry entry, and prints the
 * bundle as JSON. The sub-agent decides which members look suspicious and
 * runs further grep / Ariadne calls on its own.
 *
 * Usage:
 *   node --import tsx .claude/skills/triage-curator/scripts/get_qa_context.ts \
 *     --group <group_id> --run <triage_results.json>
 *
 * Output: JSON to stdout with shape:
 *   {
 *     group_id, run_path, registry_entry: KnownIssue | null,
 *     total_members, sample_size,
 *     members: [{ entry_index, name, file_path, start_line, signature,
 *                 source_excerpt }]
 *   }
 */

import * as fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { parse_known_issues_registry_json } from "@ariadnejs/types";
import { get_registry_file_path } from "../src/paths.js";
import { SAMPLE_SIZE, read_source_excerpt } from "../src/source_excerpt.js";
import type {
  PublishedConfirmedUnreachable,
  TriageResultsFile,
} from "../src/types.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  group_id: string;
  run_path: string;
}

function parse_argv(argv: string[]): CliArgs {
  let group_id: string | null = null;
  let run_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--group":
        group_id = argv[++i];
        break;
      case "--run":
        run_path = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write("Usage: get_qa_context --group <id> --run <path>\n");
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (group_id === null || group_id.length === 0) {
    throw new Error("--group <id> is required");
  }
  if (run_path === null || run_path.length === 0) {
    throw new Error("--run <path> is required");
  }
  return { group_id, run_path };
}

/**
 * Filter the v4 `confirmed_unreachable[]` to the rows the named classifier
 * matched. triage-entrypoints writes each row's provenance as
 * `source: { kind: "registry", group_id }` when the match came from a known
 * rule, vs. `kind: "llm-tp"` for per-entry confirmations. The QA loop only
 * audits the registry-attributed slice.
 */
export function select_registry_matches(
  triage: TriageResultsFile,
  group_id: string,
): PublishedConfirmedUnreachable[] {
  return triage.confirmed_unreachable.filter(
    (e) => e.source.kind === "registry" && e.source.group_id === group_id,
  );
}

/**
 * Evenly-spaced sub-sample of `entries`, length ≤ `max`. The QA sub-agent's
 * tool budget is fixed (`SAMPLE_SIZE`); for large registry hit-lists we want
 * the sampled members to span the population (first, mid, last) rather than
 * an arbitrary contiguous slice.
 */
export function sample_members(
  entries: PublishedConfirmedUnreachable[],
  max: number,
): PublishedConfirmedUnreachable[] {
  if (entries.length <= max) return entries;
  const step = entries.length / max;
  const out: PublishedConfirmedUnreachable[] = [];
  for (let i = 0; i < max; i++) {
    out.push(entries[Math.floor(i * step)]);
  }
  return out;
}

async function main(): Promise<void> {
  const { group_id, run_path } = parse_argv(process.argv.slice(2));

  const triage_raw = await fs.readFile(run_path, "utf8");
  const triage = JSON.parse(triage_raw) as TriageResultsFile;

  const rule_matches = select_registry_matches(triage, group_id);
  if (rule_matches.length === 0) {
    throw new Error(
      `group_id "${group_id}" has no confirmed_unreachable matches in ${run_path}`,
    );
  }

  const registry_raw = await fs.readFile(get_registry_file_path(), "utf8");
  const registry = parse_known_issues_registry_json(registry_raw);
  const registry_entry = registry.find((e) => e.group_id === group_id) ?? null;

  const sampled = sample_members(rule_matches, SAMPLE_SIZE);
  const members = await Promise.all(
    sampled.map(async (entry) => ({
      entry_index: entry.entry_index,
      name: entry.name,
      file_path: entry.file_path,
      start_line: entry.start_line,
      signature: entry.signature ?? null,
      source_excerpt: await read_source_excerpt(entry.file_path, entry.start_line, triage.project_path),
    })),
  );

  const out = {
    group_id,
    run_path,
    registry_entry,
    total_members: rule_matches.length,
    sample_size: members.length,
    members,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(
      `get_qa_context failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}

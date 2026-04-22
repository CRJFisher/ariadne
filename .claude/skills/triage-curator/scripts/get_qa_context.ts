#!/usr/bin/env node
/**
 * Hydrates the context for the `triage-curator-qa` sub-agent.
 *
 * The main agent only passes pointers (`--group`, `--run`, `--output`). This
 * script loads the triage_results JSON, picks a sample of up to ~10 members of
 * the group, attaches each member's source excerpt, looks up the classifier
 * entry the group was auto-labeled under, and prints the whole bundle as JSON
 * to stdout. The sub-agent can then decide which members look suspicious and
 * do further grep / Ariadne calls on its own.
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

import { error_code } from "../src/errors.js";
import { get_registry_file_path } from "../src/paths.js";
import type {
  FalsePositiveEntry,
  KnownIssue,
  TriageResultsFile,
} from "../src/types.js";
import "../src/require_node_import_tsx.js";

const SAMPLE_SIZE = 10;
const EXCERPT_LINES_BEFORE = 2;
const EXCERPT_LINES_AFTER = 8;

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

async function read_source_excerpt(
  file_path: string,
  start_line: number,
): Promise<string> {
  try {
    const raw = await fs.readFile(file_path, "utf8");
    const lines = raw.split(/\r?\n/);
    const from = Math.max(0, start_line - 1 - EXCERPT_LINES_BEFORE);
    const to = Math.min(lines.length, start_line - 1 + EXCERPT_LINES_AFTER + 1);
    return lines
      .slice(from, to)
      .map((line, idx) => `${from + idx + 1}: ${line}`)
      .join("\n");
  } catch (err) {
    if (error_code(err) === "ENOENT") return "<file not found>";
    throw err;
  }
}

function sample_members(
  entries: FalsePositiveEntry[],
  max: number,
): Array<{ entry_index: number; entry: FalsePositiveEntry }> {
  if (entries.length <= max) {
    return entries.map((entry, entry_index) => ({ entry_index, entry }));
  }
  // Evenly-spaced indices so the sample spans the group.
  const step = entries.length / max;
  const out: Array<{ entry_index: number; entry: FalsePositiveEntry }> = [];
  for (let i = 0; i < max; i++) {
    const entry_index = Math.floor(i * step);
    out.push({ entry_index, entry: entries[entry_index] });
  }
  return out;
}

async function main(): Promise<void> {
  const { group_id, run_path } = parse_argv(process.argv.slice(2));

  const triage_raw = await fs.readFile(run_path, "utf8");
  const triage = JSON.parse(triage_raw) as TriageResultsFile;

  const group = triage.false_positive_groups[group_id];
  if (group === undefined) {
    throw new Error(`group_id "${group_id}" not found in ${run_path}`);
  }

  const registry_raw = await fs.readFile(get_registry_file_path(), "utf8");
  const registry = JSON.parse(registry_raw) as KnownIssue[];
  const registry_entry = registry.find((e) => e.group_id === group_id) ?? null;

  const sampled = sample_members(group.entries, SAMPLE_SIZE);
  const members = await Promise.all(
    sampled.map(async ({ entry_index, entry }) => ({
      entry_index,
      name: entry.name,
      file_path: entry.file_path,
      start_line: entry.start_line,
      signature: entry.signature ?? null,
      source_excerpt: await read_source_excerpt(entry.file_path, entry.start_line),
    })),
  );

  const out = {
    group_id,
    run_path,
    registry_entry,
    root_cause: group.root_cause,
    reasoning: group.reasoning,
    total_members: group.entries.length,
    sample_size: members.length,
    members,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(
    `get_qa_context failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Step 6b housekeeping: after `mcp__backlog__task_create` resolves task ids
 * for every `ariadne_bug_tasks[]` entry, write those ids into the matching
 * registry entries' `backlog_task` field.
 *
 * Usage:
 *   node --import tsx link_ariadne_bug_tasks.ts --mapping <path>
 *
 * The `--mapping` JSON is a { [target_registry_group_id]: "TASK-<N>" } object
 * produced by the main agent in Step 6b. Each key must match an existing
 * `KnownIssue.group_id`; unknown keys are silently skipped.
 */

import * as fs from "node:fs/promises";

import { link_ariadne_bug_tasks } from "../src/apply_proposals.js";
import { get_registry_file_path } from "../src/paths.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  mapping_path: string;
}

function parse_argv(argv: string[]): CliArgs {
  let mapping_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--mapping":
        mapping_path = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write("Usage: link_ariadne_bug_tasks --mapping <path>\n");
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (mapping_path === null || mapping_path.length === 0) {
    throw new Error("--mapping <path> is required");
  }
  return { mapping_path };
}

async function load_mapping(mapping_path: string): Promise<Record<string, string>> {
  const raw = JSON.parse(await fs.readFile(mapping_path, "utf8")) as unknown;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(
      `--mapping ${mapping_path} must be a JSON object mapping target_registry_group_id → TASK id`,
    );
  }
  const out: Record<string, string> = {};
  for (const [group_id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `--mapping entry for '${group_id}' must be a non-empty TASK-<N> string`,
      );
    }
    out[group_id] = value;
  }
  return out;
}

async function main(): Promise<void> {
  const { mapping_path } = parse_argv(process.argv.slice(2));
  const mapping = await load_mapping(mapping_path);
  const result = await link_ariadne_bug_tasks(get_registry_file_path(), mapping);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(
    `link_ariadne_bug_tasks failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

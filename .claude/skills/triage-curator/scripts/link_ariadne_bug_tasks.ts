#!/usr/bin/env node
/**
 * Step 4 housekeeping: write `backlog_task` ids onto matching registry
 * entries after `mcp__backlog__task_create` has resolved them.
 *
 * Two source modes — pick the one that matches the caller:
 *
 *   node --import tsx link_ariadne_bug_tasks.ts --run-id <run_id>
 *     Reads `<run-dir>/created_task_ids.json` (the canonical sidecar). The
 *     main curator agent appends to this file incrementally as each
 *     `mcp__backlog__task_create` resolves, so a crash between
 *     `task_create` and this script does NOT strand the registry row —
 *     re-running with the same run_id picks up where the previous run
 *     stopped.
 *
 *   node --import tsx link_ariadne_bug_tasks.ts --mapping <path>
 *     Reads an explicit mapping file. Used by the on-demand
 *     `propose_backlog_tasks` operator flow, which is not anchored to a
 *     curator run_id.
 *
 * The mapping is a JSON object `{ [target_registry_group_id]: "TASK-<N>" }`.
 * Entries whose key matches no existing `KnownIssue.group_id` are silently
 * skipped (the upsert may have failed earlier, or the entry was rejected).
 */

import * as fs from "node:fs/promises";

import { error_code } from "@ariadnejs/skill-fs";
import { link_ariadne_bug_tasks } from "../src/apply/apply_proposals.js";
import {
  created_task_ids_path,
  get_registry_file_path,
} from "../src/store/paths.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

interface CliArgs {
  run_id: string | null;
  mapping_path: string | null;
}

function parse_argv(argv: string[]): CliArgs {
  let run_id: string | null = null;
  let mapping_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--run-id":
        run_id = argv[++i];
        break;
      case "--mapping":
        mapping_path = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: link_ariadne_bug_tasks --run-id <run_id> | --mapping <path>\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  const has_run_id = run_id !== null && run_id.length > 0;
  const has_mapping = mapping_path !== null && mapping_path.length > 0;
  if (has_run_id === has_mapping) {
    throw new Error("exactly one of --run-id <run_id> or --mapping <path> is required");
  }
  return { run_id, mapping_path };
}

async function load_mapping(source_path: string): Promise<Record<string, string>> {
  let raw: string;
  try {
    raw = await fs.readFile(source_path, "utf8");
  } catch (err) {
    if (error_code(err) === "ENOENT") {
      throw new Error(
        `mapping file not found at ${source_path}. ` +
          "The main agent must write each created task id to this file " +
          "immediately after `mcp__backlog__task_create` resolves; only " +
          "after the file exists should this script be invoked.",
      );
    }
    throw err;
  }
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `${source_path} must be a JSON object mapping target_registry_group_id → TASK id`,
    );
  }
  const out: Record<string, string> = {};
  for (const [group_id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `${source_path} entry for '${group_id}' must be a non-empty TASK-<N> string`,
      );
    }
    out[group_id] = value;
  }
  return out;
}

async function main(): Promise<void> {
  const { run_id, mapping_path } = parse_argv(process.argv.slice(2));
  const source_path =
    run_id !== null ? created_task_ids_path(run_id) : (mapping_path as string);
  const mapping = await load_mapping(source_path);
  const result = await link_ariadne_bug_tasks(get_registry_file_path(), mapping);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(
    `link_ariadne_bug_tasks failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

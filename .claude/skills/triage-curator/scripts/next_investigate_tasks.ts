#!/usr/bin/env node
/**
 * Pulls the next batch of pending investigate dispatches from a flattened
 * dispatch list supplied by the main agent. A dispatch is "done" when its
 * pre-allocated `output_path` exists and parses as valid JSON — the same
 * convention `curate_run --phase finalize` uses. Missing or malformed
 * response files count as pending; the latter emits a stderr warning so
 * repeat-crash investigators are visible to the caller.
 *
 * Input shape and caller protocol are documented in SKILL.md Step 4.
 *
 * Usage:
 *   node --import tsx .claude/skills/triage-curator/scripts/next_investigate_tasks.ts \
 *     --dispatch-list <path-to-json> --limit <n>
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { error_code } from "../src/errors.js";
import "../src/require_node_import_tsx.js";

interface DispatchEntry {
  run_path: string;
  group_id: string;
  output_path: string;
  get_context_cmd: string;
}

interface CliArgs {
  dispatch_list_path: string;
  limit: number;
}

function parse_argv(argv: string[]): CliArgs {
  let dispatch_list_path: string | null = null;
  let limit: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--dispatch-list":
        dispatch_list_path = argv[++i];
        break;
      case "--limit":
        limit = Number.parseInt(argv[++i], 10);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (dispatch_list_path === null || dispatch_list_path.length === 0) {
    throw new Error("--dispatch-list <path> is required");
  }
  if (limit === null || Number.isNaN(limit) || limit < 0) {
    throw new Error("--limit <n> is required and must be a non-negative integer");
  }
  return { dispatch_list_path, limit };
}

async function is_done(output_path: string): Promise<boolean> {
  let contents: string;
  try {
    contents = await fs.readFile(output_path, "utf8");
  } catch (err) {
    if (error_code(err) === "ENOENT") return false;
    throw err;
  }
  try {
    JSON.parse(contents);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `malformed JSON at ${path.basename(output_path)} (${msg}) — counting as pending\n`,
    );
    return false;
  }
}

async function main(): Promise<void> {
  const { dispatch_list_path, limit } = parse_argv(process.argv.slice(2));

  const entries: DispatchEntry[] = JSON.parse(
    await fs.readFile(dispatch_list_path, "utf8"),
  );
  if (!Array.isArray(entries)) {
    throw new Error("dispatch list must be a JSON array");
  }

  const not_done: DispatchEntry[] = [];
  for (const entry of entries) {
    if (!(await is_done(entry.output_path))) {
      not_done.push(entry);
    }
  }

  const pending = not_done.slice(0, limit);

  process.stdout.write(
    JSON.stringify(
      {
        pending,
        remaining: not_done.length,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((err) => {
  process.stderr.write(
    `next_investigate_tasks failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Pulls the next batch of pending investigate dispatches written by the main
 * agent (promote-novel entries from `curate_all`). A dispatch is "done" when
 * its pre-allocated `output_path` exists and parses as valid JSON. Missing or
 * malformed response files count as pending; malformed ones emit a stderr
 * warning.
 *
 * Drift-flagged wip rules float to the front of the queue: any registry row
 * whose `drift_detected === true` (set by either the QA-sample drift path or
 * the in-flight `fp-classifier-regression` absorb in 190.19.4) sorts ahead of
 * its peers so the strongest classifier-rework signal lands inside the
 * limit-sized slice.
 *
 * Input shape and caller protocol are documented in SKILL.md Step 4.
 *
 * Usage:
 *   node --import tsx next_investigate_tasks.ts --dispatch-list <path> --limit <n>
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { parse_known_issues_registry_json } from "@ariadnejs/types";
import { error_code } from "../src/errors.js";
import { get_registry_file_path } from "../src/paths.js";
import type { KnownIssue } from "../src/types.js";
import "../src/require_node_import_tsx.js";

export interface DispatchEntry {
  run_path: string;
  /**
   * Dispatch key — under v4 this is a `novel_issue.id` for promote-novel
   * dispatches. The puller does not interpret the value; it only uses it for
   * stable ordering and registry lookup against `KnownIssue.group_id`.
   */
  group_id: string;
  output_path: string;
  get_context_cmd: string;
}

/**
 * Stable-sort dispatches so drift-flagged `wip` rules come first. A drifting
 * classifier is one whose existing match shape has shifted relative to the QA
 * sample, and we want to investigate it before the puller's limit fills with
 * non-drifting candidates. Pure.
 */
export function sort_by_drift_priority(
  entries: DispatchEntry[],
  registry_by_group: Map<string, KnownIssue>,
): DispatchEntry[] {
  const priority = (entry: DispatchEntry): number => {
    const reg = registry_by_group.get(entry.group_id);
    if (reg === undefined) return 1;
    if (reg.status === "wip" && reg.drift_detected === true) return 0;
    return 1;
  };
  return entries
    .map((entry, index) => ({ entry, index, prio: priority(entry) }))
    .sort((a, b) => (a.prio !== b.prio ? a.prio - b.prio : a.index - b.index))
    .map(({ entry }) => entry);
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

  const dispatch_entries = JSON.parse(
    await fs.readFile(dispatch_list_path, "utf8"),
  ) as DispatchEntry[];
  if (!Array.isArray(dispatch_entries)) {
    throw new Error("dispatch list must be a JSON array");
  }

  const registry = parse_known_issues_registry_json(
    await fs.readFile(get_registry_file_path(), "utf8"),
  );
  const registry_by_group = new Map(registry.map((e) => [e.group_id, e]));

  // Dedupe by output_path (same file means same dispatch). Drift-flagged
  // wip rules float to the front of the queue.
  const by_output = new Map<string, DispatchEntry>();
  for (const e of dispatch_entries) {
    by_output.set(e.output_path, e);
  }
  const ordered = sort_by_drift_priority([...by_output.values()], registry_by_group);

  const not_done: DispatchEntry[] = [];
  for (const entry of ordered) {
    if (!(await is_done(entry.output_path))) not_done.push(entry);
  }
  const pending = not_done.slice(0, limit);

  process.stdout.write(
    JSON.stringify({ pending, remaining: not_done.length }, null, 2) + "\n",
  );
}

// Only run when invoked as the entry point (skips when imported by tests).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(
      `next_investigate_tasks failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}

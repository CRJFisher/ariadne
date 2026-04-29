#!/usr/bin/env node
/**
 * Pulls the next batch of pending investigate dispatches. Reads the flat
 * dispatch list written by the main agent (residual entries from `curate_all`),
 * then scans each referenced run's `qa/` directory and promotes any
 * QA-broken classifier to an investigate dispatch on the fly — promotion is
 * not a separate orchestration step.
 *
 * A dispatch is "done" when its pre-allocated `output_path` exists and parses
 * as valid JSON. Missing or malformed response files count as pending;
 * malformed ones emit a stderr warning.
 *
 * Input shape and caller protocol are documented in SKILL.md Step 4.
 *
 * Usage:
 *   node --import tsx next_investigate_tasks.ts --dispatch-list <path> --limit <n>
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parse_known_issues_registry_json } from "@ariadnejs/types";
import { error_code } from "../src/errors.js";
import {
  derive_run_id,
  get_registry_file_path,
  get_repo_root,
  get_scripts_rel,
  run_output_dir,
} from "../src/paths.js";
import type {
  KnownIssue,
  QaResponse,
  TriageResultsFile,
} from "../src/types.js";
import "../src/require_node_import_tsx.js";

/**
 * QA sample size — must match the value `get_qa_context.ts` hands to the
 * sub-agent. Promotion uses this as the denominator for the outlier rate.
 */
const QA_SAMPLE_SIZE = 10;

/** Sample-outlier rate at or above which a QA'd classifier is re-investigated. */
const PROMOTE_SAMPLE_OUTLIER_RATE_THRESHOLD = 0.4;

/** Minimum QA sample size below which promotion is skipped as too noisy. */
const PROMOTE_MIN_SAMPLE_SIZE = 4;

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

async function read_dir_safe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch (err) {
    if (error_code(err) === "ENOENT") return [];
    throw err;
  }
}

async function read_qa_responses(qa_dir: string): Promise<QaResponse[]> {
  const files = await read_dir_safe(qa_dir);
  const results: QaResponse[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(await fs.readFile(path.join(qa_dir, file), "utf8")) as QaResponse;
      results.push(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`skipping QA ${file}: unreadable JSON (${msg})\n`);
    }
  }
  return results;
}

/**
 * Walk QA responses for one run and emit a promoted dispatch for every
 * classifier whose sample outlier rate crosses the threshold. Promoted
 * entries land in the same `investigate/` directory as residuals — the
 * `--promoted` flag on `get_context_cmd` hydrates the extra QA context.
 */
async function compute_promotions(
  run_path: string,
  registry_by_group: Map<string, KnownIssue>,
  scripts_rel: string,
  run_rel: string,
): Promise<DispatchEntry[]> {
  const run_id = derive_run_id(run_path);
  const output_dir = run_output_dir(run_id);
  const qa_responses = await read_qa_responses(path.join(output_dir, "qa"));

  const triage_raw = await fs.readFile(run_path, "utf8");
  const triage = JSON.parse(triage_raw) as TriageResultsFile;

  const inv_script = path.join(scripts_rel, "get_investigate_context.ts");
  const promotions: DispatchEntry[] = [];
  for (const qa of qa_responses) {
    const group = triage.false_positive_groups[qa.group_id];
    if (group === undefined) continue;
    const registry_entry = registry_by_group.get(qa.group_id);
    if (registry_entry === undefined) continue;
    if (registry_entry.status === "permanent") continue;

    const sample_size = Math.min(QA_SAMPLE_SIZE, group.entries.length);
    if (sample_size < PROMOTE_MIN_SAMPLE_SIZE) continue;

    const rate = qa.outliers.length / sample_size;
    if (rate < PROMOTE_SAMPLE_OUTLIER_RATE_THRESHOLD) continue;

    promotions.push({
      run_path,
      group_id: qa.group_id,
      output_path: path.join(output_dir, "investigate", `${qa.group_id}.json`),
      get_context_cmd: `node --import tsx ${inv_script} --group ${qa.group_id} --run ${run_rel} --promoted`,
    });
  }
  return promotions;
}

async function main(): Promise<void> {
  const { dispatch_list_path, limit } = parse_argv(process.argv.slice(2));

  const residual_entries = JSON.parse(
    await fs.readFile(dispatch_list_path, "utf8"),
  ) as DispatchEntry[];
  if (!Array.isArray(residual_entries)) {
    throw new Error("dispatch list must be a JSON array");
  }

  const registry = parse_known_issues_registry_json(
    await fs.readFile(get_registry_file_path(), "utf8"),
  ) as unknown as KnownIssue[];
  const registry_by_group = new Map(registry.map((e) => [e.group_id, e]));

  // Compute promotions per unique run_path referenced by residuals.
  const repo_root = get_repo_root();
  const scripts_rel = get_scripts_rel();
  const unique_run_paths = [...new Set(residual_entries.map((e) => e.run_path))];
  const promoted_entries: DispatchEntry[] = [];
  for (const run_path of unique_run_paths) {
    const run_rel = path.relative(repo_root, run_path);
    promoted_entries.push(
      ...(await compute_promotions(run_path, registry_by_group, scripts_rel, run_rel)),
    );
  }

  // Merge residual + promoted; dedupe by output_path (same file means same
  // dispatch from this puller's perspective).
  const by_output = new Map<string, DispatchEntry>();
  for (const e of [...residual_entries, ...promoted_entries]) {
    by_output.set(e.output_path, e);
  }
  const combined = [...by_output.values()];

  const not_done: DispatchEntry[] = [];
  for (const entry of combined) {
    if (!(await is_done(entry.output_path))) not_done.push(entry);
  }
  const pending = not_done.slice(0, limit);

  process.stdout.write(
    JSON.stringify({ pending, remaining: not_done.length }, null, 2) + "\n",
  );
}

main().catch((err) => {
  process.stderr.write(
    `next_investigate_tasks failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

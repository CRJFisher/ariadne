#!/usr/bin/env node
/**
 * Lint lens for the published triage_results envelope.
 *
 * Strict-parses one or every published `triage_results` file through the same
 * `parse_triage_results` the producer and every consumer use — so this lens
 * fails on exactly what a downstream reader would reject: non-JSON, a non-object
 * payload, a `schema_version` that is not the current v5, or a missing/ill-typed
 * required array (`novel_issues`, `classifier_regressions`, `confirmed_unreachable`,
 * `uncertain`). It re-derives nothing; the envelope contract stays owned by
 * `@ariadnejs/skill-protocol`.
 *
 * Exit codes: usage error → 2 (with USAGE); a parse failure → 1; ok → 0.
 *
 * Usage:
 *   node --import tsx check_triage_results.ts --file <path>
 *   node --import tsx check_triage_results.ts --project <name> [--run-id <run-id>]
 *
 * `--file` strict-parses exactly that file (for a seeded fixture). `--project`
 * sweeps every finalized run for the project (or the one named by `--run-id`).
 */

import * as fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { parse_triage_results } from "@ariadnejs/skill-protocol";

import {
  all_finalized_run_ids,
  read_triage_results,
} from "../src/store/triage_results_store.js";
import { triage_results_dir, triage_results_path } from "@ariadnejs/skill-protocol";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: check_triage_results --file <path> | --project <name> [--run-id <run-id>]\n";

class UsageError extends Error {}

interface CliArgs {
  file_path: string | null;
  project: string | null;
  run_id: string | null;
}

interface FileIssue {
  file: string;
  error: string;
}

interface TriageResultsCheckResult {
  ok: boolean;
  checked: number;
  issues: FileIssue[];
}

function parse_argv(argv: string[]): CliArgs {
  let file_path: string | null = null;
  let project: string | null = null;
  let run_id: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--file":
        file_path = require_value(argv, ++i, "--file");
        break;
      case "--project":
        project = require_value(argv, ++i, "--project");
        break;
      case "--run-id":
        run_id = require_value(argv, ++i, "--run-id");
        break;
      case "--help":
      case "-h":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      default:
        throw new UsageError(`Unknown argument: ${arg}`);
    }
  }
  if (file_path === null && project === null) {
    throw new UsageError("one of --file or --project is required");
  }
  if (file_path !== null && project !== null) {
    throw new UsageError("--file and --project are mutually exclusive");
  }
  if (run_id !== null && project === null) {
    throw new UsageError("--run-id requires --project");
  }
  return { file_path, project, run_id };
}

function require_value(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) {
    throw new UsageError(`${flag} expects a value`);
  }
  return value;
}

async function check_one_file(file_path: string): Promise<FileIssue | null> {
  let text: string;
  try {
    text = await fs.readFile(file_path, "utf-8");
  } catch (err) {
    return { file: file_path, error: err instanceof Error ? err.message : String(err) };
  }
  try {
    parse_triage_results(file_path, text);
    return null;
  } catch (err) {
    return { file: file_path, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function check_triage_results(args: CliArgs): Promise<TriageResultsCheckResult> {
  const issues: FileIssue[] = [];
  let checked = 0;

  if (args.file_path !== null) {
    checked = 1;
    const issue = await check_one_file(args.file_path);
    if (issue !== null) issues.push(issue);
    return { ok: issues.length === 0, checked, issues };
  }

  const project = args.project as string;
  if (args.run_id === null) {
    // A sweep over a missing results dir would return zero runs and pass
    // vacuously — indistinguishable from a typo'd project name. Fail instead.
    // An existing-but-empty dir (a legitimately unpublished project) still passes.
    const dir = triage_results_dir(project);
    try {
      await fs.access(dir);
    } catch {
      return {
        ok: false,
        checked: 0,
        issues: [{ file: dir, error: `no triage_results directory for project "${project}" — check the --project name` }],
      };
    }
  }
  const run_ids = args.run_id !== null ? [args.run_id] : await all_finalized_run_ids(project);
  for (const run_id of run_ids) {
    checked += 1;
    try {
      // read_triage_results strict-parses via parse_triage_results internally.
      await read_triage_results(project, run_id);
    } catch (err) {
      issues.push({
        file: triage_results_path(project, run_id),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { ok: issues.length === 0, checked, issues };
}

async function main(): Promise<void> {
  const args = parse_argv(process.argv.slice(2));
  const result = await check_triage_results(args);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (!result.ok) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n${USAGE}`);
      process.exit(2);
    }
    process.stderr.write(
      `check_triage_results failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
  });
}

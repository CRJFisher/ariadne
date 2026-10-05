#!/usr/bin/env node
/**
 * Health lens over a whole triage store.
 *
 * `check_triage_results` validates one published envelope's shape. This asks the
 * question one level up, over every project and run a store holds: did each
 * triage job actually finish, is its verdict published, and is it filed under an
 * id that downstream readers can find it by. That is the check worth running
 * before a store is bundled for another machine, and again after it is merged
 * into one — a merge that silently dropped a run, or landed it under a legacy
 * id, looks exactly like a store that was never run.
 *
 * Completion is read from the run manifest rather than re-derived: `finalize`
 * refuses a run whose state phase is not `complete`, then stamps the manifest
 * `finalized` and writes the published envelope. So manifest-finalized plus a
 * published envelope *is* the completion proof, and the 280 MB `triage.json`
 * only has to be opened for runs that lack it. `--deep` opens it anyway and
 * reports the per-entry tallies.
 *
 * Exit codes: usage error → 2; any problem found → 1; clean → 0.
 *
 * Usage:
 *   node --import tsx check_triage_store.ts [--store <dir>] [--deep] [--json]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { identify_project, type ProjectIdentity } from "../src/store/project_identity.js";
import {
  default_store_dir,
  list_analysis_projects,
  list_run_ids,
  list_state_projects,
  manifest_file,
  state_file,
  triage_results_file,
} from "../src/store/store_layout.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE = "Usage: check_triage_store.ts [--store <dir>] [--deep] [--json]\n";

class UsageError extends Error {}

export interface CheckStoreArgs {
  store_dir: string;
  deep: boolean;
}

/** Per-entry tallies, present only when `triage.json` was opened. */
export interface EntryTallies {
  total: number;
  completed: number;
  pending: number;
  failed: number;
}

export interface RunHealth {
  run_id: string;
  manifest_status: string | null;
  phase: string | null;
  tallies: EntryTallies | null;
  results_published: boolean;
  problems: string[];
}

export interface ProjectHealth {
  project_id: string;
  identity: ProjectIdentity;
  runs: RunHealth[];
  problems: string[];
}

export interface StoreHealth {
  store_dir: string;
  projects: ProjectHealth[];
  ok: boolean;
}

function parse_argv(argv: readonly string[]): CheckStoreArgs & { json: boolean } {
  let store_dir = default_store_dir();
  let deep = false;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--store": {
        const value = argv[++i];
        if (value === undefined || value.startsWith("--")) {
          throw new UsageError("--store expects a value");
        }
        store_dir = path.resolve(value);
        break;
      }
      case "--deep":
        deep = true;
        break;
      case "--json":
        json = true;
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

  return { store_dir, deep, json };
}

function read_json(file_path: string): Record<string, unknown> | null {
  if (!fs.existsSync(file_path)) return null;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file_path, "utf8"));
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function tally_entries(state: Record<string, unknown>): EntryTallies {
  const entries = Array.isArray(state.entries) ? state.entries : [];
  const tallies: EntryTallies = { total: entries.length, completed: 0, pending: 0, failed: 0 };
  for (const entry of entries) {
    const status = (entry as { status?: unknown }).status;
    if (status === "completed") tallies.completed++;
    else if (status === "pending") tallies.pending++;
    else if (status === "failed") tallies.failed++;
  }
  return tallies;
}

function check_run(args: CheckStoreArgs, project_id: string, run_id: string): RunHealth {
  const problems: string[] = [];
  const manifest = read_json(manifest_file(args.store_dir, project_id, run_id));
  const manifest_status =
    manifest !== null && typeof manifest.status === "string" ? manifest.status : null;
  const results_published = fs.existsSync(
    triage_results_file(args.store_dir, project_id, run_id),
  );

  if (manifest === null) problems.push("missing-manifest");
  if (manifest_status === "active") problems.push("run-still-active");
  if (manifest_status === "finalized" && !results_published) problems.push("results-missing");

  // A finalized run with its envelope on disk is complete by construction, so
  // the state file is opened only when that proof is absent — or on --deep.
  const proven_complete = manifest_status === "finalized" && results_published;
  const state =
    proven_complete && !args.deep ? null : read_json(state_file(args.store_dir, project_id, run_id));

  let phase: string | null = null;
  let tallies: EntryTallies | null = null;

  if (state !== null) {
    phase = typeof state.phase === "string" ? state.phase : null;
    tallies = tally_entries(state);
    if (phase !== "complete") problems.push(`phase-${phase ?? "unknown"}`);
    if (tallies.pending > 0) problems.push(`entries-pending-${tallies.pending}`);
    if (tallies.failed > 0) problems.push(`entries-failed-${tallies.failed}`);
  } else if (!proven_complete) {
    problems.push("missing-state");
  }

  if (!results_published && manifest_status !== "abandoned") {
    if (!problems.includes("results-missing")) problems.push("results-missing");
  }

  return { run_id, manifest_status, phase, tallies, results_published, problems };
}

function check_project(args: CheckStoreArgs, project_id: string): ProjectHealth {
  const identity = identify_project(args.store_dir, project_id);
  const problems: string[] = [];

  if (identity.verdict === "legacy") problems.push("legacy-project-id");
  if (identity.verdict === "unresolved") problems.push("unresolved-project-id");

  const run_ids = list_run_ids(args.store_dir, project_id);
  if (run_ids.length === 0) problems.push("no-runs");

  const runs = run_ids.map((run_id) => check_run(args, project_id, run_id));
  return { project_id, identity, runs, problems };
}

/**
 * Survey every project the store holds, whether it is known by its run state,
 * its published output, or both — a half-copied merge shows up as a project
 * present in one and absent from the other.
 */
export function check_triage_store(args: CheckStoreArgs): StoreHealth {
  const project_ids = [
    ...new Set([
      ...list_state_projects(args.store_dir),
      ...list_analysis_projects(args.store_dir),
    ]),
  ].sort();

  const projects = project_ids.map((project_id) => check_project(args, project_id));
  const ok = projects.every(
    (project) =>
      project.problems.length === 0 && project.runs.every((run) => run.problems.length === 0),
  );

  return { store_dir: args.store_dir, projects, ok };
}

function format_report(health: StoreHealth): string {
  const lines: string[] = [`Store: ${health.store_dir}`, ""];
  const width = Math.max(
    ...health.projects.map((p) => p.project_id.length),
    "PROJECT".length,
  );

  lines.push(`${"PROJECT".padEnd(width)}  RUNS  STATUS`);
  lines.push(`${"-".repeat(width)}  ----  ------`);

  for (const project of health.projects) {
    const run_problems = project.runs.flatMap((run) =>
      run.problems.map((problem) => `${run.run_id}: ${problem}`),
    );
    const all = [...project.problems, ...run_problems];
    lines.push(
      `${project.project_id.padEnd(width)}  ${String(project.runs.length).padStart(4)}  ` +
        (all.length === 0 ? "ok" : all.join(", ")),
    );
    if (project.identity.verdict === "legacy") {
      lines.push(
        `${" ".repeat(width)}        → canonical id is ${project.identity.canonical_project_id}`,
      );
    }
  }

  const legacy = health.projects.filter((p) => p.identity.verdict === "legacy").length;
  lines.push("");
  lines.push(
    `${health.projects.length} project(s), ` +
      `${health.projects.reduce((n, p) => n + p.runs.length, 0)} run(s), ` +
      `${legacy} under a legacy id.`,
  );
  lines.push(health.ok ? "OK — every run finished and published." : "PROBLEMS FOUND (see above).");
  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  let args: CheckStoreArgs & { json: boolean };
  try {
    args = parse_argv(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exit(2);
  }

  if (!fs.existsSync(args.store_dir)) {
    process.stderr.write(`Error: store directory not found: ${args.store_dir}\n`);
    process.exit(2);
  }

  const health = check_triage_store(args);
  process.stdout.write(
    args.json ? JSON.stringify(health, null, 2) + "\n" : format_report(health),
  );
  process.exit(health.ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}

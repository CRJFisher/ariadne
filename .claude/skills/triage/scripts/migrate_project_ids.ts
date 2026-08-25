#!/usr/bin/env node
/**
 * Re-file a store's projects under their canonical, owner-qualified ids.
 *
 * The project id is the join key: it names `triage_state/<id>/` and
 * `analysis_output/<id>/`, it is what `targets.yaml` records as `project_id`,
 * and it is what the known-issues registry records in `observed_projects`. Two
 * earlier resolvers wrote other ids — the last slug segment alone (`webpack`,
 * and `core` for two different repos), and a slug of the corpus's absolute path
 * (`-Users-me-...-repos-babel--babel`). A run filed under either is stranded:
 * the registry cannot attribute a rule to it, `targets.yaml` cannot say it was
 * triaged, and a second repo sharing a last-segment id would share its history.
 *
 * This walks a settled store and re-files every such project, reading the
 * canonical id out of the corpus path its own artifacts recorded rather than
 * un-slugging a directory name. Three things move with it:
 *
 *   - the run directories, and the `project_name` recorded inside each run's
 *     manifest and state file;
 *   - each manifest's `source_analysis_path`, which points into
 *     `analysis_output/<id>/` and would otherwise dangle — `get_entry_context
 *     --enriched` reads that path directly;
 *   - the plan store's `projects[]` and `project` attributions, so a fault
 *     area's evidence still names the corpus it came from.
 *
 * Dry-run by default; `--apply` performs the moves. Run it on any machine whose
 * store predates the owner-qualified id, before or after a merge.
 *
 * Exit codes: usage error → 2; a conflict blocked part of the plan → 1; ok → 0.
 *
 * Usage:
 *   node --import tsx migrate_project_ids.ts [--store <dir>] [--plan-dir <dir>]
 *                                            [--apply] [--prune-empty] [--json]
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { stream_replace_in_place } from "../src/store/stream_rewrite.js";
import { identify_project, type IdentityVerdict } from "../src/store/project_identity.js";
import {
  ANALYSIS_OUTPUT_SUBDIR,
  default_store_dir,
  list_analysis_projects,
  list_run_ids,
  list_state_projects,
  list_subdirectories,
  manifest_file,
  project_analysis_dir,
  project_config_file,
  project_state_dir,
  run_dir,
  runs_root,
  state_file,
} from "../src/store/store_layout.js";
import { LATEST_FILENAME } from "../src/store/paths.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: migrate_project_ids.ts [--store <dir>] [--plan-dir <dir>] [--apply] [--prune-empty] [--json]\n";

class UsageError extends Error {}

export interface MigrateArgs {
  store_dir: string;
  plan_dir: string;
  apply: boolean;
  prune_empty: boolean;
}

/** One relocation, and whether something already sitting at the target blocks it. */
export interface Move {
  from: string;
  to: string;
  blocked_by_existing: boolean;
}

export interface ProjectMigration {
  from_project_id: string;
  to_project_id: string;
  project_path: string;
  /** The canonical id already owns a directory, so runs merge into it. */
  merges_into_existing: boolean;
  run_moves: Move[];
  analysis_moves: Move[];
  config_move: Move | null;
}

/** A plan-store file that attributes evidence to a project being re-filed. */
export interface PlanAttributionRewrite {
  file: string;
  occurrences: number;
}

export interface MigrationPlan {
  store_dir: string;
  plan_dir: string;
  id_map: Record<string, string>;
  migrations: ProjectMigration[];
  /** Projects left alone, with the reason their id could not be checked. */
  skipped: Array<{ project_id: string; verdict: IdentityVerdict }>;
  /** Project directories holding runs with no manifest, state or verdicts. */
  empty_project_dirs: string[];
  plan_rewrites: PlanAttributionRewrite[];
  /** Two legacy ids resolving to one canonical id, which needs a human. */
  ambiguous: Array<{ to_project_id: string; from_project_ids: string[] }>;
}

export interface MigrationReport {
  plan: MigrationPlan;
  applied: boolean;
  runs_moved: number;
  analysis_files_moved: number;
  configs_moved: number;
  plan_files_rewritten: number;
  pruned_dirs: string[];
  blocked: string[];
}

// ===== Planning =====

/** True when a run directory holds no file at any depth. */
function run_dir_is_empty(store_dir: string, project_id: string, run_id: string): boolean {
  const dir = run_dir(store_dir, project_id, run_id);
  if (!fs.existsSync(dir)) return true;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) stack.push(path.join(current, entry.name));
      else return false;
    }
  }
  return true;
}

function project_is_empty(store_dir: string, project_id: string): boolean {
  const analysis_dir = project_analysis_dir(store_dir, project_id);
  if (fs.existsSync(analysis_dir)) {
    for (const type_dir of list_subdirectories(analysis_dir)) {
      if (fs.readdirSync(path.join(analysis_dir, type_dir)).length > 0) return false;
    }
  }
  return list_run_ids(store_dir, project_id).every((run_id) =>
    run_dir_is_empty(store_dir, project_id, run_id),
  );
}

/** Every published artifact of a project, as (from, to) pairs under the new id. */
function plan_analysis_moves(store_dir: string, from_id: string, to_id: string): Move[] {
  const from_dir = project_analysis_dir(store_dir, from_id);
  const to_dir = project_analysis_dir(store_dir, to_id);
  const moves: Move[] = [];

  for (const type_dir of list_subdirectories(from_dir)) {
    for (const name of fs.readdirSync(path.join(from_dir, type_dir)).sort()) {
      const to = path.join(to_dir, type_dir, name);
      moves.push({
        from: path.join(from_dir, type_dir, name),
        to,
        blocked_by_existing: fs.existsSync(to),
      });
    }
  }
  return moves;
}

function plan_run_moves(store_dir: string, from_id: string, to_id: string): Move[] {
  return list_run_ids(store_dir, from_id).map((run_id) => {
    const to = run_dir(store_dir, to_id, run_id);
    return {
      from: run_dir(store_dir, from_id, run_id),
      to,
      blocked_by_existing: fs.existsSync(to),
    };
  });
}

function plan_config_move(store_dir: string, from_id: string, to_id: string): Move | null {
  const from = project_config_file(store_dir, from_id);
  if (!fs.existsSync(from)) return null;
  const to = project_config_file(store_dir, to_id);
  return { from, to, blocked_by_existing: fs.existsSync(to) };
}

/**
 * Rewrite every `projects[]` / `project` attribution in a parsed plan artifact,
 * counting the substitutions. Shape-agnostic by design: the plan store keeps
 * project attributions in a sweep manifest, in fault-area buckets and in task
 * records, and a structural walk survives all three without naming them.
 */
export function rewrite_plan_attributions(
  value: unknown,
  id_map: Readonly<Record<string, string>>,
): { value: unknown; occurrences: number } {
  let occurrences = 0;

  function walk(node: unknown, key: string | null): unknown {
    if (Array.isArray(node)) {
      return node.map((item) => {
        if (key === "projects" && typeof item === "string" && item in id_map) {
          occurrences++;
          return id_map[item];
        }
        return walk(item, null);
      });
    }
    if (typeof node === "object" && node !== null) {
      const out: Record<string, unknown> = {};
      for (const [child_key, child] of Object.entries(node)) {
        if (child_key === "project" && typeof child === "string" && child in id_map) {
          occurrences++;
          out[child_key] = id_map[child];
        } else {
          out[child_key] = walk(child, child_key);
        }
      }
      return out;
    }
    return node;
  }

  const rewritten = walk(value, null);
  return { value: rewritten, occurrences };
}

function list_plan_files(plan_dir: string): string[] {
  if (!fs.existsSync(plan_dir)) return [];
  const files: string[] = [];
  const stack = [plan_dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith(".json") || entry.name.endsWith(".jsonl")) files.push(full);
    }
  }
  return files.sort();
}

/** Count the attributions one plan file would rewrite, without writing it. */
function count_plan_occurrences(file: string, id_map: Readonly<Record<string, string>>): number {
  const text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".jsonl")) {
    let total = 0;
    for (const line of text.split("\n")) {
      if (line.trim().length === 0) continue;
      try {
        total += rewrite_plan_attributions(JSON.parse(line), id_map).occurrences;
      } catch {
        return 0;
      }
    }
    return total;
  }
  try {
    return rewrite_plan_attributions(JSON.parse(text), id_map).occurrences;
  } catch {
    return 0;
  }
}

export function plan_project_id_migration(args: MigrateArgs): MigrationPlan {
  const project_ids = [
    ...new Set([...list_state_projects(args.store_dir), ...list_analysis_projects(args.store_dir)]),
  ].sort();

  const migrations: ProjectMigration[] = [];
  const skipped: Array<{ project_id: string; verdict: IdentityVerdict }> = [];
  const empty_project_dirs: string[] = [];
  const id_map: Record<string, string> = {};

  for (const project_id of project_ids) {
    const identity = identify_project(args.store_dir, project_id);

    if (identity.verdict !== "legacy") {
      if (identity.verdict !== "canonical") {
        skipped.push({ project_id, verdict: identity.verdict });
        if (project_is_empty(args.store_dir, project_id)) empty_project_dirs.push(project_id);
      }
      continue;
    }

    const to_project_id = identity.canonical_project_id as string;
    id_map[project_id] = to_project_id;
    migrations.push({
      from_project_id: project_id,
      to_project_id,
      project_path: identity.project_path as string,
      merges_into_existing: fs.existsSync(project_state_dir(args.store_dir, to_project_id)),
      run_moves: plan_run_moves(args.store_dir, project_id, to_project_id),
      analysis_moves: plan_analysis_moves(args.store_dir, project_id, to_project_id),
      config_move: plan_config_move(args.store_dir, project_id, to_project_id),
    });
  }

  const by_target = new Map<string, string[]>();
  for (const [from, to] of Object.entries(id_map)) {
    by_target.set(to, [...(by_target.get(to) ?? []), from]);
  }
  const ambiguous = [...by_target.entries()]
    .filter(([, froms]) => froms.length > 1)
    .map(([to_project_id, from_project_ids]) => ({ to_project_id, from_project_ids }));

  const plan_rewrites =
    Object.keys(id_map).length === 0
      ? []
      : list_plan_files(args.plan_dir)
          .map((file) => ({ file, occurrences: count_plan_occurrences(file, id_map) }))
          .filter((rewrite) => rewrite.occurrences > 0);

  return {
    store_dir: args.store_dir,
    plan_dir: args.plan_dir,
    id_map,
    migrations,
    skipped,
    empty_project_dirs,
    plan_rewrites,
    ambiguous,
  };
}

// ===== Applying =====

/** Move a path, falling back to copy-then-remove when it crosses a device. */
function move_path(from: string, to: string): void {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (err) {
    if ((err as { code?: string }).code !== "EXDEV") throw err;
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
}

/**
 * Retarget the two references a moved run carries to its own project id: the
 * `project_name` field, and the `source_analysis_path` that points into the
 * project's published output. Streamed, because `triage.json` reaches 280 MB.
 */
async function rewrite_run_references(
  store_dir: string,
  to_project_id: string,
  run_id: string,
  from_project_id: string,
): Promise<void> {
  const replacements = [
    {
      find: `"project_name": ${JSON.stringify(from_project_id)}`,
      replace: `"project_name": ${JSON.stringify(to_project_id)}`,
    },
    {
      find: `"project_name":${JSON.stringify(from_project_id)}`,
      replace: `"project_name":${JSON.stringify(to_project_id)}`,
    },
    {
      find: `/${ANALYSIS_OUTPUT_SUBDIR}/${from_project_id}/`,
      replace: `/${ANALYSIS_OUTPUT_SUBDIR}/${to_project_id}/`,
    },
  ];

  for (const file of [
    manifest_file(store_dir, to_project_id, run_id),
    state_file(store_dir, to_project_id, run_id),
  ]) {
    if (fs.existsSync(file)) await stream_replace_in_place(file, replacements);
  }
}

function rewrite_plan_file(file: string, id_map: Readonly<Record<string, string>>): void {
  const text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".jsonl")) {
    const lines = text.split("\n").map((line) => {
      if (line.trim().length === 0) return line;
      return JSON.stringify(rewrite_plan_attributions(JSON.parse(line), id_map).value);
    });
    fs.writeFileSync(file, lines.join("\n"), "utf8");
    return;
  }
  const rewritten = rewrite_plan_attributions(JSON.parse(text), id_map).value;
  fs.writeFileSync(file, JSON.stringify(rewritten, null, 2) + "\n", "utf8");
}

/** Drop a directory once nothing is left in it, deepest first. */
function remove_if_empty(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  for (const child of list_subdirectories(dir)) remove_if_empty(path.join(dir, child));
  if (fs.readdirSync(dir).length > 0) return false;
  fs.rmdirSync(dir);
  return true;
}

export async function apply_project_id_migration(
  plan: MigrationPlan,
  options: { prune_empty: boolean },
): Promise<MigrationReport> {
  const blocked: string[] = [];
  const pruned_dirs: string[] = [];
  let runs_moved = 0;
  let analysis_files_moved = 0;
  let configs_moved = 0;

  // Two ids claiming one canonical id is a data question, not a move: applying
  // either one silently decides which run history survives. Stop instead.
  if (plan.ambiguous.length > 0) {
    for (const clash of plan.ambiguous) {
      blocked.push(`${clash.from_project_ids.join(" + ")} both resolve to ${clash.to_project_id}`);
    }
    return {
      plan,
      applied: false,
      runs_moved: 0,
      analysis_files_moved: 0,
      configs_moved: 0,
      plan_files_rewritten: 0,
      pruned_dirs: [],
      blocked,
    };
  }

  for (const migration of plan.migrations) {
    for (const move of migration.run_moves) {
      if (move.blocked_by_existing) {
        blocked.push(`run already present at ${move.to}`);
        continue;
      }
      move_path(move.from, move.to);
      await rewrite_run_references(
        plan.store_dir,
        migration.to_project_id,
        path.basename(move.to),
        migration.from_project_id,
      );
      runs_moved++;
    }

    // The pointer names an in-flight run, so it travels with the runs it points at.
    const latest_from = path.join(
      project_state_dir(plan.store_dir, migration.from_project_id),
      LATEST_FILENAME,
    );
    if (fs.existsSync(latest_from)) {
      const latest_to = path.join(
        project_state_dir(plan.store_dir, migration.to_project_id),
        LATEST_FILENAME,
      );
      if (fs.existsSync(latest_to)) blocked.push(`LATEST already present at ${latest_to}`);
      else move_path(latest_from, latest_to);
    }

    for (const move of migration.analysis_moves) {
      if (move.blocked_by_existing) {
        blocked.push(`published artifact already present at ${move.to}`);
        continue;
      }
      move_path(move.from, move.to);
      analysis_files_moved++;
    }

    if (migration.config_move !== null) {
      if (migration.config_move.blocked_by_existing) {
        blocked.push(`project config already present at ${migration.config_move.to}`);
      } else {
        move_path(migration.config_move.from, migration.config_move.to);
        configs_moved++;
      }
    }

    for (const dir of [
      runs_root(plan.store_dir, migration.from_project_id),
      project_state_dir(plan.store_dir, migration.from_project_id),
      project_analysis_dir(plan.store_dir, migration.from_project_id),
    ]) {
      if (remove_if_empty(dir)) pruned_dirs.push(dir);
    }
  }

  for (const rewrite of plan.plan_rewrites) rewrite_plan_file(rewrite.file, plan.id_map);

  if (options.prune_empty) {
    for (const project_id of plan.empty_project_dirs) {
      for (const dir of [
        project_state_dir(plan.store_dir, project_id),
        project_analysis_dir(plan.store_dir, project_id),
      ]) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          pruned_dirs.push(dir);
        }
      }
    }
  }

  return {
    plan,
    applied: true,
    runs_moved,
    analysis_files_moved,
    configs_moved,
    plan_files_rewritten: plan.plan_rewrites.length,
    pruned_dirs,
    blocked,
  };
}

// ===== CLI =====

function parse_argv(argv: readonly string[]): MigrateArgs & { json: boolean } {
  let store_dir = default_store_dir();
  let plan_dir = path.join(os.homedir(), ".ariadne", "plan");
  let apply = false;
  let prune_empty = false;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = (flag: string): string => {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) {
        throw new UsageError(`${flag} expects a value`);
      }
      return path.resolve(value);
    };
    switch (arg) {
      case "--store":
        store_dir = take("--store");
        break;
      case "--plan-dir":
        plan_dir = take("--plan-dir");
        break;
      case "--apply":
        apply = true;
        break;
      case "--prune-empty":
        prune_empty = true;
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

  return { store_dir, plan_dir, apply, prune_empty, json };
}

function format_plan(plan: MigrationPlan, applied: boolean): string {
  const lines: string[] = [
    `Store:      ${plan.store_dir}`,
    `Plan store: ${plan.plan_dir}`,
    "",
    applied ? "APPLIED" : "DRY RUN — pass --apply to perform these moves",
    "",
  ];

  if (plan.migrations.length === 0) {
    lines.push("Every project is already filed under its canonical id.");
  } else {
    const width = Math.max(...plan.migrations.map((m) => m.from_project_id.length));
    for (const migration of plan.migrations) {
      lines.push(
        `${migration.from_project_id.padEnd(width)}  →  ${migration.to_project_id}` +
          `   (${migration.run_moves.length} run(s), ` +
          `${migration.analysis_moves.length} published file(s)` +
          `${migration.config_move === null ? "" : ", config"}` +
          `${migration.merges_into_existing ? ", merging into an existing directory" : ""})`,
      );
    }
  }

  if (plan.plan_rewrites.length > 0) {
    const total = plan.plan_rewrites.reduce((n, r) => n + r.occurrences, 0);
    lines.push("", `Plan store: ${total} attribution(s) across ${plan.plan_rewrites.length} file(s).`);
  }

  if (plan.skipped.length > 0) {
    lines.push("", "Left alone:");
    for (const skip of plan.skipped) lines.push(`  ${skip.project_id}  (${skip.verdict})`);
  }

  if (plan.empty_project_dirs.length > 0) {
    lines.push(
      "",
      `Empty project directories (pass --prune-empty to delete): ${plan.empty_project_dirs.join(", ")}`,
    );
  }

  if (plan.ambiguous.length > 0) {
    lines.push("", "BLOCKED — two ids resolve to one canonical id:");
    for (const clash of plan.ambiguous) {
      lines.push(`  ${clash.from_project_ids.join(" + ")}  →  ${clash.to_project_id}`);
    }
  }

  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  let args: MigrateArgs & { json: boolean };
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

  const plan = plan_project_id_migration(args);

  if (!args.apply) {
    process.stdout.write(
      args.json ? JSON.stringify(plan, null, 2) + "\n" : format_plan(plan, false),
    );
    process.exit(plan.ambiguous.length > 0 ? 1 : 0);
  }

  const report = await apply_project_id_migration(plan, { prune_empty: args.prune_empty });
  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(format_plan(plan, report.applied));
    process.stdout.write(
      `\nMoved ${report.runs_moved} run(s), ${report.analysis_files_moved} published file(s), ` +
        `${report.configs_moved} config(s); rewrote ${report.plan_files_rewritten} plan file(s).\n`,
    );
    if (report.pruned_dirs.length > 0) {
      process.stdout.write(`Removed ${report.pruned_dirs.length} empty directory/directories.\n`);
    }
    for (const problem of report.blocked) process.stdout.write(`BLOCKED: ${problem}\n`);
  }
  process.exit(report.blocked.length > 0 ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}

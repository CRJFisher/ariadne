#!/usr/bin/env node
/**
 * Describe a machine's Ariadne data for transfer to another machine.
 *
 * The manifest is what makes a merge auditable rather than hopeful: it records
 * which projects and runs the bundle claims to carry, so the receiving machine
 * can check afterwards that every one of them arrived, and it records the commit
 * of the tools that wrote it, so a store written by a newer layout is not merged
 * by an older reader.
 *
 * It also owns the single definition of *what a bundle contains*. Triage data is
 * selected by cohort — the grouping `targets.yaml` gives the corpora — so a
 * bundle carries one cohort's verdicts rather than the whole store's. Selection
 * is by *canonical* project id, so a project still filed under a legacy id is
 * picked up by the cohort it actually belongs to.
 *
 * Everything else is an allow-list, not an exclude-list, because the two largest
 * things under `~/.ariadne` must never travel and an exclusion that silently
 * stopped matching would ship tens of gigabytes of them:
 *
 *   - `triage-entrypoints/repos/` — shallow clones at pinned commits, which
 *     `detect_entrypoints` re-creates from the recorded commit hash.
 *   - `cache/` — the derived per-corpus index, in directories named by a hash of
 *     the corpus's absolute path. On a machine with a different home directory
 *     it is not even addressable.
 *
 * `--print-payload` emits the resolved path list so the packaging step selects
 * exactly what the manifest describes, and the two cannot disagree.
 *
 * Usage:
 *   node --import tsx build_transfer_manifest.ts --out <dir> [--cohort <n>]...
 *                                                [--ariadne-dir <dir>]
 *   node --import tsx build_transfer_manifest.ts --print-payload [--cohort <n>]...
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { repo_root } from "@ariadnejs/skill-protocol";

import { check_triage_store, type StoreHealth } from "./check_triage_store.js";
import { read_target_cohorts } from "../src/target_cohorts.js";
import {
  canonical_id_from_project_path,
  identify_project,
} from "../src/store/project_identity.js";
import { TRIAGE_STATE_SUBDIR } from "../src/store/paths.js";
import {
  ANALYSIS_OUTPUT_SUBDIR,
  PROJECT_CONFIGS_SUBDIR,
  REPOS_SUBDIR,
  list_analysis_projects,
  list_state_projects,
  project_configs_root,
} from "../src/store/store_layout.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: build_transfer_manifest.ts --out <dir> [--cohort <n>]... [--ariadne-dir <dir>]\n" +
  "       build_transfer_manifest.ts --print-payload [--cohort <n>]... [--ariadne-dir <dir>]\n";

class UsageError extends Error {}

/** The store namespace under `~/.ariadne`, fixed independently of the skill name. */
const TRIAGE_DIR = "triage-entrypoints";

/**
 * Measurement subtrees a bundle carries, matched by top-level name prefix.
 *
 * These hold the performance work on indexing at vscode's scale — the one
 * cohort-2 target still out of reach — so they travel with the cohort's verdicts
 * rather than being stranded on the machine that recorded them. Prefix matching
 * is what keeps a date-stamped investigation directory from needing this list
 * edited each time one is opened.
 */
const MEASUREMENT_TREE_PREFIXES: readonly string[] = ["perf-investigation-", "benchmark-runs"];

/** Subtrees deliberately left behind, with the reason a reader will want. */
const EXCLUDED_TREES: ReadonlyArray<{ path: string; reason: string }> = [
  {
    path: path.join(TRIAGE_DIR, REPOS_SUBDIR),
    reason:
      "shallow clones at pinned commits; re-created by detect_entrypoints from each run's commit_hash",
  },
  {
    path: "cache",
    reason:
      "derived per-corpus index, in directories named by a hash of the corpus's absolute path; not addressable on a machine with a different home",
  },
  { path: "plan", reason: "the plan engine's task store, derived from cohort 1 and not carried" },
  { path: "skill-analysis", reason: "superseded analysis notes" },
  { path: "tmp", reason: "scratch space" },
];

export interface TreeSummary {
  path: string;
  files: number;
  bytes: number;
}

/** One project weighed against the cohort filter. */
export interface ProjectSelection {
  /** The directory name the project is stored under, which may be a legacy id. */
  store_project_id: string;
  canonical_project_id: string | null;
  cohort: number | null;
  included: boolean;
}

export interface TransferManifest {
  schema_version: 1;
  created_at: string;
  source: {
    host: string;
    user: string;
    platform: string;
    ariadne_dir: string;
  };
  toolchain: {
    repo_root: string;
    git_commit: string | null;
    git_branch: string | null;
    git_dirty: boolean;
  };
  selection: {
    /** Cohorts carried, or null when the bundle carries every project. */
    cohorts: number[] | null;
    included: ProjectSelection[];
    omitted: ProjectSelection[];
  };
  payload: TreeSummary[];
  excluded: Array<{ path: string; reason: string }>;
  store: {
    projects: number;
    runs: number;
    legacy_project_ids: number;
    ok: boolean;
    /** Every run the bundle claims, so the receiver can verify what landed. */
    inventory: Array<{ project_id: string; canonical_project_id: string | null; run_ids: string[] }>;
  };
  companions: {
    readme: string;
    store_health: string;
    checksums: string;
  };
}

// ===== Selection =====

/**
 * Weigh every project in the store against the cohort filter.
 *
 * The cohort is looked up by canonical id, never by the directory name, so a
 * project still filed under a legacy id is selected by the cohort it belongs to
 * rather than dropped for being unrecognized. A project whose canonical id
 * cannot be recovered has no cohort and is excluded whenever a filter is set —
 * it is litter or a corpus outside `repos/`, and neither belongs in a bundle.
 */
export function select_projects(
  store_dir: string,
  cohorts: ReadonlySet<number> | null,
): ProjectSelection[] {
  const cohort_by_project = read_target_cohorts();
  const project_ids = [
    ...new Set([...list_state_projects(store_dir), ...list_analysis_projects(store_dir)]),
  ].sort();

  return project_ids.map((store_project_id) => {
    const identity = identify_project(store_dir, store_project_id);
    const canonical_project_id = identity.canonical_project_id;
    const cohort =
      canonical_project_id === null ? null : cohort_by_project.get(canonical_project_id) ?? null;
    return {
      store_project_id,
      canonical_project_id,
      cohort,
      included: cohorts === null || (cohort !== null && cohorts.has(cohort)),
    };
  });
}

/** Config files belonging to the selected cohorts, keyed by their own filename. */
function selected_config_files(
  store_dir: string,
  cohorts: ReadonlySet<number> | null,
): string[] {
  const configs_dir = project_configs_root(store_dir);
  if (!fs.existsSync(configs_dir)) return [];
  if (cohorts === null) return fs.readdirSync(configs_dir).sort();

  const cohort_by_project = read_target_cohorts();
  const selected: string[] = [];

  for (const name of fs.readdirSync(configs_dir).sort()) {
    if (!name.endsWith(".json")) continue;
    let project_path: unknown;
    try {
      project_path = (
        JSON.parse(fs.readFileSync(path.join(configs_dir, name), "utf8")) as {
          project_path?: unknown;
        }
      ).project_path;
    } catch {
      continue;
    }
    if (typeof project_path !== "string") continue;
    const canonical = canonical_id_from_project_path(project_path);
    if (canonical === null) continue;
    const cohort = cohort_by_project.get(canonical);
    if (cohort !== undefined && cohorts.has(cohort)) selected.push(name);
  }
  return selected;
}

/**
 * Resolve the payload to concrete paths under the Ariadne data directory.
 *
 * With no cohort filter the triage trees travel whole; with one, each selected
 * project contributes its own state and output directories, so the archive
 * carries the chosen cohort and nothing else.
 */
export function resolve_payload_paths(
  ariadne_dir: string,
  cohorts: ReadonlySet<number> | null,
): string[] {
  const store_dir = path.join(ariadne_dir, TRIAGE_DIR);
  const resolved: string[] = [];

  if (fs.existsSync(store_dir)) {
    if (cohorts === null) {
      for (const subdir of [TRIAGE_STATE_SUBDIR, ANALYSIS_OUTPUT_SUBDIR]) {
        if (fs.existsSync(path.join(store_dir, subdir))) {
          resolved.push(path.join(TRIAGE_DIR, subdir));
        }
      }
    } else {
      for (const selection of select_projects(store_dir, cohorts)) {
        if (!selection.included) continue;
        for (const subdir of [TRIAGE_STATE_SUBDIR, ANALYSIS_OUTPUT_SUBDIR]) {
          const tree = path.join(TRIAGE_DIR, subdir, selection.store_project_id);
          if (fs.existsSync(path.join(ariadne_dir, tree))) resolved.push(tree);
        }
      }
    }

    for (const name of selected_config_files(store_dir, cohorts)) {
      resolved.push(path.join(TRIAGE_DIR, PROJECT_CONFIGS_SUBDIR, name));
    }
  }

  if (fs.existsSync(ariadne_dir)) {
    for (const entry of fs.readdirSync(ariadne_dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (MEASUREMENT_TREE_PREFIXES.some((prefix) => entry.name.startsWith(prefix))) {
        resolved.push(entry.name);
      }
    }
  }

  return [...new Set(resolved)].sort();
}

// ===== Manifest =====

function summarize_tree(ariadne_dir: string, relative_path: string): TreeSummary {
  const root = path.join(ariadne_dir, relative_path);
  if (fs.statSync(root).isFile()) {
    return { path: relative_path, files: 1, bytes: fs.statSync(root).size };
  }

  let files = 0;
  let bytes = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        files++;
        bytes += fs.statSync(full).size;
      }
    }
  }
  return { path: relative_path, files, bytes };
}

function git(repo: string, args: readonly string[]): string | null {
  try {
    return execFileSync("git", [...args], { cwd: repo, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

/** Narrow a whole-store health report to the projects the bundle carries. */
export function restrict_health_to_selection(
  health: StoreHealth,
  selections: readonly ProjectSelection[],
): StoreHealth {
  const included = new Set(
    selections.filter((s) => s.included).map((s) => s.store_project_id),
  );
  const projects = health.projects.filter((project) => included.has(project.project_id));
  return {
    store_dir: health.store_dir,
    projects,
    ok: projects.every(
      (project) =>
        project.problems.length === 0 && project.runs.every((run) => run.problems.length === 0),
    ),
  };
}

export function build_transfer_manifest(
  ariadne_dir: string,
  health: StoreHealth,
  selections: readonly ProjectSelection[],
  cohorts: ReadonlySet<number> | null,
): TransferManifest {
  const repo = repo_root();
  const included = selections.filter((selection) => selection.included);

  return {
    schema_version: 1,
    created_at: new Date().toISOString(),
    source: {
      host: os.hostname(),
      user: os.userInfo().username,
      platform: process.platform,
      ariadne_dir,
    },
    toolchain: {
      repo_root: repo,
      git_commit: git(repo, ["rev-parse", "HEAD"]),
      git_branch: git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]),
      git_dirty: (git(repo, ["status", "--porcelain"]) ?? "").length > 0,
    },
    selection: {
      cohorts: cohorts === null ? null : [...cohorts].sort((a, b) => a - b),
      included,
      omitted: selections.filter((selection) => !selection.included),
    },
    payload: resolve_payload_paths(ariadne_dir, cohorts).map((tree) =>
      summarize_tree(ariadne_dir, tree),
    ),
    excluded: EXCLUDED_TREES.filter((tree) => fs.existsSync(path.join(ariadne_dir, tree.path))).map(
      ({ path: tree_path, reason }) => ({ path: tree_path, reason }),
    ),
    store: {
      projects: health.projects.length,
      runs: health.projects.reduce((total, project) => total + project.runs.length, 0),
      legacy_project_ids: included.filter(
        (selection) => selection.canonical_project_id !== selection.store_project_id,
      ).length,
      ok: health.ok,
      inventory: health.projects.map((project) => ({
        project_id: project.project_id,
        canonical_project_id: project.identity.canonical_project_id,
        run_ids: project.runs.map((run) => run.run_id),
      })),
    },
    companions: {
      readme: "_transfer/README.md",
      store_health: "_transfer/store_health.json",
      checksums: "_transfer/SHA256SUMS",
    },
  };
}

// ===== CLI =====

interface CliArgs {
  ariadne_dir: string;
  out_dir: string | null;
  cohorts: Set<number> | null;
  print_payload: boolean;
}

function parse_argv(argv: readonly string[]): CliArgs {
  let ariadne_dir = path.join(os.homedir(), ".ariadne");
  let out_dir: string | null = null;
  let cohorts: Set<number> | null = null;
  let print_payload = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = (flag: string): string => {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) {
        throw new UsageError(`${flag} expects a value`);
      }
      return value;
    };
    switch (arg) {
      case "--ariadne-dir":
        ariadne_dir = path.resolve(take("--ariadne-dir"));
        break;
      case "--out":
        out_dir = path.resolve(take("--out"));
        break;
      case "--cohort": {
        const value = take("--cohort");
        if (value === "all") {
          cohorts = null;
          break;
        }
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) throw new UsageError("--cohort expects a number or \"all\"");
        cohorts = (cohorts ?? new Set<number>()).add(parsed);
        break;
      }
      case "--print-payload":
        print_payload = true;
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

  if (!print_payload && out_dir === null) {
    throw new UsageError("one of --out or --print-payload is required");
  }
  return { ariadne_dir, out_dir, cohorts, print_payload };
}

function main(): void {
  let args: CliArgs;
  try {
    args = parse_argv(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exit(2);
  }

  if (!fs.existsSync(args.ariadne_dir)) {
    process.stderr.write(`Error: Ariadne data directory not found: ${args.ariadne_dir}\n`);
    process.exit(2);
  }

  if (args.print_payload) {
    process.stdout.write(resolve_payload_paths(args.ariadne_dir, args.cohorts).join("\n") + "\n");
    return;
  }

  const store_dir = path.join(args.ariadne_dir, TRIAGE_DIR);
  const selections = select_projects(store_dir, args.cohorts);
  const health = restrict_health_to_selection(
    check_triage_store({ store_dir, deep: false }),
    selections,
  );

  const out_dir = args.out_dir as string;
  fs.mkdirSync(out_dir, { recursive: true });
  fs.writeFileSync(path.join(out_dir, "store_health.json"), JSON.stringify(health, null, 2) + "\n");
  fs.writeFileSync(
    path.join(out_dir, "MANIFEST.json"),
    JSON.stringify(
      build_transfer_manifest(args.ariadne_dir, health, selections, args.cohorts),
      null,
      2,
    ) + "\n",
  );

  const included = selections.filter((selection) => selection.included);
  const legacy = included.filter((s) => s.canonical_project_id !== s.store_project_id).length;
  process.stderr.write(
    `Manifest written to ${out_dir}: ${included.length} project(s) carried, ` +
      `${selections.length - included.length} omitted, ` +
      `${health.projects.reduce((n, p) => n + p.runs.length, 0)} run(s), ` +
      `${legacy} still on a legacy id.\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}

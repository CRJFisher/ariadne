/**
 * Discovery over per-run scratch state under `triage_state/<project>/runs/<run-id>/`.
 *
 * Lifecycle: these run dirs are deleted by `prune_runs.ts`. Read-only access
 * to the long-lived published artifacts (`analysis_output/.../triage_results/`)
 * lives in `triage_results_store.ts`.
 */

import * as fs from "node:fs/promises";

import { runs_dir_for } from "./paths.js";
import { manifest_path_for, run_dir_for, state_path_for } from "./paths.js";
import { RUN_MANIFEST_SCHEMA_VERSION, type RunManifest } from "../triage_state_types.js";

/**
 * Read a run's manifest. Throws when the manifest is missing, malformed, or
 * carries a schema version this pipeline doesn't recognise — silent partial
 * parsing of a future-shape manifest would be worse than failing loudly.
 */
export async function read_manifest(project: string, run_id: string): Promise<RunManifest> {
  const text = await fs.readFile(manifest_path_for(project, run_id), "utf-8");
  const manifest = JSON.parse(text) as RunManifest;
  if (manifest.schema_version !== RUN_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `Manifest at ${manifest_path_for(project, run_id)} has schema_version ${manifest.schema_version}; ` +
        `this pipeline understands schema_version ${RUN_MANIFEST_SCHEMA_VERSION}.`,
    );
  }
  return manifest;
}

/** Read a run's manifest. Returns null when missing or unreadable (no throw). */
export async function read_manifest_safe(
  project: string,
  run_id: string,
): Promise<RunManifest | null> {
  try {
    return await read_manifest(project, run_id);
  } catch {
    return null;
  }
}

export interface RunSummary {
  run_id: string;
  run_dir: string;
  manifest: RunManifest | null;
}

/**
 * Enumerate every run directory for `project`. Each entry includes the parsed
 * manifest when present; runs whose manifest is unreadable still appear with
 * `manifest: null` so callers can decide how to handle abandoned/legacy runs.
 *
 * Sorted by `run_id` ascending (lex), which clusters by short-commit prefix
 * and then by ISO timestamp within a commit.
 */
export async function list_runs(project: string): Promise<RunSummary[]> {
  const runs_dir = runs_dir_for(project);
  let entries: string[];
  try {
    const dirents = await fs.readdir(runs_dir, { withFileTypes: true });
    entries = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }

  entries.sort();

  const out: RunSummary[] = [];
  for (const run_id of entries) {
    out.push({
      run_id,
      run_dir: run_dir_for(project, run_id),
      manifest: await read_manifest_safe(project, run_id),
    });
  }
  return out;
}

export interface ActiveRun {
  run_id: string;
  /** Short commit the run was prepared at; null for a non-git target. */
  short_commit: string | null;
  /**
   * Whether the run owns a `triage.json`. False for a run interrupted between
   * its manifest write and its state write: it holds the project but has no
   * entries, so abandoning is its only exit.
   */
  resumable: boolean;
}

/**
 * Runs for `project` whose manifest still reads `status: "active"` — neither
 * finalized nor abandoned, and so still owning the project's LATEST pointer.
 *
 * The commit travels with each run because it is what makes the caller's
 * choice decidable: continuing a run prepared at a commit that is no longer
 * HEAD publishes results describing code that has moved on.
 *
 * A run whose manifest is unreadable counts as inactive: its status is
 * unknowable, and treating corruption as a live run would refuse the project
 * on the strength of a file nothing can interpret.
 */
export async function find_active_runs(project: string): Promise<ActiveRun[]> {
  const summaries = await list_runs(project);
  const active = summaries.filter((s) => s.manifest?.status === "active");

  return Promise.all(
    active.map(async (s) => ({
      run_id: s.run_id,
      short_commit: s.manifest?.commit_hash?.slice(0, 7) ?? null,
      resumable: await fs
        .access(state_path_for(project, s.run_id))
        .then(() => true)
        .catch(() => false),
    })),
  );
}

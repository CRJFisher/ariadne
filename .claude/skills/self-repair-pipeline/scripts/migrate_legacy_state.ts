#!/usr/bin/env node --import tsx
/**
 * Migrate pre-run-namespaced triage state to the new layout, optionally.
 *
 * Old layout (legacy):
 *   triage_state/<project>/<project>_triage.json
 *   triage_state/<project>/results/
 *   triage_state/<project>/aggregation/
 *
 * New layout:
 *   triage_state/<project>/runs/<run-id>/{triage.json, manifest.json, results/, aggregation/}
 *
 * This script wraps the legacy files into a synthetic
 * `runs/legacy-<iso-ts>/` directory with `manifest.status="abandoned"`. It
 * does NOT set `LATEST` — legacy state is treated as historical.
 *
 * Usage:
 *   node --import tsx migrate_legacy_state.ts --project <name> [--purge]
 *
 * `--purge` deletes legacy files instead of wrapping them.
 */

import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import path from "path";

import { TRIAGE_STATE_DIR } from "../src/paths.js";
import { parse_project_arg } from "../src/cli_args.js";
import {
  manifest_path_for,
  run_dir_for,
  state_path_for,
} from "../src/triage_state_paths.js";
import {
  RUN_MANIFEST_SCHEMA_VERSION,
  type RunManifest,
  type TriageState,
} from "../src/triage_state_types.js";
import "../src/guard_tsx_invocation.js";

const USAGE = "Usage: migrate_legacy_state.ts --project <name> [--purge]";

interface LegacyState {
  legacy_state_file: string | null;
  legacy_results_dir: string | null;
  legacy_aggregation_dir: string | null;
}

function detect_legacy(project: string): LegacyState {
  const project_dir = path.join(TRIAGE_STATE_DIR, project);
  if (!fsSync.existsSync(project_dir)) {
    return { legacy_state_file: null, legacy_results_dir: null, legacy_aggregation_dir: null };
  }
  const legacy_state = path.join(project_dir, `${project}_triage.json`);
  const legacy_results = path.join(project_dir, "results");
  const legacy_aggregation = path.join(project_dir, "aggregation");
  return {
    legacy_state_file: fsSync.existsSync(legacy_state) ? legacy_state : null,
    legacy_results_dir: fsSync.existsSync(legacy_results) ? legacy_results : null,
    legacy_aggregation_dir: fsSync.existsSync(legacy_aggregation) ? legacy_aggregation : null,
  };
}

async function main(): Promise<void> {
  const project = parse_project_arg(process.argv, USAGE);
  const purge = process.argv.slice(2).includes("--purge");

  const legacy = detect_legacy(project);
  if (
    legacy.legacy_state_file === null &&
    legacy.legacy_results_dir === null &&
    legacy.legacy_aggregation_dir === null
  ) {
    process.stderr.write(`No legacy state for project "${project}". Nothing to do.\n`);
    return;
  }

  if (purge) {
    if (legacy.legacy_state_file !== null) await fs.rm(legacy.legacy_state_file);
    if (legacy.legacy_results_dir !== null)
      await fs.rm(legacy.legacy_results_dir, { recursive: true });
    if (legacy.legacy_aggregation_dir !== null)
      await fs.rm(legacy.legacy_aggregation_dir, { recursive: true });
    process.stderr.write(`Purged legacy state for "${project}".\n`);
    process.stdout.write(JSON.stringify({ project, action: "purge" }) + "\n");
    return;
  }

  // Read project_path off the legacy state file BEFORE renaming. Falls back
  // to the empty string only when the legacy file is unreadable — better to
  // record the truth than to write a sentinel.
  let project_path = "";
  if (legacy.legacy_state_file !== null) {
    try {
      const legacy_text = await fs.readFile(legacy.legacy_state_file, "utf8");
      const legacy_state = JSON.parse(legacy_text) as Partial<TriageState>;
      if (typeof legacy_state.project_path === "string") {
        project_path = legacy_state.project_path;
      }
    } catch {
      // Unreadable legacy file — proceed with empty project_path.
    }
  }

  const ts = new Date().toISOString().replace(/:/g, "-");
  const run_id = `legacy-${ts}`;
  const run_dir = run_dir_for(project, run_id);
  await fs.mkdir(run_dir, { recursive: true });

  if (legacy.legacy_state_file !== null) {
    await fs.rename(legacy.legacy_state_file, state_path_for(project, run_id));
  }
  if (legacy.legacy_results_dir !== null) {
    await fs.rename(legacy.legacy_results_dir, path.join(run_dir, "results"));
  }
  if (legacy.legacy_aggregation_dir !== null) {
    await fs.rename(legacy.legacy_aggregation_dir, path.join(run_dir, "aggregation"));
  }

  const now = new Date().toISOString();
  const manifest: RunManifest = {
    schema_version: RUN_MANIFEST_SCHEMA_VERSION,
    run_id,
    project_name: project,
    project_path,
    created_at: now,
    finalized_at: null,
    status: "abandoned",
    source_analysis_path: "",
    source_analysis_run_id: "",
    max_count: 0,
    commit_hash: null,
    tp_cache: { enabled: false, source_run_id: null, skipped_count: 0, skipped_entry_keys: [] },
  };
  await fs.writeFile(manifest_path_for(project, run_id), JSON.stringify(manifest, null, 2) + "\n");

  process.stderr.write(`Migrated legacy state for "${project}" to ${run_dir}.\n`);
  process.stdout.write(JSON.stringify({ project, action: "migrate", run_id, run_dir }) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

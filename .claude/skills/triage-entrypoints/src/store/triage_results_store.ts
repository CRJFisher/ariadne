/**
 * Read-only access to the published triage_results store.
 *
 * Layout: `analysis_output/<project>/triage_results/<run-id>.json`. These
 * files are kept forever (small, KB-scale) and are the source of truth for
 * cross-run consumers — the TP cache, `diff_runs`, and the triage-curator
 * skill. They survive `prune_runs`, which only deletes per-run scratch state
 * under `triage_state/<project>/runs/<run-id>/`.
 *
 * This module owns the shape and lookup of the published store. Run-state
 * discovery (manifests, active runs) lives in `run_discovery.ts` instead.
 */

import * as fs from "node:fs/promises";
import path from "path";

import { ANALYSIS_OUTPUT_DIR } from "./paths.js";
import {
  FINALIZATION_OUTPUT_SCHEMA_VERSION,
  type FinalizationOutput,
} from "../finalize/output.js";

/**
 * Single chokepoint for parsing a published `triage_results/<run-id>.json`.
 * Rejects any file whose `schema_version` does not match the current version
 * — legacy files age out naturally per the persisted-state policy in
 * `SKILL.md` (do not `rm -rf analysis_output/`).
 */
function parse_finalization_output(
  source_label: string,
  text: string,
): FinalizationOutput {
  const parsed = JSON.parse(text) as Partial<FinalizationOutput>;
  if (parsed.schema_version !== FINALIZATION_OUTPUT_SCHEMA_VERSION) {
    throw new Error(
      `${source_label}: schema_version=${String(parsed.schema_version)} does not match ` +
        `current ${FINALIZATION_OUTPUT_SCHEMA_VERSION}. Re-finalize the run or remove the stale file.`,
    );
  }
  return parsed as FinalizationOutput;
}

/** Path to a project's triage_results directory. Existence is not checked. */
export function triage_results_dir_for(project: string): string {
  return path.join(ANALYSIS_OUTPUT_DIR, project, "triage_results");
}

/**
 * Find the most-recent published `triage_results/<run-id>.json` whose run-id
 * has the given `<short-commit>-` prefix. Returns the parsed output along
 * with the run-id; returns `null` when no matching artifact exists.
 *
 * "Most recent" = lex-max of run-id within the matching commit (ISO timestamp
 * suffix gives chronological order within a commit).
 */
export async function most_recent_finalized_triage_results(
  project: string,
  short_commit: string,
): Promise<{ run_id: string; output: FinalizationOutput } | null> {
  const dir = triage_results_dir_for(project);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return null;
  }

  const prefix = `${short_commit}-`;
  const matching = files.filter((f) => f.startsWith(prefix) && f.endsWith(".json"));
  if (matching.length === 0) return null;

  matching.sort();
  const winner = matching[matching.length - 1];
  const winner_path = path.join(dir, winner);
  const text = await fs.readFile(winner_path, "utf-8");
  const output = parse_finalization_output(winner_path, text);
  return { run_id: winner.slice(0, -".json".length), output };
}

/**
 * Read a specific published triage_results file by run-id. Throws on missing.
 */
export async function read_triage_results(
  project: string,
  run_id: string,
): Promise<FinalizationOutput> {
  const file = path.join(triage_results_dir_for(project), `${run_id}.json`);
  const text = await fs.readFile(file, "utf-8");
  return parse_finalization_output(file, text);
}

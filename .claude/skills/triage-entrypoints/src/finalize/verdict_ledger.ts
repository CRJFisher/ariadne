/**
 * Per-entry verdict ledger: shared I/O over `results/<entry_index>.json` files.
 *
 * The triage dispatcher's per-entry investigator writes its verdict to
 * `triage_state/<project>/runs/<run-id>/results/<entry_index>.json`. Two
 * consumers read this ledger:
 *
 * - `merge_results.ts` — flips state entries to `completed`/`failed` based on
 *   the verdict files' presence + parseability.
 * - `finalize/output.ts` (via its `finalize_triage.ts` orchestrator) — re-reads
 *   the verdicts when building the published `triage_results/<run-id>.json`.
 *
 * Both call into this module so the absorb-time and finalize-time gates can
 * never diverge again.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parse_triage_verdict, type TriageVerdict } from "../verdict/triage_verdict.js";

/**
 * Strict non-negative-integer filename: rejects `-3.json`, `01.json`,
 * `5.5.json`, ` 5.json`, `5.json.bak`, and any other shape outside the
 * dispatcher's `<entry_index>.json` contract.
 */
export const VERDICT_FILE_BASENAME = /^(0|[1-9]\d*)$/;

export interface VerdictFileRef {
  entry_index: number;
  file_path: string;
}

/**
 * List the verdict files under `results_dir` whose basename matches the
 * strict `<entry_index>.json` contract. Returns an empty array when the
 * directory does not exist.
 */
export async function list_verdict_files(
  results_dir: string,
): Promise<VerdictFileRef[]> {
  let files: string[];
  try {
    files = await fs.readdir(results_dir);
  } catch (err) {
    if (is_enoent(err)) return [];
    throw err;
  }
  const out: VerdictFileRef[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const basename = file.slice(0, -".json".length);
    if (!VERDICT_FILE_BASENAME.test(basename)) continue;
    out.push({
      entry_index: Number.parseInt(basename, 10),
      file_path: path.join(results_dir, file),
    });
  }
  return out;
}

/** Read and strictly parse a single verdict file. Throws with a clear context message on failure. */
export async function read_verdict_file(file_path: string): Promise<TriageVerdict> {
  const raw = await fs.readFile(file_path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${file_path}: invalid JSON — ${message}`);
  }
  return parse_triage_verdict(parsed);
}

/**
 * Load every per-entry verdict in `results_dir` keyed by `entry_index`.
 * Aborts on the first malformed file so a finalize never silently drops verdicts.
 */
export async function load_verdicts_by_entry_index(
  results_dir: string,
): Promise<Map<number, TriageVerdict>> {
  const out = new Map<number, TriageVerdict>();
  for (const { entry_index, file_path } of await list_verdict_files(results_dir)) {
    out.set(entry_index, await read_verdict_file(file_path));
  }
  return out;
}

function is_enoent(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if (!("code" in err)) return false;
  return (err as { code: unknown }).code === "ENOENT";
}

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { error_code } from "./errors.js";
import { run_output_dir } from "./paths.js";
import type { CuratedRunEntry } from "./types.js";

/**
 * Presence of `runs/<id>/finalized.json` is the sole signal that a run has
 * been curated. scan_runs uses this to skip re-curating; finalize writes it
 * at the end. No rolled-up state.json.
 */

function sentinel_path(run_id: string): string {
  return path.join(run_output_dir(run_id), "finalized.json");
}

export async function is_curated(run_id: string): Promise<boolean> {
  try {
    await fs.access(sentinel_path(run_id));
    return true;
  } catch (err) {
    if (error_code(err) === "ENOENT") return false;
    throw err;
  }
}

export async function save_outcome(entry: CuratedRunEntry): Promise<void> {
  const out = sentinel_path(entry.run_id);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(entry, null, 2) + "\n", "utf8");
}

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { error_code } from "./errors.js";
import { CURATOR_STATE_DIR, CURATOR_STATE_FILE } from "./paths.js";
import type { CuratedRunEntry, CuratorState } from "./types.js";

export async function load_state(file_path: string = CURATOR_STATE_FILE): Promise<CuratorState> {
  try {
    const raw = await fs.readFile(file_path, "utf8");
    const parsed = JSON.parse(raw) as CuratorState;
    return parsed;
  } catch (err) {
    if (error_code(err) === "ENOENT") {
      return { curated_runs: [] };
    }
    throw err;
  }
}

export async function save_state(
  state: CuratorState,
  file_path: string = CURATOR_STATE_FILE,
): Promise<void> {
  const dir = path.dirname(file_path);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file_path, JSON.stringify(state, null, 2) + "\n", "utf8");
}

export function is_curated(state: CuratorState, run_id: string): boolean {
  return state.curated_runs.some((e) => e.run_id === run_id);
}

export function upsert_curated_run(state: CuratorState, entry: CuratedRunEntry): CuratorState {
  const others = state.curated_runs.filter((e) => e.run_id !== entry.run_id);
  return { curated_runs: [...others, entry] };
}

export function get_curated_run(
  state: CuratorState,
  run_id: string,
): CuratedRunEntry | null {
  return state.curated_runs.find((e) => e.run_id === run_id) ?? null;
}

/** Exported for paths.ts consumers that want the default location. */
export { CURATOR_STATE_DIR, CURATOR_STATE_FILE };

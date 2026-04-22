import * as fs from "node:fs/promises";

import type { KnownIssue } from "./types.js";

/**
 * Return `{ group_id → examples.length }` for every wip registry entry.
 * Drives the `--reinvestigate` comparison in `scan_runs`.
 */
export async function compute_wip_group_counts(
  registry_path: string,
): Promise<Record<string, number>> {
  const raw = await fs.readFile(registry_path, "utf8");
  const registry = JSON.parse(raw) as KnownIssue[];
  const counts: Record<string, number> = {};
  for (const entry of registry) {
    if (entry.status !== "wip") continue;
    counts[entry.group_id] = entry.examples.length;
  }
  return counts;
}

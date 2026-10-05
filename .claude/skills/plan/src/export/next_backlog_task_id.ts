/**
 * Mint the next top-level backlog task id by scanning the user's `backlog/` tree
 * — the same scan-based allocation `backlog.md` itself uses, so a directly
 * written task id never collides with one the tracker would later assign.
 *
 * The scan is recursive across the WHOLE tree (`tasks/`, `archive/`,
 * `completed/`, `drafts/`, and their nested sub-dirs), because an id retired
 * into `archive/`/`completed/` can exceed the max id still live under `tasks/`;
 * scanning only the write target would risk reusing it. Read-only (`readdir`
 * only) — this is not a backlog writer.
 */

import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import * as path from "node:path";

import { error_code } from "@ariadnejs/skill-fs";

/** The leading integer of a `task-<N>…` filename (`task-190.22.10` → 190), or `null`. */
const TOP_LEVEL_ID = /^task-(\d+)/;

export function parse_backlog_top_level_id(filename: string): number | null {
  const match = TOP_LEVEL_ID.exec(filename);
  if (match === null) return null;
  return Number.parseInt(match[1], 10);
}

/**
 * The next free top-level backlog id = (max `task-<N>` across the tree) + 1.
 * An absent root (or absent sub-dir) contributes nothing rather than throwing —
 * an empty/sparse backlog yields `1`.
 */
export async function next_backlog_task_id(backlog_root: string): Promise<number> {
  let max = 0;
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (error_code(err) === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const id = parse_backlog_top_level_id(entry.name);
      if (id !== null && id > max) max = id;
    }
  }
  await walk(backlog_root);
  return max + 1;
}

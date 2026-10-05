/**
 * LATEST pointer I/O.
 *
 * Each project keeps a `LATEST` file at `triage_state/<project>/LATEST`
 * recording the active run-id. Sync I/O so CLI scripts can read/write it
 * without an async transition.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";

import { latest_pointer_for, project_state_dir } from "./paths.js";

/** Read the LATEST pointer for a project. Returns null when the pointer is absent. */
export function read_latest_run_id(project: string): string | null {
  const ptr = latest_pointer_for(project);
  if (!fs.existsSync(ptr)) return null;
  const text = fs.readFileSync(ptr, "utf8").trim();
  return text.length > 0 ? text : null;
}

/** Atomically write the LATEST pointer (write `.tmp.<rand>` + rename). */
export function write_latest_run_id(project: string, run_id: string): void {
  const dir = project_state_dir(project);
  fs.mkdirSync(dir, { recursive: true });
  const final_path = latest_pointer_for(project);
  const tmp_path = `${final_path}.tmp.${crypto.randomBytes(4).toString("hex")}`;
  fs.writeFileSync(tmp_path, run_id + "\n", "utf8");
  fs.renameSync(tmp_path, final_path);
}

/** Remove the LATEST pointer if present. No-op when already absent. */
export function clear_latest(project: string): void {
  const ptr = latest_pointer_for(project);
  if (fs.existsSync(ptr)) fs.unlinkSync(ptr);
}

/**
 * Discover the active triage state file in triage_state/.
 *
 * Shared by the stop hook and get_entry_context.ts so both
 * can locate the state file without hardcoded paths.
 */

import fs from "fs";
import path from "path";

/**
 * Find a triage state file (*_triage.json) in the given directory.
 */
export function discover_state_file(triage_dir: string): string | null {
  if (!fs.existsSync(triage_dir)) return null;
  const files = fs.readdirSync(triage_dir).filter((f) => f.endsWith("_triage.json"));
  if (files.length === 0) return null;
  return path.join(triage_dir, files[0]);
}

/**
 * Resolve the triage_state directory from the project root.
 */
export function get_triage_dir(project_dir: string): string {
  return path.join(project_dir, ".claude", "skills", "self-repair-pipeline", "triage_state");
}

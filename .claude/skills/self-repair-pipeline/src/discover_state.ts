/**
 * Discover the active triage state file and resolve pipeline data directories.
 *
 * Shared by the stop hook, get_entry_context.ts, and caller scripts so all
 * can locate state/data paths without hardcoded paths.
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

/** Pipeline data directory for mutable outputs. Outside .claude/skills/ to avoid sandbox restrictions. */
export function get_data_dir(project_dir: string): string {
  return path.join(project_dir, ".claude", "self-repair-pipeline-state");
}

/**
 * Resolve the triage directory from the project root.
 */
export function get_triage_dir(project_dir: string): string {
  return path.join(get_data_dir(project_dir), "triage");
}

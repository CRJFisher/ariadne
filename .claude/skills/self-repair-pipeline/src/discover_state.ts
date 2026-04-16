/**
 * Discover the active triage state file in triage_state/.
 *
 * State files live in project subdirectories:
 *   triage_state/{project_name}/{project_name}_triage.json
 *
 * Shared by scripts that need to locate the state file without a hardcoded path.
 */

import fs from "fs";
import path from "path";

/**
 * Find a triage state file (*_triage.json) in a project subdirectory of triage_dir.
 */
export function discover_state_file(triage_dir: string): string | null {
  if (!fs.existsSync(triage_dir)) return null;
  const entries = fs.readdirSync(triage_dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const project_dir = path.join(triage_dir, entry.name);
    const files = fs.readdirSync(project_dir).filter((f) => f.endsWith("_triage.json"));
    if (files.length > 0) {
      return path.join(project_dir, files[0]);
    }
  }
  return null;
}

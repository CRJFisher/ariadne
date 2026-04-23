/**
 * Triage state file locations and shared CLI helpers.
 *
 * Layout: triage_state/{project}/{project}_triage.json
 *
 * Each call to a state-reading script names its project explicitly via
 * `--project <name>`. No shared "active project" pointer — pipelines for
 * different projects run in parallel against the same triage_state dir.
 */

import fs from "fs";
import path from "path";
import { TRIAGE_STATE_DIR } from "./paths.js";

/** Deterministic path to a project's triage state file. Existence is not checked. */
export function state_path_for(triage_dir: string, project: string): string {
  return path.join(triage_dir, project, `${project}_triage.json`);
}

/** List project subdirectories that contain a `*_triage.json` file. */
export function list_projects_with_state(triage_dir: string): string[] {
  if (!fs.existsSync(triage_dir)) return [];
  const entries = fs.readdirSync(triage_dir, { withFileTypes: true });
  const projects: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const project_dir = path.join(triage_dir, entry.name);
    const files = fs.readdirSync(project_dir).filter((f) => f.endsWith("_triage.json"));
    if (files.length > 0) projects.push(entry.name);
  }
  return projects;
}

/**
 * Resolve the state file for `project` or exit(1) with an actionable error.
 * The six state-reading scripts all need a non-nullable path.
 */
export function require_state_file(project: string): string {
  const expected = state_path_for(TRIAGE_STATE_DIR, project);
  if (fs.existsSync(expected)) return expected;

  const other = list_projects_with_state(TRIAGE_STATE_DIR).filter((p) => p !== project);
  const lines = [`Error: no triage state for project "${project}" at ${expected}. Run prepare_triage.ts first.`];
  if (other.length > 0) {
    lines.push(`Projects with existing state: ${other.join(", ")}`);
  }
  process.stderr.write(lines.join("\n") + "\n");
  process.exit(1);
}

/**
 * Extract the required `--project <name>` from argv, or exit(1) with the usage string.
 * Consolidates the identical parse loop repeated across every state-reading script.
 */
export function parse_project_arg(argv: readonly string[], usage: string): string {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project") {
      const value = args[i + 1];
      if (value !== undefined && value.length > 0) return value;
    }
  }
  process.stderr.write(`${usage}\n`);
  process.exit(1);
}

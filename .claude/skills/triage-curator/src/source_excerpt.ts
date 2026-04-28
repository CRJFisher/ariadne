import * as fs from "node:fs/promises";
import * as path from "node:path";

import { error_code } from "./errors.js";

/**
 * How many QA members the sonnet sub-agent sees per group. The promotion
 * threshold in promote_to_investigate.ts uses this as its denominator.
 */
export const SAMPLE_SIZE = 10;

const EXCERPT_LINES_BEFORE = 2;
const EXCERPT_LINES_AFTER = 8;

/**
 * Read a small window of source lines around `start_line`, prefixed with
 * 1-based line numbers. Returns a placeholder when the file has moved or been
 * deleted since the triage run.
 *
 * `file_path` is treated as relative to `project_path` when `project_path` is
 * provided (schema v2 published runs); absolute paths and pre-v2 calls (no
 * project_path) are read directly.
 */
export async function read_source_excerpt(
  file_path: string,
  start_line: number,
  project_path?: string,
): Promise<string> {
  const resolved = resolve_excerpt_path(file_path, project_path);
  try {
    const raw = await fs.readFile(resolved, "utf8");
    const lines = raw.split(/\r?\n/);
    const from = Math.max(0, start_line - 1 - EXCERPT_LINES_BEFORE);
    const to = Math.min(lines.length, start_line - 1 + EXCERPT_LINES_AFTER + 1);
    return lines
      .slice(from, to)
      .map((line, idx) => `${from + idx + 1}: ${line}`)
      .join("\n");
  } catch (err) {
    if (error_code(err) === "ENOENT") return "<file not found>";
    throw err;
  }
}

function resolve_excerpt_path(file_path: string, project_path: string | undefined): string {
  if (path.isAbsolute(file_path)) return file_path;
  if (project_path !== undefined && project_path.length > 0) {
    return path.resolve(project_path, file_path);
  }
  return file_path;
}

import * as fs from "node:fs/promises";

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
 */
export async function read_source_excerpt(
  file_path: string,
  start_line: number,
): Promise<string> {
  try {
    const raw = await fs.readFile(file_path, "utf8");
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

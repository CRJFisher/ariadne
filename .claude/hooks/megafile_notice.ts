#!/usr/bin/env npx tsx
/**
 * PostToolUse hook: after a Write/Edit to a source file, reframe excessive size
 * as name-accuracy.
 *
 * The dead-code catalog marks lines-of-code a warning signal, never a gate, so
 * this hook only ever injects `additionalContext` — a name that is no longer
 * fully true is the concern, not the line count itself. A Stop-level block would
 * punish work-in-progress, so there is no block path here.
 *
 * There is deliberately no per-session dedup (unlike the marshaller nudge): the
 * notice is cheap, and a file's size changes on every edit, so re-emitting on
 * each write over the threshold is a fresh, accurate signal rather than noise.
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { parse_stdin, get_project_dir } from "./utils.js";

// Above this many significant (non-blank, non-comment) lines, a file is likely
// hosting more than one concern; ~500 is the catalog's warning threshold.
export const MEGAFILE_THRESHOLD = 500;

export interface PostToolUseContextOutput {
  hookSpecificOutput: {
    hookEventName: "PostToolUse";
    additionalContext: string;
  };
}

/**
 * Count lines carrying code — blank lines and lines wholly inside `//` or
 * `/* *\/` comments do not count, while a line mixing code and a trailing
 * comment does. Comment markers inside `'`, `"`, or backtick string literals are
 * treated as string content, not comments. Regex-literal delimiters are NOT
 * tokenized, so a `/*` inside a regex still opens a comment scan; that
 * under-counts, which is the safe direction for a non-gating warning.
 */
export function count_significant_lines(content: string): number {
  let in_block = false;
  let in_template = false;
  let count = 0;

  for (const raw of content.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    let code = "";
    let quote: "'" | "\"" | null = null;
    let i = 0;

    while (i < line.length) {
      const c = line[i];
      const c2 = line[i + 1];

      if (in_block) {
        if (c === "*" && c2 === "/") { in_block = false; i += 2; } else { i += 1; }
        continue;
      }
      if (in_template) {
        if (c === "\\") { code += c + (c2 ?? ""); i += 2; continue; }
        if (c === "`") { in_template = false; }
        code += c;
        i += 1;
        continue;
      }
      if (quote) {
        if (c === "\\") { code += c + (c2 ?? ""); i += 2; continue; }
        if (c === quote) { quote = null; }
        code += c;
        i += 1;
        continue;
      }

      if (c === "/" && c2 === "/") break;
      if (c === "/" && c2 === "*") { in_block = true; i += 2; continue; }
      if (c === "'" || c === "\"") { quote = c; code += c; i += 1; continue; }
      if (c === "`") { in_template = true; code += c; i += 1; continue; }

      code += c;
      i += 1;
    }

    if (code.trim().length > 0) count++;
  }

  return count;
}

/**
 * Whether a written path is a hand-authored package source file. Tests and
 * generated classifier builtins are exempt — they earn their length legitimately.
 */
export function is_megafile_candidate(relative_path: string): boolean {
  const normalized = relative_path.split(path.sep).join("/");
  const parts = normalized.split("/");

  if (parts[0] !== "packages" || parts[2] !== "src") return false;
  if (!normalized.endsWith(".ts")) return false;
  if (normalized.endsWith(".test.ts")) return false;
  if (normalized.includes("classify_entry_points/builtins/")) return false;

  return true;
}

/**
 * The name-accuracy notice for a written file that now exceeds the threshold,
 * else null (wrong location, or under the threshold).
 */
export function compute_megafile_notice(file_path: string, project_dir: string): string | null {
  const relative = path.relative(project_dir, file_path);
  if (!is_megafile_candidate(relative)) return null;

  let content: string;
  try {
    content = fs.readFileSync(file_path, "utf8");
  } catch {
    return null;
  }

  const lines = count_significant_lines(content);
  if (lines <= MEGAFILE_THRESHOLD) return null;

  const basename = path.basename(file_path);
  return (
    `\`${relative}\` is now ${lines} significant lines. ` +
    `A file's name must be fully true: check \`${basename}\` still describes everything the file holds. ` +
    `If it now hosts multiple concerns, split it into precisely-named leaves. ` +
    `Guidance, not a block.`
  );
}

/** Wrap the notice as PostToolUse additionalContext — never a block decision. */
export function megafile_context_output(notice: string): PostToolUseContextOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: notice,
    },
  };
}

function main(): void {
  const input = parse_stdin();
  if (!input) return;

  const tool_name = input.tool_name as string;
  if (!["Write", "Edit"].includes(tool_name)) return;

  const tool_input = input.tool_input as Record<string, unknown> | undefined;
  const file_path = tool_input?.file_path as string | undefined;
  if (!file_path) return;

  const notice = compute_megafile_notice(file_path, get_project_dir(input));
  if (!notice) return;

  console.log(JSON.stringify(megafile_context_output(notice)));
}

// Run only when executed as the hook entry, not when a test imports this module
// (main() reads stdin, which would block a test worker on fd 0).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

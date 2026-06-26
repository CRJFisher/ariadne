/**
 * Read-only backlog dedup signal — the engine's one window into the user's
 * `backlog/`. Reconcile reads it to recognise work the user has ALREADY
 * promoted out of the task-DB so it stops re-proposing it (the task moves to
 * `status: "exported"`).
 *
 * The match is a STRUCTURED FRONTMATTER LINK, not a fuzzy text scan: a promoted
 * backlog task carries a `plan_dedup_keys` frontmatter list — the verbatim
 * `PlanTask.dedup_key` of every source group it was promoted from (one for an
 * ordinary epic, several for a consolidated cluster). The user-invoked export
 * adapter (the sole backlog writer) stamps it; this reader maps every entry back
 * to the task. A backlog task without the field is invisible here (it is
 * human-authored work the engine has no DB lineage for).
 *
 * This module is strictly read-only against `backlog/` — `readdir` + `readFile`
 * only, no write primitive, no `mcp__backlog__*` tool. It reads the user's
 * backlog to avoid re-proposing work already tracked there; it never writes it.
 */

import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";

import { error_code } from "@ariadnejs/skill-fs";

/** Pull the leading `---\n…\n---` frontmatter block, or `null` when absent. */
function frontmatter_block(text: string): string | null {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  return match === null ? null : match[1];
}

/** Read one scalar frontmatter field, trimming surrounding quotes; `null` if absent. */
function scalar_field(block: string, field: string): string | null {
  const re = new RegExp(`^${field}:\\s*(.+)$`, "m");
  const match = block.match(re);
  if (match === null) return null;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

/** Read a YAML block-sequence field (`field:\n  - a\n  - b`) as a string list; `[]` if absent. */
function list_field(block: string, field: string): string[] {
  const re = new RegExp(`^${field}:[ \\t]*\\n((?:[ \\t]*-[ \\t]*.+\\n?)+)`, "m");
  const match = block.match(re);
  if (match === null) return [];
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .map((line) => line.replace(/^-[ \t]*/, "").replace(/^["']|["']$/g, ""));
}

/**
 * Map every promoted backlog task's `plan_dedup_keys` entries → its backlog task
 * `id`, read from `*.md` frontmatter under `backlog_dir`. A file contributes only
 * when it carries BOTH `id` and a non-empty `plan_dedup_keys` (a key with no
 * owning task id is unusable); every key in the list maps to the one owning task,
 * so a consolidated epic's many source groups all resolve back to it. A missing
 * directory, a non-`.md` entry, or a file with no frontmatter is skipped — never a
 * throw: an absent or sparse backlog is the normal early state, not corruption.
 */
export async function read_exported_backlog_keys(
  backlog_dir: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let files: string[];
  try {
    files = await readdir(backlog_dir);
  } catch (err) {
    if (error_code(err) === "ENOENT") return out;
    throw err;
  }
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    // Normalize CRLF so a backlog task saved with Windows line endings still parses.
    const text = (await readFile(path.join(backlog_dir, file), "utf8")).replace(/\r\n/g, "\n");
    const block = frontmatter_block(text);
    if (block === null) continue;
    const dedup_keys = list_field(block, "plan_dedup_keys");
    const id = scalar_field(block, "id");
    if (dedup_keys.length === 0 || id === null) continue;
    for (const dedup_key of dedup_keys) out.set(dedup_key, id);
  }
  return out;
}

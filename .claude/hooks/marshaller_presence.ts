/**
 * Marshaller-presence nudge for the file-naming PreToolUse hook.
 *
 * A folder that grows language variants ({feature}.{language}.ts) needs an
 * in-folder {feature}.ts marshaller owning the dispatch switch. Static naming
 * rules cannot time that advice — it only lands the moment the FIRST variant
 * appears without its marshaller. This module computes that one-shot nudge as
 * `additionalContext` (never a block), kept isolated from file_naming.ts's
 * block logic so the encourage path and the enforce path never entangle.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { createHash } from "crypto";
import { LANGUAGES } from "./file_naming.js";

// Per-session dedup markers live here so repeated variant writes in one folder
// inject the reminder once, not once per file.
const NUDGE_STATE_DIR = path.join(os.tmpdir(), "ariadne-marshaller-nudges");

export interface PreToolUseContextOutput {
  hookSpecificOutput: {
    hookEventName: "PreToolUse";
    additionalContext: string;
  };
}

/**
 * The nudge text if this write is a new language-variant leaf under
 * packages/core/src with no sibling marshaller, else null.
 *
 * `file_path` is absolute (the raw tool_input.file_path). Newness is read from
 * disk: at PreToolUse time the leaf does not yet exist for a create, and an
 * edit of an existing variant already had its chance to be nudged.
 */
export function compute_marshaller_nudge(file_path: string, project_dir: string): string | null {
  const relative = path.relative(project_dir, file_path);
  const parts = relative.split(path.sep);

  // packages/core/src/**/<leaf>
  if (parts[0] !== "packages" || parts[1] !== "core" || parts[2] !== "src") return null;
  if (parts.length < 4) return null;

  const filename = parts[parts.length - 1];
  if (filename.endsWith(".test.ts")) return null;

  // {feature}.{language}.ts — feature is greedy so nested dots stay with it.
  const match = filename.match(/^(.+)\.([a-z]+)\.ts$/);
  if (!match) return null;
  const [, feature, language] = match;
  if (!feature || !LANGUAGES.includes(language)) return null;

  // Only a fresh leaf earns the nudge; an edit already lives beside its folder.
  if (fs.existsSync(file_path)) return null;

  const marshaller = path.join(path.dirname(file_path), `${feature}.ts`);
  if (fs.existsSync(marshaller)) return null;

  return (
    `This is a new \`${feature}.${language}.ts\` variant with no \`${feature}.ts\` beside it. ` +
    `A folder with language variants needs an in-folder \`${feature}.ts\` marshaller owning the ` +
    `dispatch switch — do not displace dispatch into a stage orchestrator. ` +
    `Gold standard: import_resolution/import_resolution.ts.`
  );
}

/**
 * Marker file identifying "this session already nudged this folder". The key is
 * hashed so an arbitrarily deep folder path stays a bounded filename.
 */
function dedup_marker(session_id: string, file_path: string, project_dir: string, state_dir: string): string {
  const folder = path.dirname(path.relative(project_dir, file_path));
  const digest = createHash("sha1").update(`${session_id}::${folder}`).digest("hex");
  return path.join(state_dir, digest);
}

/**
 * The nudge, gated by a per-(session, folder) dedup so a burst of variant
 * writes in one folder injects the reminder only once. Best-effort: a state-dir
 * write failure never suppresses the nudge, and a missing session_id skips
 * dedup rather than dropping the message.
 */
export function marshaller_nudge_with_dedup(
  file_path: string,
  project_dir: string,
  session_id: string | undefined,
  state_dir: string = NUDGE_STATE_DIR,
): string | null {
  const nudge = compute_marshaller_nudge(file_path, project_dir);
  if (!nudge) return null;
  if (!session_id) return nudge;

  const marker = dedup_marker(session_id, file_path, project_dir, state_dir);
  try {
    if (fs.existsSync(marker)) return null;
    fs.mkdirSync(state_dir, { recursive: true });
    fs.writeFileSync(marker, "");
  } catch {
    // Dedup is an optimization; a failed marker must not swallow the nudge.
  }
  return nudge;
}

/** Wrap the nudge as PreToolUse additionalContext — never a block decision. */
export function marshaller_context_output(nudge: string): PreToolUseContextOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: nudge,
    },
  };
}

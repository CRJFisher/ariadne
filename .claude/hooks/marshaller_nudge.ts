/**
 * Marshaller-presence nudge for the file-naming PreToolUse hook.
 *
 * A folder that grows language variants ({feature}.{language}.ts) needs an
 * in-folder {feature}.ts marshaller owning the dispatch switch. Static naming
 * rules cannot time that advice — it only lands when a new variant leaf is
 * written while its marshaller is still absent. This module computes that nudge
 * as `additionalContext` (never a block), kept isolated from file_naming.ts's
 * block logic so the encourage path and the enforce path never entangle.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { createHash } from "crypto";
import { LANGUAGES } from "./file_naming.js";

// Per-(session, folder, feature) dedup markers live here so repeated writes of
// one feature's language variants inject the reminder once, while a different
// feature's missing marshaller in the same folder still earns its own nudge.
const NUDGE_STATE_DIR = path.join(os.tmpdir(), "ariadne-marshaller-nudges");

export interface PreToolUseContextOutput {
  hookSpecificOutput: {
    hookEventName: "PreToolUse";
    additionalContext: string;
  };
}

interface Variant {
  feature: string;
  language: string;
}

/**
 * Parse a {feature}.{language}.ts leaf name into its parts, or null if the name
 * is not a language variant that warrants a marshaller. `index` is excluded for
 * the same reason file_naming.ts excludes it from language-suffixing: a barrel
 * names its folder's exports, not one language's dispatch.
 */
function parse_variant(filename: string): Variant | null {
  if (filename.endsWith(".test.ts")) return null;

  // feature is greedy so nested dots stay with it (a.b.rust.ts → feature a.b).
  const match = filename.match(/^(.+)\.([a-z]+)\.ts$/);
  if (!match) return null;

  const [, feature, language] = match;
  if (feature === "index" || !LANGUAGES.includes(language)) return null;

  return { feature, language };
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

  const variant = parse_variant(parts[parts.length - 1]);
  if (!variant) return null;
  const { feature, language } = variant;

  // Only a fresh leaf earns the nudge; an edit already lives beside its folder.
  if (fs.existsSync(file_path)) return null;

  const marshaller = path.join(path.dirname(file_path), `${feature}.ts`);
  if (fs.existsSync(marshaller)) return null;

  return (
    `This is a new \`${feature}.${language}.ts\` variant with no \`${feature}.ts\` beside it. ` +
    `A folder with language variants needs an in-folder \`${feature}.ts\` marshaller owning the ` +
    `dispatch switch — do not displace dispatch into a stage orchestrator ` +
    `(gold standard: resolve_references/import_resolution/import_resolution.ts).`
  );
}

/**
 * Marker file identifying "this session already nudged this folder's feature".
 * The key is hashed so an arbitrarily deep folder path stays a bounded filename.
 */
function dedup_marker(feature: string, file_path: string, project_dir: string, session_id: string, state_dir: string): string {
  const folder = path.dirname(path.relative(project_dir, file_path));
  const digest = createHash("sha1").update(`${session_id}::${folder}::${feature}`).digest("hex");
  return path.join(state_dir, digest);
}

/**
 * The nudge, gated by a per-(session, folder, feature) dedup so a burst of one
 * feature's language-variant writes injects the reminder only once. Best-effort:
 * a state-dir write failure never suppresses the nudge, and a missing session_id
 * skips dedup rather than dropping the message.
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

  // compute_marshaller_nudge already validated the leaf, so parse_variant here
  // cannot be null; the guard keeps the type non-nullable without an assertion.
  const variant = parse_variant(path.basename(file_path));
  if (!variant) return nudge;

  const marker = dedup_marker(variant.feature, file_path, project_dir, session_id, state_dir);
  try {
    if (fs.existsSync(marker)) return null;
    fs.mkdirSync(state_dir, { recursive: true });
    fs.writeFileSync(marker, "");
  } catch {
    // Dedup is an optimization; a failed marker must not swallow the nudge.
  }
  return nudge;
}

/**
 * Wrap the nudge as PreToolUse additionalContext — never a block decision.
 *
 * permissionDecision is intentionally omitted: a PreToolUse hook that emits
 * additionalContext with no decision stays on the allow path and injects the
 * context next to the tool result (see the "Add context for Claude" table at
 * code.claude.com/docs/en/hooks). Adding a permissionDecision here would turn
 * this encourage-only nudge into a gate.
 */
export function marshaller_context_output(nudge: string): PreToolUseContextOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: nudge,
    },
  };
}

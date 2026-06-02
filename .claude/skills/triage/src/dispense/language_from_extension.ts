/**
 * Derive a `KnownIssueLanguage` from a file path by inspecting its extension.
 *
 * Used by any module that filters `KnownIssue.languages` against a per-entry
 * file path — the dispense payload's registry slice today, more callers as the
 * pipeline grows.
 */

import type { KnownIssueLanguage } from "@ariadnejs/types";

const LANGUAGE_BY_EXTENSION: Record<string, KnownIssueLanguage> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".pyi": "python",
  ".rs": "rust",
};

/**
 * Best-effort language lookup. Returns `null` for unknown extensions and
 * extensionless paths — callers must handle the `null` branch explicitly.
 */
export function language_from_extension(file_path: string): KnownIssueLanguage | null {
  const last_dot = file_path.lastIndexOf(".");
  if (last_dot === -1) return null;
  const ext = file_path.slice(last_dot).toLowerCase();
  return LANGUAGE_BY_EXTENSION[ext] ?? null;
}

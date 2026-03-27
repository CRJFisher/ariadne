import * as path from "path";
import { createHash } from "crypto";
import { homedir } from "os";

const CACHE_DISABLED_VALUES = new Set(["off", "none", "false", "0"]);

/**
 * Resolve the cache directory for a given project path.
 *
 * Precedence:
 *   1. ARIADNE_CACHE_DIR env var (explicit path, or "off"/"none"/"false"/"0" to disable)
 *   2. Default: ~/.ariadne/cache/<project-slug>/
 *
 * The project slug is `<basename>-<8-char-sha256>` of the absolute project path,
 * ensuring deterministic, filesystem-safe, human-scannable directory names.
 */
export function resolve_cache_dir(project_path: string): string | null {
  const env_value = process.env.ARIADNE_CACHE_DIR;

  if (env_value !== undefined) {
    const trimmed = env_value.trim();
    if (trimmed === "" || CACHE_DISABLED_VALUES.has(trimmed.toLowerCase())) {
      return null;
    }
    return path.resolve(trimmed);
  }

  const slug = slugify_project_path(project_path);
  return path.join(homedir(), ".ariadne", "cache", slug);
}

/**
 * Convert an absolute project path to a filesystem-safe slug.
 * Format: <basename>-<8-char-sha256-hex>
 */
export function slugify_project_path(project_path: string): string {
  const resolved = path.resolve(project_path);
  const base = path
    .basename(resolved)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const hash = createHash("sha256").update(resolved).digest("hex").slice(0, 8);
  return base ? `${base}-${hash}` : hash;
}

/**
 * Git-accelerated file change detection using git plumbing commands.
 *
 * For git repos, detects which files changed without reading file content,
 * enabling fast cache invalidation on the MCP server's short-lived invocations.
 */

import { execFile } from "child_process";
import { resolve, join } from "path";

const GIT_TIMEOUT_MS = 10_000;
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB — handles ~125k files

/** Branded type for git tree SHA-1 hashes. */
export type GitTreeHash = string & { _brand: "GitTreeHash" };

/** Per-file state from the git index. */
export interface GitFileState {
  /** SHA-1 hash of the HEAD tree object. */
  readonly tree_hash: GitTreeHash;
  /** Absolute path → git blob SHA-1 for tracked files in the index. */
  readonly tracked_hashes: ReadonlyMap<string, string>;
  /** Absolute paths of files with unstaged working-tree changes. */
  readonly dirty_files: ReadonlySet<string>;
  /** Absolute paths of untracked, non-ignored files. */
  readonly untracked_files: ReadonlySet<string>;
}

/** Check if a directory is inside a git work tree. */
export async function is_git_repo(project_path: string): Promise<boolean> {
  try {
    const stdout = await exec_git(project_path, [
      "rev-parse",
      "--is-inside-work-tree",
    ]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

/**
 * Query git index state using plumbing commands.
 * Runs commands in parallel for speed (~20ms wall-clock).
 * Returns null if any critical command fails.
 */
export async function query_git_file_state(
  project_path: string,
): Promise<GitFileState | null> {
  try {
    const abs_root = resolve(project_path);

    const [tree_hash_raw, ls_files_raw, diff_files_raw, untracked_raw] =
      await Promise.all([
        exec_git(abs_root, ["rev-parse", "HEAD^{tree}"]),
        exec_git(abs_root, ["ls-files", "-s"]),
        exec_git(abs_root, ["diff-files", "--name-only"]),
        exec_git(abs_root, [
          "ls-files",
          "--others",
          "--exclude-standard",
        ]),
      ]);

    const tree_hash = tree_hash_raw.trim() as GitTreeHash;
    const tracked_hashes = parse_ls_files_output(ls_files_raw, abs_root);
    const dirty_files = parse_name_list(diff_files_raw, abs_root);
    const untracked_files = parse_name_list(untracked_raw, abs_root);

    return { tree_hash, tracked_hashes, dirty_files, untracked_files };
  } catch {
    return null;
  }
}

/**
 * Parse `git ls-files -s` output into a map of absolute paths to blob hashes.
 * Format: "<mode> <hash> <stage>\t<path>"
 */
export function parse_ls_files_output(
  stdout: string,
  project_root: string,
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  if (!stdout.trim()) return result;

  for (const line of stdout.split("\n")) {
    if (!line) continue;
    // Format: "100644 <40-char-hash> <stage>\t<relative-path>"
    const tab_idx = line.indexOf("\t");
    if (tab_idx === -1) continue;
    const meta = line.slice(0, tab_idx);
    const rel_path = line.slice(tab_idx + 1);
    const parts = meta.split(" ");
    if (parts.length < 2) continue;
    const blob_hash = parts[1];
    const abs_path = join(project_root, rel_path);
    result.set(abs_path, blob_hash);
  }

  return result;
}

/**
 * Parse a newline-separated list of relative paths into a set of absolute paths.
 * Used for `git diff-files --name-only` and `git ls-files --others`.
 */
export function parse_name_list(
  stdout: string,
  project_root: string,
): ReadonlySet<string> {
  const result = new Set<string>();
  if (!stdout.trim()) return result;

  for (const line of stdout.split("\n")) {
    if (!line) continue;
    result.add(join(project_root, line));
  }

  return result;
}

/**
 * Run a git command and return stdout.
 * Clears inherited GIT_DIR / GIT_WORK_TREE / GIT_INDEX_FILE so that git
 * resolves the repo from `cwd` rather than from an inherited hook environment.
 */
function exec_git(cwd: string, args: string[]): Promise<string> {
  const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...env } = process.env;
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: MAX_BUFFER, env },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      },
    );
  });
}

/**
 * The scan range a Stop hook examines: from the last commit that hook cleared,
 * up to the working tree.
 *
 * A hook that asks git only what differs from HEAD goes blind the moment a
 * session commits — the edit is already in history, the tree is clean, and the
 * hook finds nothing to check. Anchoring instead at a recorded mark keeps
 * committed work in scope until some run has actually examined it.
 *
 * Each hook owns its own mark, because each clears its own concern: a session
 * where lint passes and the build fails must leave the build's range open. The
 * marks live in the git directory, which git keeps per-worktree, so a worktree
 * tracks its own cleared points.
 *
 * The contract every consumer follows is in `.claude/hooks/SCAN_SCOPE.md`.
 */

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

const SCAN_BASE_DIR = "ariadne_scan_base";
const FULL_SHA = /^[0-9a-f]{40}$/;

/**
 * `git` reads GIT_DIR, GIT_INDEX_FILE and friends from the environment in
 * preference to the working directory, so a caller that inherits them — any
 * process spawned under a git hook, including the pre-commit test suite —
 * would silently query a repository other than `project_dir`. Dropping them
 * makes the directory the only thing that selects the repository.
 */
const AMBIENT_GIT_VARS = [
  "GIT_DIR",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_WORK_TREE",
  "GIT_PREFIX",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
];

export function git_env(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of AMBIENT_GIT_VARS) delete env[name];
  return env;
}

export function git(project_dir: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd: project_dir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
    env: git_env(),
  }).trim();
}

/**
 * Git abbreviates a rename to its destination path alone, which hides the
 * directory a file moved OUT of — and losing a file is exactly what several of
 * these hooks exist to notice. `core.quotepath=false` keeps non-ASCII paths
 * literal so they still match the callers' path patterns.
 */
export function git_changed_paths(project_dir: string, ...args: string[]): string[] {
  return git(project_dir, "-c", "core.quotepath=false", ...args)
    .split("\n")
    .filter((f) => f.trim());
}

/**
 * `--git-common-dir` answers relative to the repository root, so the result is
 * resolved against `project_dir` rather than the process working directory.
 */
function scan_base_path(project_dir: string, hook: string, git_dir_flag: string): string {
  const git_dir = path.resolve(project_dir, git(project_dir, "rev-parse", git_dir_flag));
  return path.join(git_dir, SCAN_BASE_DIR, hook);
}

function read_recorded_sha(project_dir: string, hook: string, git_dir_flag: string): string | null {
  try {
    const sha = fs.readFileSync(scan_base_path(project_dir, hook, git_dir_flag), "utf8").trim();
    return FULL_SHA.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

function is_ancestor_of_head(project_dir: string, sha: string): boolean {
  try {
    git(project_dir, "merge-base", "--is-ancestor", sha, "HEAD");
    return true;
  } catch {
    return false;
  }
}

/**
 * The commit to scan from, given a recorded mark that may not be on this
 * history. A branch switch or rebase leaves the mark describing work HEAD
 * cannot reach; the fork point is the newest commit that IS shared, so the
 * range from it covers everything this history has that the mark had not
 * cleared. Anchoring at HEAD instead would declare that range clean without
 * ever looking at it.
 */
function nearest_cleared_ancestor(project_dir: string, sha: string): string | null {
  if (is_ancestor_of_head(project_dir, sha)) return sha;
  try {
    return git(project_dir, "merge-base", sha, "HEAD") || null;
  } catch {
    return null;
  }
}

/**
 * Null only for a repository whose first commit has not landed — there is
 * genuinely nothing to scan. Every other git failure propagates, so a caller
 * decides whether being unable to read the repository is fatal.
 */
export function current_head(project_dir: string): string | null {
  try {
    return git(project_dir, "rev-parse", "HEAD");
  } catch (error) {
    if (git(project_dir, "rev-list", "--count", "--all") === "0") return null;
    throw error;
  }
}

export interface ScanRange {
  /** The last commit this hook cleared, or null when none is on record. */
  base: string | null;
  /** The commit the range ends at, or null in a repository with no commits. */
  head: string | null;
}

/**
 * A linked worktree starts with no mark of its own. Falling back to the shared
 * git directory's mark — the main checkout's cleared point — means a worktree's
 * very first run still covers the commits made inside it, instead of treating
 * its whole history as already cleared.
 */
export function open_scan_range(project_dir: string, hook: string): ScanRange {
  const recorded = [
    read_recorded_sha(project_dir, hook, "--absolute-git-dir"),
    read_recorded_sha(project_dir, hook, "--git-common-dir"),
  ];

  let base: string | null = null;
  for (const sha of recorded) {
    if (!sha) continue;
    base = nearest_cleared_ancestor(project_dir, sha);
    if (base) break;
  }

  return { base, head: current_head(project_dir) };
}

/**
 * Record that this hook examined everything up to `range.head` and found it
 * clean. Recording is bookkeeping, not a verdict: a git directory that cannot
 * be written costs the next run a repeated scan, which is the safe direction,
 * so a failure here is reported to the caller rather than thrown.
 */
export function record_scan_cleared(
  project_dir: string,
  hook: string,
  range: ScanRange,
): { recorded: boolean; error?: string } {
  if (range.head === null) return { recorded: false };

  try {
    const target = scan_base_path(project_dir, hook, "--absolute-git-dir");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temp = `${target}.tmp`;
    fs.writeFileSync(temp, `${range.head}\n`);
    fs.renameSync(temp, target);
    return { recorded: true };
  } catch (error) {
    return { recorded: false, error: String(error) };
  }
}

/**
 * Every path touched since `scan_base`, whether it landed as a commit or is
 * still sitting in the working tree.
 *
 * A null base means nothing has been cleared yet, so every tracked file counts.
 * Anything narrower would let a run declare history clean that it never looked
 * at. Callers that must not act on untouched files pass `base ?? head` instead,
 * which anchors the first run at HEAD and covers every session after it.
 */
export function changed_paths_since(project_dir: string, scan_base: string | null): string[] {
  const paths = [
    ...git_changed_paths(project_dir, "diff", "--name-only", "--no-renames", "HEAD"),
    ...git_changed_paths(project_dir, "ls-files", "--others", "--exclude-standard"),
    ...(scan_base
      ? git_changed_paths(project_dir, "diff", "--name-only", "--no-renames", `${scan_base}..HEAD`)
      : git_changed_paths(project_dir, "ls-files")),
  ];

  return [...new Set(paths)];
}

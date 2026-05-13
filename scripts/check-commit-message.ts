#!/usr/bin/env node
/**
 * Validate a commit message against the convention documented in
 * `.claude/rules/commit-convention.md`. Permissive by design: this script
 * only intervenes when a commit subject's scope LOOKS task-shaped
 * (matches `^\d+(?:\.\d+)*(?:-\d+)?$`). Named scopes, no-scope commits, and
 * non-Conventional-Commits messages all pass through.
 *
 * Two invocation modes:
 *
 *   node --import tsx scripts/check-commit-message.ts <commit-msg-file>
 *     Used by the git `commit-msg` hook. Exits 1 on failure with a message.
 *
 *   node --import tsx scripts/check-commit-message.ts --ci
 *     Used in CI. Reads HEAD's message via git and validates it.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SUBJECT_REGEX = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?:\s*(?<subject>.+)$/;
const TASK_SCOPE_REGEX = /^\d+(?:\.\d+)*(?:-\d+)?$/;
const TASK_RANGE_REGEX = /^(?<base>(?:\d+\.)*)(?<lo>\d+)-(?<hi>\d+)$/;
const BODY_TRAILER_REGEX = /^(?:Fixes|Implements|Closes):\s*TASK-([\w.]+)\s*$/;

export interface ValidationResult {
  ok: boolean;
  reason: string | null;
}

/**
 * Expand a task-id scope into the full list of referenced task ids. Single ids
 * round-trip unchanged. Ranges like `190.17.12-14` expand to three ids.
 *
 * Single-segment range only: the `-N` suffix applies to the last segment.
 */
export function expand_task_scope(scope: string): string[] {
  const match = TASK_RANGE_REGEX.exec(scope);
  if (match === null) return [scope];
  const { base, lo, hi } = match.groups as { base: string; lo: string; hi: string };
  const lo_n = Number.parseInt(lo, 10);
  const hi_n = Number.parseInt(hi, 10);
  if (hi_n < lo_n) return [scope]; // degenerate; caller will report a not-found
  const ids: string[] = [];
  for (let i = lo_n; i <= hi_n; i++) ids.push(`${base}${i}`);
  return ids;
}

/**
 * Core validator. Pure aside from the `task_exists` callback. The callback
 * answers "does backlog/tasks/task-<id> *.md exist?" — injected so tests can
 * pass a Set instead of touching the filesystem.
 */
export function validate_commit_message(
  message: string,
  task_exists: (id: string) => boolean,
): ValidationResult {
  const first_line = message.split("\n", 1)[0] ?? "";
  const subject_match = SUBJECT_REGEX.exec(first_line);

  if (subject_match !== null) {
    const groups = subject_match.groups as {
      type: string;
      scope: string | undefined;
      subject: string;
    };
    const scope = groups.scope;
    if (scope !== undefined && TASK_SCOPE_REGEX.test(scope)) {
      const ids = expand_task_scope(scope);
      for (const id of ids) {
        if (!task_exists(id)) {
          return {
            ok: false,
            reason:
              `scope '${scope}' references TASK-${id} which does not exist in backlog/tasks/. ` +
              "Use a named scope (mcp/python/core/…) for non-task work, or fix the task id.",
          };
        }
      }
    }
  }

  // Body trailer scan (independent of subject). Lines starting with
  // Fixes:/Implements:/Closes: TASK-<id> must reference existing tasks.
  const body_lines = message.split("\n").slice(1);
  for (const line of body_lines) {
    const trailer_match = BODY_TRAILER_REGEX.exec(line);
    if (trailer_match === null) continue;
    const id = trailer_match[1];
    if (!task_exists(id)) {
      return {
        ok: false,
        reason:
          `body trailer references TASK-${id} which does not exist in backlog/tasks/.`,
      };
    }
  }

  return { ok: true, reason: null };
}

async function build_task_exists(repo_root: string): Promise<(id: string) => boolean> {
  const tasks_dir = path.join(repo_root, "backlog", "tasks");
  let entries: string[];
  try {
    entries = await fs.readdir(tasks_dir);
  } catch {
    // No backlog/tasks/ dir — treat every task as missing.
    return () => false;
  }
  const known_ids = new Set<string>();
  for (const entry of entries) {
    const m = /^task-([\w.]+)\s+-\s.+\.md$/.exec(entry);
    if (m !== null) known_ids.add(m[1]);
  }
  return (id) => known_ids.has(id);
}

async function load_message(args: string[]): Promise<string> {
  if (args[0] === "--ci") {
    return execSync("git log -1 --format=%B HEAD", { encoding: "utf8" });
  }
  if (args[0] === undefined) {
    throw new Error(
      "usage: check-commit-message <commit-msg-file>  |  check-commit-message --ci",
    );
  }
  return fs.readFile(args[0], "utf8");
}

async function find_repo_root(): Promise<string> {
  return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const message = await load_message(args);
  const repo_root = await find_repo_root();
  const task_exists = await build_task_exists(repo_root);
  const result = validate_commit_message(message, task_exists);
  if (!result.ok) {
    process.stderr.write(`commit-msg: ${result.reason}\n`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(
      `check-commit-message failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}

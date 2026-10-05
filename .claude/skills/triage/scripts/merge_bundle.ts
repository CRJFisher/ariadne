#!/usr/bin/env node
/**
 * Fold a transfer bundle's Ariadne data into this machine's `~/.ariadne`.
 *
 * A triage verdict is the expensive artifact in this pipeline: every entry in a
 * run was investigated by a model, and nothing re-derives that. So two machines
 * that each triaged part of the corpus hold two disjoint halves of one result,
 * and the only way to see the whole is to union them. That is all this does —
 * union, never overwrite.
 *
 * The unit of union is the file path, because every path in the store is already
 * effectively content-addressed: a run directory is named `<commit>-<millisecond
 * timestamp>`, a published envelope is named after its run, and a detect dump is
 * named after the instant it was written. Two machines cannot independently
 * produce the same path for different content. So a path absent here is copied,
 * a path present here is left exactly as it is, and a path present with a
 * different size is reported as a conflict and touched by neither side.
 *
 * Absolute paths are embedded throughout the store — a run manifest names the
 * corpus it indexed and the detect dump it was prepared from. When the two
 * machines do not share a home directory those references have to be retargeted
 * on the way in, which is what `--rewrite` does; the merge refuses to run
 * without it rather than land a store full of paths that resolve to nothing.
 *
 * Dry-run by default; `--apply` performs the copies.
 *
 * Exit codes: usage error → 2; conflicts found → 1; ok → 0.
 *
 * Usage:
 *   node --import tsx merge_bundle.ts --bundle <dir> [--target <dir>]
 *                                     [--rewrite <from> <to>]... [--apply]
 *                                     [--verify-hash] [--json]
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
  stream_copy_with_replacements,
  type Replacement,
} from "../src/store/stream_rewrite.js";
import { LATEST_FILENAME } from "../src/store/paths.js";
import { REPOS_SUBDIR } from "../src/store/store_layout.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: merge_bundle.ts --bundle <dir> [--target <dir>] [--rewrite <from> <to>]... " +
  "[--apply] [--verify-hash] [--json]\n";

class UsageError extends Error {}

/**
 * Payload subtrees never merged, whatever a bundle happens to carry.
 *
 * `repos/` is shallow clones at pinned commits and `cache/` is a derived index
 * whose directory name is a hash of the absolute corpus path — both re-create
 * themselves on the target machine, and the cache would not even be addressable
 * there. Copying either costs tens of gigabytes to gain nothing. `_transfer/` is
 * the bundle describing itself — its manifest and checksums document this
 * transfer and have no place in a store.
 */
const EXCLUDED_SEGMENTS: readonly string[] = [REPOS_SUBDIR, "cache", "tmp", "_transfer"];

/** Extensions whose contents carry retargetable absolute paths. */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  ".json",
  ".jsonl",
  ".md",
  ".txt",
  ".log",
  ".out",
  ".err",
  ".patch",
  ".mmd",
  ".ts",
  ".js",
]);

/** Files above this size are compared by size alone unless `--verify-hash`. */
const HASH_SIZE_LIMIT_BYTES = 64 * 1024 * 1024;

export interface MergeArgs {
  bundle_dir: string;
  target_dir: string;
  rewrites: Replacement[];
  apply: boolean;
  verify_hash: boolean;
}

export type MergeAction = "copy" | "skip-identical" | "conflict" | "excluded";

export interface FileDecision {
  relative_path: string;
  action: MergeAction;
  bytes: number;
  reason: string | null;
}

export interface MergePlan {
  bundle_dir: string;
  target_dir: string;
  rewrites: Replacement[];
  decisions: FileDecision[];
  copy_count: number;
  copy_bytes: number;
  skip_count: number;
  conflict_count: number;
  excluded_count: number;
}

export interface MergeReport {
  plan: MergePlan;
  applied: boolean;
  copied: number;
  copied_bytes: number;
  failures: Array<{ relative_path: string; error: string }>;
}

// ===== Planning =====

function is_excluded(relative_path: string): boolean {
  const segments = relative_path.split(path.sep);
  if (segments[segments.length - 1] === LATEST_FILENAME) return true;
  return segments.some((segment) => EXCLUDED_SEGMENTS.includes(segment));
}

function list_payload_files(root: string): string[] {
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) files.push(path.relative(root, full));
    }
  }
  return files.sort();
}

function sha256(file_path: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file_path)).digest("hex");
}

/**
 * Decide whether an existing target file is the same artifact.
 *
 * Size is the primary test and is decisive in practice, because a shared path
 * between two stores means a shared run id — the same artifact copied earlier.
 * Content is hashed too when both sides are small enough for that to be free,
 * or whenever `--verify-hash` says the operator wants certainty over speed.
 */
function same_artifact(source: string, target: string, verify_hash: boolean): boolean {
  const source_size = fs.statSync(source).size;
  const target_size = fs.statSync(target).size;
  if (source_size !== target_size) return false;
  if (!verify_hash && source_size > HASH_SIZE_LIMIT_BYTES) return true;
  return sha256(source) === sha256(target);
}

export function plan_bundle_merge(args: MergeArgs): MergePlan {
  const decisions: FileDecision[] = [];

  for (const relative_path of list_payload_files(args.bundle_dir)) {
    const source = path.join(args.bundle_dir, relative_path);
    const bytes = fs.statSync(source).size;

    if (is_excluded(relative_path)) {
      decisions.push({ relative_path, action: "excluded", bytes, reason: "not merged" });
      continue;
    }

    const target = path.join(args.target_dir, relative_path);
    if (!fs.existsSync(target)) {
      decisions.push({ relative_path, action: "copy", bytes, reason: null });
      continue;
    }

    if (same_artifact(source, target, args.verify_hash)) {
      decisions.push({ relative_path, action: "skip-identical", bytes, reason: null });
    } else {
      decisions.push({
        relative_path,
        action: "conflict",
        bytes,
        reason: `already present with different content (${fs.statSync(target).size} bytes here)`,
      });
    }
  }

  const by_action = (action: MergeAction): FileDecision[] =>
    decisions.filter((decision) => decision.action === action);

  return {
    bundle_dir: args.bundle_dir,
    target_dir: args.target_dir,
    rewrites: args.rewrites,
    decisions,
    copy_count: by_action("copy").length,
    copy_bytes: by_action("copy").reduce((total, decision) => total + decision.bytes, 0),
    skip_count: by_action("skip-identical").length,
    conflict_count: by_action("conflict").length,
    excluded_count: by_action("excluded").length,
  };
}

// ===== Applying =====

/** Rewrites apply to text artifacts only; anything else is copied byte for byte. */
function replacements_for(relative_path: string, rewrites: readonly Replacement[]): Replacement[] {
  if (rewrites.length === 0) return [];
  return TEXT_EXTENSIONS.has(path.extname(relative_path)) ? [...rewrites] : [];
}

export async function apply_bundle_merge(plan: MergePlan): Promise<MergeReport> {
  const failures: Array<{ relative_path: string; error: string }> = [];
  let copied = 0;
  let copied_bytes = 0;

  for (const decision of plan.decisions) {
    if (decision.action !== "copy") continue;
    const source = path.join(plan.bundle_dir, decision.relative_path);
    const target = path.join(plan.target_dir, decision.relative_path);
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      await stream_copy_with_replacements(
        source,
        target,
        replacements_for(decision.relative_path, plan.rewrites),
      );
      copied++;
      copied_bytes += decision.bytes;
    } catch (err) {
      failures.push({
        relative_path: decision.relative_path,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { plan, applied: true, copied, copied_bytes, failures };
}

// ===== CLI =====

function parse_argv(argv: readonly string[]): MergeArgs & { json: boolean } {
  let bundle_dir: string | null = null;
  let target_dir = path.join(os.homedir(), ".ariadne");
  const rewrites: Replacement[] = [];
  let apply = false;
  let verify_hash = false;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = (flag: string): string => {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) {
        throw new UsageError(`${flag} expects a value`);
      }
      return value;
    };
    switch (arg) {
      case "--bundle":
        bundle_dir = path.resolve(take("--bundle"));
        break;
      case "--target":
        target_dir = path.resolve(take("--target"));
        break;
      case "--rewrite": {
        const find = take("--rewrite");
        const replace = take("--rewrite");
        rewrites.push({ find, replace });
        break;
      }
      case "--apply":
        apply = true;
        break;
      case "--verify-hash":
        verify_hash = true;
        break;
      case "--json":
        json = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      default:
        throw new UsageError(`Unknown argument: ${arg}`);
    }
  }

  if (bundle_dir === null) throw new UsageError("--bundle is required");
  return { bundle_dir, target_dir, rewrites, apply, verify_hash, json };
}

/**
 * The home directory the bundle's contents point at, read from a run manifest.
 *
 * Every manifest records `project_path` as an absolute path into the writing
 * machine's store, so one of them is enough to tell whether the two machines
 * agree on where `.ariadne` lives.
 */
export function detect_bundle_home(bundle_dir: string): string | null {
  const state_root = path.join(bundle_dir, "triage-entrypoints", "triage_state");
  if (!fs.existsSync(state_root)) return null;

  for (const project of fs.readdirSync(state_root).sort()) {
    const runs_root = path.join(state_root, project, "runs");
    if (!fs.existsSync(runs_root)) continue;
    for (const run_id of fs.readdirSync(runs_root).sort()) {
      const manifest = path.join(runs_root, run_id, "manifest.json");
      if (!fs.existsSync(manifest)) continue;
      try {
        const project_path = (JSON.parse(fs.readFileSync(manifest, "utf8")) as {
          project_path?: unknown;
        }).project_path;
        if (typeof project_path !== "string") continue;
        const marker = `${path.sep}.ariadne${path.sep}`;
        const index = project_path.indexOf(marker);
        if (index > 0) return project_path.slice(0, index + marker.length - 1);
      } catch {
        continue;
      }
    }
  }
  return null;
}

function format_bytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function format_plan(plan: MergePlan, applied: boolean): string {
  const lines = [
    `Bundle: ${plan.bundle_dir}`,
    `Target: ${plan.target_dir}`,
    "",
    applied ? "APPLIED" : "DRY RUN — pass --apply to perform these copies",
    "",
    `  copy            ${plan.copy_count} file(s), ${format_bytes(plan.copy_bytes)}`,
    `  already present ${plan.skip_count} file(s)`,
    `  excluded        ${plan.excluded_count} file(s)`,
    `  CONFLICT        ${plan.conflict_count} file(s)`,
  ];

  if (plan.rewrites.length > 0) {
    lines.push("", "Path rewrites applied to text artifacts:");
    for (const rewrite of plan.rewrites) lines.push(`  ${rewrite.find}  →  ${rewrite.replace}`);
  }

  if (plan.conflict_count > 0) {
    lines.push("", "Conflicts (left untouched on both sides):");
    for (const decision of plan.decisions.filter((d) => d.action === "conflict")) {
      lines.push(`  ${decision.relative_path} — ${decision.reason}`);
    }
  }

  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  let args: MergeArgs & { json: boolean };
  try {
    args = parse_argv(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exit(2);
  }

  if (!fs.existsSync(args.bundle_dir)) {
    process.stderr.write(`Error: bundle directory not found: ${args.bundle_dir}\n`);
    process.exit(2);
  }

  // A store whose embedded paths point at a home this machine does not have is
  // worse than no store: every manifest resolves to nothing and the failure only
  // shows up later, inside a triage run. Refuse until the operator names the
  // rewrite, and tell them exactly which one.
  const bundle_home = detect_bundle_home(args.bundle_dir);
  if (bundle_home !== null && args.rewrites.length === 0) {
    const target_home = args.target_dir;
    if (path.resolve(bundle_home) !== path.resolve(target_home)) {
      process.stderr.write(
        `Error: the bundle's paths point at ${bundle_home}, but this machine's ` +
          `Ariadne data lives at ${target_home}.\n` +
          `Re-run with:  --rewrite ${bundle_home} ${target_home}\n`,
      );
      process.exit(2);
    }
  }

  const plan = plan_bundle_merge(args);

  if (!args.apply) {
    process.stdout.write(
      args.json ? JSON.stringify(plan, null, 2) + "\n" : format_plan(plan, false),
    );
    process.exit(plan.conflict_count > 0 ? 1 : 0);
  }

  const report = await apply_bundle_merge(plan);
  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(format_plan(plan, true));
    process.stdout.write(
      `\nCopied ${report.copied} file(s), ${format_bytes(report.copied_bytes)}.\n`,
    );
    for (const failure of report.failures) {
      process.stdout.write(`FAILED: ${failure.relative_path} — ${failure.error}\n`);
    }
  }
  process.exit(plan.conflict_count > 0 || report.failures.length > 0 ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}

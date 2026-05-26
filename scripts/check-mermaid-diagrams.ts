#!/usr/bin/env tsx

/**
 * Pure-Node hash check that verifies every `.mmd` source is in sync with its
 * sibling `.svg`. Requires no Chrome and no mmdc — reads files, computes
 * SHA256, compares against the `<!-- source-sha256: ... -->` comment stamped
 * into the SVG by `render-mermaid-diagrams.ts`.
 *
 * Failure modes (exit 1, with one line per problem):
 *   - missing-svg     : a `.mmd` has no sibling `.svg`
 *   - missing-stamp   : the sibling `.svg` lacks the source-sha256 comment
 *   - hash-mismatch   : the stamped hash does not match the `.mmd`'s SHA256
 *   - orphaned-svg    : a tracked `.svg` whose first 512 bytes carry the
 *                       source-sha256 stamp (so it was produced by this
 *                       workflow) but has no sibling `.mmd`. Standalone SVGs
 *                       (icons, logos) are unstamped and are ignored.
 */

import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  extract_stamped_hash,
  has_stamp,
  sha256_of,
} from "./svg_hash_stamp.ts";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

interface Failure {
  kind:
    | "missing-svg"
    | "missing-stamp"
    | "hash-mismatch"
    | "orphaned-svg";
  path: string;
  detail?: string;
}

function git_ls_files(pattern: string): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", pattern],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  return out
    .split("\n")
    .filter((line) => line.length > 0)
    .map((rel) => path.join(REPO_ROOT, rel));
}

function check_pair(mmd_path: string): Failure | null {
  const svg_path = mmd_path.replace(/\.mmd$/, ".svg");
  if (!existsSync(svg_path)) {
    return { kind: "missing-svg", path: mmd_path };
  }
  const svg = readFileSync(svg_path, "utf8");
  const stamped = extract_stamped_hash(svg);
  if (!stamped) {
    return { kind: "missing-stamp", path: svg_path };
  }
  const actual = sha256_of(readFileSync(mmd_path));
  if (stamped !== actual) {
    return {
      kind: "hash-mismatch",
      path: mmd_path,
      detail: `stamped=${stamped.slice(0, 12)}... actual=${actual.slice(0, 12)}...`,
    };
  }
  return null;
}

function check_orphans(mmd_paths: readonly string[]): Failure[] {
  const tracked_svgs = git_ls_files("*.svg");
  const expected_svg_for_mmd = new Set(
    mmd_paths.map((p) => p.replace(/\.mmd$/, ".svg"))
  );
  const failures: Failure[] = [];
  for (const svg of tracked_svgs) {
    if (expected_svg_for_mmd.has(svg)) continue;
    // Only flag tracked SVGs that this workflow produced (i.e. carry the
    // source-sha256 stamp). Unstamped SVGs are out of scope — icons, logos,
    // anything a contributor commits by hand.
    const contents = readFileSync(svg, "utf8");
    if (!has_stamp(contents)) continue;
    failures.push({ kind: "orphaned-svg", path: svg });
  }
  return failures;
}

async function main(): Promise<void> {
  const mmd_paths = git_ls_files("*.mmd");
  const failures: Failure[] = [];
  for (const mmd of mmd_paths) {
    const failure = check_pair(mmd);
    if (failure) failures.push(failure);
  }
  failures.push(...check_orphans(mmd_paths));

  if (failures.length === 0) {
    process.stdout.write(
      `check-mermaid-diagrams: ${mmd_paths.length} diagram(s) in sync\n`
    );
    return;
  }

  process.stderr.write(
    `check-mermaid-diagrams: ${failures.length} problem(s):\n`
  );
  for (const f of failures) {
    const rel = path.relative(REPO_ROOT, f.path);
    const detail = f.detail ? ` (${f.detail})` : "";
    process.stderr.write(`  [${f.kind}] ${rel}${detail}\n`);
  }
  process.stderr.write(
    "\nRun `pnpm render-mermaid-diagrams` (requires Chrome) to regenerate.\n"
  );
  process.exit(1);
}

const invoked_directly =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("check-mermaid-diagrams.ts");

if (invoked_directly) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}

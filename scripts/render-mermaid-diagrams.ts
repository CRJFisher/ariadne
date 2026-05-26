#!/usr/bin/env tsx

/**
 * Render every `**\/*.mmd` source file to a sibling `.svg`, stamped with the
 * SHA256 of the source. The hash lets `check-mermaid-diagrams.ts` verify sync
 * without re-rendering (no Chrome required at check time).
 *
 * Modes:
 *   default       : full sweep of all `.mmd` sources in the repo.
 *   --staged      : only `.mmd` files present in `git diff --cached`. After
 *                   rendering, the regenerated `.svg` is `git add`-ed so the
 *                   pre-commit hook can keep them in sync transparently.
 *
 * Silent exit 0 when Chrome is not detected, so contributors and CI without a
 * local browser are never blocked. Exits non-zero only on mmdc syntax errors
 * (or missing mmdc binary).
 */

import { execFileSync, spawnSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { detect_chrome } from "./detect-chrome.ts";
import { inject_hash_comment, sha256_of } from "./svg_hash_stamp.ts";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const MMDC_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "mmdc");
const PUPPETEER_CONFIG_TEMPLATE = path.join(
  REPO_ROOT,
  "scripts",
  "puppeteer-config.json"
);

function list_mmd_files_full_sweep(): string[] {
  // Use git ls-files to respect .gitignore and avoid node_modules. Include
  // both tracked sources and not-yet-tracked-but-not-ignored sources so a
  // brand-new `.mmd` is rendered on first run.
  const out = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "*.mmd"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  return out
    .split("\n")
    .filter((line) => line.length > 0)
    .map((rel) => path.join(REPO_ROOT, rel));
}

function list_mmd_files_staged(): string[] {
  // ACMR = added, copied, modified, renamed. Deletions (D) are intentionally
  // excluded: a staged delete of a `.mmd` has nothing to render. The orphan
  // check in `check-mermaid-diagrams.ts` catches the residual `.svg`.
  const out = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  return out
    .split("\n")
    .filter((line) => line.endsWith(".mmd"))
    .map((rel) => path.join(REPO_ROOT, rel));
}

function write_puppeteer_config(chrome_path: string): {
  config_path: string;
  cleanup: () => void;
} {
  const template = JSON.parse(
    readFileSync(PUPPETEER_CONFIG_TEMPLATE, "utf8")
  ) as Record<string, unknown>;
  const merged = { ...template, executablePath: chrome_path };
  const dir = mkdtempSync(path.join(tmpdir(), "ariadne-mmdc-"));
  const config_path = path.join(dir, "puppeteer-config.json");
  writeFileSync(config_path, JSON.stringify(merged, null, 2));
  return {
    config_path,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function stamp_svg_with_hash(svg_path: string, source_hash: string): void {
  const svg = readFileSync(svg_path, "utf8");
  const stamped = inject_hash_comment(svg, source_hash);
  writeFileSync(svg_path, stamped);
}

interface RenderResult {
  source: string;
  output: string;
  source_hash: string;
}

function render_one(
  mmd_path: string,
  puppeteer_config_path: string
): RenderResult {
  const svg_path = mmd_path.replace(/\.mmd$/, ".svg");
  const source = readFileSync(mmd_path);
  const source_hash = sha256_of(source);
  const result = spawnSync(
    MMDC_BIN,
    [
      "-i",
      mmd_path,
      "-o",
      svg_path,
      "-p",
      puppeteer_config_path,
      "--quiet",
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    const stderr = result.stderr || "(no stderr)";
    throw new Error(
      `mmdc failed for ${path.relative(REPO_ROOT, mmd_path)}:\n${stderr}`
    );
  }
  stamp_svg_with_hash(svg_path, source_hash);
  return { source: mmd_path, output: svg_path, source_hash };
}

function git_add(paths: readonly string[]): void {
  if (paths.length === 0) return;
  execFileSync("git", ["add", "--", ...paths], { cwd: REPO_ROOT });
}

async function main(): Promise<void> {
  const staged_mode = process.argv.includes("--staged");
  const sources_raw = staged_mode
    ? list_mmd_files_staged()
    : list_mmd_files_full_sweep();

  // In --staged mode a `.mmd` can be staged + then deleted from the worktree
  // before commit. Skip those silently so the pre-commit hook does not abort
  // an otherwise-valid commit. The orphan check in CI surfaces the stale
  // sibling SVG if it ends up committed.
  const sources = staged_mode
    ? sources_raw.filter((p) => existsSync(p))
    : sources_raw;

  if (sources.length === 0) {
    return;
  }

  const chrome_path = detect_chrome();
  if (!chrome_path) {
    if (!staged_mode) {
      process.stderr.write(
        "render-mermaid-diagrams: Chrome not detected — skipping. " +
          "Set CHROME_PATH or install Google Chrome to enable.\n"
      );
    }
    return;
  }

  const { config_path, cleanup } = write_puppeteer_config(chrome_path);
  try {
    const rendered: RenderResult[] = [];
    for (const src of sources) {
      const result = render_one(src, config_path);
      rendered.push(result);
      process.stdout.write(
        `rendered ${path.relative(REPO_ROOT, result.source)} -> ` +
          `${path.relative(REPO_ROOT, result.output)}\n`
      );
    }
    if (staged_mode) {
      git_add(rendered.map((r) => r.output));
    }
  } finally {
    cleanup();
  }
}

const invoked_directly =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("render-mermaid-diagrams.ts");

if (invoked_directly) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}

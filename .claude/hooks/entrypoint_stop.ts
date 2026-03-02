#!/usr/bin/env npx tsx
/**
 * Claude Code Stop hook: Entry point detection using Ariadne directly
 *
 * Detects which packages were modified, runs entrypoint analysis using Ariadne,
 * and compares against package-specific whitelists.
 * Blocks if unexpected entry points are found.
 */

import { load_project } from "../../packages/core/src/index.js";
import * as fs from "fs/promises";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(__dirname, "..", "hook_log.txt");

interface EntryPoint {
  name: string;
  kind: string;
  file_path: string;
  start_line: number;
}

interface KnownEntrypointSource {
  source: string;
  description: string;
  entrypoints: { name: string; file_path?: string }[];
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [entrypoint] ${message}\n`;
  fs.appendFile(LOG_FILE, entry).catch(() => {});
}

function output_result(decision: "block" | "approve", reason?: string): void {
  if (decision === "block" && reason) {
    console.log(JSON.stringify({ decision, reason }));
  }
  process.exit(0);
}

/**
 * Get list of packages that have modified files (staged or unstaged)
 */
function get_modified_packages(project_dir: string): string[] {
  try {
    // Get both staged and unstaged changes
    const diff_output = execSync("git diff --name-only HEAD", {
      cwd: project_dir,
      encoding: "utf8",
    }).trim();

    const staged_output = execSync("git diff --name-only --cached", {
      cwd: project_dir,
      encoding: "utf8",
    }).trim();

    const all_files = [...diff_output.split("\n"), ...staged_output.split("\n")]
      .filter((f) => f.trim())
      .filter((f) => f.startsWith("packages/"));

    // Extract unique package names
    const packages = new Set<string>();
    for (const file of all_files) {
      const match = file.match(/^packages\/([^/]+)\//);
      if (match) {
        packages.add(match[1]);
      }
    }

    return Array.from(packages);
  } catch {
    return [];
  }
}

/**
 * Load whitelist for a specific package
 */
async function load_whitelist(project_dir: string, package_name: string): Promise<Set<string>> {
  const registry_path = path.join(
    project_dir,
    ".claude/skills/self-repair-pipeline/known_entrypoints",
    `${package_name}.json`
  );

  try {
    const content = await fs.readFile(registry_path, "utf-8");
    const sources: KnownEntrypointSource[] = JSON.parse(content);
    const names = new Set<string>();
    for (const source of sources) {
      for (const ep of source.entrypoints) {
        names.add(ep.name);
      }
    }
    return names;
  } catch {
    log(`No known-entrypoints registry found for package ${package_name}`);
    return new Set();
  }
}

/**
 * Analyze a single package and return unexpected entry points
 */
async function analyze_package(
  project_dir: string,
  package_name: string
): Promise<EntryPoint[]> {
  const src_folder = path.join("packages", package_name, "src");

  const project = await load_project({
    project_path: project_dir,
    folders: [src_folder],
  });

  const call_graph = project.get_call_graph();

  const entry_points: EntryPoint[] = [];
  for (const entry_point_id of call_graph.entry_points) {
    const node = call_graph.nodes.get(entry_point_id);
    if (!node) continue;

    entry_points.push({
      name: node.name as string,
      kind: node.definition.kind,
      file_path: node.location.file_path,
      start_line: node.location.start_line,
    });
  }

  const whitelist = await load_whitelist(project_dir, package_name);
  return entry_points.filter((ep) => !whitelist.has(ep.name));
}

async function main(): Promise<void> {
  log("Hook started");

  // Read stdin (required by hook protocol)
  let stdin_data = "";
  try {
    stdin_data = await fs.readFile(0 as any, "utf-8");
  } catch {
    // Ignore stdin read errors
  }
  log(`Stdin: ${stdin_data.substring(0, 100)}...`);

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  log(`Project dir: ${project_dir}`);

  // Get modified packages
  const modified_packages = get_modified_packages(project_dir);
  if (modified_packages.length === 0) {
    log("No packages modified, skipping analysis");
    process.exit(0);
  }

  log(`Modified packages: ${modified_packages.join(", ")}`);

  const start_time = Date.now();
  const all_unexpected: { package: string; entry_points: EntryPoint[] }[] = [];

  // Analyze each modified package
  for (const pkg of modified_packages) {
    log(`Analyzing package: ${pkg}`);
    try {
      const unexpected = await analyze_package(project_dir, pkg);
      if (unexpected.length > 0) {
        all_unexpected.push({ package: pkg, entry_points: unexpected });
      }
      log(`  Found ${unexpected.length} unexpected entry points in ${pkg}`);
    } catch (error) {
      log(`  Error analyzing ${pkg}: ${error}`);
    }
  }

  const elapsed_s = ((Date.now() - start_time) / 1000).toFixed(1);
  log(`Analysis completed in ${elapsed_s}s`);

  // Report results
  if (all_unexpected.length > 0) {
    const total = all_unexpected.reduce((sum, p) => sum + p.entry_points.length, 0);
    const formatted = all_unexpected
      .map((p) => {
        const eps = p.entry_points
          .map((ep) => `  - ${ep.name} (${ep.kind})\n    ${ep.file_path}:${ep.start_line}`)
          .join("\n\n");
        return `Package ${p.package}:\n${eps}`;
      })
      .join("\n\n");

    output_result(
      "block",
      `Found ${total} unexpected entry point(s) [${elapsed_s}s]:\n\n${formatted}\n\n` +
        `These are exported but never called. Either:\n` +
        `  1. Delete the dead code\n` +
        `  2. Add to known_entrypoints/${modified_packages[0]}.json if legitimate API`
    );
  } else {
    log(`All entry points are in whitelists (${elapsed_s}s)`);
  }

  process.exit(0);
}

main().catch((error) => {
  log(`Fatal error: ${error}`);
  console.log(
    JSON.stringify({
      decision: "block",
      reason: `Entry point detection failed: ${error}`,
    })
  );
  process.exit(0);
});

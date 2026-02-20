#!/usr/bin/env npx tsx
/**
 * Claude Code Stop hook: Build modified packages to keep dist/ up to date
 *
 * Detects which packages have modified source files (via get_changed_files),
 * then builds them in dependency order. Downstream dependents are
 * included automatically so their dist/ stays consistent.
 *
 * Dependency chain: types → core → mcp
 */

import { execSync } from "child_process";
import { create_logger, parse_stdin, get_project_dir, get_changed_files } from "./utils.js";

const log = create_logger("build");

interface PackageInfo {
  dir: string;
  workspace: string;
}

/**
 * Ordered list of buildable packages with their workspace names.
 * Order matters: each package may depend on earlier ones.
 */
const PACKAGES: PackageInfo[] = [
  { dir: "types", workspace: "@ariadnejs/types" },
  { dir: "core", workspace: "@ariadnejs/core" },
  { dir: "mcp", workspace: "@ariadnejs/mcp" },
];

/**
 * Map from package dir to the set of downstream packages that must
 * also be rebuilt when it changes.
 */
const DEPENDENTS: Record<string, string[]> = {
  types: ["core", "mcp"],
  core: ["mcp"],
  mcp: [],
};

/**
 * Expand modified packages to include downstream dependents,
 * then return them in build order (deduped).
 */
function resolve_build_order(modified: string[]): PackageInfo[] {
  const to_build = new Set(modified);

  for (const pkg of modified) {
    const deps = DEPENDENTS[pkg];
    if (deps) {
      for (const dep of deps) {
        to_build.add(dep);
      }
    }
  }

  return PACKAGES.filter((p) => to_build.has(p.dir));
}

function main(): void {
  log("Hook started");
  parse_stdin();

  const project_dir = get_project_dir();
  const changed = get_changed_files(project_dir);

  if (changed.modified_packages.length === 0) {
    log("No packages modified, skipping build");
    return;
  }

  log(`Modified packages: ${changed.modified_packages.join(", ")}`);
  const build_list = resolve_build_order(changed.modified_packages);
  log(`Build order: ${build_list.map((p) => p.dir).join(" → ")}`);

  const errors: string[] = [];

  for (const pkg of build_list) {
    log(`Building ${pkg.dir}...`);
    try {
      execSync(`pnpm --filter ${pkg.workspace} build`, {
        cwd: project_dir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 120000,
      });
      log(`${pkg.dir} built successfully`);
    } catch (error: unknown) {
      const exec_error = error as { stdout?: string; stderr?: string };
      const output = (exec_error.stdout || "") + "\n" + (exec_error.stderr || "");
      log(`${pkg.dir} build failed: ${output.substring(0, 300)}`);
      errors.push(`Build failed for ${pkg.dir}:\n${output.trim().substring(0, 1000)}`);
      // Stop building further packages since they likely depend on this one
      break;
    }
  }

  if (errors.length > 0) {
    log("Build completed with errors - blocking");
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `Package build failed:\n\n${errors.join("\n\n")}\n\nFix the build errors before completing.`,
      })
    );
  } else {
    log("All packages built successfully");
  }

  process.exit(0);
}

main();

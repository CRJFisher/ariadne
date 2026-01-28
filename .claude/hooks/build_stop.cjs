#!/usr/bin/env node
/**
 * Claude Code Stop hook: Build modified packages to keep dist/ up to date
 *
 * Detects which packages have modified source files (via git diff),
 * then builds them in dependency order. Downstream dependents are
 * included automatically so their dist/ stays consistent.
 *
 * Dependency chain: types → core → mcp
 */
/* eslint-disable no-undef */

const { execSync } = require("child_process");
const { create_logger, parse_stdin } = require("./utils.cjs");

const log = create_logger("build");

/**
 * Ordered list of buildable packages with their workspace names.
 * Order matters: each package may depend on earlier ones.
 */
const PACKAGES = [
  { dir: "types", workspace: "@ariadnejs/types" },
  { dir: "core", workspace: "@ariadnejs/core" },
  { dir: "mcp", workspace: "@ariadnejs/mcp" },
];

/**
 * Map from package dir to the set of downstream packages that must
 * also be rebuilt when it changes.
 */
const DEPENDENTS = {
  types: ["core", "mcp"],
  core: ["mcp"],
  mcp: [],
};

/**
 * Detect which packages have modified source files (staged or unstaged).
 */
function get_modified_packages(project_dir) {
  try {
    const diff_output = execSync("git diff --name-only HEAD", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const staged_output = execSync("git diff --name-only --cached", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const all_files = [...diff_output.split("\n"), ...staged_output.split("\n")]
      .filter((f) => f.trim())
      .filter((f) => f.startsWith("packages/"));

    const packages = new Set();
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
 * Expand modified packages to include downstream dependents,
 * then return them in build order (deduped).
 */
function resolve_build_order(modified) {
  const to_build = new Set(modified);

  for (const pkg of modified) {
    const deps = DEPENDENTS[pkg];
    if (deps) {
      for (const dep of deps) {
        to_build.add(dep);
      }
    }
  }

  // Return in dependency order
  return PACKAGES.filter((p) => to_build.has(p.dir));
}

function main() {
  log("Hook started");
  parse_stdin();

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const modified = get_modified_packages(project_dir);

  if (modified.length === 0) {
    log("No packages modified, skipping build");
    return;
  }

  log(`Modified packages: ${modified.join(", ")}`);
  const build_list = resolve_build_order(modified);
  log(`Build order: ${build_list.map((p) => p.dir).join(" → ")}`);

  const errors = [];

  for (const pkg of build_list) {
    log(`Building ${pkg.dir}...`);
    try {
      execSync(`npm run build -w ${pkg.workspace}`, {
        cwd: project_dir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 120000,
      });
      log(`${pkg.dir} built successfully`);
    } catch (error) {
      const output = (error.stdout || "") + "\n" + (error.stderr || "");
      log(`${pkg.dir} build failed: ${output.substring(0, 300)}`);
      errors.push(`Build failed for ${pkg.dir}:\n${output.trim().substring(0, 1000)}`);
      // Stop building further packages since they likely depend on this one
      break;
    }
  }

  if (errors.length > 0) {
    log(`Build completed with errors - blocking`);
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `Package build failed:\n\n${errors.join("\n\n")}\n\nFix the build errors before completing.`,
      })
    );
  } else {
    log(`All packages built successfully`);
  }

  process.exit(0);
}

main();

#!/usr/bin/env node
/**
 * Claude Code Stop hook: Entry point detection
 *
 * Runs ariadne self-analysis on packages/core and compares
 * detected entry points against the known public API.
 * Blocks if unexpected entry points are found.
 */
/* eslint-disable no-undef */

const { execSync } = require("child_process");
const { readFileSync } = require("fs");
const path = require("path");
const { create_logger, parse_stdin } = require("./utils.cjs");

const log = create_logger("entrypoint");

function main() {
  log("Hook started");
  parse_stdin();

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  log(`Project dir: ${project_dir}`);

  // 1. Run detection script with timing
  log("Running entrypoint detection...");
  const start_time = Date.now();

  let detection_output;
  try {
    detection_output = execSync(
      "npx tsx top-level-nodes-analysis/detect_entrypoints_using_ariadne.ts --stdout",
      { cwd: project_dir, encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"] }
    );
  } catch (error) {
    const elapsed = ((Date.now() - start_time) / 1000).toFixed(1);
    log(`Detection failed after ${elapsed}s: ${error.message}`);
    console.log(JSON.stringify({
      decision: "block",
      reason: `Entry point detection failed after ${elapsed}s:\n${error.message}`
    }));
    process.exit(0);
  }

  const elapsed_ms = Date.now() - start_time;
  const elapsed_s = (elapsed_ms / 1000).toFixed(1);
  log(`Detection completed in ${elapsed_s}s (${elapsed_ms}ms)`);

  // 2. Parse detection results (extract JSON from mixed output)
  const json_match = detection_output.match(/\{[\s\S]*\}/);
  if (!json_match) {
    log("Failed to parse JSON from detection output");
    console.log(JSON.stringify({
      decision: "block",
      reason: "Entry point detection produced invalid output (no JSON found)"
    }));
    process.exit(0);
  }

  let detected;
  try {
    detected = JSON.parse(json_match[0]);
  } catch (parse_error) {
    log(`Failed to parse detection JSON: ${parse_error.message}`);
    console.log(JSON.stringify({
      decision: "block",
      reason: `Entry point detection produced invalid JSON:\n${parse_error.message}`
    }));
    process.exit(0);
  }

  // 3. Load whitelist (11 public Project API methods)
  const whitelist_path = path.join(project_dir, "top-level-nodes-analysis/ground_truth/project_api_methods.json");
  let whitelist;
  try {
    whitelist = JSON.parse(readFileSync(whitelist_path, "utf8"));
  } catch (whitelist_error) {
    log(`Failed to load whitelist: ${whitelist_error.message}`);
    console.log(JSON.stringify({
      decision: "block",
      reason: `Failed to load entry point whitelist:\n${whitelist_error.message}`
    }));
    process.exit(0);
  }

  const allowed_names = new Set(whitelist.map(e => e.name));
  log(`Whitelist has ${allowed_names.size} allowed entry points`);

  // 4. Find unexpected entry points
  const unexpected = detected.entry_points.filter(ep => !allowed_names.has(ep.name));

  // 5. Report results (always include timing in log)
  if (unexpected.length > 0) {
    const formatted = unexpected.map(ep =>
      `  - ${ep.name} (${ep.kind})\n    ${ep.file_path}:${ep.start_line}`
    ).join("\n\n");

    log(`Found ${unexpected.length} unexpected entry points (analysis took ${elapsed_s}s)`);
    console.log(JSON.stringify({
      decision: "block",
      reason: `Found ${unexpected.length} unexpected entry point(s) [${elapsed_s}s]:\n\n${formatted}\n\nThese are exported but never called. Either:\n  1. Delete the dead code\n  2. Add to ground_truth/project_api_methods.json if legitimate API`
    }));
  } else {
    log(`All ${detected.entry_points.length} entry points are in whitelist (${elapsed_s}s)`);
  }

  process.exit(0);
}

main();

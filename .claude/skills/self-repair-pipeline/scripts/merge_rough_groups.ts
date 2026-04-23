#!/usr/bin/env node --import tsx
/**
 * CLI: collect rough-aggregator outputs into canonical pass3 input.
 *
 * Delegates merging to `src/aggregation/merge_rough_groups.ts`.
 *
 * Usage:
 *   node --import tsx merge_rough_groups.ts --project <name>
 *
 * Output (JSON to stdout):
 *   { group_count: number }
 */

import fs from "fs";
import path from "path";
import { merge_rough_groups } from "../src/aggregation/merge_rough_groups.js";
import type { Pass1Output } from "../src/aggregation/types.js";
import { parse_project_arg, require_state_file } from "../src/triage_state_paths.js";
import "../src/guard_tsx_invocation.js";

const project = parse_project_arg(process.argv, "Usage: merge_rough_groups.ts --project <name>");
const state_path = require_state_file(project);

const aggregation_dir = path.join(path.dirname(state_path), "aggregation");
const pass1_dir = path.join(aggregation_dir, "pass1");

if (!fs.existsSync(pass1_dir)) {
  process.stderr.write(`Error: pass1 directory not found at ${pass1_dir}\n`);
  process.exit(1);
}

const pass1_outputs: Pass1Output[] = fs
  .readdirSync(pass1_dir)
  .filter((f) => f.endsWith(".output.json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(pass1_dir, f), "utf8")) as Pass1Output);

const canonical_groups = merge_rough_groups(pass1_outputs);

const pass3_dir = path.join(aggregation_dir, "pass3");
fs.mkdirSync(pass3_dir, { recursive: true });
fs.writeFileSync(
  path.join(pass3_dir, "input.json"),
  JSON.stringify({ canonical_groups }, null, 2) + "\n",
);

console.error(`Wrote ${canonical_groups.length} canonical group(s) to pass3/input.json`);
process.stdout.write(JSON.stringify({ group_count: canonical_groups.length }) + "\n");

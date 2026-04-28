#!/usr/bin/env node --import tsx
/**
 * Mark a run as abandoned. Updates manifest.status and clears the project's
 * LATEST pointer if it currently points at the run being abandoned.
 *
 * Useful for "this run hung / errored mid-pipeline; I'm starting fresh."
 *
 * Usage:
 *   node --import tsx abandon_run.ts --project <name> [--run-id <id>]
 *
 * If --run-id is omitted, the LATEST run is abandoned.
 */

import * as fs from "node:fs/promises";

import { read_manifest } from "../src/run_discovery.js";
import { parse_project_arg, parse_run_id_arg } from "../src/cli_args.js";
import {
  clear_latest,
  read_latest_run_id,
  require_run,
} from "../src/triage_state_paths.js";
import "../src/guard_tsx_invocation.js";

const USAGE = "Usage: abandon_run.ts --project <name> [--run-id <id>]";

async function main(): Promise<void> {
  const project = parse_project_arg(process.argv, USAGE);
  const run_id_opt = parse_run_id_arg(process.argv);
  const { run_id, manifest_path } = require_run(project, run_id_opt);

  const manifest = await read_manifest(project, run_id);

  if (manifest.status === "finalized") {
    process.stderr.write(`Refusing to abandon finalized run ${run_id}.\n`);
    process.exit(1);
  }

  manifest.status = "abandoned";
  await fs.writeFile(manifest_path, JSON.stringify(manifest, null, 2) + "\n");

  if (read_latest_run_id(project) === run_id) {
    clear_latest(project);
  }

  process.stdout.write(JSON.stringify({ project, run_id, status: "abandoned" }) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

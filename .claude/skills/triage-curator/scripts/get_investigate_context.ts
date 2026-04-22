#!/usr/bin/env node
/**
 * Hydrates the context for the `triage-curator-investigator` sub-agent.
 *
 * The main agent passes pointers only (`--group`, `--run`, `--output`). This
 * script loads the full group (all entries — no sampling), the current
 * registry, the signal inventory, and the write-scope allowlist, and prints
 * the bundle as JSON to stdout. The sub-agent uses this to propose a new
 * classifier, backlog task, and missing signals.
 *
 * Usage:
 *   node --import tsx .claude/skills/triage-curator/scripts/get_investigate_context.ts \
 *     --group <group_id> --run <triage_results.json>
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { error_code } from "../src/errors.js";
import { get_builtins_glob, get_registry_file_path } from "../src/paths.js";
import type { KnownIssue, TriageResultsFile } from "../src/types.js";
import "../src/require_node_import_tsx.js";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(THIS_DIR, "..");
const SIGNAL_INVENTORY_PATH = path.join(SKILL_DIR, "reference", "signal_inventory.md");

interface CliArgs {
  group_id: string;
  run_path: string;
}

function parse_argv(argv: string[]): CliArgs {
  let group_id: string | null = null;
  let run_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--group":
        group_id = argv[++i];
        break;
      case "--run":
        run_path = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write("Usage: get_investigate_context --group <id> --run <path>\n");
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (group_id === null || group_id.length === 0) {
    throw new Error("--group <id> is required");
  }
  if (run_path === null || run_path.length === 0) {
    throw new Error("--run <path> is required");
  }
  return { group_id, run_path };
}

async function read_optional_file(file_path: string): Promise<string | null> {
  try {
    return await fs.readFile(file_path, "utf8");
  } catch (err) {
    if (error_code(err) === "ENOENT") return null;
    throw err;
  }
}

async function main(): Promise<void> {
  const { group_id, run_path } = parse_argv(process.argv.slice(2));

  const triage_raw = await fs.readFile(run_path, "utf8");
  const triage = JSON.parse(triage_raw) as TriageResultsFile;

  const group = triage.false_positive_groups[group_id];
  if (group === undefined) {
    throw new Error(`group_id "${group_id}" not found in ${run_path}`);
  }

  const registry_path = get_registry_file_path();
  const registry_raw = await fs.readFile(registry_path, "utf8");
  const registry = JSON.parse(registry_raw) as KnownIssue[];

  const signal_inventory = await read_optional_file(SIGNAL_INVENTORY_PATH);

  const writable_paths = [registry_path, get_builtins_glob()];

  const out = {
    group_id,
    run_path,
    group,
    registry,
    signal_inventory_path: SIGNAL_INVENTORY_PATH,
    signal_inventory,
    writable_paths,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(
    `get_investigate_context failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

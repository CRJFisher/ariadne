#!/usr/bin/env node
/**
 * Reads every QA response under `~/.ariadne/triage-curator/runs/<run_id>/qa/`,
 * decides which groups are sufficiently mis-classified to warrant investigation,
 * and emits a dispatch list the main agent can mechanically fire Task() calls
 * against. Output paths are pre-created under the new `investigate_promoted/`
 * sibling directory of `qa/` and `investigate/`, so the finalize globber can
 * treat the three dirs uniformly.
 *
 * The promotion threshold uses `outliers / sample_size` — the classifier-broken
 * signal. This is complementary to `detect_drift` (group-size denominator,
 * sticky registry tag).
 *
 * Usage:
 *   node --import tsx .claude/skills/triage-curator/scripts/promote_qa_to_investigate.ts \
 *     --run <triage_results.json> [--dry-run]
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse_qa_response } from "../src/apply_proposals.js";
import { error_code } from "../src/errors.js";
import {
  get_registry_file_path,
  run_output_dir,
} from "../src/paths.js";
import { should_promote_to_investigate } from "../src/promote_to_investigate.js";
import { SAMPLE_SIZE } from "../src/source_excerpt.js";
import type {
  KnownIssue,
  QaResponse,
  TriageResultsFile,
} from "../src/types.js";
import "../src/require_node_import_tsx.js";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "..", "..", "..", "..");
const SCRIPTS_REL = path.relative(REPO_ROOT, THIS_DIR);

interface CliArgs {
  run_path: string;
  dry_run: boolean;
}

function parse_argv(argv: string[]): CliArgs {
  let run_path: string | null = null;
  let dry_run = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--run":
        run_path = argv[++i];
        break;
      case "--dry-run":
        dry_run = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: promote_qa_to_investigate --run <triage_results.json> [--dry-run]\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (run_path === null || run_path.length === 0) throw new Error("--run <path> is required");
  return { run_path, dry_run };
}

function derive_run_id(run_path: string): string {
  return path.basename(run_path, ".json");
}

interface PromotedEntry {
  group_id: string;
  member_count: number;
  sample_size: number;
  sample_outlier_rate: number;
  output_path: string;
  get_context_cmd: string;
}

interface SkippedEntry {
  group_id: string;
  reason: string;
  sample_outlier_rate: number;
}

async function read_qa_responses(qa_dir: string): Promise<QaResponse[]> {
  let files: string[];
  try {
    files = await fs.readdir(qa_dir);
  } catch (err) {
    if (error_code(err) === "ENOENT") return [];
    throw err;
  }
  const results: QaResponse[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = JSON.parse(await fs.readFile(path.join(qa_dir, file), "utf8"));
    const parsed = parse_qa_response(raw);
    if ("error" in parsed) {
      process.stderr.write(`skipping ${file}: ${parsed.error}\n`);
      continue;
    }
    results.push(parsed);
  }
  return results;
}

async function main(): Promise<void> {
  const { run_path, dry_run } = parse_argv(process.argv.slice(2));

  const triage = JSON.parse(await fs.readFile(run_path, "utf8")) as TriageResultsFile;
  const registry = JSON.parse(
    await fs.readFile(get_registry_file_path(), "utf8"),
  ) as KnownIssue[];
  const registry_by_group = new Map(registry.map((e) => [e.group_id, e]));

  const run_id = derive_run_id(run_path);
  const output_dir = run_output_dir(run_id);
  const qa_dir = path.join(output_dir, "qa");
  const promoted_dir = path.join(output_dir, "investigate_promoted");
  if (!dry_run) {
    await fs.mkdir(promoted_dir, { recursive: true });
  }

  const inv_script = path.join(SCRIPTS_REL, "get_investigate_context.ts");
  const run_rel = path.relative(REPO_ROOT, run_path);

  const qa_responses = await read_qa_responses(qa_dir);

  const promoted_groups: PromotedEntry[] = [];
  const skipped: SkippedEntry[] = [];

  for (const qa of qa_responses) {
    const group = triage.false_positive_groups[qa.group_id];
    if (group === undefined) {
      skipped.push({
        group_id: qa.group_id,
        reason: "group_id not present in triage_results",
        sample_outlier_rate: 0,
      });
      continue;
    }
    const member_count = group.entries.length;
    const sample_size = Math.min(SAMPLE_SIZE, member_count);
    const registry_entry = registry_by_group.get(qa.group_id);
    if (registry_entry === undefined) {
      skipped.push({
        group_id: qa.group_id,
        reason: "no registry entry — QA would not have run",
        sample_outlier_rate: 0,
      });
      continue;
    }

    const decision = should_promote_to_investigate(qa, sample_size, registry_entry);
    if (!decision.promote) {
      skipped.push({
        group_id: qa.group_id,
        reason: decision.reason,
        sample_outlier_rate: decision.sample_outlier_rate,
      });
      continue;
    }

    const output_path = path.join(promoted_dir, `${qa.group_id}.json`);
    const get_context_cmd = `node --import tsx ${inv_script} --group ${qa.group_id} --run ${run_rel} --promoted`;

    promoted_groups.push({
      group_id: qa.group_id,
      member_count,
      sample_size,
      sample_outlier_rate: decision.sample_outlier_rate,
      output_path,
      get_context_cmd,
    });
  }

  process.stdout.write(
    JSON.stringify(
      {
        run_id,
        run_path,
        dry_run,
        promoted_groups,
        skipped,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((err) => {
  process.stderr.write(
    `promote_qa_to_investigate failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

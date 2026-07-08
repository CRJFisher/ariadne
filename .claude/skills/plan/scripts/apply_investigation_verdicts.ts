#!/usr/bin/env node
/**
 * Make the `refactor-investigator`'s on-disk `verdict.json` authoritative over a
 * `PlanTask`'s mint-time `is_permanent_limitation` flag. Prioritize runs this
 * after the investigation wave (step 3.5): it strict-parses each verdict, and
 * where the verdict disagrees with the row's flag it flips the flag through the
 * task-DB writer and records the disagreement in `reroutes.json`. The export gate
 * (`select_exportable_tasks`) then agrees with the investigation, and
 * `validate_consolidation` reads `reroutes.json` to keep a rerouted-to-permanent
 * row out of every cluster (the Z24 wedge).
 *
 * Inputs:
 *   --verdict <path>...   one or more verdict.json files (repeatable / space-listed)
 *   --reroutes <path>     where to write the reroutes.json (the run's staging root)
 *   --dry-run             compute and print reroutes; flip nothing, write nothing
 *
 * Exit codes: usage error → 2 (with USAGE); a verdict naming an unknown row → 1.
 *
 * **Script invocation:** always `node --import tsx`. Never `pnpm exec tsx`.
 */

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { atomic_write_file } from "@ariadnejs/skill-fs";

import { JsonPlanTaskRepository } from "../src/store/json_plan_task_repository.js";
import type { PlanTask } from "../src/store/plan_task.js";
import {
  parse_investigation_verdict,
  reconcile_verdicts,
  type RowFlag,
} from "../src/reconcile/investigation_verdict.js";
import type { PermanentLimitationReroute } from "../src/reconcile/permanent_reroute.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: apply_investigation_verdicts --verdict <path>... --reroutes <out-path> [--dry-run]\n";

interface CliArgs {
  verdict_paths: string[];
  reroutes_path: string;
  dry_run: boolean;
}

class UsageError extends Error {}

function parse_argv(argv: string[]): CliArgs {
  const verdict_paths: string[] = [];
  let reroutes_path: string | null = null;
  let dry_run = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--verdict":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          verdict_paths.push(argv[++i]);
        }
        break;
      case "--reroutes":
        reroutes_path = argv[++i] ?? null;
        break;
      case "--dry-run":
        dry_run = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      default:
        throw new UsageError(`Unknown argument: ${arg}`);
    }
  }
  if (verdict_paths.length === 0) throw new UsageError("at least one --verdict <path> is required");
  if (reroutes_path === null || reroutes_path.length === 0) {
    throw new UsageError("--reroutes <out-path> is required");
  }
  return { verdict_paths, reroutes_path, dry_run };
}

/** An apply run is not a sweep, but the task-DB stamps `updated_in_sweep`; namespace it. */
function mint_run_id(now: Date): string {
  return `verdicts-${now.toISOString().replace(/[:.]/g, "-")}`;
}

export interface ApplyVerdictsSummary {
  dry_run: boolean;
  reroutes: PermanentLimitationReroute[];
  reroutes_path: string;
}

export async function run(argv: string[], now: Date = new Date()): Promise<ApplyVerdictsSummary> {
  const { verdict_paths, reroutes_path, dry_run } = parse_argv(argv);

  const verdicts = await Promise.all(
    verdict_paths.map(async (path) =>
      parse_investigation_verdict(JSON.parse(await readFile(path, "utf8")), path),
    ),
  );

  const repo = new JsonPlanTaskRepository();
  const all_tasks = await repo.query({});
  const flag_by_id = new Map<string, RowFlag>(
    all_tasks.map((task) => [
      task.id,
      { fault_area: task.fault_area, is_permanent_limitation: task.is_permanent_limitation },
    ]),
  );

  const { reroutes, unknown_row_ids } = reconcile_verdicts(verdicts, flag_by_id);
  if (unknown_row_ids.length > 0) {
    throw new Error(
      `verdict names row id(s) absent from the task-DB: ${unknown_row_ids.join(", ")}`,
    );
  }

  if (!dry_run) {
    const run_id = mint_run_id(now);
    const task_by_id = new Map<string, PlanTask>(all_tasks.map((task) => [task.id, task]));
    for (const reroute of reroutes) {
      const task = task_by_id.get(reroute.row_id);
      if (task === undefined) continue; // unreachable — reconcile only emits known ids
      await repo.put({
        ...task,
        is_permanent_limitation: reroute.now_permanent_limitation,
        updated_in_sweep: run_id,
      });
    }
    await atomic_write_file(reroutes_path, `${JSON.stringify(reroutes, null, 2)}\n`);
  }

  return { dry_run, reroutes, reroutes_path };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2))
    .then((summary) => process.stdout.write(JSON.stringify(summary, null, 2) + "\n"))
    .catch((err) => {
      if (err instanceof UsageError) {
        process.stderr.write(`${err.message}\n${USAGE}`);
        process.exit(2);
      }
      process.stderr.write(
        `apply_investigation_verdicts failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
      );
      process.exit(1);
    });
}

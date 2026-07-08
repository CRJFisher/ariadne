#!/usr/bin/env node --import tsx
/**
 * Prioritize step-1 advisory: print live task-DB candidates whose flagged MEMBER
 * set overlaps work already promoted into `backlog/`. Read-only — writes nothing,
 * suppresses nothing. Reconcile's exact `dedup_key` match already suppresses full
 * overlaps; this surfaces the PARTIAL overlaps that exact match misses, so the
 * human can judge whether a candidate duplicates promoted work before graduating.
 *
 * Usage:
 *   node --import tsx cross_check_exported_overlap.ts [--format text|json]
 */

import { JsonPlanTaskRepository } from "../src/store/json_plan_task_repository.js";
import {
  find_exported_overlaps,
  format_exported_overlaps,
} from "../src/reconcile/exported_overlap.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

function parse_format(argv: readonly string[]): "text" | "json" {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format") {
      const v = args[i + 1] ?? "";
      if (v === "text" || v === "json") return v;
      process.stderr.write("Error: --format must be text|json\n");
      process.exit(1);
    }
  }
  return "text";
}

async function main(): Promise<void> {
  const format = parse_format(process.argv);
  const repo = new JsonPlanTaskRepository();
  const all_tasks = await repo.query({});
  const overlaps = find_exported_overlaps(all_tasks);

  if (format === "json") {
    process.stdout.write(JSON.stringify({ overlaps }, null, 2) + "\n");
    return;
  }
  if (overlaps.length === 0) {
    process.stdout.write("No exported-overlap collisions.\n");
    return;
  }
  process.stdout.write(format_exported_overlaps(overlaps) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

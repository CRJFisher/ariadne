#!/usr/bin/env npx tsx
/**
 * One named call site per failure reason, for a corpus the harness measured.
 *
 * A taxonomy row says how many calls ended for each reason; re-attributing the
 * residue needs a site to read. This loads the same file set the arm loaded,
 * through the same loader, and prints the first `--per-reason` sites each
 * reason holds, with the caller file and line a reader opens.
 */
import * as path from "path";
import { location_key } from "@ariadnejs/types";
import type { ResolutionFailureReason } from "@ariadnejs/types";
import { discover_corpus, parse_corpus_predicate_name } from "../src/benchmark_corpus_load";
import { load_project } from "../src/project/load_project";

function flag(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required flag --${name}`);
  }
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const corpus_root = path.resolve(flag("corpus-root"));
  const predicate = parse_corpus_predicate_name(flag("predicate"));
  const per_reason = Number(flag("per-reason", "3"));
  const files = await discover_corpus(corpus_root, predicate);
  const loaded = await load_project({ project_path: corpus_root, files });

  const sites = new Map<ResolutionFailureReason, string[]>();
  const counts = new Map<ResolutionFailureReason, number>();
  const names = new Map<ResolutionFailureReason, Map<string, number>>();
  const indexed = [...loaded.discovered_files].filter((f) => !loaded.dropped_files.has(f));
  for (const file of indexed) {
    for (const call of loaded.project.resolutions.get_calls_for_file(file)) {
      if (call.resolutions.length > 0) continue;
      const failure = call.resolution_failure;
      if (failure === undefined) continue;
      counts.set(failure.reason, (counts.get(failure.reason) ?? 0) + 1);
      const by_name = names.get(failure.reason) ?? new Map<string, number>();
      by_name.set(String(call.name), (by_name.get(String(call.name)) ?? 0) + 1);
      names.set(failure.reason, by_name);
      const held = sites.get(failure.reason) ?? [];
      if (held.length < per_reason) {
        held.push(
          `${call.call_type} ${call.name} @ ${location_key(call.location).replace(corpus_root + "/", "")}`,
        );
        sites.set(failure.reason, held);
      }
    }
  }
  const ordered = [...counts].sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of ordered) {
    console.log(`${reason}\t${count}`);
    for (const site of sites.get(reason) ?? []) console.log(`    ${site}`);
    const histogram = [...(names.get(reason) ?? new Map())]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    for (const [name, n] of histogram) {
      console.log(`      ${String(n).padStart(7)}  ${((100 * n) / count).toFixed(1)}%  ${name}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});

/**
 * Pure pipeline core for `scripts/prepare_triage.ts`.
 *
 * Extracted so the two-bucket orchestration can be exercised in unit tests
 * without spawning a subprocess or touching the filesystem for state writes.
 *
 * Responsibilities:
 *   1. Partition entries into `auto` (predicate classifier) and `residual` buckets
 *      using the provided registry + reader.
 *   2. Order the residual bucket deterministically and apply `max_count`.
 *   3. Delegate shape assembly to `build_triage_entries`.
 */

import {
  auto_classify,
  type ClassifiedEntryPointResult,
  type FileLinesReader,
} from "@ariadnejs/core";
import {
  build_triage_entries,
  type BuildTriageEntriesInput,
  type ResidualEntryPoint,
} from "./build_triage_entries.js";
import type { EnrichedEntryPoint, KnownIssuesRegistry } from "@ariadnejs/types";
import type { TriageEntry } from "./triage_state_types.js";

export interface PrepareTriageInput {
  entry_points: EnrichedEntryPoint[];
  registry: KnownIssuesRegistry;
  read_file_lines: FileLinesReader;
  /** When set, truncate the ordered residual bucket to this many entries. */
  max_count: number | null;
}

export interface PrepareTriageReport {
  entries: TriageEntry[];
  stats: {
    auto_count: number;
    residual_total: number;
    residual_kept: number;
  };
}

/**
 * Stable ordering for residual sampling. Largest trees first (most likely to
 * matter), then file+line for a total order so two runs on the same analysis
 * JSON pick the same top-N.
 */
export function sort_residual_entry_points(entries: ResidualEntryPoint[]): ResidualEntryPoint[] {
  return [...entries].sort((a, b) => {
    const size_delta = b.entry_point.tree_size - a.entry_point.tree_size;
    if (size_delta !== 0) return size_delta;
    if (a.entry_point.file_path < b.entry_point.file_path) return -1;
    if (a.entry_point.file_path > b.entry_point.file_path) return 1;
    return a.entry_point.start_line - b.entry_point.start_line;
  });
}

export function prepare_triage(input: PrepareTriageInput): PrepareTriageReport {
  const classified = auto_classify(input.entry_points, input.registry, input.read_file_lines);

  const auto_hits: ClassifiedEntryPointResult[] = [];
  const residual_pool: ResidualEntryPoint[] = [];
  for (const { entry_point, result } of classified) {
    if (result.auto_classified) {
      auto_hits.push({ entry_point, result });
    } else {
      residual_pool.push({ entry_point, classifier_hints: result.classifier_hints });
    }
  }

  const sorted_residual = sort_residual_entry_points(residual_pool);
  const residual =
    input.max_count === null ? sorted_residual : sorted_residual.slice(0, input.max_count);

  const build_input: BuildTriageEntriesInput = {
    auto_classified: auto_hits,
    residual,
  };
  const entries = build_triage_entries(build_input);

  return {
    entries,
    stats: {
      auto_count: auto_hits.length,
      residual_total: residual_pool.length,
      residual_kept: residual.length,
    },
  };
}

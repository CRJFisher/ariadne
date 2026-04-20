/**
 * Pure pipeline core for `scripts/prepare_triage.ts`.
 *
 * Extracted so the three-bucket orchestration can be exercised in unit tests
 * without spawning a subprocess or touching the filesystem for state writes.
 *
 * Responsibilities:
 *   1. Partition entries into `known` (whitelist), `auto` (predicate classifier),
 *      and `residual` buckets using the provided registry + reader.
 *   2. Order the residual bucket deterministically and apply `max_count`.
 *   3. Delegate shape assembly to `build_triage_entries`.
 */

import { auto_classify } from "../auto_classify/auto_classify.js";
import type { AutoClassifiedEntry, FileLinesReader } from "../auto_classify/types.js";
import {
  build_triage_entries,
  type BuildTriageEntriesInput,
  type ResidualEntry,
} from "../build_triage_entries.js";
import type { FilterResult } from "../known_entrypoints.js";
import type { KnownIssuesRegistry } from "../types.js";
import type { TriageEntry } from "../triage_state_types.js";

export interface PrepareTriageInput {
  filtered: FilterResult;
  registry: KnownIssuesRegistry;
  read_file_lines: FileLinesReader;
  /** When set, truncate the ordered residual bucket to this many entries. */
  max_count: number | null;
}

export interface PrepareTriageReport {
  entries: TriageEntry[];
  stats: {
    known_count: number;
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
export function sort_residual_entries(entries: ResidualEntry[]): ResidualEntry[] {
  return [...entries].sort((a, b) => {
    const size_delta = b.entry.tree_size - a.entry.tree_size;
    if (size_delta !== 0) return size_delta;
    if (a.entry.file_path < b.entry.file_path) return -1;
    if (a.entry.file_path > b.entry.file_path) return 1;
    return a.entry.start_line - b.entry.start_line;
  });
}

export function prepare_triage(input: PrepareTriageInput): PrepareTriageReport {
  const classified = auto_classify(input.filtered.remaining, input.registry, input.read_file_lines);

  const auto_hits: AutoClassifiedEntry[] = [];
  const residual_pool: ResidualEntry[] = [];
  for (const { entry, result } of classified) {
    if (result.auto_classified) {
      auto_hits.push({ entry, result });
    } else {
      residual_pool.push({ entry, classifier_hints: result.classifier_hints });
    }
  }

  const sorted_residual = sort_residual_entries(residual_pool);
  const residual =
    input.max_count === null ? sorted_residual : sorted_residual.slice(0, input.max_count);

  const build_input: BuildTriageEntriesInput = {
    known: input.filtered.known_true_positives,
    auto_classified: auto_hits,
    residual,
  };
  const entries = build_triage_entries(build_input);

  return {
    entries,
    stats: {
      known_count: input.filtered.known_true_positives.length,
      auto_count: auto_hits.length,
      residual_total: residual_pool.length,
      residual_kept: residual.length,
    },
  };
}

/**
 * Entry point classification using the known-entrypoints registry.
 *
 * Matches entries against known sources (project TPs, dead code, framework
 * patterns). Entries that don't match any source are left unclassified
 * for LLM triage.
 */

import type { EnrichedFunctionEntry, KnownEntrypointSource } from "./types.js";
import {
  filter_known_entrypoints,
  type KnownEntrypointMatch,
} from "./known_entrypoints.js";

// ===== Classification Result Types =====

export interface PreClassificationResult {
  known_true_positives: KnownEntrypointMatch[];
  unclassified: EnrichedFunctionEntry[];
}

// ===== Main Classification Function =====

/**
 * Classify enriched entry points against the known-entrypoints registry.
 *
 * Entries matching any registry source become known true positives.
 * Everything else goes to unclassified for LLM triage.
 */
export function classify_entrypoints(
  entries: EnrichedFunctionEntry[],
  known_sources: KnownEntrypointSource[],
  project_path: string,
): PreClassificationResult {
  const { known_true_positives, remaining } = filter_known_entrypoints(
    entries,
    known_sources,
    project_path,
  );

  return { known_true_positives, unclassified: remaining };
}

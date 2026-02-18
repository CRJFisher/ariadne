/**
 * Convert classify_entrypoints() output into TriageEntry[].
 *
 * Registry matches become known-tp (completed), everything else
 * becomes llm-triage (pending).
 */

import type { PreClassificationResult } from "./classify_entrypoints.js";
import type { EnrichedFunctionEntry } from "./types.js";
import type { TriageEntry, TriageEntryResult } from "./triage_state_types.js";

function entry_to_triage_base(entry: EnrichedFunctionEntry): Pick<
  TriageEntry,
  "name" | "file_path" | "start_line" | "kind" | "signature" | "diagnosis"
> {
  return {
    name: entry.name,
    file_path: entry.file_path,
    start_line: entry.start_line,
    kind: entry.kind,
    signature: entry.signature ?? null,
    diagnosis: entry.diagnostics.diagnosis,
  };
}

const KNOWN_TP_RESULT: TriageEntryResult = {
  is_true_positive: true,
  is_likely_dead_code: false,
  group_id: "true-positive",
  root_cause: "Known true positive",
  reasoning: "Matched known-entrypoints registry",
};

export function build_triage_entries(
  classification: PreClassificationResult,
): TriageEntry[] {
  const entries: TriageEntry[] = [];

  for (const match of classification.known_true_positives) {
    entries.push({
      ...entry_to_triage_base(match.entry),
      route: "known-tp",
      deterministic_group_id: null,
      known_source: match.source,
      status: "completed",
      result: KNOWN_TP_RESULT,
      error: null,
      attempt_count: 0,
    });
  }

  for (const entry of classification.unclassified) {
    entries.push({
      ...entry_to_triage_base(entry),
      route: "llm-triage",
      deterministic_group_id: null,
      known_source: null,
      status: "pending",
      result: null,
      error: null,
      attempt_count: 0,
    });
  }

  return entries;
}

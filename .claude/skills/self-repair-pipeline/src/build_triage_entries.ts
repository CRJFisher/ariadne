/**
 * Convert filter_known_entrypoints() output into TriageEntry[].
 *
 * Registry matches become known-unreachable (completed), everything else
 * becomes llm-triage (pending).
 */

import type { EnrichedFunctionEntry } from "./types.js";
import type { FilterResult } from "./known_entrypoints.js";
import type { TriageEntry, TriageEntryResult } from "./triage_state_types.js";

function entry_to_triage_base(entry: EnrichedFunctionEntry): Pick<
  TriageEntry,
  "name" | "file_path" | "start_line" | "kind" | "signature" | "diagnosis" | "is_exported" | "access_modifier" | "diagnostics"
> {
  return {
    name: entry.name,
    file_path: entry.file_path,
    start_line: entry.start_line,
    kind: entry.kind,
    signature: entry.signature ?? null,
    diagnosis: entry.diagnostics.diagnosis,
    is_exported: entry.is_exported,
    access_modifier: entry.access_modifier ?? null,
    diagnostics: entry.diagnostics,
  };
}

const KNOWN_UNREACHABLE_RESULT: TriageEntryResult = {
  ariadne_correct: true,
  group_id: "confirmed-unreachable",
  root_cause: "Known confirmed-unreachable",
  reasoning: "Matched known-entrypoints registry",
};

export function build_triage_entries(filtered: FilterResult): TriageEntry[] {
  const entries: TriageEntry[] = [];
  let index = 0;

  for (const match of filtered.known_true_positives) {
    entries.push({
      entry_index: index++,
      ...entry_to_triage_base(match.entry),
      route: "known-unreachable",
      known_source: match.source,
      status: "completed",
      result: KNOWN_UNREACHABLE_RESULT,
      error: null,
    });
  }

  for (const entry of filtered.remaining) {
    entries.push({
      entry_index: index++,
      ...entry_to_triage_base(entry),
      route: "llm-triage",
      known_source: null,
      status: "pending",
      result: null,
      error: null,
    });
  }

  return entries;
}

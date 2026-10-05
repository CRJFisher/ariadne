/**
 * Dispense payload assembled per investigator invocation.
 *
 * The payload carries everything the per-entry `triage-investigator` needs to
 * emit one `TriageVerdict` without round-tripping back through the dispatcher:
 *
 * - `entry_context` — the entry under investigation (the full `TriageEntry`
 *   from `triage.json`).
 * - `relevant_registry_slice` — the subset of wip + permanent classifier rules
 *   that are in scope for the entry. The investigator uses this to detect
 *   `fp-classifier-regression` (a rule whose classifier *should* have matched
 *   but did not) without loading the full registry.
 *
 * The slice filter is pure and deterministic: two investigators dispensed with
 * the same inputs see the same slice. The cap (`max_rules`) is an
 * observability bound, not a correctness one — exceeding it just truncates
 * the tail by `observed_count`.
 */

import type {
  KnownIssue,
  KnownIssuesRegistry,
} from "@ariadnejs/types";

import { language_from_extension } from "./language_from_extension.js";
import type { TriageEntry } from "../triage_state_types.js";

export const DEFAULT_REGISTRY_SLICE_MAX = 20;

export interface DispensePayload {
  entry_context: TriageEntry;
  relevant_registry_slice: KnownIssue[];
}

export interface BuildDispensePayloadInput {
  entry: TriageEntry;
  registry: KnownIssuesRegistry;
  max_rules?: number;
}

/**
 * Assemble the full payload for a single dispense. Pure: no I/O, no clock.
 */
export function build_dispense_payload(input: BuildDispensePayloadInput): DispensePayload {
  const max_rules = input.max_rules ?? DEFAULT_REGISTRY_SLICE_MAX;
  return {
    entry_context: input.entry,
    relevant_registry_slice: select_relevant_registry_slice(
      input.registry,
      input.entry,
      max_rules,
    ),
  };
}

/**
 * Filter the registry to the subset that is in scope for one entry, then sort
 * and truncate.
 *
 * Inclusion rule:
 *
 *   rule.status ∈ {wip, permanent}  AND
 *   rule.languages includes the entry's file-extension language
 *
 * Sorted by `observed_count` descending (missing `observed_count` treated as
 * 0), then `group_id` ascending for deterministic tie-breaks. Truncated to
 * `max_rules`.
 */
export function select_relevant_registry_slice(
  registry: KnownIssuesRegistry,
  entry: TriageEntry,
  max_rules: number,
): KnownIssue[] {
  const entry_language = language_from_extension(entry.file_path);
  const matches = registry.filter((rule) => {
    if (rule.status === "fixed") return false;
    return entry_language !== null && rule.languages.includes(entry_language);
  });
  matches.sort((a, b) => {
    const ac = a.observed_count ?? 0;
    const bc = b.observed_count ?? 0;
    if (ac !== bc) return bc - ac;
    return a.group_id < b.group_id ? -1 : a.group_id > b.group_id ? 1 : 0;
  });
  return matches.slice(0, max_rules);
}

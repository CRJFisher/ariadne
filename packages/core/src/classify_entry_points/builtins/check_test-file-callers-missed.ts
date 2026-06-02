// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// Entry has zero resolved inbound callers but grep located call sites inside unindexed test directories. The function is exercised by tests that Ariadne does not index, so it appears unreachable in the call graph.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_test_file_callers_missed(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = (entry_point.diagnostics.grep_call_sites_unindexed_tests.length > 0) === true;
  const check_1 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  return check_0 && check_1;
}

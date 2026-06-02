// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// JavaScript named-function-expression definitions assigned to a `var` (`var X = function X(...) { ... }`) whose only call sites live in the same file. Diagnostic fingerprint: diagnosis=callers-not-in-registry (resolver never registered any call refs), ariadne_call_refs=[] (callers_count_at_most:0), and every grep hit's file_path equals the definition's file_path (grep_hits_all_intra_file:true). The textual call sites exist (grep finds them) but Ariadne never produced a CallReference for them, so the function is reported as having zero callers.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_intra_file_call_not_in_registry(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "javascript";
  const check_1 = entry_point.diagnostics.diagnosis === "callers-not-in-registry";
  const check_2 = (entry_point.diagnostics.grep_call_sites.length > 0 && entry_point.diagnostics.grep_call_sites.every((h) => h.file_path === entry_point.file_path)) === true;
  const check_3 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  return check_0 && check_1 && check_2 && check_3;
}

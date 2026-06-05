// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// JavaScript function definitions whose only call sites live in the same file but the resolver returns name_not_in_scope for bare-name calls. Diagnostic shape: diagnosis=callers-in-registry-unresolved, all ariadne_call_refs failing with name_not_in_scope and receiver_kind=none, all grep hits intra-file. Captures the var-bound function expression pattern (var X = function X(...)) where the function symbol is extracted but the var-name binding is not added to the enclosing scope's symbol table.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_same_file_var_function_resolution(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "javascript";
  const check_1 = entry_point.diagnostics.diagnosis === "callers-in-registry-unresolved";
  const check_2 = entry_point.diagnostics.ariadne_call_refs.some((r) => r.resolution_failure !== null && r.resolution_failure.reason === "name_not_in_scope");
  const check_3 = entry_point.diagnostics.ariadne_call_refs.some((r) => r.receiver_kind === "none");
  const check_4 = (entry_point.diagnostics.grep_call_sites.length > 0 && entry_point.diagnostics.grep_call_sites.every((h) => h.file_path === entry_point.file_path)) === true;
  const check_5 = entry_point.diagnostics.ariadne_call_refs.length >= 1;
  return check_0 && check_1 && check_2 && check_3 && check_4 && check_5;
}

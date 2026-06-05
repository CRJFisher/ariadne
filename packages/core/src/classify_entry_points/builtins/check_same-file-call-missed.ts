// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// Definition has zero resolved Ariadne callers, but at least one textual grep hit, with every grep hit residing in the same file as the definition. Captures named function expressions assigned to var/let/const where the resolver fails to link intra-file call sites back to the definition (e.g. `var f = function f(...) {...}` called as `f(...)` elsewhere in the same module).

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_same_file_call_missed(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "javascript";
  const check_1 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  const check_2 = (entry_point.diagnostics.grep_call_sites.length > 0 && entry_point.diagnostics.grep_call_sites.every((h) => h.file_path === entry_point.file_path)) === true;
  return check_0 && check_1 && check_2;
}

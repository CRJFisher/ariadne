// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// Object-literal property methods invoked via this.<name>() from a sibling method in the same object literal. Ariadne cannot resolve the this receiver to the surrounding object literal, so the method shows zero callers despite an intra-file this.<name>(...) call site.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_this_property_method_dispatch(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "javascript";
  const check_1 = entry_point.definition_features.definition_is_object_literal_method === true;
  const check_2 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  const check_3 = (() => { const pattern = new RegExp("\\bthis\\.[A-Za-z_$][A-Za-z0-9_$]*\\s*\\("); return entry_point.diagnostics.grep_call_sites.some((h) => pattern.test(h.content)); })();
  const check_4 = (entry_point.diagnostics.grep_call_sites.length > 0 && entry_point.diagnostics.grep_call_sites.every((h) => h.file_path === entry_point.file_path)) === true;
  return check_0 && check_1 && check_2 && check_3 && check_4;
}

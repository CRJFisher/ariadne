// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// Function whose only textual references appear inside string literals passed to `new Function(...)` or `eval(...)`. The runtime constructs and invokes the function from a string, so the call site is invisible to static analysis. Restricted to JavaScript with zero resolved Ariadne callers and at least one grep hit on a line that invokes `new Function(` or `eval(`.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_dynamic_new_function_dispatch(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  const check_0 = language === "javascript";
  const check_1 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  const pattern_2 = new RegExp("\\b(?:new\\s+Function|eval)\\s*\\(");
  const check_2 = entry_point.diagnostics.grep_call_sites.some((h) => pattern_2.test(h.content));
  return check_0 && check_1 && check_2;
}

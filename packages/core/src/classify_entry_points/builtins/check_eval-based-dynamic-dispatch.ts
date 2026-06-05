// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// JavaScript dunder-named local helpers (e.g. __link__, __loop__, __escape__, __bind__, __path__) defined inside template-compiler functions and invoked exclusively from generated source strings passed to eval(...) or new Function(...). The dunder-name convention plus zero resolved callers is a precise signal: production source rarely uses Python-style __name__ for ordinary JS locals — these names exist solely to be referenced by name from runtime-generated code. Confirmed in /Users/chuck/.ariadne/triage-entrypoints/repos/lodash--lodash/vendor/firebug-lite/src/firebug-lite-debug.js where __link__ (14374, 14600), __escape__ (14390), __loop__ (14412, 14615), __bind__ (14595), and __path__ (14628) are all locals inside compileMarkup / compileDOM, both of which end with eval(js) at lines 14439 and 14652.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_eval_based_dynamic_dispatch(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "javascript";
  const check_1 = new RegExp("^__[a-z][a-z_]*__$").test(entry_point.name);
  const check_2 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  return check_0 && check_1 && check_2;
}

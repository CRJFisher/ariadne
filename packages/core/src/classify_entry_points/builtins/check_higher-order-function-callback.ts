// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// Anonymous TypeScript functions whose only caller is a higher-order function that invokes its function-typed parameter. The static call graph cannot link the lambda back to the callee that calls it indirectly, and no textual caller exists because the function literal has no name to grep for. Diagnosis 'no-textual-callers' plus an anonymous name is the structural fingerprint.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_higher_order_function_callback(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = new RegExp("^<anonymous>$").test(entry_point.name);
  const check_2 = entry_point.diagnostics.diagnosis === "no-textual-callers";
  return check_0 && check_1 && check_2;
}

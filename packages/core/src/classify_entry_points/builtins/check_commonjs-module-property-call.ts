// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// JavaScript CommonJS exports invoked through a require-bound namespace variable (e.g. `var utils = require('./utils'); utils.canonicalType(...)`). Ariadne's method_lookup stage reports `method_not_on_type` against an identifier receiver even though the receiver's `partial_info.import_target_file` is the entry_point's own file. Matches the dominant sub-case (method_lookup failure with identifier receiver); entries where tree-sitter missed the call capture entirely do not match this rule and are left for a future capture-gap classifier.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_commonjs_module_property_call(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "javascript";
  const check_1 = entry_point.diagnostics.diagnosis === "callers-in-registry-unresolved";
  const check_2 = entry_point.diagnostics.ariadne_call_refs.some((r) => r.resolution_failure !== null && r.resolution_failure.reason === "method_not_on_type");
  const check_3 = entry_point.diagnostics.ariadne_call_refs.some((r) => r.receiver_kind === "identifier");
  const check_4 = (() => { const pattern = new RegExp("[A-Za-z_$][A-Za-z0-9_$]*\\s*\\.\\s*[A-Za-z_$][A-Za-z0-9_$]*\\s*\\("); return entry_point.diagnostics.grep_call_sites.some((h) => pattern.test(h.content)); })();
  return check_0 && check_1 && check_2 && check_3 && check_4;
}

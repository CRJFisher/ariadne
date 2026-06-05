// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// Capitalised JavaScript constructor functions invoked exclusively through a local variable alias (`var X = NS.X; ... new X();`) within the same indexed file. Ariadne records zero call-refs, the diagnosis lands as 'callers-not-in-registry', and tree-sitter does not fire @reference.constructor at the grep hit because the call target binds to a local var whose initialiser is a member expression rather than a function declaration.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_local_variable_alias(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "javascript";
  const check_1 = entry_point.diagnostics.diagnosis === "callers-not-in-registry";
  const check_2 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  const check_3 = new RegExp("^[A-Z][A-Za-z0-9_]*$").test(entry_point.name);
  const check_4 = (entry_point.diagnostics.grep_call_sites.length > 0 && entry_point.diagnostics.grep_call_sites.every((h) => h.file_path === entry_point.file_path)) === true;
  const check_5 = (() => { const pattern = new RegExp("\\bnew\\s+[A-Z][A-Za-z0-9_]*\\s*\\("); return entry_point.diagnostics.grep_call_sites.some((h) => pattern.test(h.content)); })();
  const check_6 = entry_point.diagnostics.grep_call_sites.some((h) => !h.captures.includes("reference.constructor"));
  return check_0 && check_1 && check_2 && check_3 && check_4 && check_5 && check_6;
}

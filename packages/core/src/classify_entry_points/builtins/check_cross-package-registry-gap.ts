// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// TypeScript getter override with no resolved callers whose grep evidence includes an `abstract get` declaration of the same name. Captures the pathology where an abstract base class declares a getter, a concrete subclass overrides it, and call sites typed against the abstract base type fail to dispatch to the override — leaving the override entry_point unreachable in Ariadne's call graph.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_cross_package_registry_gap(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = entry_point.definition_features.accessor_kind === "getter";
  const check_2 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  const check_3 = (() => { const pattern = new RegExp("abstract\\s+get\\s+"); return entry_point.diagnostics.grep_call_sites.some((h) => pattern.test(h.content)); })();
  return check_0 && check_1 && check_2 && check_3;
}

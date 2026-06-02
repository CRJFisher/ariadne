// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// Anonymous TypeScript functions whose grep scan finds no textual callers. These are inline arrow / function expressions passed as callback arguments (most commonly to higher-order methods like Array.prototype.map / forEach / filter, Map.forEach, Promise.then). Ariadne does not synthesize a call edge from the higher-order callee to the inline lambda, and grep cannot find them by name (`<anonymous>` is not a real identifier). The combination name=='<anonymous>' AND diagnosis=='no-textual-callers' AND language=='typescript' precisely describes this systematic false positive.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_inline_callback(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = new RegExp("^<anonymous>$").test(entry_point.name);
  const check_1 = entry_point.diagnostics.diagnosis === "no-textual-callers";
  const check_2 = detect_language(entry_point.file_path) === "typescript";
  return check_0 && check_1 && check_2;
}

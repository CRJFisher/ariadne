// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// TypeScript class method whose only call sites are intra-class `this.<name>(...)` invocations. The resolver loses the `this` receiver-to-class binding for self-reference method calls, so no inbound edge is produced despite grep finding the literal call sites. Distinguishing signals: grep hits contain `this.<identifier>` AND Ariadne produced zero resolved inbound call refs.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_intra_class_method_call(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = (() => { const pattern = new RegExp("\\bthis\\.\\w"); return entry_point.diagnostics.grep_call_sites.some((h) => pattern.test(h.content)); })();
  const check_2 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  return check_0 && check_1 && check_2;
}

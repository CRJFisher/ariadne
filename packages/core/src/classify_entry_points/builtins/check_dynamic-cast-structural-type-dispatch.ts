// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// TypeScript method invoked through an `as`-cast receiver (e.g. `(factory as {componentReplaced?: (id: string) => void}).componentReplaced?.(...)`). At least one inbound call reference has receiver_kind=type_cast and the entry_point's diagnosis is callers-in-registry-unresolved, indicating Ariadne saw the call sites but cannot resolve the concrete class through the cast — typically because the cast target is an inline anonymous structural object type literal.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_dynamic_cast_structural_type_dispatch(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = entry_point.diagnostics.ariadne_call_refs.some((r) => r.receiver_kind === "type_cast");
  const check_2 = entry_point.diagnostics.diagnosis === "callers-in-registry-unresolved";
  return check_0 && check_1 && check_2;
}

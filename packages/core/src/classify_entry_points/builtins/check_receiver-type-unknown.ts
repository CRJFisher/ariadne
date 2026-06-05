// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// JavaScript method whose only callers invoke it as `<identifier>.<name>(...)` where the receiver's type cannot be statically inferred (local variable assigned from an array/object method, parameter with no JSDoc, dynamically-assigned property). Ariadne produces no CallReference at all — diagnosis is `callers-not-in-registry` and `ariadne_call_refs` is empty — so the method-call-shaped grep hit plus the absence of a call ref is the discriminator. Strictly narrower than `callers-outside-scope-strict-grep-evidence` (adds the identifier-receiver grep shape) and distinct from `aliased-receiver-type-lost` (F1), which requires a call-ref with resolution_failure.reason=receiver_type_unknown — unavailable here because no call-ref exists.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_receiver_type_unknown(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "javascript";
  const check_1 = entry_point.diagnostics.diagnosis === "callers-not-in-registry";
  const check_2 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  const check_3 = (() => { const pattern = new RegExp("[A-Za-z_$][A-Za-z0-9_$]*(?:\\.[A-Za-z_$][A-Za-z0-9_$]*)+\\s*\\("); return entry_point.diagnostics.grep_call_sites.some((h) => pattern.test(h.content)); })();
  return check_0 && check_1 && check_2 && check_3;
}

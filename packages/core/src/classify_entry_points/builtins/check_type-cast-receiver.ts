// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// TypeScript methods unreachable because their call sites invoke them on a receiver introduced by an explicit type cast — either the `x as Type` form or the angle-bracket `<Type>x` form. Ariadne's resolver does not propagate the cast's target type to method lookup, so the call cannot be linked to the concrete implementation. Detected via a grep neighbourhood scan that finds either cast form within 10 lines preceding a grep hit on the entry_point name.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_type_cast_receiver(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = (() => { const pattern = new RegExp("(<\\s*[A-Z][A-Za-z0-9_]*\\s*>\\s*[A-Za-z_$][A-Za-z0-9_$.]*|\\b[A-Za-z_$][A-Za-z0-9_$.]*\\s+as\\s+[A-Z][A-Za-z0-9_]*)"); return entry_point.diagnostics.grep_call_sites.some((h) => { const lines = read_file_lines(h.file_path); const start = Math.max(0, h.line - 1 - 10); for (let i = start; i < h.line - 1; i++) { if (pattern.test(lines[i] ?? "")) return true; } return false; }); })();
  return check_0 && check_1;
}

// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// TypeScript methods unreachable because their call sites invoke them on a receiver introduced by an explicit type cast (`<Type>x` angle-bracket form or `x as Type`). Ariadne's resolver does not propagate the cast's target type to method-lookup, so the call cannot be linked to the concrete implementation. Detected via a grep neighbourhood scan around each grep hit on the entry_point name for either type-assertion form.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_type_cast_dispatch(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const pattern_1 = new RegExp("(<\\s*[A-Z][A-Za-z0-9_]*\\s*>\\s*[A-Za-z_$][A-Za-z0-9_$.]*|\\b[A-Za-z_$][A-Za-z0-9_$.]*\\s+as\\s+[A-Z][A-Za-z0-9_]*)");
  const check_1 = entry_point.diagnostics.grep_call_sites.some((h) => { const lines = read_file_lines(h.file_path); const start = Math.max(0, h.line - 1 - 25); for (let i = start; i < h.line - 1; i++) { if (pattern_1.test(lines[i] ?? "")) return true; } return false; });
  return check_0 && check_1;
}

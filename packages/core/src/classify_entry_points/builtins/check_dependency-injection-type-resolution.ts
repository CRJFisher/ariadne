// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// Method invoked as the chained continuation of an Angular-style dependency-injection lookup of the form `<id>.get(<TypeToken>).<method>(...)`. Ariadne cannot statically resolve the generic return type of `Injector.get<T>(token: Type<T>): T`, so the chained method receiver is opaque and the call edge is dropped. The grep hit fires on the chained `.method(` continuation line; a 3-line look-back catches the `.get(<TypeToken>)` line that establishes the receiver.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_dependency_injection_type_resolution(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  const check_2 = (() => { const pattern = new RegExp("^\\s*\\.[A-Za-z_][A-Za-z0-9_]*\\s*\\("); return entry_point.diagnostics.grep_call_sites.some((h) => pattern.test(h.content)); })();
  const check_3 = (() => { const pattern = new RegExp("\\.get\\s*\\(\\s*[A-Z][A-Za-z0-9_]*\\s*[,)]"); return entry_point.diagnostics.grep_call_sites.some((h) => { const lines = read_file_lines(h.file_path); const start = Math.max(0, h.line - 1 - 3); for (let i = start; i < h.line - 1; i++) { if (pattern.test(lines[i] ?? "")) return true; } return false; }); })();
  return check_0 && check_1 && check_2 && check_3;
}

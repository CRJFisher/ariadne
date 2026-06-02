// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// TypeScript named-import direct-call where Ariadne fails to link the call to the imported function. Pattern: an entry_point has zero resolved callers, but its grep hits include both an `import { ... }` line and a call-with-parens line in a file other than the definition file. Observed on `generateLocaleGlobalFile` in the Angular corpus, where the caller in `bin/write-locale-files-to-dist.ts` directly imports and calls the function from `../locale-global-file` and Ariadne's import resolver does not cross the `bin/` subdirectory boundary.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_import_resolution_missed(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  const check_2 = (entry_point.diagnostics.grep_call_sites.length > 0 && entry_point.diagnostics.grep_call_sites.every((h) => h.file_path === entry_point.file_path)) === false;
  const check_3 = (() => { const pattern = new RegExp("^\\s*import\\s*\\{"); return entry_point.diagnostics.grep_call_sites.some((h) => pattern.test(h.content)); })();
  const check_4 = (() => { const pattern = new RegExp("\\("); return entry_point.diagnostics.grep_call_sites.some((h) => pattern.test(h.content)); })();
  return check_0 && check_1 && check_2 && check_3 && check_4;
}

// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// TypeScript class method whose only callers are method-calls on a typed instance receiver (e.g. `column.compareEntityValue(...)` inside `(column: ColumnMetadata) => ...`), where Ariadne resolves zero CallReferences but grep finds identifier-dot-method call sites. Receiver type is statically knowable (typed local, callback parameter from `T[]`, or `Class.prototype.method` extraction) but Ariadne's receiver-resolution pipeline drops the type — particularly when the class is brought in via `import type { Class }` and the receiver is a callback parameter whose type flows from the array element.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_method_call_on_typed_instance(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  const pattern_2 = new RegExp("\\b[a-zA-Z_$][\\w$]*\\.[a-zA-Z_$][\\w$]*\\s*\\(");
  const check_2 = entry_point.diagnostics.grep_call_sites.some((h) => pattern_2.test(h.content));
  return check_0 && check_1 && check_2;
}

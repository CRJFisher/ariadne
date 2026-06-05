// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// TypeScript/JavaScript getter accessors (`get name()`) are invoked through property-read syntax (`obj.name`), not call syntax (`obj.name()`). The tree-sitter `.scm` query does not emit `@reference.call` on property-read AST nodes, so getters whose only call sites are property accesses appear unreachable. The `accessor_kind` definition feature (TASK-190.16.15) is populated only for JS/TS getter/setter declarations, so `accessor_kind_eq: "getter"` is implicitly language-scoped. Pairing it with `callers_count_at_most: 0` anchors on the false-positive shape (zero resolved callers) and prevents the rule from firing on genuinely-reached getters.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_getter_accessor_not_tracked(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = entry_point.definition_features.accessor_kind === "getter";
  const check_1 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  return check_0 && check_1;
}

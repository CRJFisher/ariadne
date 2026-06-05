// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// JavaScript class constructors whose triage grep-prefilter (which searches for the literal definition name 'constructor') finds no textual call sites, and whose resolved call-ref list is empty. The real call sites write `new ClassName(...)` not `new constructor(...)`, so the prefilter cannot discover them; when the class identity additionally flows through a dynamic require/property lookup (e.g. `require(require.resolve(name))`, `this._reporter = require(...)`, `rewiremock.proxy(() => require(...))`), Ariadne's resolver cannot link the `new` expression either, leaving the constructor as an apparent unreachable entry point.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_dynamic_require_constructor(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "javascript";
  const check_1 = new RegExp("^constructor$").test(entry_point.name);
  const check_2 = entry_point.diagnostics.diagnosis === "no-textual-callers";
  const check_3 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  return check_0 && check_1 && check_2 && check_3;
}

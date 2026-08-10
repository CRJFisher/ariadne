// Rendered from the known-issues registry; edit the registry row for anything
// the row itself states. The predicate below was broadened by hand as an
// ordinary source edit — the lifecycle contract allows exactly that for a check
// file, never for registry.json: `references-without-call-syntax` joined the
// diagnosis set once that diagnosis started carrying entries this rule used to
// see as `no-textual-callers`.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// JavaScript class constructors whose triage grep-prefilter (which searches for the literal definition name 'constructor') finds no textual call sites, and whose resolved call-ref list is empty. The real call sites write `new ClassName(...)` not `new constructor(...)`, so the prefilter cannot discover them; when the class identity additionally flows through a dynamic require/property lookup (e.g. `require(require.resolve(name))`, `this._reporter = require(...)`, `rewiremock.proxy(() => require(...))`), Ariadne's resolver cannot link the `new` expression either, leaving the constructor as an apparent unreachable entry point.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_dynamic_require_constructor(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  const check_0 = language === "javascript";
  const check_1 = new RegExp("^constructor$").test(entry_point.name);
  // Both readings mean the same thing for this rule: the grep prefilter found
  // no call site for the literal name `constructor`. Which of the two lands
  // depends only on whether the class name is mentioned without call parens
  // (`module.exports = Reporter`), which is orthogonal to the rule's shape.
  const check_2 =
    entry_point.diagnostics.diagnosis === "no-textual-callers" ||
    entry_point.diagnostics.diagnosis === "references-without-call-syntax";
  const check_3 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  return check_0 && check_1 && check_2 && check_3;
}

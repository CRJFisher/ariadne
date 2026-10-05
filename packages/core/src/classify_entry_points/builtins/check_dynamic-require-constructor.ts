// Rendered from the known-issues registry; the row's metadata is owned by
// registry.json, while the predicate is ordinary source and may be edited under
// .claude/rules/classifier-lifecycle.md.
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
  // The condition, not the labels for it: the grep prefilter found no call site
  // for the literal name `constructor`. Which diagnosis that produces depends on
  // evidence orthogonal to this rule — whether the class name is mentioned
  // without call parens (`module.exports = Reporter`), whether a caller sits
  // outside the indexed corpus — so keying on the enum would silently stop the
  // rule firing each time the vocabulary grows.
  const check_2 = entry_point.diagnostics.grep_call_sites.length === 0;
  const check_3 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  return check_0 && check_1 && check_2 && check_3;
}

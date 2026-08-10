// Classifier for the known-issues registry rule `callback-passed-to-invoker`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A bound method / callback handed BY REFERENCE to a higher-order invoker that
// calls it indirectly, so no static call edge binds the caller to the
// definition. The entry's name appears only as an ARGUMENT — never as `name(`
// at the call site — and the actual invocation happens inside the invoker
// (`maybe_call(self.on_node_status, ...)`, `this.socket.on('data',
// this.onData.bind(this))`, `PopulateDict(self._access_cls)`). The resolver
// sees the reference but has no invocation site to link it to, so the callee
// looks unreachable.
//
// Precision anchor: an entry point is always a callable, so a bare
// `self.<name>` / `this.<name>` reference in argument position — with no
// trailing `(` — is necessarily a bound-method reference (a callback), not a
// data read. Two surface forms carry that anchor unambiguously:
//
//   1. `<name>.bind(` — a bound method passed as a callback (JS/TS). The
//      `.bind(this)` idiom exists precisely to hand a method to an invoker.
//   2. `self.<name>` / `this.<name>` sitting in a call's argument list —
//      preceded by an argument delimiter (`(`, `,`, or a kwarg `=`) and NOT
//      followed by `(` (that would be a direct call), `.`/`[` (further member
//      or index access), or a word char (a longer identifier).
//
// The anchor is deliberately narrow. An ordinary resolvable callback passed on
// a NAMED receiver (`messageBus.on('e', inspector.handler)`) is resolvable and
// is left as a reportable true-positive — it carries no `self`/`this`/`.bind`
// anchor. A bare-name argument (`register(handler)`) is indistinguishable from
// passing a data value and is NOT matched; that looser form is deferred (see
// proposal). A computed-index dispatch (`handlers[key]()`) belongs to
// `dynamic-property-keyed-callback`, not here, and contains a `[` the anchor
// rejects.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

function escape_regex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function check_callback_passed_to_invoker(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  if (
    language !== "python" &&
    language !== "typescript" &&
    language !== "javascript"
  ) {
    return false;
  }

  const name = entry_point.name;
  if (name.length === 0) return false;
  const esc = escape_regex(name);

  // Form 1 — `<name>.bind(` bound-method callback (JS/TS idiom).
  const bind_ref = new RegExp(`\\b${esc}\\.bind\\s*\\(`);

  // Form 2 — `self.<name>` / `this.<name>` as a call argument: preceded by an
  // arg delimiter, and not immediately a call / further access / longer ident.
  const bound_method_arg = new RegExp(
    `[(,=]\\s*(?:self|this)\\.${esc}(?![\\w(.\\[])`,
  );

  // Read the reference channel, not the grep channel: these surface forms
  // carry no `name(` by construction, so they never produce a grep hit. Every
  // sample in this rule's registry entry was unmatchable until this channel
  // existed.
  return entry_point.diagnostics.reference_sites.some(
    (site) => bind_ref.test(site.content) || bound_method_arg.test(site.content),
  );
}

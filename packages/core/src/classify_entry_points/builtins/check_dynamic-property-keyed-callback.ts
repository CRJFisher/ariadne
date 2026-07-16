// Classifier for the known-issues registry rule `dynamic-property-keyed-callback`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A callback is stored in a map/object/list and invoked through a key the
// resolver cannot pin to a literal — `handlers[key](...)`, `table[node.kind]`,
// `getattr(self, method)(...)`. The resolver has the collection source but no
// literal key, so the specific callback edge is lost. This is a permanent
// limitation whenever the key is computed at runtime.
//
// Three signals fire the rule, tried against the entry's textual call sites:
//
//   1. `is_dynamic_dispatch` on any Ariadne call ref — the case where core did
//      produce a computed-member call reference with a non-literal index key.
//   2. A grep call-site line performing a computed-index invocation:
//      `<expr>[<non-literal>]` on a line that also calls something. The key
//      being non-literal IS the limitation; a literal key (`m["submit"]()`,
//      `steps[0]()`) is resolvable and deliberately excluded, as is a bare
//      array/object literal (`= [a, b]`), which is a registration site.
//   3. (Python) a `getattr`/`operator.attrgetter` whose name argument is not a
//      plain string literal — `getattr(self, method)`, `getattr(self, f"m_{n}")`,
//      `attrgetter("visit_%s" % name)`. This is Python's spelling of `obj[name]`.
//      A literal name (`getattr(self, "submit")`) is resolvable and excluded.
//
// Precision: signals 2 and 3 both carve out the literal-key form so a genuinely
// unreachable callback dispatched through a literal member is still reported.
// Registration-only shapes with no in-line dynamic invocation — a decorator that
// enrols the function into a dispatch table (`@register_lowering(...)`), a
// dict/list literal storing it as a value, a `.get(key)` lookup, a callback
// passed by reference to an invoker helper — are a distinct detectable limitation
// and are NOT matched here.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

// A computed index access `<expr>[<key>]`: the char before `[` closes an
// expression (identifier, `)`, `]`, or object literal `}`), which distinguishes
// an index access from an array/object literal preceded by `=`, `(`, or `,`.
const INDEX_ACCESS = /[\w$)\]}]\[([^\]]+)\]/g;
// A key spelled as a quoted string or an integer is a literal the resolver can
// follow; only a non-literal key defeats resolution.
const STRING_LITERAL_KEY = /^\s*(["'`]).*\1\s*$/;
const INT_LITERAL_KEY = /^\s*-?\d+\s*$/;
// Any invocation on the line — the heuristic that the computed index is a
// dispatch, not an incidental data lookup.
const HAS_CALL = /[\w$)\]]\s*\(/;

function has_computed_index_call(line: string): boolean {
  if (!HAS_CALL.test(line)) return false;
  INDEX_ACCESS.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INDEX_ACCESS.exec(line)) !== null) {
    const key = match[1];
    if (STRING_LITERAL_KEY.test(key) || INT_LITERAL_KEY.test(key)) continue;
    return true;
  }
  return false;
}

const GETATTR = /\bgetattr\s*\(/;
// `getattr(<receiver>, "<literal>")` — a resolvable literal name. The receiver
// segment stops at the first paren so a `getattr(colored(), name)` receiver-call
// does not spill into the name match.
const GETATTR_LITERAL_NAME = /\bgetattr\s*\(\s*[^,()]*,\s*(["'])[^"'\\]*\1\s*[,)]/;
const ATTRGETTER = /\battrgetter\s*\(/;
const ATTRGETTER_LITERAL_NAME = /\battrgetter\s*\(\s*(["'])[^"'\\]*\1\s*\)/;

function has_computed_getattr(line: string): boolean {
  if (GETATTR.test(line) && !GETATTR_LITERAL_NAME.test(line)) return true;
  if (ATTRGETTER.test(line) && !ATTRGETTER_LITERAL_NAME.test(line)) return true;
  return false;
}

export function check_dynamic_property_keyed_callback(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;

  const has_dynamic_ref = entry_point.diagnostics.ariadne_call_refs.some(
    (r) => r.syntactic_features.is_dynamic_dispatch === true,
  );
  if (has_dynamic_ref) return true;

  const lines = entry_point.diagnostics.grep_call_sites.map((h) => h.content);
  if (lines.some(has_computed_index_call)) return true;
  if (language === "python" && lines.some(has_computed_getattr)) return true;
  return false;
}

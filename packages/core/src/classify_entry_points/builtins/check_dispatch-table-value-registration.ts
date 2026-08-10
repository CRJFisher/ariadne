// Classifier for the known-issues registry rule `dispatch-table-value-registration`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A callback whose ONLY textual mention is its enrolment as a VALUE in a dict /
// object / list literal, later invoked through a computed key on a different
// line — `MAP.get(computed_key)`, `table[key]()`, `list[index]()`. The dispatch
// line does not bear the callback's name, so no static call edge links it; the
// registration line names the callback but only as inert data.
//
// This is the registration-side companion to `dynamic-property-keyed-callback`,
// which fires on the invocation/`getattr` line (a computed index that also
// calls, or a non-literal `getattr`). Because the callback's name appears only
// at the registration site, the entry's grep call sites are the registration
// lines — which carry no computed-index invocation and no `getattr` — so the two
// rules match disjoint lines. `string-keyed-dispatch` is likewise disjoint: it
// is TypeScript-only and matches the index-access side (`receiver[node.kind]`),
// never a literal value position.
//
// Three registration shapes fire the rule, anchored on the entry's OWN name so a
// same-named identifier in ordinary data cannot trip it:
//
//   1. Object/dict value — `key: <name>` or `key: recv.<name>` (Python
//      `{1: self.as_task_v1}`, `handlers={'*': dumper.on_event}`; the enum-keyed
//      `{ ONETOMANY: _OneToManyDP }` constructor table).
//   2. List/tuple element — `[<name>, ...]` or `(..., recv.<name>)` (Python
//      `self._subheader_processors = [self._process_rowsize_subheader, ...]`,
//      `self.steps = [_spoil_point._retrieve_baked_query]`).
//   3. Lambda-wrapped value — a dict value that is `lambda ...: recv.<name>(...)`
//      (PyTorch NNAPI `"aten::conv2d": lambda self, node: self.add_conv2d(node)`,
//      dispatched via `self.ADDER_MAP.get(node.kind())`).
//
// Precision: the name must sit at a value position (after `:`, or as a bare list
// element) as an unquoted identifier. A quoted occurrence (`{ label: "on_event" }`)
// or a longer identifier that merely starts with the name (`handle_failure_count`)
// does not match, because the value must be exactly the name up to a structural
// terminator (`,` `}` `)` `]` or end of line).

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

const SUPPORTED: ReadonlySet<Language> = new Set<Language>([
  "python",
  "typescript",
  "javascript",
]);

// Escape a callable name for embedding in a RegExp source.
function escape_regexp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// An optional dotted receiver chain before the name — `self.`, `this.`,
// `dumper.`, `_spoil_point.` — or nothing.
const RECEIVER = "(?:[\\w$]+\\.)*";
// The value must end at a structural boundary so `add_conv2d` never matches
// inside `add_conv2d_relu`.
const VALUE_END = "(?=[,}\\)\\]]|\\s|$)";

function registration_matchers(name: string): readonly RegExp[] {
  const n = escape_regexp(name);
  return [
    // 1. Object/dict value: `key: <name>` / `key: recv.<name>`.
    new RegExp(":\\s*" + RECEIVER + n + VALUE_END),
    // 2. List/tuple element: `[<name>` / `, recv.<name>`.
    new RegExp("[\\[,]\\s*" + RECEIVER + n + VALUE_END),
    // 3. Lambda-wrapped dict value invoking the entry: `: lambda ...: recv.<name>(`.
    new RegExp(":\\s*lambda\\b[^:]*:\\s*" + RECEIVER + n + "\\s*\\("),
  ];
}

export function check_dispatch_table_value_registration(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  if (!SUPPORTED.has(language)) return false;

  const matchers = registration_matchers(entry_point.name);
  // Read the reference channel, not the grep channel: a name enrolled as a
  // dict or list value carries no call parens, so it never produces a grep
  // hit. The rule could not fire on its own registry samples before this.
  return entry_point.diagnostics.reference_sites.some((site) =>
    matchers.some((re) => re.test(site.content)),
  );
}

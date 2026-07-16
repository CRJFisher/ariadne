// Classifier for the known-issues registry rule `py-functional-property-accessor`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// The FUNCTIONAL form of Python's property descriptor: an accessor function is
// passed by reference to the builtin `property(...)` — `request =
// property(_get_request)`, `POST = property(_get_post, _set_post)`. The
// descriptor invokes the accessor implicitly on attribute access (`obj.request`,
// `obj.POST = v`), never as an explicit `_get_request()` call, so tree-sitter's
// call captures never link a caller to the accessor and it looks unreachable —
// a permanent capture-model limitation.
//
// This is disjoint from `py-property-decorator-access` by construction. That
// sibling reads the DECORATOR block above the definition (`@property def x`).
// The functional accessor carries NO decorator: its name appears only as an
// ARGUMENT to a `property(...)` call elsewhere in the file, so the decorator
// mechanism structurally cannot see it. The two forms partition the property
// surface with no overlap.
//
// Precision: the predicate suppresses findings, so it anchors on the entry's
// OWN name appearing as a whole-word argument inside a bare `property(...)`
// call. A method that is genuinely uncalled and merely sits near a `property(`
// for an unrelated attribute does not match — its name is not in the arg list.
// `property` must be bare (not `.property(` method call, not `my_property(`
// substring) to stay pinned to the builtin.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

// Build a name-anchored matcher: the entry's own name must appear as a
// whole-word argument between `property(` and its first closing `)`. `[^)]*`
// forbids crossing the paren, so the name is provably inside the arg list; the
// negative lookbehind keeps `property` bare (rejects `.property(` and
// `my_property(`). Handles fget/fset/fdel positions and `fget=` keyword form,
// since `,` `=` and spaces are all non-`)` characters.
function property_accessor_arg_regex(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w.])property\\s*\\([^)]*\\b${escaped}\\b`);
}

export function check_py_functional_property_accessor(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  if (language !== "python") return false;

  const arg_regex = property_accessor_arg_regex(entry_point.name);
  return entry_point.diagnostics.grep_call_sites.some((h) =>
    arg_regex.test(h.content),
  );
}

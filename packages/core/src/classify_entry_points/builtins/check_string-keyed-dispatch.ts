// Classifier for the known-issues registry rule `string-keyed-dispatch`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A method reachable only through a computed/string-keyed dispatch, so no static
// AST call site links the caller to the definition. Two surface forms of the
// same limitation:
//
//   1. Angular JIT ɵɵ-instructions: a `ɵɵ`-prefixed runtime instruction defined
//      under `/packages/core/src/`. The JIT stores these in the `angularCoreEnv`
//      string-keyed map and invokes them via `new Function(...)` over
//      compiler-emitted source. The double-`ɵ` (U+0275) prefix is Angular's
//      convention for compiler-injected runtime APIs and is exclusive to this
//      dispatch path.
//   2. Computed-key dispatch table: a call site resolves the callee by indexing a
//      table or receiver with a runtime key — `table[node.kind]`, or a two-step
//      `const m = MAP[key]; target[m]` string-map lookup. The key is an
//      identifier, not a literal, so the callee is statically unresolvable.
//
// Precision for form 2: the index key must be a bare identifier or member path.
// A string-literal key (`map["submit"]`) or numeric index (`arr[0]`) is
// statically resolvable and stays a reportable true-positive, and the character
// before `[` must close an expression so a computed index (`receiver[key]`) is
// distinguished from an array literal (`[key]`).

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

// `<receiver>[<key>]` — the char before `[` closes an expression (identifier,
// `)`, `]`, `}`) and the key is an identifier or dotted member path, never a
// quoted string or numeric literal.
const COMPUTED_KEY_INDEX = new RegExp(
  "[\\w$)\\]}]\\s*\\[\\s*[A-Za-z_$][\\w$.]*\\s*\\]",
);

export function check_string_keyed_dispatch(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  if (language !== "typescript") return false;

  const is_angular_instruction =
    /^ɵɵ/.test(entry_point.name) &&
    /\/packages\/core\/src\//.test(entry_point.file_path);
  if (is_angular_instruction) return true;

  return entry_point.diagnostics.grep_call_sites.some((h) =>
    COMPUTED_KEY_INDEX.test(h.content),
  );
}

// Classifier for the known-issues registry rule `rust-macro-registration-table`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A Rust function registered as a function-POINTER VALUE inside a builtin-macro
// expander table — `register_bang! { format_args_nl: source_util::expand_format_args_nl }`,
// `register_attr! { bench: test::expand_bench }`, `register_derive! { CoercePointee:
// coerce_pointee::expand_deriving_coerce_pointee }`. The compiler's macro-expansion
// engine loads the table and dispatches through the stored pointer; the function is
// never called from any static call site the pre-expansion AST can see, so it looks
// unreachable.
//
// This is disjoint from `rust-macro-invocation-call`, which keys on the call-SITE
// forms of macro reachability: a `name!(` invocation token on the line, a `$crate::`
// hygiene token, or a reachability attribute on the definition. A registration-table
// binding has none of those — the grep hit is a bare `key: path::fn,` value line, and
// the `register_*!` macro token sits on a DIFFERENT line (the block opener), so the
// call-site predicate cannot see it. This rule captures exactly that gap
// (evidence entry 16758).
//
// Precision: a bare `key: path::fn,` line also describes ordinary struct literals,
// HashMap initializers, and config tables — matching it alone would suppress real
// unreachable functions. The discriminator is the ENCLOSING BLOCK: the binding must
// be lexically nested directly inside a `register_<name>! { ... }` macro invocation.
// The `register_*!` opener is what proves the value is an expander-table entry rather
// than plain data, and it is exclusive to Rust's builtin-macro registration.

import type { EnrichedEntryPoint, Language, GrepHit } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

// A table-entry binding: `<key>: <path-or-ident>,` where the value is a plain path
// (function pointer), never a call, closure, or literal. Anchored so it matches the
// whole trimmed line, keeping stray in-block mentions of the name from qualifying.
const TABLE_ENTRY_BINDING = new RegExp(
  "^\\s*[A-Za-z_]\\w*\\s*:\\s*[A-Za-z_][\\w:]*\\s*,?\\s*$",
);

// The block opener that makes a value table an expander table: `register_bang! {`,
// `register_attr! {`, `register_derive! {`, etc. The `register_` prefix + `!` macro
// token is the discriminating signal.
const REGISTER_MACRO_OPENER = new RegExp("\\bregister_[A-Za-z_]*!\\s*[({\\[]");

// Registration tables in rustc can list ~100 entries, so an entry's binding may sit
// far below the `register_*!` opener. Bound the upward scan generously; the work is
// a cheap per-line brace tally.
const MAX_UPWARD_SCAN_LINES = 1000;

// Walk upward from a binding line to the opener of its immediately-enclosing block and
// report whether that opener is a `register_*!` macro invocation. Balance braces
// right-to-left per line: a `}` seen while walking up entered a sibling block below the
// binding (skip its matching `{`); the first `{` that drives the balance negative is
// the opener of the block that ENCLOSES the binding. Heuristic on brace characters —
// registration tables contain no string/comment braces, so the tally stays honest.
function enclosing_block_is_register_macro(
  lines: readonly string[],
  binding_line_1_based: number,
): boolean {
  let balance = 0;
  const start = binding_line_1_based - 2; // line above the binding, 0-based
  for (let i = start; i >= 0 && start - i < MAX_UPWARD_SCAN_LINES; i--) {
    const line = lines[i] ?? "";
    for (let c = line.length - 1; c >= 0; c--) {
      const ch = line[c];
      if (ch === "}") {
        balance++;
      } else if (ch === "{") {
        if (balance === 0) {
          // This `{` opens the enclosing block; its opener text precedes it.
          return REGISTER_MACRO_OPENER.test(line);
        }
        balance--;
      }
    }
  }
  return false;
}

function is_registration_table_hit(
  hit: GrepHit,
  read_file_lines: FileLinesReader,
): boolean {
  if (!TABLE_ENTRY_BINDING.test(hit.content)) return false;
  const lines = read_file_lines(hit.file_path);
  return enclosing_block_is_register_macro(lines, hit.line);
}

export function check_rust_macro_registration_table(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  if (language !== "rust") return false;

  return entry_point.diagnostics.grep_call_sites.some((hit) =>
    is_registration_table_hit(hit, read_file_lines),
  );
}

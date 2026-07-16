// Classifier for the known-issues registry rule `rust-macro-invocation-call`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// Rust macros make a function reachable through code the pre-expansion AST never
// sees, so the callee looks unreachable — a permanent limitation of analysing
// tree-sitter's `.scm` queries on the un-expanded source. Three surface forms of
// the same limitation trigger this rule:
//
//   1. A function-like macro invocation on a call site (`name!(` / `name![` /
//      `name!{`), e.g. `write!(f, ..)`, `walk_list!(..)`, `quote! { .. }`.
//   2. A call whose line carries `$crate::`, which is only legal inside a
//      `macro_rules!` body — so the callee is reached solely via expansion.
//   3. An attribute macro on the definition that hands the function to
//      harness- or compiler-generated code: the test/bench harness (`#[test]`,
//      `#[tokio::test]`, `#[actix_rt::test]`), a runtime wrapper (`#[tokio::main]`),
//      or a proc-macro entry point (`#[proc_macro_derive(..)]`). These have no
//      static call site at all; the reachability signal is the attribute itself.
//
// Precision: the attribute set is restricted to attributes that intrinsically
// imply macro/harness reachability. Ordinary attributes that leave a function's
// reachability unchanged (`#[allow(..)]`, `#[cfg(..)]`, `#[inline]`,
// `#[derive(..)]`, `#[should_panic]`) are deliberately NOT matched, so a
// genuinely-unreachable annotated function is still reported.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { extract_decorator_block } from "./extract_decorator_block";

// `name!(` / `name![` / `name!{` — a function-like macro invocation.
const CALL_SITE_MACRO = new RegExp("[A-Za-z_][A-Za-z0-9_]*!\\s*[\\(\\[{]");
// `$crate` is a macro-hygiene token with no meaning outside a `macro_rules!`
// body, so its presence on a call site proves the call lives in an expansion.
const MACRO_BODY_CALL = new RegExp("\\$crate\\b");
// Attribute macros whose expansion is what makes the function reachable. The
// optional `ident::` prefix admits path-qualified forms (`actix_rt::test`,
// `tokio::main`); `proc_macro[A-Za-z_]*` admits `proc_macro`,
// `proc_macro_derive`, and `proc_macro_attribute`.
const REACHABILITY_ATTRIBUTE = new RegExp(
  "#!?\\[\\s*(?:[A-Za-z_][A-Za-z0-9_]*::)*(?:test|bench|main|proc_macro[A-Za-z_]*)\\b",
);

export function check_rust_macro_invocation_call(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  if (language !== "rust") return false;

  const call_site_hit = entry_point.diagnostics.grep_call_sites.some(
    (h) => CALL_SITE_MACRO.test(h.content) || MACRO_BODY_CALL.test(h.content),
  );
  if (call_site_hit) return true;

  const decorator_block = extract_decorator_block(
    read_file_lines(entry_point.file_path),
    entry_point.start_line,
  );
  return REACHABILITY_ATTRIBUTE.test(decorator_block);
}

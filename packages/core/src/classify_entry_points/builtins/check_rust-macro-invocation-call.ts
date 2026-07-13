// Classifier for the known-issues registry rule `rust-macro-invocation-call`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// Rust macros (`println!`, `format!`, custom proc macros, `#[derive(...)]`)
// expand into calls invisible to tree-sitter's `.scm` queries on the
// pre-expansion AST, so functions invoked only through a macro look
// unreachable — a permanent limitation of pre-expansion analysis. The
// discriminator is a macro-invocation token (`name!(` / `name![` / `name!{`) on
// any grep call site, in a Rust file.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_rust_macro_invocation_call(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  const check_0 = language === "rust";
  const re = new RegExp("[A-Za-z_][A-Za-z0-9_]*!\\s*[\\(\\[{]");
  const check_1 = entry_point.diagnostics.grep_call_sites.some((h) => re.test(h.content));
  return check_0 && check_1;
}

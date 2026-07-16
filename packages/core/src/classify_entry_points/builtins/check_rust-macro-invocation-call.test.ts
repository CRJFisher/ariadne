import { describe, it, expect } from "vitest";

import type { EnrichedEntryPoint, FilePath, GrepHit } from "@ariadnejs/types";
import { check_rust_macro_invocation_call } from "./check_rust-macro-invocation-call";

const RUST_FILE = "/repo/src/resolve.rs" as FilePath;
const EMPTY_READER = (_: string) => [] as readonly string[];

function make_grep_hit(content: string): GrepHit {
  return { file_path: RUST_FILE, line: 12, content, captures: [] };
}

function make_entry(overrides: {
  file_path?: FilePath;
  start_line?: number;
  call_sites?: GrepHit[];
} = {}): EnrichedEntryPoint {
  return {
    name: "resolve_expr_field",
    file_path: overrides.file_path ?? RUST_FILE,
    start_line: overrides.start_line ?? 10,
    kind: "function",
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: overrides.call_sites ?? [],
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
    },
  };
}

// A reader whose `start_line` (1-based) definition is preceded by `decorators`.
// Mirrors the harness in check_framework-lifecycle-handler.test.ts.
function reader_with_decorators(start_line: number, decorators: string[]): (path: string) => readonly string[] {
  const lines: string[] = [];
  for (let i = 0; i < start_line - 1 - decorators.length; i++) lines.push("");
  for (const d of decorators) lines.push(d);
  lines.push("fn definition_body() {");
  return (_: string) => lines;
}

describe("check_rust_macro_invocation_call", () => {
  // Branch 1: a function-like macro invocation on the call site — the callee is
  // reached through the macro's expansion, invisible to the pre-expansion AST.
  it("matches a call site that is a function-like macro invocation", () => {
    const entry = make_entry({
      call_sites: [make_grep_hit("walk_list!(self, resolve_expr_field, &se.fields, expr);")],
    });
    expect(check_rust_macro_invocation_call(entry, EMPTY_READER, "rust")).toBe(true);
  });

  it("matches a call site macro invoked with square-bracket delimiters", () => {
    const entry = make_entry({
      call_sites: [make_grep_hit("let items = vec![resolve_expr_field(&se.fields)];")],
    });
    expect(check_rust_macro_invocation_call(entry, EMPTY_READER, "rust")).toBe(true);
  });

  it("matches a call site macro invoked with brace delimiters", () => {
    const entry = make_entry({
      call_sites: [make_grep_hit("quote! { #de_impl_generics #ident #ty_generics }")],
    });
    expect(check_rust_macro_invocation_call(entry, EMPTY_READER, "rust")).toBe(true);
  });

  // Branch 2: a `$crate::` path only parses inside a `macro_rules!` body, so the
  // call site is textually a fragment of an expansion.
  it("matches a call site carrying a $crate:: macro-hygiene path", () => {
    const entry = make_entry({
      call_sites: [make_grep_hit("$crate::query_scalar::query_statement_scalar(self)")],
    });
    expect(check_rust_macro_invocation_call(entry, EMPTY_READER, "rust")).toBe(true);
  });

  // Branch 3: a reachability attribute on the definition hands the function to
  // harness- or compiler-generated code; the attribute is the only call signal.
  it("matches a definition carrying a bare #[test] attribute", () => {
    const entry = make_entry({ start_line: 20 });
    const reader = reader_with_decorators(20, ["#[test]"]);
    expect(check_rust_macro_invocation_call(entry, reader, "rust")).toBe(true);
  });

  it("matches a definition carrying a path-qualified #[tokio::test] attribute", () => {
    const entry = make_entry({ start_line: 20 });
    const reader = reader_with_decorators(20, ["#[tokio::test]"]);
    expect(check_rust_macro_invocation_call(entry, reader, "rust")).toBe(true);
  });

  it("matches a definition carrying an #[actix_rt::test] attribute", () => {
    const entry = make_entry({ start_line: 20 });
    const reader = reader_with_decorators(20, ["#[actix_rt::test]"]);
    expect(check_rust_macro_invocation_call(entry, reader, "rust")).toBe(true);
  });

  it("matches a definition carrying a #[tokio::main] runtime-wrapper attribute", () => {
    const entry = make_entry({ start_line: 20 });
    const reader = reader_with_decorators(20, ["#[tokio::main]"]);
    expect(check_rust_macro_invocation_call(entry, reader, "rust")).toBe(true);
  });

  it("matches a definition carrying a #[proc_macro_derive(...)] entry-point attribute", () => {
    const entry = make_entry({ start_line: 20 });
    const reader = reader_with_decorators(20, ["#[proc_macro_derive(MultipartForm, attributes(multipart))]"]);
    expect(check_rust_macro_invocation_call(entry, reader, "rust")).toBe(true);
  });

  // The reachability attribute fires even when stacked below ordinary attributes,
  // because extract_decorator_block collects the whole immediate attribute run.
  it("matches a reachability attribute stacked below an ordinary #[allow(...)] attribute", () => {
    const entry = make_entry({ start_line: 20 });
    const reader = reader_with_decorators(20, ["#[allow(clippy::literal_string_with_formatting_args)]", "#[test]"]);
    expect(check_rust_macro_invocation_call(entry, reader, "rust")).toBe(true);
  });

  // Precision proof: a genuinely-unreachable fn whose only call site is an
  // ordinary (non-macro) call and whose attribute is ordinary must stay reported.
  it("does not match an ordinary call site under an ordinary #[cfg(test)] attribute", () => {
    const entry = make_entry({
      start_line: 20,
      call_sites: [make_grep_hit("let field = resolve_expr_field(&se.fields);")],
    });
    const reader = reader_with_decorators(20, ["#[cfg(test)]"]);
    expect(check_rust_macro_invocation_call(entry, reader, "rust")).toBe(false);
  });

  it("does not match a definition whose only attribute is #[derive(Debug)]", () => {
    const entry = make_entry({ start_line: 20 });
    const reader = reader_with_decorators(20, ["#[derive(Debug)]"]);
    expect(check_rust_macro_invocation_call(entry, reader, "rust")).toBe(false);
  });

  // #[should_panic] rides alongside #[test] but never implies reachability on its
  // own; it must not fire when it is the sole attribute.
  it("does not match a definition whose only attribute is #[should_panic]", () => {
    const entry = make_entry({ start_line: 20 });
    const reader = reader_with_decorators(20, ["#[should_panic]"]);
    expect(check_rust_macro_invocation_call(entry, reader, "rust")).toBe(false);
  });

  it("does not match when a macro call site belongs to a non-rust entry", () => {
    const entry = make_entry({
      file_path: "/repo/src/resolve.ts" as FilePath,
      call_sites: [make_grep_hit("walk_list!(self, resolve_expr_field, &se.fields, expr);")],
    });
    expect(check_rust_macro_invocation_call(entry, EMPTY_READER, "typescript")).toBe(false);
  });
});

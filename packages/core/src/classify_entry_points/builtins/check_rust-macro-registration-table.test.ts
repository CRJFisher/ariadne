import { describe, it, expect } from "vitest";

import type {
  EnrichedEntryPoint,
  FilePath,
  GrepHit,
  Language,
} from "@ariadnejs/types";
import { check_rust_macro_registration_table } from "./check_rust-macro-registration-table";

const REGISTRATION_FILE = "/rustc/compiler/rustc_builtin_macros/src/lib.rs" as FilePath;
const DEF_FILE = "/rustc/compiler/rustc_builtin_macros/src/asm.rs" as FilePath;

function grep_hit(content: string, line: number): GrepHit {
  return { file_path: REGISTRATION_FILE, line, content, captures: [] };
}

function make_entry(overrides: {
  name?: string;
  grep_hits?: GrepHit[];
} = {}): EnrichedEntryPoint {
  return {
    name: overrides.name ?? "expand_naked_asm",
    file_path: DEF_FILE,
    start_line: 10,
    kind: "function",
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: overrides.grep_hits ?? [],
      grep_call_sites_outside_index: [],
      reference_sites: [],
      ariadne_call_refs: [],
      diagnosis: "callers-in-registry-unresolved",
      has_uncaptured_indexed_grep_hit: false,
    },
  };
}

// Fixture registration file: two `register_*!` tables. Grep hits in the tests below
// carry the 1-based line of their binding within this fixture.
const REGISTRATION_FILE_LINES: readonly string[] = [
  "pub fn register_builtin_macros(resolver: &mut dyn ResolverExpand) {",
  "    register_bang! {",
  "        naked_asm: asm::expand_naked_asm,",
  "        global_asm: asm::expand_global_asm,",
  "        format_args_nl: source_util::expand_format_args_nl,",
  "    }",
  "",
  "    register_attr! {",
  "        bench: test::expand_bench,",
  "    }",
  "}",
];

function run(entry: EnrichedEntryPoint, language: Language): boolean {
  return check_rust_macro_registration_table(entry, (_: string) => REGISTRATION_FILE_LINES, language);
}

describe("check_rust_macro_registration_table", () => {
  it("matches a register_bang! expander-table binding (naked_asm: asm::expand_naked_asm)", () => {
    const entry = make_entry({
      name: "expand_naked_asm",
      grep_hits: [grep_hit("        naked_asm: asm::expand_naked_asm,", 3)],
    });
    expect(run(entry, "rust")).toBe(true);
  });

  it("matches a register_bang! binding several lines below the opener", () => {
    const entry = make_entry({
      name: "expand_format_args_nl",
      grep_hits: [grep_hit("        format_args_nl: source_util::expand_format_args_nl,", 5)],
    });
    expect(run(entry, "rust")).toBe(true);
  });

  it("matches a register_attr! expander-table binding (bench: test::expand_bench)", () => {
    const entry = make_entry({
      name: "expand_bench",
      grep_hits: [grep_hit("        bench: test::expand_bench,", 9)],
    });
    expect(run(entry, "rust")).toBe(true);
  });

  it("matches a single-segment value inside a register block (unsafe_eii: eii::unsafe_eii)", () => {
    const lines = [
      "register_attr! {",
      "    unsafe_eii: eii::unsafe_eii,",
      "}",
    ];
    const entry = make_entry({
      name: "unsafe_eii",
      grep_hits: [{ file_path: REGISTRATION_FILE, line: 2, content: "    unsafe_eii: eii::unsafe_eii,", captures: [] }],
    });
    expect(check_rust_macro_registration_table(entry, (_: string) => lines, "rust")).toBe(true);
  });

  it("does not match an ordinary struct-literal binding of the same key: path::fn shape", () => {
    const lines = [
      "let config = Config {",
      "    handler: routes::index_handler,",
      "};",
    ];
    const entry = make_entry({
      name: "index_handler",
      grep_hits: [{ file_path: REGISTRATION_FILE, line: 2, content: "    handler: routes::index_handler,", captures: [] }],
    });
    expect(check_rust_macro_registration_table(entry, (_: string) => lines, "rust")).toBe(false);
  });

  it("does not match a binding whose enclosing block is a nested non-register block", () => {
    const lines = [
      "register_bang! {",
      "    other: foo::expand_other,",
      "}",
      "let table = Table {",
      "    naked_asm: asm::expand_naked_asm,",
      "};",
    ];
    const entry = make_entry({
      name: "expand_naked_asm",
      grep_hits: [{ file_path: REGISTRATION_FILE, line: 5, content: "    naked_asm: asm::expand_naked_asm,", captures: [] }],
    });
    expect(check_rust_macro_registration_table(entry, (_: string) => lines, "rust")).toBe(false);
  });

  it("does not match a match arm using => rather than a key: value binding", () => {
    const lines = [
      "register_bang! {",
      "    Key => asm::expand_naked_asm,",
      "}",
    ];
    const entry = make_entry({
      name: "expand_naked_asm",
      grep_hits: [{ file_path: REGISTRATION_FILE, line: 2, content: "    Key => asm::expand_naked_asm,", captures: [] }],
    });
    expect(check_rust_macro_registration_table(entry, (_: string) => lines, "rust")).toBe(false);
  });

  it("does not match a call-shaped line even inside a register block", () => {
    const lines = [
      "register_bang! {",
      "    let x = asm::expand_naked_asm(cx, span);",
      "}",
    ];
    const entry = make_entry({
      name: "expand_naked_asm",
      grep_hits: [{ file_path: REGISTRATION_FILE, line: 2, content: "    let x = asm::expand_naked_asm(cx, span);", captures: [] }],
    });
    expect(check_rust_macro_registration_table(entry, (_: string) => lines, "rust")).toBe(false);
  });

  it("does not match a non-rust entry", () => {
    const entry = make_entry({
      name: "expand_naked_asm",
      grep_hits: [grep_hit("        naked_asm: asm::expand_naked_asm,", 3)],
    });
    expect(run(entry, "typescript")).toBe(false);
  });

  it("does not match when there are no grep call sites", () => {
    const entry = make_entry({ grep_hits: [] });
    expect(run(entry, "rust")).toBe(false);
  });
});

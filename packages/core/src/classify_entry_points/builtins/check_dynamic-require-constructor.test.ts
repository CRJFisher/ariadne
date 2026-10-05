import { describe, it, expect } from "vitest";

import type {
  EnrichedEntryPoint,
  EntryPointDiagnosis,
  FilePath,
  GrepHit,
  Language,
} from "@ariadnejs/types";
import { check_dynamic_require_constructor } from "./check_dynamic-require-constructor";

const EMPTY_READER = (_: string) => [] as readonly string[];

const fp = (p: string): FilePath => p as FilePath;

function make_entry(overrides: {
  name?: string;
  diagnosis?: EntryPointDiagnosis;
  call_ref_count?: number;
  grep_call_sites?: GrepHit[];
}): EnrichedEntryPoint {
  return {
    name: overrides.name ?? "constructor",
    file_path: "/repo/lib/reporter.js" as FilePath,
    start_line: 2,
    kind: "constructor",
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: overrides.grep_call_sites ?? [],
      grep_call_sites_outside_index: [],
      reference_sites: [],
      ariadne_call_refs: Array.from({ length: overrides.call_ref_count ?? 0 }, () => ({
        caller_function: "make",
        caller_file: "/repo/lib/runner.js" as FilePath,
        call_line: 2,
        call_type: "constructor" as const,
        resolution_count: 0,
        resolved_to: [],
        receiver_kind: "none" as const,
        resolution_failure: null,
        syntactic_features: {
          is_new_expression: true,
          is_super_call: false,
          is_optional_chain: false,
          is_awaited: false,
          is_callback_arg: false,
          is_dynamic_dispatch: false,
        },
      })),
      diagnosis: overrides.diagnosis ?? "no-textual-callers",
      has_uncaptured_indexed_grep_hit: false,
    },
  };
}

function run(entry: EnrichedEntryPoint, language: Language = "javascript"): boolean {
  return check_dynamic_require_constructor(entry, EMPTY_READER, language);
}

describe("check_dynamic_require_constructor", () => {
  it("matches a JavaScript constructor with no textual callers", () => {
    expect(run(make_entry({ diagnosis: "no-textual-callers" }))).toBe(true);
  });

  // The class name is mentioned without call parens (`module.exports = Reporter`),
  // so the entry reports the reference diagnosis instead. That says nothing about
  // this rule's shape — the grep prefilter still found no `constructor(` call.
  it("matches when the class name is mentioned only as a non-call reference", () => {
    expect(run(make_entry({ diagnosis: "references-without-call-syntax" }))).toBe(true);
  });

  it("matches when the only caller sits outside the indexed corpus", () => {
    expect(run(make_entry({ diagnosis: "callers-outside-indexed-corpus" }))).toBe(true);
  });

  it("does not match when the resolver produced a call reference", () => {
    expect(run(make_entry({ call_ref_count: 1 }))).toBe(false);
  });

  it("does not match when the prefilter found a call site for the literal name", () => {
    // The gate is the evidence condition, not the diagnosis label: a rule keyed
    // on the enum would fire here whenever a new diagnosis value appeared with
    // grep hits present.
    expect(
      run(
        make_entry({
          diagnosis: "no-textual-callers",
          grep_call_sites: [
            { file_path: fp("other.js"), line: 3, content: "constructor(x)", captures: [] },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("does not match a named callable or another language", () => {
    expect(run(make_entry({ name: "render" }))).toBe(false);
    expect(run(make_entry({}), "typescript")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";

import type { EnrichedEntryPoint, FilePath } from "@ariadnejs/types";
import { check_py_dunder_protocol } from "./check_py-dunder-protocol";

const SOURCE_FILE = "/repo/src/model.py" as FilePath;
const EMPTY_READER = (_: string) => [] as readonly string[];

function make_entry(overrides: {
  name?: string;
  file_path?: FilePath;
  kind?: EnrichedEntryPoint["kind"];
  signature?: string;
} = {}): EnrichedEntryPoint {
  return {
    name: overrides.name ?? "__len__",
    file_path: overrides.file_path ?? SOURCE_FILE,
    start_line: 5,
    kind: overrides.kind ?? "method",
    signature: overrides.signature,
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
    },
  };
}

describe("check_py_dunder_protocol", () => {
  it("matches a Python method whose name is an implicit-protocol dunder (__len__)", () => {
    expect(check_py_dunder_protocol(make_entry({ name: "__len__" }), EMPTY_READER, "python")).toBe(true);
  });

  it("matches the iteration-protocol dunder __iter__", () => {
    expect(check_py_dunder_protocol(make_entry({ name: "__iter__" }), EMPTY_READER, "python")).toBe(true);
  });

  it("matches the context-manager dunder __enter__", () => {
    expect(check_py_dunder_protocol(make_entry({ name: "__enter__" }), EMPTY_READER, "python")).toBe(true);
  });

  // The negative guard the precision constraint turns on: an ordinary uncalled
  // Python method whose name is NOT a dunder is a genuine true positive and must
  // never be suppressed by this rule.
  it("does not match an ordinary uncalled method whose name is not a dunder", () => {
    expect(check_py_dunder_protocol(make_entry({ name: "compute" }), EMPTY_READER, "python")).toBe(false);
  });

  // __init__/__call__/__new__ stay traceable entry points (constructor /
  // callable-instance dispatch resolves them), so they are excluded.
  it("does not match the traceable dunder __init__", () => {
    expect(check_py_dunder_protocol(make_entry({ name: "__init__" }), EMPTY_READER, "python")).toBe(false);
  });

  it("does not match a non-Python entry point", () => {
    const entry = make_entry({ name: "__len__", file_path: "/repo/src/model.ts" as FilePath });
    expect(check_py_dunder_protocol(entry, EMPTY_READER, "typescript")).toBe(false);
  });

  it("does not match a non-method entry point", () => {
    expect(check_py_dunder_protocol(make_entry({ name: "__len__", kind: "function" }), EMPTY_READER, "python")).toBe(false);
  });

  // A single-underscore name is not dunder-shaped and is out of scope.
  it("does not match a single-underscore private method", () => {
    expect(check_py_dunder_protocol(make_entry({ name: "_helper" }), EMPTY_READER, "python")).toBe(false);
  });
});

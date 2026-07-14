import { describe, it, expect } from "vitest";

import type { EnrichedEntryPoint, FilePath } from "@ariadnejs/types";
import { check_framework_lifecycle_override } from "./check_framework-lifecycle-override";

const EMPTY_READER = (_: string) => [] as readonly string[];

function make_entry(overrides: { name: string; file_path: string }): EnrichedEntryPoint {
  return {
    name: overrides.name,
    file_path: overrides.file_path as FilePath,
    start_line: 1,
    kind: "method",
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

describe("check_framework_lifecycle_override", () => {
  it("classifies a JavaScript stream _transform subclass method", () => {
    const entry = make_entry({ name: "_transform", file_path: "src/stream.js" });
    expect(check_framework_lifecycle_override(entry, EMPTY_READER, "javascript")).toBe(true);
  });

  it("classifies a TypeScript stream _flush override", () => {
    const entry = make_entry({ name: "_flush", file_path: "src/stream.ts" });
    expect(check_framework_lifecycle_override(entry, EMPTY_READER, "typescript")).toBe(true);
  });

  it("does not classify a Python method with the same name", () => {
    const entry = make_entry({ name: "_transform", file_path: "src/stream.py" });
    expect(check_framework_lifecycle_override(entry, EMPTY_READER, "python")).toBe(false);
  });

  it("does not classify a non-lifecycle JavaScript method name", () => {
    const entry = make_entry({ name: "handle", file_path: "src/stream.js" });
    expect(check_framework_lifecycle_override(entry, EMPTY_READER, "javascript")).toBe(false);
  });
});

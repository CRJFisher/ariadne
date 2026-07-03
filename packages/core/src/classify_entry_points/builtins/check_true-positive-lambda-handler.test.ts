import { describe, it, expect } from "vitest";

import type { EnrichedEntryPoint, FilePath } from "@ariadnejs/types";
import { check_true_positive_lambda_handler } from "./check_true-positive-lambda-handler";

const EMPTY_READER = (_: string) => [] as readonly string[];

function make_entry(file_path: string): EnrichedEntryPoint {
  return {
    name: "handler",
    file_path: file_path as FilePath,
    start_line: 1,
    kind: "function",
    tree_size: 0,
    is_exported: true,
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

describe("check_true_positive_lambda_handler", () => {
  it("matches a Python file whose path contains _lambda_handler", () => {
    const entry = make_entry("src/handlers/ingest_lambda_handler.py");
    expect(check_true_positive_lambda_handler(entry, EMPTY_READER)).toBe(true);
  });

  it("matches a TypeScript file whose path contains _lambda_handler", () => {
    const entry = make_entry("src/api/export_lambda_handler.ts");
    expect(check_true_positive_lambda_handler(entry, EMPTY_READER)).toBe(true);
  });

  it("matches when the marker appears in a directory segment", () => {
    const entry = make_entry("services/ingest_lambda_handler/index.js");
    expect(check_true_positive_lambda_handler(entry, EMPTY_READER)).toBe(true);
  });

  it("does not match a path without the marker", () => {
    const entry = make_entry("src/handlers/ingest.py");
    expect(check_true_positive_lambda_handler(entry, EMPTY_READER)).toBe(false);
  });

  it("does not match a path with only a partial marker (lambda without the handler suffix)", () => {
    const entry = make_entry("src/handlers/ingest_lambda.py");
    expect(check_true_positive_lambda_handler(entry, EMPTY_READER)).toBe(false);
  });
});

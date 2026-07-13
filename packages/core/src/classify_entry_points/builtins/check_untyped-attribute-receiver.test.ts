import { describe, it, expect } from "vitest";

import type {
  CallRefDiagnostic,
  EnrichedEntryPoint,
  FilePath,
  ReceiverKind,
  ResolutionFailureReason,
  SymbolId,
} from "@ariadnejs/types";
import { check_untyped_attribute_receiver } from "./check_untyped-attribute-receiver";

const CALLER_FILE = "/repo/pandas/core/indexing.py" as FilePath;
const EMPTY_READER = (_: string) => [] as readonly string[];

const NO_SYNTACTIC_FEATURES = {
  is_new_expression: false,
  is_super_call: false,
  is_optional_chain: false,
  is_awaited: false,
  is_callback_arg: false,
  is_inside_try: false,
  is_dynamic_dispatch: false,
};

// A SymbolId whose file segment is `file` — the collapsed receiver class.
function class_symbol_id(file: string): SymbolId {
  return `class:${file}:11:7:11:26:_ScalarAccessIndexer` as SymbolId;
}

function make_ref(overrides: Partial<CallRefDiagnostic> = {}): CallRefDiagnostic {
  return {
    caller_function: "__setitem__",
    caller_file: CALLER_FILE,
    call_line: 3171,
    call_type: "method",
    resolution_count: 0,
    resolved_to: [],
    receiver_kind: "self_keyword" as ReceiverKind,
    resolution_failure: {
      stage: "type_inference",
      reason: "member_type_unknown" as ResolutionFailureReason,
      partial_info: { resolved_receiver_type: class_symbol_id(CALLER_FILE) },
    },
    syntactic_features: NO_SYNTACTIC_FEATURES,
    ...overrides,
  };
}

function make_entry(overrides: {
  file_path?: FilePath;
  kind?: EnrichedEntryPoint["kind"];
  refs?: CallRefDiagnostic[];
} = {}): EnrichedEntryPoint {
  return {
    name: "_set_value",
    file_path: overrides.file_path ?? (CALLER_FILE),
    start_line: 4831,
    kind: overrides.kind ?? "method",
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: overrides.refs ?? [make_ref()],
      diagnosis: "callers-in-registry-unresolved",
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
    },
  };
}

describe("check_untyped_attribute_receiver", () => {
  it("matches a Python method whose self-attribute receiver collapsed to the caller's own class", () => {
    expect(check_untyped_attribute_receiver(make_entry(), EMPTY_READER, "python")).toBe(true);
  });

  // The typed-attribute / untyped-sub-member shape, e.g. `self.frame.values.foo()`
  // where `self.frame` is typed (a class in another file) but `.values` is not:
  // the receiver resolves to that other-file class, so file != caller_file.
  it("does not match when the resolved receiver type lives in another file (typed attribute, untyped sub-member)", () => {
    const ref = make_ref({
      resolution_failure: {
        stage: "type_inference",
        reason: "member_type_unknown" as ResolutionFailureReason,
        partial_info: { resolved_receiver_type: class_symbol_id("/repo/other/module.py") },
      },
    });
    expect(check_untyped_attribute_receiver(make_entry({ refs: [ref] }), EMPTY_READER, "python")).toBe(false);
  });

  it("does not match an identifier receiver (the fixture-injected styler._repr_html_ shape is out of scope)", () => {
    const ref = make_ref({
      receiver_kind: "identifier" as ReceiverKind,
      resolution_failure: {
        stage: "receiver_resolution",
        reason: "receiver_type_unknown" as ResolutionFailureReason,
        partial_info: {},
      },
    });
    expect(check_untyped_attribute_receiver(make_entry({ refs: [ref] }), EMPTY_READER, "python")).toBe(false);
  });

  it("does not match a non-Python entry point", () => {
    const entry = make_entry({ file_path: "/repo/src/indexing.ts" as FilePath });
    expect(check_untyped_attribute_receiver(entry, EMPTY_READER, "typescript")).toBe(false);
  });

  it("does not match a non-method entry point", () => {
    expect(check_untyped_attribute_receiver(make_entry({ kind: "function" }), EMPTY_READER, "python")).toBe(false);
  });

  it("does not match when the call resolved (resolution_count > 0)", () => {
    const ref = make_ref({ resolution_count: 1 });
    expect(check_untyped_attribute_receiver(make_entry({ refs: [ref] }), EMPTY_READER, "python")).toBe(false);
  });

  it("does not match a different failure reason (method_not_on_type on a typed receiver)", () => {
    const ref = make_ref({
      resolution_failure: {
        stage: "method_lookup",
        reason: "method_not_on_type" as ResolutionFailureReason,
        partial_info: { resolved_receiver_type: class_symbol_id(CALLER_FILE) },
      },
    });
    expect(check_untyped_attribute_receiver(make_entry({ refs: [ref] }), EMPTY_READER, "python")).toBe(false);
  });

  it("does not match when there is no resolution failure", () => {
    const ref = make_ref({ resolution_count: 1, resolution_failure: null });
    expect(check_untyped_attribute_receiver(make_entry({ refs: [ref] }), EMPTY_READER, "python")).toBe(false);
  });

  it("does not match when resolved_receiver_type is absent", () => {
    const ref = make_ref({
      resolution_failure: {
        stage: "type_inference",
        reason: "member_type_unknown" as ResolutionFailureReason,
        partial_info: {},
      },
    });
    expect(check_untyped_attribute_receiver(make_entry({ refs: [ref] }), EMPTY_READER, "python")).toBe(false);
  });

  it("does not match an entry with no call refs", () => {
    expect(check_untyped_attribute_receiver(make_entry({ refs: [] }), EMPTY_READER, "python")).toBe(false);
  });

  it("matches when a non-matching ref precedes a matching one (.some over all refs)", () => {
    const non_matching = make_ref({
      resolution_failure: {
        stage: "method_lookup",
        reason: "method_not_on_type" as ResolutionFailureReason,
        partial_info: { resolved_receiver_type: class_symbol_id(CALLER_FILE) },
      },
    });
    const entry = make_entry({ refs: [non_matching, make_ref()] });
    expect(check_untyped_attribute_receiver(entry, EMPTY_READER, "python")).toBe(true);
  });

  it("does not match when every ref fails a clause", () => {
    const identifier_ref = make_ref({ receiver_kind: "identifier" as ReceiverKind });
    const resolved_ref = make_ref({ resolution_count: 1, resolution_failure: null });
    const entry = make_entry({ refs: [identifier_ref, resolved_ref] });
    expect(check_untyped_attribute_receiver(entry, EMPTY_READER, "python")).toBe(false);
  });
});

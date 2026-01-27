import { describe, it, expect } from "vitest";
import { classify_entrypoints } from "./classify_entrypoints.js";
import type { EnrichedFunctionEntry } from "./types.js";

// ===== Test Helpers =====

function make_entry(overrides: Partial<EnrichedFunctionEntry>): EnrichedFunctionEntry {
  return {
    name: "test_func",
    file_path: "src/test.ts",
    start_line: 10,
    start_column: 0,
    end_line: 20,
    end_column: 1,
    kind: "function",
    tree_size: 0,
    is_exported: false,
    is_anonymous: false,
    call_summary: {
      total_calls: 0,
      unresolved_count: 0,
      method_calls: 0,
      constructor_calls: 0,
      callback_invocations: 0,
    },
    diagnostics: {
      grep_call_sites: [],
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
    },
    ...overrides,
  };
}

// ===== Rule 1: No textual callers + exported =====

describe("Rule 1: No textual callers + exported → true positive", () => {
  it("classifies exported function with no callers as true positive", () => {
    const entry = make_entry({
      is_exported: true,
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
      },
    });

    const result = classify_entrypoints([entry]);

    expect(result.true_positives).toEqual([entry]);
    expect(result.classified_false_positives).toEqual([]);
    expect(result.unclassified).toEqual([]);
  });

  it("does not classify non-exported function with no callers as true positive", () => {
    const entry = make_entry({
      is_exported: false,
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
      },
    });

    const result = classify_entrypoints([entry]);

    expect(result.true_positives).toEqual([]);
    // Falls through to unclassified
    expect(result.unclassified).toEqual([entry]);
  });
});

// ===== Rule 2: Constructors =====

describe("Rule 2: Constructors → constructor resolution bug", () => {
  it("classifies constructor as false positive", () => {
    const entry = make_entry({
      kind: "constructor",
      diagnostics: {
        grep_call_sites: [{ file_path: "src/foo.ts", line: 5, content: "new MyClass()" }],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
      },
    });

    const result = classify_entrypoints([entry]);

    expect(result.classified_false_positives).toHaveLength(1);
    expect(result.classified_false_positives[0].group_id).toBe("constructor-resolution-bug");
    expect(result.classified_false_positives[0].rule_id).toBe("constructor");
  });
});

// ===== Rule 3: Protected/private methods =====

describe("Rule 3: Non-public methods → this-call tracking bug", () => {
  it("classifies protected method as false positive", () => {
    const entry = make_entry({
      kind: "method",
      access_modifier: "protected",
    });

    const result = classify_entrypoints([entry]);

    expect(result.classified_false_positives).toHaveLength(1);
    expect(result.classified_false_positives[0].group_id).toBe("method-call-via-this-not-tracked");
  });

  it("classifies private method as false positive", () => {
    const entry = make_entry({
      kind: "method",
      access_modifier: "private",
    });

    const result = classify_entrypoints([entry]);

    expect(result.classified_false_positives).toHaveLength(1);
    expect(result.classified_false_positives[0].group_id).toBe("method-call-via-this-not-tracked");
  });

  it("does not classify public method", () => {
    const entry = make_entry({
      kind: "method",
      access_modifier: "public",
      diagnostics: {
        grep_call_sites: [{ file_path: "src/foo.ts", line: 5, content: "obj.method()" }],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
      },
    });

    const result = classify_entrypoints([entry]);

    // Public method falls through to unclassified (needs LLM triage)
    expect(result.classified_false_positives).toHaveLength(0);
    expect(result.unclassified).toEqual([entry]);
  });
});

// ===== Rule 4: Callback functions =====

describe("Rule 4: Callback functions → callback invocation not tracked", () => {
  it("classifies callback function as false positive", () => {
    const entry = make_entry({
      callback_context: {
        is_callback: true,
        receiver_is_external: null,
      },
    });

    const result = classify_entrypoints([entry]);

    expect(result.classified_false_positives).toHaveLength(1);
    expect(result.classified_false_positives[0].group_id).toBe("callback-invocation-not-tracked");
  });

  it("does not classify non-callback function", () => {
    const entry = make_entry({
      callback_context: {
        is_callback: false,
        receiver_is_external: null,
      },
    });

    const result = classify_entrypoints([entry]);

    expect(result.classified_false_positives).toEqual([]);
    expect(result.unclassified).toEqual([entry]);
  });
});

// ===== Diagnostic-based entries go to unclassified =====

describe("Diagnostic-based entries are not pre-classified", () => {
  it("callers-not-in-registry goes to unclassified for LLM triage", () => {
    const entry = make_entry({
      diagnostics: {
        grep_call_sites: [{ file_path: "src/caller.ts", line: 15, content: "test_func()" }],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
      },
    });

    const result = classify_entrypoints([entry]);

    expect(result.classified_false_positives).toHaveLength(0);
    expect(result.unclassified).toEqual([entry]);
  });

  it("callers-in-registry-unresolved goes to unclassified for LLM triage", () => {
    const entry = make_entry({
      diagnostics: {
        grep_call_sites: [{ file_path: "src/caller.ts", line: 15, content: "test_func()" }],
        ariadne_call_refs: [{
          caller_function: "some_caller",
          caller_file: "src/caller.ts",
          call_line: 15,
          call_type: "function",
          resolution_count: 0,
          resolved_to: [],
        }],
        diagnosis: "callers-in-registry-unresolved",
      },
    });

    const result = classify_entrypoints([entry]);

    expect(result.classified_false_positives).toHaveLength(0);
    expect(result.unclassified).toEqual([entry]);
  });
});

// ===== Rule precedence =====

describe("Rule precedence", () => {
  it("constructor rule classifies constructor regardless of diagnosis", () => {
    const entry = make_entry({
      kind: "constructor",
      diagnostics: {
        grep_call_sites: [{ file_path: "src/foo.ts", line: 5, content: "new MyClass()" }],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
      },
    });

    const result = classify_entrypoints([entry]);

    expect(result.classified_false_positives).toHaveLength(1);
    expect(result.classified_false_positives[0].group_id).toBe("constructor-resolution-bug");
  });

  it("private method rule classifies private method regardless of diagnosis", () => {
    const entry = make_entry({
      kind: "method",
      access_modifier: "private",
      diagnostics: {
        grep_call_sites: [{ file_path: "src/foo.ts", line: 5, content: "this.method()" }],
        ariadne_call_refs: [{
          caller_function: "other",
          caller_file: "src/foo.ts",
          call_line: 5,
          call_type: "method",
          resolution_count: 0,
          resolved_to: [],
        }],
        diagnosis: "callers-in-registry-unresolved",
      },
    });

    const result = classify_entrypoints([entry]);

    expect(result.classified_false_positives).toHaveLength(1);
    expect(result.classified_false_positives[0].group_id).toBe("method-call-via-this-not-tracked");
  });
});

// ===== Mixed entries =====

describe("Mixed entry classification", () => {
  it("correctly sorts entries into all three buckets", () => {
    const true_positive = make_entry({
      name: "exported_api",
      is_exported: true,
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
      },
    });

    const false_positive = make_entry({
      name: "private_method",
      kind: "method",
      access_modifier: "private",
    });

    const unclassified = make_entry({
      name: "mystery_func",
      diagnostics: {
        grep_call_sites: [{ file_path: "src/x.ts", line: 1, content: "mystery_func()" }],
        ariadne_call_refs: [{
          caller_function: "caller",
          caller_file: "src/x.ts",
          call_line: 1,
          call_type: "function",
          resolution_count: 1,
          resolved_to: ["wrong_symbol_id"],
        }],
        diagnosis: "callers-in-registry-wrong-target",
      },
    });

    const result = classify_entrypoints([true_positive, false_positive, unclassified]);

    expect(result.true_positives).toEqual([true_positive]);
    expect(result.classified_false_positives).toHaveLength(1);
    expect(result.classified_false_positives[0].entry).toEqual(false_positive);
    expect(result.unclassified).toEqual([unclassified]);
  });
});

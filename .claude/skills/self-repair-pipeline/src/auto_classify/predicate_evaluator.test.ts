import { describe, it, expect } from "vitest";

import type {
  CallRefDiagnostic,
  EnrichedFunctionEntry,
  EntryPointDiagnostics,
  GrepHit,
  SyntacticFeatures,
} from "../entry_point_types.js";
import type { PredicateExpr } from "../known_issues_types.js";
import { evaluate_predicate } from "./predicate_evaluator.js";

// ===== Fixtures =====

const BASE_FEATURES: SyntacticFeatures = {
  is_new_expression: false,
  is_super_call: false,
  is_optional_chain: false,
  is_awaited: false,
  is_callback_arg: false,
  is_inside_try: false,
  is_dynamic_dispatch: false,
};

function make_grep_hit(overrides: Partial<GrepHit> = {}): GrepHit {
  return {
    file_path: "src/caller.ts",
    line: 10,
    content: "foo()",
    captures: [],
    ...overrides,
  };
}

function make_call_ref(overrides: Partial<CallRefDiagnostic> = {}): CallRefDiagnostic {
  return {
    caller_function: "caller",
    caller_file: "src/caller.ts",
    call_line: 10,
    call_type: "function",
    resolution_count: 0,
    resolved_to: [],
    receiver_kind: "none",
    resolution_failure: null,
    syntactic_features: { ...BASE_FEATURES },
    ...overrides,
  };
}

function make_diagnostics(
  overrides: Partial<EntryPointDiagnostics> = {},
): EntryPointDiagnostics {
  return {
    grep_call_sites: [],
    ariadne_call_refs: [],
    diagnosis: "callers-not-in-registry",
    ...overrides,
  };
}

function make_entry(
  overrides: Partial<EnrichedFunctionEntry> = {},
): EnrichedFunctionEntry {
  return {
    name: "target",
    file_path: "src/target.ts",
    start_line: 5,
    kind: "function",
    tree_size: 0,
    is_exported: true,
    diagnostics: make_diagnostics(),
    ...overrides,
  };
}

function ctx(entry: EnrichedFunctionEntry, lines_by_file: Record<string, string[]> = {}) {
  return {
    entry,
    read_file_lines: (p: string) => lines_by_file[p] ?? [],
  };
}

// ===== Leaves =====

describe("evaluate_predicate — leaf operators", () => {
  it("diagnosis_eq matches when entry diagnosis equals value", () => {
    const entry = make_entry({
      diagnostics: make_diagnostics({ diagnosis: "no-textual-callers" }),
    });
    const expr: PredicateExpr = { op: "diagnosis_eq", value: "no-textual-callers" };
    expect(evaluate_predicate(expr, ctx(entry))).toBe(true);
  });

  it("diagnosis_eq false on mismatch", () => {
    const entry = make_entry();
    const expr: PredicateExpr = { op: "diagnosis_eq", value: "no-textual-callers" };
    expect(evaluate_predicate(expr, ctx(entry))).toBe(false);
  });

  it("language_eq reads language from file extension", () => {
    const py_entry = make_entry({ file_path: "app/main.py" });
    const ts_entry = make_entry({ file_path: "src/server.ts" });
    const expr: PredicateExpr = { op: "language_eq", value: "python" };
    expect(evaluate_predicate(expr, ctx(py_entry))).toBe(true);
    expect(evaluate_predicate(expr, ctx(ts_entry))).toBe(false);
  });

  it("grep_line_regex matches any grep hit content", () => {
    const entry = make_entry({
      diagnostics: make_diagnostics({
        grep_call_sites: [make_grep_hit({ content: "this._hooks[name].call(arg)" })],
      }),
    });
    const yes: PredicateExpr = { op: "grep_line_regex", pattern: "\\[.*\\]\\.call" };
    const no: PredicateExpr = { op: "grep_line_regex", pattern: "\\bawait\\b" };
    expect(evaluate_predicate(yes, ctx(entry))).toBe(true);
    expect(evaluate_predicate(no, ctx(entry))).toBe(false);
  });

  it("grep_line_regex uses compiled_pattern when attached", () => {
    const entry = make_entry({
      diagnostics: make_diagnostics({
        grep_call_sites: [make_grep_hit({ content: "super.foo()" })],
      }),
    });
    const node: PredicateExpr = {
      op: "grep_line_regex",
      pattern: "NEVER_MATCHES",
      compiled_pattern: /super\./,
    };
    expect(evaluate_predicate(node, ctx(entry))).toBe(true);
  });

  it("decorator_matches reads preceding decorator block", () => {
    const entry = make_entry({ file_path: "app.py", start_line: 2 });
    const lines = ["@pytest.fixture", "def load_config():", "    pass"];
    const expr: PredicateExpr = { op: "decorator_matches", pattern: "pytest\\.fixture" };
    expect(evaluate_predicate(expr, ctx(entry, { "app.py": lines }))).toBe(true);
  });

  it("decorator_matches false when no decorator above the definition", () => {
    const entry = make_entry({ file_path: "app.py", start_line: 1 });
    const lines = ["def load_config():", "    pass"];
    const expr: PredicateExpr = { op: "decorator_matches", pattern: "pytest\\.fixture" };
    expect(evaluate_predicate(expr, ctx(entry, { "app.py": lines }))).toBe(false);
  });

  it("has_capture_at_grep_hit matches when any hit includes the capture", () => {
    const entry = make_entry({
      diagnostics: make_diagnostics({
        grep_call_sites: [
          make_grep_hit({ captures: ["@reference.call"] }),
          make_grep_hit({ captures: [] }),
        ],
      }),
    });
    const yes: PredicateExpr = { op: "has_capture_at_grep_hit", capture_name: "@reference.call" };
    const no: PredicateExpr = {
      op: "has_capture_at_grep_hit",
      capture_name: "@reference.constructor",
    };
    expect(evaluate_predicate(yes, ctx(entry))).toBe(true);
    expect(evaluate_predicate(no, ctx(entry))).toBe(false);
  });

  it("missing_capture_at_grep_hit matches when any hit is missing the capture", () => {
    const entry = make_entry({
      diagnostics: make_diagnostics({
        grep_call_sites: [
          make_grep_hit({ captures: ["@reference.constructor"] }),
          make_grep_hit({ captures: [] }), // missing — triggers match
        ],
      }),
    });
    const expr: PredicateExpr = {
      op: "missing_capture_at_grep_hit",
      capture_name: "@reference.constructor",
    };
    expect(evaluate_predicate(expr, ctx(entry))).toBe(true);
  });

  it("missing_capture_at_grep_hit false when every hit has the capture", () => {
    const entry = make_entry({
      diagnostics: make_diagnostics({
        grep_call_sites: [
          make_grep_hit({ captures: ["@reference.constructor"] }),
          make_grep_hit({ captures: ["@reference.constructor"] }),
        ],
      }),
    });
    const expr: PredicateExpr = {
      op: "missing_capture_at_grep_hit",
      capture_name: "@reference.constructor",
    };
    expect(evaluate_predicate(expr, ctx(entry))).toBe(false);
  });

  it("resolution_failure_reason_eq matches when any call_ref has matching failure reason", () => {
    const entry = make_entry({
      diagnostics: make_diagnostics({
        ariadne_call_refs: [
          make_call_ref({
            resolution_failure: {
              stage: "name_resolution",
              reason: "name_not_in_scope",
              partial_info: {},
            },
          }),
        ],
      }),
    });
    const yes: PredicateExpr = {
      op: "resolution_failure_reason_eq",
      value: "name_not_in_scope",
    };
    const no: PredicateExpr = {
      op: "resolution_failure_reason_eq",
      value: "polymorphic_no_implementations",
    };
    expect(evaluate_predicate(yes, ctx(entry))).toBe(true);
    expect(evaluate_predicate(no, ctx(entry))).toBe(false);
  });

  it("receiver_kind_eq matches when any call_ref has the receiver_kind", () => {
    const entry = make_entry({
      diagnostics: make_diagnostics({
        ariadne_call_refs: [make_call_ref({ receiver_kind: "index_access" })],
      }),
    });
    const yes: PredicateExpr = { op: "receiver_kind_eq", value: "index_access" };
    const no: PredicateExpr = { op: "receiver_kind_eq", value: "identifier" };
    expect(evaluate_predicate(yes, ctx(entry))).toBe(true);
    expect(evaluate_predicate(no, ctx(entry))).toBe(false);
  });

  it("syntactic_feature_eq matches for is_dynamic_dispatch=true", () => {
    const entry = make_entry({
      diagnostics: make_diagnostics({
        ariadne_call_refs: [
          make_call_ref({
            syntactic_features: { ...BASE_FEATURES, is_dynamic_dispatch: true },
          }),
        ],
      }),
    });
    const expr: PredicateExpr = {
      op: "syntactic_feature_eq",
      name: "is_dynamic_dispatch",
      value: true,
    };
    expect(evaluate_predicate(expr, ctx(entry))).toBe(true);
  });

  it("syntactic_feature_eq false when no call_ref carries the feature", () => {
    const entry = make_entry({
      diagnostics: make_diagnostics({
        ariadne_call_refs: [make_call_ref()],
      }),
    });
    const expr: PredicateExpr = {
      op: "syntactic_feature_eq",
      name: "is_super_call",
      value: true,
    };
    expect(evaluate_predicate(expr, ctx(entry))).toBe(false);
  });
});

// ===== Combinators =====

describe("evaluate_predicate — combinators", () => {
  const py_entry = make_entry({
    file_path: "app.py",
    diagnostics: make_diagnostics({ diagnosis: "no-textual-callers" }),
  });

  it("all — true only when every child matches", () => {
    const expr: PredicateExpr = {
      op: "all",
      of: [
        { op: "language_eq", value: "python" },
        { op: "diagnosis_eq", value: "no-textual-callers" },
      ],
    };
    expect(evaluate_predicate(expr, ctx(py_entry))).toBe(true);

    const mixed: PredicateExpr = {
      op: "all",
      of: [
        { op: "language_eq", value: "python" },
        { op: "diagnosis_eq", value: "callers-in-registry-wrong-target" },
      ],
    };
    expect(evaluate_predicate(mixed, ctx(py_entry))).toBe(false);
  });

  it("any — true when any child matches", () => {
    const expr: PredicateExpr = {
      op: "any",
      of: [
        { op: "language_eq", value: "rust" },
        { op: "language_eq", value: "python" },
      ],
    };
    expect(evaluate_predicate(expr, ctx(py_entry))).toBe(true);
  });

  it("not — inverts the child", () => {
    const expr: PredicateExpr = {
      op: "not",
      of: { op: "language_eq", value: "rust" },
    };
    expect(evaluate_predicate(expr, ctx(py_entry))).toBe(true);
  });
});

// ===== Runtime bad operator =====

describe("evaluate_predicate — runtime guards", () => {
  it("throws on an operator that bypassed registry validation", () => {
    // Bypass TS via JSON.parse so we can feed a bad `op` through.
    const bad = JSON.parse("{\"op\":\"unknown_operator\",\"value\":\"x\"}") as PredicateExpr;
    const entry = make_entry();
    expect(() => evaluate_predicate(bad, ctx(entry))).toThrow(/Unknown predicate operator/);
  });
});

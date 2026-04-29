import { describe, it, expect } from "vitest";

import type {
  CallRefDiagnostic,
  DefinitionFeatures,
  EnrichedEntryPoint,
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
    grep_call_sites_unindexed_tests: [],
    ariadne_call_refs: [],
    diagnosis: "callers-not-in-registry",
    ...overrides,
  };
}

const BASE_DEFINITION_FEATURES: DefinitionFeatures = {
  definition_is_object_literal_method: false,
  accessor_kind: null,
};

function make_entry(
  overrides: Partial<EnrichedEntryPoint> = {},
): EnrichedEntryPoint {
  return {
    name: "target",
    file_path: "src/target.ts",
    start_line: 5,
    kind: "function",
    tree_size: 0,
    is_exported: true,
    definition_features: { ...BASE_DEFINITION_FEATURES },
    diagnostics: make_diagnostics(),
    ...overrides,
  };
}

function ctx(entry_point: EnrichedEntryPoint, lines_by_file: Record<string, string[]> = {}) {
  return {
    entry_point,
    read_file_lines: (p: string) => lines_by_file[p] ?? [],
  };
}

// ===== Leaves =====

describe("evaluate_predicate — leaf operators", () => {
  it("diagnosis_eq matches when entry_point diagnosis equals value", () => {
    const entry_point = make_entry({
      diagnostics: make_diagnostics({ diagnosis: "no-textual-callers" }),
    });
    const expr: PredicateExpr = { op: "diagnosis_eq", value: "no-textual-callers" };
    expect(evaluate_predicate(expr, ctx(entry_point))).toBe(true);
  });

  it("diagnosis_eq false on mismatch", () => {
    const entry_point = make_entry();
    const expr: PredicateExpr = { op: "diagnosis_eq", value: "no-textual-callers" };
    expect(evaluate_predicate(expr, ctx(entry_point))).toBe(false);
  });

  it("language_eq reads language from file extension", () => {
    const py_entry = make_entry({ file_path: "app/main.py" });
    const ts_entry = make_entry({ file_path: "src/server.ts" });
    const expr: PredicateExpr = { op: "language_eq", value: "python" };
    expect(evaluate_predicate(expr, ctx(py_entry))).toBe(true);
    expect(evaluate_predicate(expr, ctx(ts_entry))).toBe(false);
  });

  it("grep_line_regex matches any grep hit content", () => {
    const entry_point = make_entry({
      diagnostics: make_diagnostics({
        grep_call_sites: [make_grep_hit({ content: "this._hooks[name].call(arg)" })],
      }),
    });
    const yes: PredicateExpr = { op: "grep_line_regex", pattern: "\\[.*\\]\\.call" };
    const no: PredicateExpr = { op: "grep_line_regex", pattern: "\\bawait\\b" };
    expect(evaluate_predicate(yes, ctx(entry_point))).toBe(true);
    expect(evaluate_predicate(no, ctx(entry_point))).toBe(false);
  });

  it("grep_line_regex uses compiled_pattern when attached", () => {
    const entry_point = make_entry({
      diagnostics: make_diagnostics({
        grep_call_sites: [make_grep_hit({ content: "super.foo()" })],
      }),
    });
    const node: PredicateExpr = {
      op: "grep_line_regex",
      pattern: "NEVER_MATCHES",
      compiled_pattern: /super\./,
    };
    expect(evaluate_predicate(node, ctx(entry_point))).toBe(true);
  });

  it("decorator_matches reads preceding decorator block", () => {
    const entry_point = make_entry({ file_path: "app.py", start_line: 2 });
    const lines = ["@pytest.fixture", "def load_config():", "    pass"];
    const expr: PredicateExpr = { op: "decorator_matches", pattern: "pytest\\.fixture" };
    expect(evaluate_predicate(expr, ctx(entry_point, { "app.py": lines }))).toBe(true);
  });

  it("decorator_matches false when no decorator above the definition", () => {
    const entry_point = make_entry({ file_path: "app.py", start_line: 1 });
    const lines = ["def load_config():", "    pass"];
    const expr: PredicateExpr = { op: "decorator_matches", pattern: "pytest\\.fixture" };
    expect(evaluate_predicate(expr, ctx(entry_point, { "app.py": lines }))).toBe(false);
  });

  it("has_capture_at_grep_hit matches when any hit includes the capture", () => {
    const entry_point = make_entry({
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
    expect(evaluate_predicate(yes, ctx(entry_point))).toBe(true);
    expect(evaluate_predicate(no, ctx(entry_point))).toBe(false);
  });

  it("missing_capture_at_grep_hit matches when any hit is missing the capture", () => {
    const entry_point = make_entry({
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
    expect(evaluate_predicate(expr, ctx(entry_point))).toBe(true);
  });

  it("missing_capture_at_grep_hit false when every hit has the capture", () => {
    const entry_point = make_entry({
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
    expect(evaluate_predicate(expr, ctx(entry_point))).toBe(false);
  });

  it("resolution_failure_reason_eq matches when any call_ref has matching failure reason", () => {
    const entry_point = make_entry({
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
    expect(evaluate_predicate(yes, ctx(entry_point))).toBe(true);
    expect(evaluate_predicate(no, ctx(entry_point))).toBe(false);
  });

  it("receiver_kind_eq matches when any call_ref has the receiver_kind", () => {
    const entry_point = make_entry({
      diagnostics: make_diagnostics({
        ariadne_call_refs: [make_call_ref({ receiver_kind: "index_access" })],
      }),
    });
    const yes: PredicateExpr = { op: "receiver_kind_eq", value: "index_access" };
    const no: PredicateExpr = { op: "receiver_kind_eq", value: "identifier" };
    expect(evaluate_predicate(yes, ctx(entry_point))).toBe(true);
    expect(evaluate_predicate(no, ctx(entry_point))).toBe(false);
  });

  it("syntactic_feature_eq matches for is_dynamic_dispatch=true", () => {
    const entry_point = make_entry({
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
    expect(evaluate_predicate(expr, ctx(entry_point))).toBe(true);
  });

  it("syntactic_feature_eq false when no call_ref carries the feature", () => {
    const entry_point = make_entry({
      diagnostics: make_diagnostics({
        ariadne_call_refs: [make_call_ref()],
      }),
    });
    const expr: PredicateExpr = {
      op: "syntactic_feature_eq",
      name: "is_super_call",
      value: true,
    };
    expect(evaluate_predicate(expr, ctx(entry_point))).toBe(false);
  });

  it("grep_hits_all_intra_file matches when every hit shares the entry_point file", () => {
    const entry_point = make_entry({
      file_path: "src/foo.js",
      diagnostics: make_diagnostics({
        grep_call_sites: [
          make_grep_hit({ file_path: "src/foo.js" }),
          make_grep_hit({ file_path: "src/foo.js" }),
        ],
      }),
    });
    const yes: PredicateExpr = { op: "grep_hits_all_intra_file", value: true };
    expect(evaluate_predicate(yes, ctx(entry_point))).toBe(true);
  });

  it("grep_hits_all_intra_file rejects when any hit is cross-file", () => {
    const entry_point = make_entry({
      file_path: "src/foo.js",
      diagnostics: make_diagnostics({
        grep_call_sites: [
          make_grep_hit({ file_path: "src/foo.js" }),
          make_grep_hit({ file_path: "src/bar.js" }),
        ],
      }),
    });
    const expr: PredicateExpr = { op: "grep_hits_all_intra_file", value: true };
    expect(evaluate_predicate(expr, ctx(entry_point))).toBe(false);
  });

  it("grep_hits_all_intra_file with value:false negates the predicate", () => {
    const all_intra = make_entry({
      file_path: "src/foo.js",
      diagnostics: make_diagnostics({
        grep_call_sites: [make_grep_hit({ file_path: "src/foo.js" })],
      }),
    });
    const cross_file = make_entry({
      file_path: "src/foo.js",
      diagnostics: make_diagnostics({
        grep_call_sites: [
          make_grep_hit({ file_path: "src/foo.js" }),
          make_grep_hit({ file_path: "src/bar.js" }),
        ],
      }),
    });
    const expr: PredicateExpr = { op: "grep_hits_all_intra_file", value: false };
    expect(evaluate_predicate(expr, ctx(all_intra))).toBe(false);
    expect(evaluate_predicate(expr, ctx(cross_file))).toBe(true);
  });

  it("grep_hits_all_intra_file with empty grep array reads as 'not all intra'", () => {
    const entry_point = make_entry({
      file_path: "src/foo.js",
      diagnostics: make_diagnostics({ grep_call_sites: [] }),
    });
    const yes: PredicateExpr = { op: "grep_hits_all_intra_file", value: true };
    const no: PredicateExpr = { op: "grep_hits_all_intra_file", value: false };
    expect(evaluate_predicate(yes, ctx(entry_point))).toBe(false);
    expect(evaluate_predicate(no, ctx(entry_point))).toBe(true);
  });

  it("grep_hit_neighbourhood_matches scans lines above the hit", () => {
    const entry_point = make_entry({
      diagnostics: make_diagnostics({
        grep_call_sites: [make_grep_hit({ file_path: "src/caller.js", line: 10 })],
      }),
    });
    const lines_by_file = {
      "src/caller.js": [
        "/* 1 */", "/* 2 */", "/* 3 */", "/* 4 */",
        "/* 5 */", "/* 6 */", "/* 7 */",
        "const Foo = require(\"./foo\");",  // line 8
        "/* 9 */",
        "Foo.bar();",                       // line 10 (hit line)
      ],
    };
    const yes: PredicateExpr = {
      op: "grep_hit_neighbourhood_matches",
      pattern: "require\\(",
      window: 5,
    };
    const no: PredicateExpr = {
      op: "grep_hit_neighbourhood_matches",
      pattern: "require\\(",
      window: 1, // hit on line 10, window 1 means just line 9 — no match
    };
    expect(evaluate_predicate(yes, ctx(entry_point, lines_by_file))).toBe(true);
    expect(evaluate_predicate(no, ctx(entry_point, lines_by_file))).toBe(false);
  });

  it("grep_hit_neighbourhood_matches handles top-of-file (window larger than hit line)", () => {
    const entry_point = make_entry({
      diagnostics: make_diagnostics({
        grep_call_sites: [make_grep_hit({ file_path: "src/caller.js", line: 2 })],
      }),
    });
    const lines_by_file = {
      "src/caller.js": [
        "const Foo = require(\"./foo\");",  // line 1
        "Foo.bar();",                       // line 2 (hit line)
      ],
    };
    const expr: PredicateExpr = {
      op: "grep_hit_neighbourhood_matches",
      pattern: "require\\(",
      window: 10, // window dwarfs available lines; Math.max(0, ...) protects start index
    };
    expect(evaluate_predicate(expr, ctx(entry_point, lines_by_file))).toBe(true);
  });

  it("grep_hit_neighbourhood_matches returns false when the hit's file is not in lines_by_file", () => {
    const entry_point = make_entry({
      diagnostics: make_diagnostics({
        grep_call_sites: [make_grep_hit({ file_path: "src/missing.js", line: 5 })],
      }),
    });
    const expr: PredicateExpr = {
      op: "grep_hit_neighbourhood_matches",
      pattern: "require\\(",
      window: 5,
    };
    expect(evaluate_predicate(expr, ctx(entry_point, {}))).toBe(false);
  });

  it("definition_feature_eq reads definition-site features", () => {
    const entry_point = make_entry({
      definition_features: {
        definition_is_object_literal_method: true,
        accessor_kind: null,
      },
    });
    const yes: PredicateExpr = {
      op: "definition_feature_eq",
      name: "definition_is_object_literal_method",
      value: true,
    };
    const no: PredicateExpr = {
      op: "definition_feature_eq",
      name: "definition_is_object_literal_method",
      value: false,
    };
    expect(evaluate_predicate(yes, ctx(entry_point))).toBe(true);
    expect(evaluate_predicate(no, ctx(entry_point))).toBe(false);
  });

  it("accessor_kind_eq matches getter/setter/none", () => {
    const getter_entry = make_entry({
      definition_features: {
        definition_is_object_literal_method: false,
        accessor_kind: "getter",
      },
    });
    const plain_entry = make_entry();
    const yes: PredicateExpr = { op: "accessor_kind_eq", value: "getter" };
    const none_match: PredicateExpr = { op: "accessor_kind_eq", value: "none" };
    expect(evaluate_predicate(yes, ctx(getter_entry))).toBe(true);
    expect(evaluate_predicate(yes, ctx(plain_entry))).toBe(false);
    expect(evaluate_predicate(none_match, ctx(plain_entry))).toBe(true);
  });

  it("has_unindexed_test_caller reflects grep_call_sites_unindexed_tests presence", () => {
    const with_test = make_entry({
      diagnostics: make_diagnostics({
        grep_call_sites_unindexed_tests: [make_grep_hit({ file_path: "test/foo.test.js" })],
      }),
    });
    const without_test = make_entry();
    const yes: PredicateExpr = { op: "has_unindexed_test_caller", value: true };
    expect(evaluate_predicate(yes, ctx(with_test))).toBe(true);
    expect(evaluate_predicate(yes, ctx(without_test))).toBe(false);
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
    const entry_point = make_entry();
    expect(() => evaluate_predicate(bad, ctx(entry_point))).toThrow(/Unknown predicate operator/);
  });
});

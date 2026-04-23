import { describe, it, expect } from "vitest";

import type { EnrichedFunctionEntry } from "../entry_point_types.js";
import type { KnownIssue, KnownIssuesRegistry, PredicateExpr } from "../known_issues_types.js";
import type { ClassifierHint } from "../triage_state_types.js";
import { auto_classify } from "./orchestrator.js";

// ===== Fixtures =====

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
    diagnostics: {
      grep_call_sites: [],
      ariadne_call_refs: [],
      diagnosis: "callers-not-in-registry",
    },
    ...overrides,
  };
}

function predicate_issue(
  group_id: string,
  expression: PredicateExpr,
  min_confidence: number,
  overrides: Partial<KnownIssue> = {},
): KnownIssue {
  return {
    group_id,
    title: `Title for ${group_id}`,
    description: `Desc for ${group_id}`,
    status: "permanent",
    languages: ["typescript"],
    examples: [],
    classifier: {
      kind: "predicate",
      axis: "A",
      expression,
      min_confidence,
    },
    ...overrides,
  };
}

function none_issue(group_id: string): KnownIssue {
  return {
    group_id,
    title: `Title for ${group_id}`,
    description: `Desc for ${group_id}`,
    status: "permanent",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "none" },
  };
}

const EMPTY_READER = (_: string) => [] as readonly string[];

// ===== Tests =====

describe("auto_classify — priority and match semantics", () => {
  it("first matching predicate wins when two predicates both match", () => {
    const entry = make_entry({
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
      },
    });
    const registry: KnownIssuesRegistry = [
      predicate_issue("first", { op: "diagnosis_eq", value: "no-textual-callers" }, 1.0),
      predicate_issue("second", { op: "diagnosis_eq", value: "no-textual-callers" }, 1.0),
    ];

    const [classified] = auto_classify([entry], registry, EMPTY_READER);

    expect(classified.result.auto_classified).toBe(true);
    expect(classified.result.auto_group_id).toBe("first");
    expect(classified.result.classifier_hints).toEqual([]);
  });

  it("non-matching predicates are skipped without emitting hints", () => {
    const entry = make_entry({
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
      },
    });
    const registry: KnownIssuesRegistry = [
      predicate_issue("wont-match", { op: "diagnosis_eq", value: "no-textual-callers" }, 1.0),
      predicate_issue("will-match", { op: "diagnosis_eq", value: "callers-not-in-registry" }, 1.0),
    ];

    const [classified] = auto_classify([entry], registry, EMPTY_READER);

    expect(classified.result.auto_classified).toBe(true);
    expect(classified.result.auto_group_id).toBe("will-match");
    expect(classified.result.classifier_hints).toEqual([]);
  });

  it("kind: none entries are skipped silently", () => {
    const entry = make_entry({
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
      },
    });
    const registry: KnownIssuesRegistry = [
      none_issue("skip-none"),
      predicate_issue("match", { op: "diagnosis_eq", value: "no-textual-callers" }, 1.0),
    ];

    const [classified] = auto_classify([entry], registry, EMPTY_READER);

    expect(classified.result.auto_classified).toBe(true);
    expect(classified.result.auto_group_id).toBe("match");
  });

  it("no match anywhere → auto_classified: false with empty hints", () => {
    const entry = make_entry({
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "callers-in-registry-wrong-target",
      },
    });
    const registry: KnownIssuesRegistry = [
      predicate_issue("a", { op: "diagnosis_eq", value: "no-textual-callers" }, 1.0),
      predicate_issue("b", { op: "language_eq", value: "python" }, 1.0),
    ];

    const [classified] = auto_classify([entry], registry, EMPTY_READER);

    expect(classified.result.auto_classified).toBe(false);
    expect(classified.result.auto_group_id).toBeNull();
    expect(classified.result.reasoning).toBeNull();
    expect(classified.result.classifier_hints).toEqual([]);
  });
});

describe("auto_classify — sub-threshold hints", () => {
  it("predicate match below min_confidence becomes a hint without classifying", () => {
    const entry = make_entry({
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
      },
    });
    // Construct a hint-only registry: min_confidence > 1.0 is unreachable for
    // predicates (which always score 1.0), forcing the sub-threshold branch.
    // Bypass the registry validator's [0,1] check by building the KnownIssue
    // object directly — this is the same code path scoring builtins from
    // TASK-190.16.6 will exercise.
    const registry: KnownIssuesRegistry = [
      predicate_issue("hint-only", { op: "diagnosis_eq", value: "no-textual-callers" }, 1.1),
    ];

    const [classified] = auto_classify([entry], registry, EMPTY_READER);

    expect(classified.result.auto_classified).toBe(false);
    expect(classified.result.auto_group_id).toBeNull();
    expect(classified.result.classifier_hints).toEqual([
      {
        group_id: "hint-only",
        confidence: 1.0,
        reasoning: "Matched predicate classifier for hint-only",
      },
    ]);
  });

  it("hints accumulate then get attached to an eventual auto-classification", () => {
    const entry = make_entry({
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
      },
    });
    const registry: KnownIssuesRegistry = [
      predicate_issue("hint-1", { op: "diagnosis_eq", value: "no-textual-callers" }, 1.1),
      predicate_issue("hint-2", { op: "diagnosis_eq", value: "no-textual-callers" }, 1.2),
      predicate_issue("final", { op: "diagnosis_eq", value: "no-textual-callers" }, 1.0),
    ];

    const [classified] = auto_classify([entry], registry, EMPTY_READER);

    expect(classified.result.auto_classified).toBe(true);
    expect(classified.result.auto_group_id).toBe("final");
    expect(classified.result.classifier_hints.map((h: ClassifierHint) => h.group_id)).toEqual([
      "hint-1",
      "hint-2",
    ]);
  });
});

describe("auto_classify — file reader plumbing", () => {
  it("passes read_file_lines through to the evaluator so decorator_matches works", () => {
    const entry = make_entry({ file_path: "app.py", start_line: 2 });
    const registry: KnownIssuesRegistry = [
      predicate_issue(
        "py-fixture",
        { op: "decorator_matches", pattern: "pytest\\.fixture" },
        1.0,
      ),
    ];
    const reader = (p: string): readonly string[] =>
      p === "app.py" ? ["@pytest.fixture", "def load():", "    pass"] : [];

    const [classified] = auto_classify([entry], registry, reader);

    expect(classified.result.auto_classified).toBe(true);
    expect(classified.result.auto_group_id).toBe("py-fixture");
  });
});


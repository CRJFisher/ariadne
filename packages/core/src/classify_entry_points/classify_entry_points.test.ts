import { describe, it, expect } from "vitest";

import type {
  Language,
  EnrichedEntryPoint,
  FilePath,
  KnownIssue,
  KnownIssuesRegistry,
  ClassifierHint,
} from "@ariadnejs/types";
import { auto_classify, MissingBuiltinError } from "./classify_entry_points";
import type { BuiltinCheckFn } from "./builtins";

const fp = (s: string) => s as FilePath;

// ===== Fixtures =====

function make_entry(
  overrides: Partial<EnrichedEntryPoint> = {},
): EnrichedEntryPoint {
  return {
    name: "target",
    file_path: fp("src/target.ts"),
    start_line: 5,
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
      diagnosis: "callers-not-in-registry",
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
    },
    ...overrides,
  };
}

/**
 * A builtin rule whose `function_name` is `check_<group_id>`. Pair with a
 * `builtin_checks` map (see `checks`) that decides whether each rule matches;
 * the orchestrator's priority/skip/hint semantics are what these tests exercise,
 * independent of any specific check body.
 */
function builtin_issue(
  group_id: string,
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
      function_name: `check_${group_id}`,
      min_confidence,
    },
    ...overrides,
  };
}

/** Build a `builtin_checks` map: each named group_id → a check returning `matches`. */
function checks(...entries: [group_id: string, matches: boolean][]): Record<string, BuiltinCheckFn> {
  const map: Record<string, BuiltinCheckFn> = {};
  for (const [group_id, matches] of entries) {
    map[`check_${group_id}`] = () => matches;
  }
  return map;
}

const EMPTY_READER = (_: string) => [] as readonly string[];

const LANGUAGES: ReadonlyMap<FilePath, Language> = new Map<FilePath, Language>([
  [fp("src/target.ts"), "typescript"],
  [fp("app.py"), "python"],
]);

// ===== Tests =====

describe("auto_classify — priority and match semantics", () => {
  it("first matching builtin wins when two both match", () => {
    const entry_point = make_entry();
    const registry: KnownIssuesRegistry = [
      builtin_issue("first", 1.0),
      builtin_issue("second", 1.0),
    ];

    const [classified] = auto_classify([entry_point], registry, EMPTY_READER, LANGUAGES, {
      builtin_checks: checks(["first", true], ["second", true]),
    });

    expect(classified.result.auto_classified).toBe(true);
    expect(classified.result.auto_group_id).toBe("first");
    expect(classified.result.classifier_hints).toEqual([]);
  });

  it("non-matching builtins are skipped without emitting hints", () => {
    const entry_point = make_entry();
    const registry: KnownIssuesRegistry = [
      builtin_issue("wont-match", 1.0),
      builtin_issue("will-match", 1.0),
    ];

    const [classified] = auto_classify([entry_point], registry, EMPTY_READER, LANGUAGES, {
      builtin_checks: checks(["wont-match", false], ["will-match", true]),
    });

    expect(classified.result.auto_classified).toBe(true);
    expect(classified.result.auto_group_id).toBe("will-match");
    expect(classified.result.classifier_hints).toEqual([]);
  });

  it("no match anywhere → auto_classified: false with empty hints", () => {
    const entry_point = make_entry();
    const registry: KnownIssuesRegistry = [
      builtin_issue("a", 1.0),
      builtin_issue("b", 1.0),
    ];

    const [classified] = auto_classify([entry_point], registry, EMPTY_READER, LANGUAGES, {
      builtin_checks: checks(["a", false], ["b", false]),
    });

    expect(classified.result.auto_classified).toBe(false);
    expect(classified.result.auto_group_id).toBeNull();
    expect(classified.result.reasoning).toBeNull();
    expect(classified.result.classifier_hints).toEqual([]);
  });
});

describe("auto_classify — sub-threshold hints", () => {
  it("a match below min_confidence becomes a hint without classifying", () => {
    const entry_point = make_entry();
    // min_confidence > 1.0 is unreachable for binary classifiers (which always
    // score 1.0 on match), forcing the sub-threshold branch. Build the
    // KnownIssue directly to bypass the registry validator's [0,1] check.
    const registry: KnownIssuesRegistry = [builtin_issue("hint-only", 1.1)];

    const [classified] = auto_classify([entry_point], registry, EMPTY_READER, LANGUAGES, {
      builtin_checks: checks(["hint-only", true]),
    });

    expect(classified.result.auto_classified).toBe(false);
    expect(classified.result.auto_group_id).toBeNull();
    expect(classified.result.classifier_hints).toEqual([
      {
        group_id: "hint-only",
        confidence: 1.0,
        reasoning: "Matched builtin classifier check_hint-only for hint-only",
      },
    ]);
  });

  it("hints accumulate then get attached to an eventual auto-classification", () => {
    const entry_point = make_entry();
    const registry: KnownIssuesRegistry = [
      builtin_issue("hint-1", 1.1),
      builtin_issue("hint-2", 1.2),
      builtin_issue("final", 1.0),
    ];

    const [classified] = auto_classify([entry_point], registry, EMPTY_READER, LANGUAGES, {
      builtin_checks: checks(["hint-1", true], ["hint-2", true], ["final", true]),
    });

    expect(classified.result.auto_classified).toBe(true);
    expect(classified.result.auto_group_id).toBe("final");
    expect(classified.result.classifier_hints.map((h: ClassifierHint) => h.group_id)).toEqual([
      "hint-1",
      "hint-2",
    ]);
  });
});

describe("auto_classify — file reader plumbing", () => {
  it("passes read_file_lines through to the builtin so source-reading checks work", () => {
    const entry_point = make_entry({ file_path: fp("app.py"), start_line: 2 });
    const registry: KnownIssuesRegistry = [builtin_issue("py-fixture", 1.0)];
    const reader = (p: string): readonly string[] =>
      p === "app.py" ? ["@pytest.fixture", "def load():", "    pass"] : [];
    const builtin_checks: Record<string, BuiltinCheckFn> = {
      check_py_fixture: (e, read_file_lines) =>
        read_file_lines(e.file_path).some((line) => /pytest\.fixture/.test(line)),
    };
    // The rule's function_name must match the injected check key.
    registry[0].classifier = {
      function_name: "check_py_fixture",
      min_confidence: 1.0,
    };

    const [classified] = auto_classify([entry_point], registry, reader, LANGUAGES, { builtin_checks });

    expect(classified.result.auto_classified).toBe(true);
    expect(classified.result.auto_group_id).toBe("py-fixture");
  });
});

describe("auto_classify — language threading", () => {
  it("passes each entry's own language from the map into the check", () => {
    const ts_entry = make_entry({ file_path: fp("src/target.ts") });
    const py_entry = make_entry({ file_path: fp("app.py") });
    const registry: KnownIssuesRegistry = [builtin_issue("py_only", 1.0)];
    const builtin_checks: Record<string, BuiltinCheckFn> = {
      check_py_only: (_entry, _reader, language) => language === "python",
    };

    const [ts_result, py_result] = auto_classify(
      [ts_entry, py_entry],
      registry,
      EMPTY_READER,
      LANGUAGES,
      { builtin_checks },
    );

    expect(ts_result.result.auto_classified).toBe(false);
    expect(py_result.result.auto_classified).toBe(true);
    expect(py_result.result.auto_group_id).toBe("py_only");
  });

  it("throws when an entry point's file has no recorded language", () => {
    const entry_point = make_entry({ file_path: fp("unmapped.ts") });
    const registry: KnownIssuesRegistry = [builtin_issue("any", 1.0)];

    expect(() =>
      auto_classify([entry_point], registry, EMPTY_READER, LANGUAGES, {
        builtin_checks: checks(["any", true]),
      }),
    ).toThrow(
      "No language recorded for unmapped.ts — every entry point must come from a parsed file",
    );
  });
});

describe("auto_classify — builtin dispatch", () => {
  function tagged_builtin(group_id: string, function_name: string, min_confidence = 1.0): KnownIssue {
    return {
      group_id,
      title: group_id,
      description: "",
      status: "wip",
      languages: ["typescript"],
      examples: [],
      classifier: { function_name, min_confidence },
    };
  }

  it("dispatches builtin via BUILTIN_CHECKS lookup on function_name", () => {
    const entry_point = make_entry();
    const registry: KnownIssuesRegistry = [tagged_builtin("bg", "check_thing")];
    let invoked_with: EnrichedEntryPoint | null = null;
    const builtin_checks = {
      check_thing: (e: EnrichedEntryPoint) => {
        invoked_with = e;
        return true;
      },
    };
    const [classified] = auto_classify([entry_point], registry, EMPTY_READER, LANGUAGES, { builtin_checks });
    expect(classified.result.auto_classified).toBe(true);
    expect(classified.result.auto_group_id).toBe("bg");
    expect(classified.result.reasoning).toBe(
      "Matched builtin classifier check_thing for bg",
    );
    expect(invoked_with).toBe(entry_point);
  });

  it("throws MissingBuiltinError when function_name is missing from the barrel", () => {
    const entry_point = make_entry();
    const registry: KnownIssuesRegistry = [tagged_builtin("stale", "check_stale")];
    expect(() => auto_classify([entry_point], registry, EMPTY_READER, LANGUAGES, { builtin_checks: {} })).toThrow(
      MissingBuiltinError,
    );
    expect(() => auto_classify([entry_point], registry, EMPTY_READER, LANGUAGES, { builtin_checks: {} })).toThrow(
      /check_stale/,
    );
  });

  it("builtin that returns false does not classify and does not emit a hint", () => {
    const entry_point = make_entry();
    const registry: KnownIssuesRegistry = [
      tagged_builtin("b", "check_b"),
      tagged_builtin("p", "check_p"),
    ];
    const [classified] = auto_classify([entry_point], registry, EMPTY_READER, LANGUAGES, {
      builtin_checks: { check_b: () => false, check_p: () => true },
    });
    expect(classified.result.auto_classified).toBe(true);
    expect(classified.result.auto_group_id).toBe("p");
    expect(classified.result.classifier_hints).toEqual([]);
  });
});

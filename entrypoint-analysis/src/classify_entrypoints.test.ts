import { describe, it, expect } from "vitest";
import { classify_entrypoints } from "./classify_entrypoints.js";
import type { EnrichedFunctionEntry, KnownEntrypointSource } from "./types.js";

// ===== Test Helpers =====

function make_entry(overrides: Partial<EnrichedFunctionEntry>): EnrichedFunctionEntry {
  return {
    name: "test_func",
    file_path: "/projects/myapp/src/test.ts",
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

const PROJECT_PATH = "/projects/myapp";

// ===== Registry-based classification =====

describe("classify_entrypoints with known sources", () => {
  it("matching entry goes to known_true_positives", () => {
    const entry = make_entry({ name: "main", file_path: "/projects/myapp/src/main.py" });
    const sources: KnownEntrypointSource[] = [{
      source: "project",
      description: "Confirmed entry points",
      entrypoints: [{ name: "main", file_path: "src/main.py" }],
    }];

    const result = classify_entrypoints([entry], sources, PROJECT_PATH);

    expect(result.known_true_positives).toHaveLength(1);
    expect(result.known_true_positives[0].entry).toEqual(entry);
    expect(result.known_true_positives[0].source).toBe("project");
    expect(result.unclassified).toEqual([]);
  });

  it("non-matching entry goes to unclassified", () => {
    const entry = make_entry({ name: "unknown_func" });
    const sources: KnownEntrypointSource[] = [{
      source: "project",
      description: "Confirmed entry points",
      entrypoints: [{ name: "main", file_path: "src/main.py" }],
    }];

    const result = classify_entrypoints([entry], sources, PROJECT_PATH);

    expect(result.known_true_positives).toEqual([]);
    expect(result.unclassified).toEqual([entry]);
  });

  it("empty known sources puts all entries in unclassified", () => {
    const entry = make_entry({});

    const result = classify_entrypoints([entry], [], PROJECT_PATH);

    expect(result.known_true_positives).toEqual([]);
    expect(result.unclassified).toEqual([entry]);
  });

  it("multiple sources: project match takes priority over framework", () => {
    const entry = make_entry({ name: "render", kind: "method", file_path: "/projects/myapp/src/App.tsx" });
    const sources: KnownEntrypointSource[] = [
      {
        source: "project",
        description: "Confirmed entry points",
        entrypoints: [{ name: "render", file_path: "src/App.tsx" }],
      },
      {
        source: "react",
        description: "React lifecycle methods",
        entrypoints: [{ name: "render", kind: "method" }],
      },
    ];

    const result = classify_entrypoints([entry], sources, PROJECT_PATH);

    expect(result.known_true_positives).toHaveLength(1);
    // Project source listed first, so it matches first
    expect(result.known_true_positives[0].source).toBe("project");
  });

  it("mixed entries: some match, some don't", () => {
    const known_entry = make_entry({ name: "main", file_path: "/projects/myapp/src/main.py" });
    const unknown_entry = make_entry({ name: "mystery_func" });
    const framework_entry = make_entry({ name: "componentDidMount", kind: "method" });

    const sources: KnownEntrypointSource[] = [
      {
        source: "project",
        description: "Confirmed entry points",
        entrypoints: [{ name: "main", file_path: "src/main.py" }],
      },
      {
        source: "react",
        description: "React lifecycle methods",
        entrypoints: [{ name: "componentDidMount", kind: "method" }],
      },
    ];

    const result = classify_entrypoints(
      [known_entry, unknown_entry, framework_entry],
      sources,
      PROJECT_PATH,
    );

    expect(result.known_true_positives).toHaveLength(2);
    expect(result.known_true_positives[0].entry).toEqual(known_entry);
    expect(result.known_true_positives[0].source).toBe("project");
    expect(result.known_true_positives[1].entry).toEqual(framework_entry);
    expect(result.known_true_positives[1].source).toBe("react");
    expect(result.unclassified).toEqual([unknown_entry]);
  });
});

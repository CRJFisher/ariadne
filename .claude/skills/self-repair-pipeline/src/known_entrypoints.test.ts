import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "path";
import {
  get_registry_path,
  load_known_entrypoints,
  save_known_entrypoints,
  matches_known_entrypoint,
  filter_known_entrypoints,
  build_project_source,
  build_dead_code_source,
} from "./known_entrypoints.js";
import type { EnrichedFunctionEntry, KnownEntrypointSource } from "./types.js";

// ===== Test Helpers =====

const TEST_PROJECT = "__test_known_entrypoints__";
const TEST_DATA_DIR = "/tmp/claude/known_entrypoints_test";

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

// Clean up test registry files after each test
afterEach(async () => {
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true });
  } catch {
    // Directory may not exist
  }
});

// ===== I/O =====

describe("registry I/O", () => {
  it("load non-existent registry returns empty array", async () => {
    const sources = await load_known_entrypoints("__nonexistent_project__", TEST_DATA_DIR);
    expect(sources).toEqual([]);
  });

  it("save and load round-trips correctly", async () => {
    const sources: KnownEntrypointSource[] = [
      {
        source: "project",
        description: "Confirmed entry points",
        entrypoints: [
          { name: "main", file_path: "src/main.py", start_line: 10 },
        ],
      },
      {
        source: "react",
        description: "React lifecycle methods",
        entrypoints: [
          { name: "render", kind: "method" },
        ],
      },
    ];

    const saved_path = await save_known_entrypoints(TEST_PROJECT, sources, TEST_DATA_DIR);
    expect(saved_path).toBe(get_registry_path(TEST_PROJECT, TEST_DATA_DIR));

    const loaded = await load_known_entrypoints(TEST_PROJECT, TEST_DATA_DIR);
    expect(loaded).toEqual(sources);
  });
});

// ===== Matching =====

describe("matches_known_entrypoint", () => {
  it("project entry: matches by name + relative file_path", () => {
    const entry = make_entry({ name: "main", file_path: "/projects/myapp/src/main.py" });
    const known = { name: "main", file_path: "src/main.py" };

    expect(matches_known_entrypoint(entry, known, PROJECT_PATH)).toBe(true);
  });

  it("project entry: wrong file_path does not match", () => {
    const entry = make_entry({ name: "main", file_path: "/projects/myapp/src/other.py" });
    const known = { name: "main", file_path: "src/main.py" };

    expect(matches_known_entrypoint(entry, known, PROJECT_PATH)).toBe(false);
  });

  it("framework entry: matches by name only (no file_path)", () => {
    const entry = make_entry({ name: "render", kind: "method", file_path: "/projects/myapp/src/App.tsx" });
    const known = { name: "render" };

    expect(matches_known_entrypoint(entry, known, PROJECT_PATH)).toBe(true);
  });

  it("framework entry: matches by name + kind filter", () => {
    const entry = make_entry({ name: "componentDidMount", kind: "method" });
    const known = { name: "componentDidMount", kind: "method" as const };

    expect(matches_known_entrypoint(entry, known, PROJECT_PATH)).toBe(true);
  });

  it("framework entry: wrong kind does not match", () => {
    const entry = make_entry({ name: "componentDidMount", kind: "function" });
    const known = { name: "componentDidMount", kind: "method" as const };

    expect(matches_known_entrypoint(entry, known, PROJECT_PATH)).toBe(false);
  });

  it("monorepo entry: matches when file_path includes intermediate directories", () => {
    const entry = make_entry({
      name: "initialize",
      file_path: "/workspace/repo/packages/core/src/project/project.ts",
    });
    const known = { name: "initialize", file_path: "packages/core/src/project/project.ts" };

    expect(matches_known_entrypoint(entry, known, "/workspace/repo")).toBe(true);
  });
});

// ===== Filtering =====

describe("filter_known_entrypoints", () => {
  it("correctly partitions known TPs vs remaining", () => {
    const known_entry = make_entry({ name: "main", file_path: "/projects/myapp/src/main.py" });
    const unknown_entry = make_entry({ name: "mystery" });

    const sources: KnownEntrypointSource[] = [{
      source: "project",
      description: "test",
      entrypoints: [{ name: "main", file_path: "src/main.py" }],
    }];

    const result = filter_known_entrypoints([known_entry, unknown_entry], sources, PROJECT_PATH);

    expect(result.known_true_positives).toHaveLength(1);
    expect(result.known_true_positives[0].entry).toEqual(known_entry);
    expect(result.known_true_positives[0].source).toBe("project");
    expect(result.remaining).toEqual([unknown_entry]);
  });

  it("empty sources puts all entries in remaining", () => {
    const entry = make_entry({});
    const result = filter_known_entrypoints([entry], [], PROJECT_PATH);

    expect(result.known_true_positives).toEqual([]);
    expect(result.remaining).toEqual([entry]);
  });
});

// ===== Building sources from triage results =====

describe("build_project_source", () => {
  it("converts absolute paths to relative", () => {
    const true_positives = [
      { name: "main", file_path: "/projects/myapp/src/main.py", start_line: 10 },
      { name: "handler", file_path: "/projects/myapp/lib/handler.py", start_line: 5 },
    ];

    const source = build_project_source(true_positives, PROJECT_PATH);

    expect(source).toEqual({
      source: "project",
      description: "Confirmed entry points from triage",
      entrypoints: [
        { name: "main", file_path: "src/main.py", start_line: 10 },
        { name: "handler", file_path: "lib/handler.py", start_line: 5 },
      ],
    });
  });
});

describe("build_dead_code_source", () => {
  it("converts absolute paths to relative with dead-code source", () => {
    const dead_code = [
      { name: "unused_helper", file_path: "/projects/myapp/src/utils.py", start_line: 42 },
    ];

    const source = build_dead_code_source(dead_code, PROJECT_PATH);

    expect(source).toEqual({
      source: "dead-code",
      description: "Functions identified as likely dead code",
      entrypoints: [
        { name: "unused_helper", file_path: path.relative(PROJECT_PATH, "/projects/myapp/src/utils.py"), start_line: 42 },
      ],
    });
  });
});

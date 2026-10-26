import { describe, it, expect } from "vitest";
import {
  parse_entry_selector,
  find_entries_by_selector,
  find_enriched_entry_point,
  resolution_failure_message,
} from "./get_entry_context.js";
import type { TriageEntry } from "../src/triage_state_types.js";
import type {
  AnalysisResult,
  EnrichedEntryPoint,
  EntryPointDiagnostics,
} from "@ariadnejs/types";
import type { FilePath } from "@ariadnejs/types";

const BASE_DIAGNOSTICS: EntryPointDiagnostics = {
  grep_call_sites: [
    { file_path: "test/server.test.ts" as FilePath, line: 10, content: "handle_request(req)", captures: [] },
  ],
  grep_call_sites_outside_index: [
    { file_path: "docs/_ext/ext.py" as FilePath, line: 12, content: "handle_request(req)", captures: [] },
  ],
  reference_sites: [
    {
      file_path: "app/registry.py" as FilePath,
      line: 7,
      content: "handlers = {'*': dumper.handle_request}",
      reference_kind: "property_access",
      access_type: "property",
      receiver_kind: "identifier",
    },
  ],
  has_uncaptured_indexed_grep_hit: false,
  ariadne_call_refs: [],
  diagnosis: "callers-not-in-registry",
};

function make_entry(overrides: Partial<TriageEntry>): TriageEntry {
  return {
    entry_index: 5,
    name: "handle_request",
    file_path: "src/server.ts" as FilePath,
    start_line: 42,
    kind: "function",
    signature: "function handle_request(req: Request): Response",
    route: "llm-triage",
    diagnosis: "callers-not-in-registry",
    known_source: null,
    status: "pending",
    result: null,
    error: null,
    is_exported: true,
    access_modifier: null,
    diagnostics: BASE_DIAGNOSTICS,
    auto_classified: false,
    classifier_hints: [],
    tp_source_run_id: null,
    tp_stability_sample: false,
    retry_count: 0,
    ...overrides,
  };
}

// ===== parse_entry_selector =====

describe("parse_entry_selector", () => {
  it("parses the --entry index selector", () => {
    expect(parse_entry_selector(["--project", "mocha", "--entry", "62"])).toEqual({
      by: "index",
      entry_index: 62,
    });
  });

  it("parses the four-flag member-symbol selector", () => {
    expect(
      parse_entry_selector([
        "--project", "mocha",
        "--run-id", "20260630T101502Z",
        "--file", "lib/interfaces/bdd.js",
        "--name", "bddInterface",
        "--kind", "function",
        "--line", "12",
      ]),
    ).toEqual({
      by: "member_symbol",
      member: {
        file_path: "lib/interfaces/bdd.js",
        name: "bddInterface",
        kind: "function",
        start_line: 12,
      },
    });
  });

  it("rejects mixing --entry with member-symbol flags", () => {
    expect(() => parse_entry_selector(["--entry", "1", "--file", "src/a.ts"])).toThrowError(
      /not both/,
    );
  });

  it("rejects a partial member-symbol selector naming the missing flags", () => {
    expect(() =>
      parse_entry_selector(["--file", "src/a.ts", "--name", "foo", "--kind", "function"]),
    ).toThrowError(/missing --line/);
  });

  it("rejects an argv with no selector", () => {
    expect(() => parse_entry_selector(["--project", "mocha"])).toThrowError(
      /an entry selector is required/,
    );
  });

  it("rejects a non-integer --entry", () => {
    expect(() => parse_entry_selector(["--entry", "abc"])).toThrowError(
      /--entry requires an integer/,
    );
  });

  it("rejects a non-integer --line", () => {
    expect(() =>
      parse_entry_selector([
        "--run-id", "r1",
        "--file", "a.ts", "--name", "n", "--kind", "function", "--line", "x",
      ]),
    ).toThrowError(/--line requires an integer/);
  });

  it("rejects a partial-numeric --line rather than truncating it", () => {
    expect(() =>
      parse_entry_selector([
        "--run-id", "r1",
        "--file", "a.ts", "--name", "n", "--kind", "function", "--line", "12abc",
      ]),
    ).toThrowError(/--line requires an integer/);
  });

  it("rejects a partial-numeric --entry rather than truncating it", () => {
    expect(() => parse_entry_selector(["--entry", "62x"])).toThrowError(
      /--entry requires an integer/,
    );
  });

  it("rejects a kind outside the member-symbol union", () => {
    expect(() =>
      parse_entry_selector([
        "--run-id", "r1",
        "--file", "a.ts", "--name", "n", "--kind", "generator", "--line", "1",
      ]),
    ).toThrowError(/--kind must be one of function, method, constructor/);
  });

  it("rejects a member-symbol selector without --run-id", () => {
    expect(() =>
      parse_entry_selector([
        "--file", "a.ts", "--name", "n", "--kind", "function", "--line", "1",
      ]),
    ).toThrowError(/the member-symbol selector requires --run-id/);
  });

  it("treats a flag-like token as a missing value, not as the value", () => {
    expect(() =>
      parse_entry_selector([
        "--run-id", "r1",
        "--file", "--name", "n", "--kind", "function", "--line", "1",
      ]),
    ).toThrowError(/missing --file/);
  });
});

// ===== find_entries_by_selector =====

describe("find_entries_by_selector", () => {
  const fn_at_42 = make_entry({
    entry_index: 5,
    name: "handle",
    file_path: "src/server.ts" as FilePath,
    kind: "function",
    start_line: 42,
  });
  const method_at_42 = make_entry({
    entry_index: 6,
    name: "handle",
    file_path: "src/server.ts" as FilePath,
    kind: "method",
    start_line: 42,
  });
  const fn_at_99 = make_entry({
    entry_index: 7,
    name: "handle",
    file_path: "src/server.ts" as FilePath,
    kind: "function",
    start_line: 99,
  });
  const state = { project_path: "/repo", entries: [fn_at_42, method_at_42, fn_at_99] };

  it("resolves an index selector to the entry with that entry_index", () => {
    expect(find_entries_by_selector(state, { by: "index", entry_index: 6 })).toEqual([
      method_at_42,
    ]);
  });

  it("returns no match for a missing index", () => {
    expect(find_entries_by_selector(state, { by: "index", entry_index: 999 })).toEqual([]);
  });

  it("resolves a member symbol to the exact four-field match", () => {
    expect(
      find_entries_by_selector(state, {
        by: "member_symbol",
        member: { file_path: "src/server.ts", name: "handle", kind: "function", start_line: 42 },
      }),
    ).toEqual([fn_at_42]);
  });

  it("kind is load-bearing: the method sibling at the same file, name, and line resolves for kind=method", () => {
    expect(
      find_entries_by_selector(state, {
        by: "member_symbol",
        member: { file_path: "src/server.ts", name: "handle", kind: "method", start_line: 42 },
      }),
    ).toEqual([method_at_42]);
  });

  it("start_line is load-bearing: the sibling at a different line resolves for its own line", () => {
    expect(
      find_entries_by_selector(state, {
        by: "member_symbol",
        member: { file_path: "src/server.ts", name: "handle", kind: "function", start_line: 99 },
      }),
    ).toEqual([fn_at_99]);
  });

  it("relativizes absolute state paths against project_path before matching", () => {
    const absolute = make_entry({
      entry_index: 8,
      name: "abs_fn",
      file_path: "/repo/src/abs.ts" as FilePath,
      kind: "function",
      start_line: 10,
    });
    expect(
      find_entries_by_selector(
        { project_path: "/repo", entries: [absolute] },
        {
          by: "member_symbol",
          member: { file_path: "src/abs.ts", name: "abs_fn", kind: "function", start_line: 10 },
        },
      ),
    ).toEqual([absolute]);
  });

  it("returns no match when no entry has the member identity", () => {
    expect(
      find_entries_by_selector(state, {
        by: "member_symbol",
        member: { file_path: "src/server.ts", name: "nope", kind: "function", start_line: 42 },
      }),
    ).toEqual([]);
  });

  it("returns every colliding entry for a duplicated member identity", () => {
    const duplicate = make_entry({
      entry_index: 9,
      name: "handle",
      file_path: "src/server.ts" as FilePath,
      kind: "function",
      start_line: 42,
    });
    expect(
      find_entries_by_selector(
        { project_path: "/repo", entries: [fn_at_42, duplicate] },
        {
          by: "member_symbol",
          member: { file_path: "src/server.ts", name: "handle", kind: "function", start_line: 42 },
        },
      ),
    ).toEqual([fn_at_42, duplicate]);
  });
});

// ===== resolution_failure_message =====

describe("resolution_failure_message", () => {
  const fn_at_42 = make_entry({
    entry_index: 5,
    name: "handle",
    file_path: "src/server.ts" as FilePath,
    kind: "function",
    start_line: 42,
  });
  const method_at_42 = make_entry({
    entry_index: 6,
    name: "handle",
    file_path: "src/server.ts" as FilePath,
    kind: "method",
    start_line: 42,
  });
  const fn_at_99 = make_entry({
    entry_index: 7,
    name: "handle",
    file_path: "src/server.ts" as FilePath,
    kind: "function",
    start_line: 99,
  });
  const state = { project_path: "/repo", entries: [fn_at_42, method_at_42, fn_at_99] };

  it("returns null for exactly one match", () => {
    expect(
      resolution_failure_message(
        state,
        {
          by: "member_symbol",
          member: { file_path: "src/server.ts", name: "handle", kind: "function", start_line: 42 },
        },
        [fn_at_42],
      ),
    ).toEqual(null);
  });

  it("reports every colliding entry index for an ambiguous member symbol", () => {
    const duplicate = make_entry({
      entry_index: 9,
      name: "handle",
      file_path: "src/server.ts" as FilePath,
      kind: "function",
      start_line: 42,
    });
    expect(
      resolution_failure_message(
        { project_path: "/repo", entries: [fn_at_42, duplicate] },
        {
          by: "member_symbol",
          member: { file_path: "src/server.ts", name: "handle", kind: "function", start_line: 42 },
        },
        [fn_at_42, duplicate],
      ),
    ).toEqual(
      "Ambiguous selector: 2 entries match Member symbol function handle at src/server.ts:42 (entry indices 5, 9). Use --entry <index> to disambiguate.",
    );
  });

  it("diagnoses a zero-match with same (file, name, kind) at other lines as run drift", () => {
    expect(
      resolution_failure_message(
        state,
        {
          by: "member_symbol",
          member: { file_path: "src/server.ts", name: "handle", kind: "function", start_line: 43 },
        },
        [],
      ),
    ).toEqual(
      "Member symbol function handle at src/server.ts:43 not found in state file\n" +
        "Entries matching (file, name, kind) exist at start_line 42, 99 — the member symbol and --run-id likely come from different runs (start_line is run-specific).",
    );
  });

  it("diagnoses a zero-match with same (file, name) under other kinds as a --kind mismatch", () => {
    expect(
      resolution_failure_message(
        state,
        {
          by: "member_symbol",
          member: {
            file_path: "src/server.ts",
            name: "handle",
            kind: "constructor",
            start_line: 42,
          },
        },
        [],
      ),
    ).toEqual(
      "Member symbol constructor handle at src/server.ts:42 not found in state file\n" +
        "Entries matching (file, name) exist with kind function, method — the selector's --kind does not match this run's entry.",
    );
  });

  it("diagnoses a zero-match with no near entry as a run/selector mismatch", () => {
    expect(
      resolution_failure_message(
        state,
        {
          by: "member_symbol",
          member: { file_path: "src/server.ts", name: "nope", kind: "function", start_line: 42 },
        },
        [],
      ),
    ).toEqual(
      "Member symbol function nope at src/server.ts:42 not found in state file\n" +
        "The member symbol and --run-id must come from the same triage run.",
    );
  });

  it("reports an index zero-match with the bare not-found line", () => {
    expect(
      resolution_failure_message(state, { by: "index", entry_index: 999 }, []),
    ).toEqual("Entry index 999 not found in state file");
  });
});

// ===== find_enriched_entry_point =====

describe("find_enriched_entry_point", () => {
  const enriched_at_42: EnrichedEntryPoint = {
    name: "handle_request",
    file_path: "src/server.ts" as FilePath,
    start_line: 42,
    kind: "function",
    tree_size: 7,
    is_exported: true,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: BASE_DIAGNOSTICS,
  };
  const method_at_42: EnrichedEntryPoint = { ...enriched_at_42, kind: "method" };
  const analysis: AnalysisResult = {
    project_name: "demo",
    project_path: "/repo",
    entry_points: [method_at_42, enriched_at_42],
  };

  it("matches on the full member identity (file_path, name, kind, start_line)", () => {
    const entry = make_entry({ name: "handle_request", kind: "function", start_line: 42 });
    expect(find_enriched_entry_point(analysis, entry)).toEqual(enriched_at_42);
  });

  it("distinguishes a function from a same-name method at the same line", () => {
    const entry = make_entry({ name: "handle_request", kind: "method", start_line: 42 });
    expect(find_enriched_entry_point(analysis, entry)).toEqual(method_at_42);
  });

  it("returns undefined when no entry point matches the identity", () => {
    const entry = make_entry({ name: "handle_request", kind: "function", start_line: 99 });
    expect(find_enriched_entry_point(analysis, entry)).toEqual(undefined);
  });
});

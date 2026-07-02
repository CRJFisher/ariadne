import { describe, it, expect } from "vitest";
import {
  format_grep_hits,
  format_call_refs,
  format_classifier_hints,
  substitute_template,
  parse_entry_selector,
  find_entries_by_selector,
} from "./get_entry_context.js";
import type { TriageEntry } from "../src/triage_state_types.js";
import type { DispensePayload } from "../src/dispense/dispense_payload.js";
import type {
  GrepHit,
  CallRefDiagnostic,
  EntryPointDiagnostics,
  SyntacticFeatures,
  ClassifierHint,
  KnownIssue,
} from "@ariadnejs/types";
import type { FilePath } from "@ariadnejs/types";

const EMPTY_REGISTRY_SLICE: KnownIssue[] = [];

function payload_for(entry: TriageEntry, overrides: Partial<DispensePayload> = {}): DispensePayload {
  return {
    entry_context: entry,
    relevant_registry_slice: EMPTY_REGISTRY_SLICE,
    ...overrides,
  };
}

const BASE_SYNTACTIC_FEATURES: SyntacticFeatures = {
  is_new_expression: false,
  is_super_call: false,
  is_optional_chain: false,
  is_awaited: false,
  is_callback_arg: false,
  is_inside_try: false,
  is_dynamic_dispatch: false,
};

const BASE_DIAGNOSTICS: EntryPointDiagnostics = {
  grep_call_sites: [
    { file_path: "test/server.test.ts" as FilePath, line: 10, content: "handle_request(req)", captures: [] },
  ],
  grep_call_sites_unindexed_tests: [],
  has_uncaptured_indexed_grep_hit: false,
  callers_only_in_unindexed_tests: false,
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
    ...overrides,
  };
}

// ===== format_grep_hits =====

describe("format_grep_hits", () => {
  it("returns (none found) for empty array", () => {
    expect(format_grep_hits([])).toEqual("(none found)");
  });

  it("formats hits with file:line and trimmed content", () => {
    const hits: GrepHit[] = [
      { file_path: "src/main.ts" as FilePath, line: 10, content: "  foo(42)  ", captures: [] },
      { file_path: "src/utils.ts" as FilePath, line: 25, content: "bar.foo()", captures: [] },
    ];
    const result = format_grep_hits(hits);
    expect(result).toContain("src/main.ts:10  foo(42)");
    expect(result).toContain("src/utils.ts:25  bar.foo()");
  });
});

// ===== format_call_refs =====

describe("format_call_refs", () => {
  it("returns (none found) for empty array", () => {
    expect(format_call_refs([])).toEqual("(none found)");
  });

  it("formats resolved refs", () => {
    const refs: CallRefDiagnostic[] = [
      {
        caller_function: "main",
        caller_file: "src/main.ts" as FilePath,
        call_line: 5,
        call_type: "function",
        resolution_count: 1,
        resolved_to: ["src/lib.ts:10#foo"],
        receiver_kind: "none",
        resolution_failure: null,
        syntactic_features: BASE_SYNTACTIC_FEATURES,
      },
    ];
    const result = format_call_refs(refs);
    expect(result).toContain("src/main.ts:5");
    expect(result).toContain("function call from main");
    expect(result).toContain("resolved to: src/lib.ts:10#foo");
  });

  it("formats unresolved refs", () => {
    const refs: CallRefDiagnostic[] = [
      {
        caller_function: "handler",
        caller_file: "src/api.ts" as FilePath,
        call_line: 42,
        call_type: "method",
        resolution_count: 0,
        resolved_to: [],
        receiver_kind: "identifier",
        resolution_failure: null,
        syntactic_features: BASE_SYNTACTIC_FEATURES,
      },
    ];
    const result = format_call_refs(refs);
    expect(result).toContain("unresolved");
  });
});

// ===== substitute_template =====

describe("substitute_template", () => {
  const mock_entry: TriageEntry = make_entry({});

  it("substitutes all placeholders", () => {
    const template = [
      "Name: {{entry.name}}",
      "Kind: {{entry.kind}}",
      "File: {{entry.file_path}}:{{entry.start_line}}",
      "Signature: {{entry.signature}}",
      "Exported: {{entry.is_exported}}",
      "Access: {{entry.access_modifier}}",
      "Diagnosis: {{entry.diagnosis}}",
      "Output: {{output_path}}",
      "Grep: {{entry.diagnostics.grep_call_sites_formatted}}",
      "Refs: {{entry.diagnostics.ariadne_call_refs_formatted}}",
      "Slice: {{relevant_registry_slice}}",
    ].join("\n");

    const result = substitute_template({
      template,
      payload: payload_for(mock_entry),
      output_path: "/tmp/results/5.json",
    });

    expect(result).toContain("Name: handle_request");
    expect(result).toContain("Kind: function");
    expect(result).toContain("File: src/server.ts:42");
    expect(result).toContain("Signature: function handle_request(req: Request): Response");
    expect(result).toContain("Exported: true");
    expect(result).toContain("Access: (none)");
    expect(result).toContain("Diagnosis: callers-not-in-registry");
    expect(result).toContain("Output: /tmp/results/5.json");
    expect(result).toContain("test/server.test.ts:10");
    expect(result).toContain("(none found)"); // ariadne_call_refs is empty
    expect(result).toContain("Slice: []");
  });

  it("handles null signature", () => {
    const entry = { ...mock_entry, signature: null };
    const result = substitute_template({
      template: "Sig: {{entry.signature}}",
      payload: payload_for(entry),
      output_path: "/tmp/out.json",
    });
    expect(result).toEqual("Sig: (none)");
  });

  it("empty classifier_hints expand to nothing", () => {
    const result = substitute_template({
      template: "before{{classifier_hints}}after",
      payload: payload_for(mock_entry),
      output_path: "/tmp/out.json",
    });
    expect(result).toEqual("beforeafter");
  });

  it("unknown diagnosis falls back to the generic hints title", () => {
    const entry: TriageEntry = { ...mock_entry, diagnosis: "no-textual-callers" };
    const result = substitute_template({
      template: "{{diagnosis.title}}",
      payload: payload_for(entry),
      output_path: "/tmp/out.json",
    });
    expect(result).toEqual("General Entry Point Analysis");
  });

  it("non-empty classifier_hints render as a header block with bullets", () => {
    const hints: ClassifierHint[] = [
      {
        group_id: "method-chain-dispatch",
        confidence: 0.8,
        reasoning: "receiver_kind=call_chain on the call site",
      },
      {
        group_id: "constructor-new-expression",
        confidence: 0.55,
        reasoning: "grep saw `new Name(` without a @reference.constructor capture",
      },
    ];
    const entry: TriageEntry = { ...mock_entry, classifier_hints: hints };
    const result = substitute_template({
      template: "{{classifier_hints}}",
      payload: payload_for(entry),
      output_path: "/tmp/out.json",
    });
    expect(result).toContain("### Classifier hints (sub-threshold matches)");
    expect(result).toContain("- method-chain-dispatch (confidence 0.80): receiver_kind=call_chain on the call site");
    expect(result).toContain("- constructor-new-expression (confidence 0.55): grep saw `new Name(` without a @reference.constructor capture");
  });

  it("renders relevant_registry_slice as pretty-printed JSON", () => {
    const slice: KnownIssue[] = [
      {
        group_id: "demo-rule",
        title: "Demo",
        description: "Demo rule",
        status: "wip",
        languages: ["typescript"],
        examples: [],
        classifier: { kind: "none" },
      },
    ];
    const result = substitute_template({
      template: "{{relevant_registry_slice}}",
      payload: payload_for(mock_entry, { relevant_registry_slice: slice }),
      output_path: "/tmp/out.json",
    });
    expect(result).toEqual(JSON.stringify(slice, null, 2));
  });
});

describe("format_classifier_hints", () => {
  it("returns empty string for empty hints", () => {
    expect(format_classifier_hints([])).toEqual("");
  });

  it("renders header and one bullet per hint", () => {
    const out = format_classifier_hints([
      { group_id: "g1", confidence: 0.9, reasoning: "r1" },
      { group_id: "g2", confidence: 0.4, reasoning: "r2" },
    ]);
    expect(out).toContain("### Classifier hints (sub-threshold matches)");
    expect(out).toContain("- g1 (confidence 0.90): r1");
    expect(out).toContain("- g2 (confidence 0.40): r2");
  });
});

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
      parse_entry_selector(["--file", "a.ts", "--name", "n", "--kind", "function", "--line", "x"]),
    ).toThrowError(/--line requires an integer/);
  });

  it("rejects a kind outside the member-symbol union", () => {
    expect(() =>
      parse_entry_selector(["--file", "a.ts", "--name", "n", "--kind", "generator", "--line", "1"]),
    ).toThrowError(/--kind must be one of function, method, constructor/);
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

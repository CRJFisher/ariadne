import { describe, it, expect } from "vitest";
import {
  format_grep_hits,
  format_call_refs,
  format_classifier_hints,
  substitute_template,
} from "./get_entry_context.js";
import type { TriageEntry } from "../src/triage_state_types.js";
import type { NovelIssuesFile } from "../src/novel_issues.js";
import type { DispensePayload } from "../src/dispense_payload.js";
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
const EMPTY_NOVEL_ISSUES: NovelIssuesFile = { issues: [], flagged: [] };

function payload_for(entry: TriageEntry, overrides: Partial<DispensePayload> = {}): DispensePayload {
  return {
    entry_context: entry,
    relevant_registry_slice: EMPTY_REGISTRY_SLICE,
    novel_issues_snapshot: EMPTY_NOVEL_ISSUES,
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
  const mock_diagnostics: EntryPointDiagnostics = {
    grep_call_sites: [
      { file_path: "test/server.test.ts" as FilePath, line: 10, content: "handle_request(req)", captures: [] },
    ],
    grep_call_sites_unindexed_tests: [],
    ariadne_call_refs: [],
    diagnosis: "callers-not-in-registry",
  };

  const mock_entry: TriageEntry = {
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
    diagnostics: mock_diagnostics,
    auto_classified: false,
    classifier_hints: [],
    tp_source_run_id: null,
  };

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
      "Snapshot: {{novel_issues_snapshot}}",
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
    expect(result).toContain('"issues": []');
    expect(result).toContain('"flagged": []');
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

  it("renders novel_issues_snapshot as pretty-printed JSON", () => {
    const snapshot: NovelIssuesFile = {
      issues: [
        {
          id: "decorator-route-registration",
          canonical_name: "Decorator route registration",
          root_cause: "framework registers handler via @route decorator",
          citations: [{ entry_index: 4, evidence_excerpt: "@route('/x')" }],
        },
      ],
      flagged: [],
    };
    const result = substitute_template({
      template: "{{novel_issues_snapshot}}",
      payload: payload_for(mock_entry, { novel_issues_snapshot: snapshot }),
      output_path: "/tmp/out.json",
    });
    expect(result).toEqual(JSON.stringify(snapshot, null, 2));
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

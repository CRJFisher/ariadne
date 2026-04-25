import { describe, it, expect } from "vitest";
import {
  format_grep_hits,
  format_call_refs,
  format_classifier_hints,
  substitute_template,
} from "./get_entry_context.js";
import type { TriageEntry } from "../src/triage_state_types.js";
import type {
  GrepHit,
  CallRefDiagnostic,
  EntryPointDiagnostics,
  SyntacticFeatures,
} from "../src/entry_point_types.js";
import type { ClassifierHint } from "../src/auto_classify/types.js";

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
      { file_path: "src/main.ts", line: 10, content: "  foo(42)  ", captures: [] },
      { file_path: "src/utils.ts", line: 25, content: "bar.foo()", captures: [] },
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
        caller_file: "src/main.ts",
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
        caller_file: "src/api.ts",
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
  const mock_entry: TriageEntry = {
    entry_index: 5,
    name: "handle_request",
    file_path: "src/server.ts",
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
    diagnostics: { grep_call_sites: [], grep_call_sites_unindexed_tests: [], ariadne_call_refs: [], diagnosis: "callers-not-in-registry" },
    auto_classified: false,
    classifier_hints: [],
  };

  const mock_diagnostics: EntryPointDiagnostics = {
    grep_call_sites: [
      { file_path: "test/server.test.ts", line: 10, content: "handle_request(req)", captures: [] },
    ],
    grep_call_sites_unindexed_tests: [],
    ariadne_call_refs: [],
    diagnosis: "callers-not-in-registry",
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
    ].join("\n");

    const result = substitute_template(template, mock_entry, mock_diagnostics, "/tmp/results/5.json");

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
  });

  it("handles null signature", () => {
    const entry = { ...mock_entry, signature: null };
    const template = "Sig: {{entry.signature}}";
    const result = substitute_template(template, entry, mock_diagnostics, "/tmp/out.json");
    expect(result).toEqual("Sig: (none)");
  });

  it("empty classifier_hints expand to nothing", () => {
    const template = "before{{classifier_hints}}after";
    const result = substitute_template(template, mock_entry, mock_diagnostics, "/tmp/out.json");
    expect(result).toEqual("beforeafter");
  });

  it("unknown diagnosis falls back to the generic hints title", () => {
    const entry: TriageEntry = { ...mock_entry, diagnosis: "no-textual-callers" };
    const template = "{{diagnosis.title}}";
    const result = substitute_template(template, entry, mock_diagnostics, "/tmp/out.json");
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
    const template = "{{classifier_hints}}";
    const result = substitute_template(template, entry, mock_diagnostics, "/tmp/out.json");
    expect(result).toContain("### Classifier hints (sub-threshold matches)");
    expect(result).toContain("- method-chain-dispatch (confidence 0.80): receiver_kind=call_chain on the call site");
    expect(result).toContain("- constructor-new-expression (confidence 0.55): grep saw `new Name(` without a @reference.constructor capture");
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

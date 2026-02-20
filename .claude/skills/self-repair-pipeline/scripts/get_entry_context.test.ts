import { describe, it, expect } from "vitest";
import {
  format_grep_hits,
  format_call_refs,
  substitute_template,
} from "./get_entry_context.js";
import type { TriageEntry } from "../src/triage_state_types.js";
import type { GrepHit, CallRefDiagnostic, EntryPointDiagnostics } from "../src/types.js";

// ===== format_grep_hits =====

describe("format_grep_hits", () => {
  it("returns (none found) for empty array", () => {
    expect(format_grep_hits([])).toEqual("(none found)");
  });

  it("formats hits with file:line and trimmed content", () => {
    const hits: GrepHit[] = [
      { file_path: "src/main.ts", line: 10, content: "  foo(42)  " },
      { file_path: "src/utils.ts", line: 25, content: "bar.foo()" },
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
    deterministic_group_id: null,
    known_source: null,
    status: "pending",
    result: null,
    error: null,
    attempt_count: 0,
    is_exported: true,
    access_modifier: null,
    diagnostics: null,
  };

  const mock_diagnostics: EntryPointDiagnostics = {
    grep_call_sites: [
      { file_path: "test/server.test.ts", line: 10, content: "handle_request(req)" },
    ],
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
});

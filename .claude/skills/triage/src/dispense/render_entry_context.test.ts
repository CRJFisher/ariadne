import { describe, expect, it } from "vitest";

import type { CallRefDiagnostic, EntryPointDiagnostics, FilePath, GrepHit, KnownIssue, ReferenceSiteDiagnostic, SyntacticFeatures } from "@ariadnejs/types";

import type { TriageEntry } from "../triage_state_types.js";
import {
  MAX_EVIDENCE_ITEMS,
  format_call_refs,
  format_classifier_hints,
  format_grep_hits,
  format_reference_sites,
  format_registry_slice,
  format_symbol_id,
  render_entry_context,
} from "./render_entry_context.js";

const ROOT = "/repos/acme--app";

const NO_FEATURES: SyntacticFeatures = {
  is_new_expression: false,
  is_super_call: false,
  is_optional_chain: false,
  is_awaited: false,
  is_callback_arg: false,
  is_dynamic_dispatch: false,
};

const DIAGNOSTICS: EntryPointDiagnostics = {
  grep_call_sites: [{ file_path: `${ROOT}/test/server.test.ts` as FilePath, line: 10, content: "  handle_request(req)  ", captures: [] }],
  grep_call_sites_outside_index: [],
  reference_sites: [
    {
      file_path: `${ROOT}/app/registry.py` as FilePath,
      line: 7,
      content: "handlers = {'*': dumper.handle_request}",
      reference_kind: "property_access",
      access_type: "property",
      receiver_kind: "identifier",
    },
  ],
  has_uncaptured_indexed_grep_hit: true,
  ariadne_call_refs: [],
  diagnosis: "callers-not-in-registry",
};

function make_entry(overrides: Partial<TriageEntry>): TriageEntry {
  return {
    entry_index: 5,
    name: "handle_request",
    file_path: `${ROOT}/src/server.ts`,
    start_line: 42,
    kind: "function",
    signature: "function handle_request(req: Request): Response",
    route: "llm-triage",
    diagnosis: "callers-not-in-registry",
    known_source: null,
    status: "pending",
    result: null,
    error: null,
    retry_count: 0,
    is_exported: true,
    access_modifier: null,
    diagnostics: DIAGNOSTICS,
    auto_classified: false,
    classifier_hints: [],
    tp_source_run_id: null,
    tp_stability_sample: false,
    ...overrides,
  };
}

const RULE: KnownIssue = {
  group_id: "dict-dispatch",
  title: "Dict dispatch",
  description: "A callable stored as a dict value and invoked through a computed key.",
  status: "wip",
  languages: ["python"],
  examples: [{ file: "a.py", line: 1, snippet: "x" }],
  classifier: { function_name: "check_dict_dispatch", min_confidence: 1 },
};

describe("render_entry_context", () => {
  it("renders the entry, every evidence list and the in-scope rules with project-relative paths", () => {
    const text = render_entry_context({ entry_context: make_entry({}), relevant_registry_slice: [RULE] }, ROOT);

    expect(text).toEqual(
      [
        "Entry",
        "- name: handle_request",
        "- kind: function; exported: yes; access: none",
        "- definition: src/server.ts:42",
        "- signature: function handle_request(req: Request): Response",
        "- diagnosis: callers-not-in-registry (follow the \"Callers Not in Registry\" guide)",
        "",
        "Grep call sites in the indexed corpus (1):",
        "  test/server.test.ts:10  [no call reference]  handle_request(req)",
        "",
        "Ariadne call references matching the name (0):",
        "  (none)",
        "",
        "Call sites in files discovered but never indexed (0):",
        "  (none)",
        "",
        "Non-call references (1):",
        "  app/registry.py:7  [property_access, access: property, receiver: identifier]  handlers = {'*': dumper.handle_request}",
        "",
        "In-scope classifier rules (1):",
        "- dict-dispatch: Dict dispatch — A callable stored as a dict value and invoked through a computed key.",
        "",
      ].join("\n"),
    );
  });

  it("names the generic guide for a diagnosis without a route of its own, and renders hints", () => {
    const text = render_entry_context(
      {
        entry_context: make_entry({
          diagnosis: "no-textual-callers",
          signature: null,
          classifier_hints: [{ group_id: "dict-dispatch", confidence: 0.5, reasoning: "value of a dict literal" }],
        }),
        relevant_registry_slice: [],
      },
      ROOT,
    );

    expect(text).toContain("- diagnosis: no-textual-callers (follow the \"No Textual Callers\" guide)");
    expect(text).toContain("- signature: none");
    expect(text).toContain("- dict-dispatch (confidence 0.50): value of a dict literal\n\nIn-scope classifier rules (0):\n  (none)\n");
  });
});

describe("format_grep_hits", () => {
  it("tags each hit with the call references captured at its line", () => {
    const hits: GrepHit[] = [{ file_path: `${ROOT}/src/a.ts` as FilePath, line: 3, content: "run()", captures: ["reference.call"] }];
    expect(format_grep_hits(hits, ROOT, "run")).toEqual("  src/a.ts:3  [captured: reference.call]  run()");
  });

  it(`shows the first ${MAX_EVIDENCE_ITEMS} hits and names the rest with a grep pattern`, () => {
    const hits: GrepHit[] = Array.from({ length: MAX_EVIDENCE_ITEMS + 3 }, (_, i) => ({
      file_path: `${ROOT}/src/a.ts` as FilePath,
      line: i + 1,
      content: "x.$get()",
      captures: [],
    }));
    const lines = format_grep_hits(hits, ROOT, "$get").split("\n");
    expect(lines.length).toEqual(MAX_EVIDENCE_ITEMS + 1);
    expect(lines[MAX_EVIDENCE_ITEMS]).toEqual("  … 3 more; grep \"\\b\\$get\\b\" to list them");
  });
});

describe("format_reference_sites", () => {
  it("reports a receiver only for a property access", () => {
    const sites: ReferenceSiteDiagnostic[] = [
      { file_path: `${ROOT}/a.py` as FilePath, line: 2, content: "cb = run", reference_kind: "variable_reference", access_type: "read" },
    ];
    expect(format_reference_sites(sites, ROOT, "run")).toEqual("  a.py:2  [variable_reference, access: read]  cb = run");
  });
});

describe("format_call_refs", () => {
  const base: CallRefDiagnostic = {
    caller_function: "main",
    caller_file: `${ROOT}/src/main.ts` as FilePath,
    call_line: 5,
    call_type: "function",
    resolution_count: 1,
    resolved_to: [`function:${ROOT}/src/lib.ts:10:1:12:2:foo`],
    receiver_kind: "none",
    resolution_failure: null,
    syntactic_features: NO_FEATURES,
  };

  it("renders a resolved call with its compact target", () => {
    expect(format_call_refs([base], ROOT, "foo")).toEqual("  src/main.ts:5  function call from main; resolved to: function foo at src/lib.ts:10");
  });

  it("surfaces the receiver form, the failing resolution stage and reason, and the syntactic flags", () => {
    const ref: CallRefDiagnostic = {
      ...base,
      call_type: "method",
      resolution_count: 0,
      resolved_to: [],
      receiver_kind: "call_chain",
      resolution_failure: { stage: "import_resolution", reason: "import_unresolved", partial_info: { import_specifier: "./lib" } },
      syntactic_features: { ...NO_FEATURES, is_optional_chain: true, is_awaited: true },
    };
    expect(format_call_refs([ref], ROOT, "foo")).toEqual(
      "  src/main.ts:5  method call from main; receiver: call_chain; unresolved; failure: import_resolution/import_unresolved, import: ./lib; flags: optional-chain, awaited",
    );
  });
});

describe("format_symbol_id", () => {
  it("leaves an id it cannot parse as it is", () => {
    expect(format_symbol_id("module:<root>", ROOT)).toEqual("module:<root>");
  });
});

describe("format_classifier_hints", () => {
  it("renders nothing for no hints", () => {
    expect(format_classifier_hints([])).toEqual("");
  });
});

describe("format_registry_slice", () => {
  it("renders an empty slice as none", () => {
    expect(format_registry_slice([])).toEqual("  (none)");
  });
});

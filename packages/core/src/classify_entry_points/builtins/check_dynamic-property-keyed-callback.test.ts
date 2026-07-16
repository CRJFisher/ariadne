import { describe, it, expect } from "vitest";

import type {
  CallRefDiagnostic,
  EnrichedEntryPoint,
  FilePath,
  GrepHit,
  Language,
  ReceiverKind,
} from "@ariadnejs/types";
import { check_dynamic_property_keyed_callback } from "./check_dynamic-property-keyed-callback";

const CALLER_FILE = "/repo/src/dispatch.ts" as FilePath;
const EMPTY_READER = (_: string) => [] as readonly string[];

const NO_SYNTACTIC_FEATURES = {
  is_new_expression: false,
  is_super_call: false,
  is_optional_chain: false,
  is_awaited: false,
  is_callback_arg: false,
  is_inside_try: false,
  is_dynamic_dispatch: false,
};

function make_ref(overrides: Partial<CallRefDiagnostic> = {}): CallRefDiagnostic {
  return {
    caller_function: "dispatch",
    caller_file: CALLER_FILE,
    call_line: 42,
    call_type: "method",
    resolution_count: 0,
    resolved_to: [],
    receiver_kind: "identifier" as ReceiverKind,
    resolution_failure: null,
    syntactic_features: NO_SYNTACTIC_FEATURES,
    ...overrides,
  };
}

function grep_hit(content: string): GrepHit {
  return { file_path: CALLER_FILE, line: 1, content, captures: [] };
}

function make_entry(overrides: {
  refs?: CallRefDiagnostic[];
  grep_lines?: string[];
} = {}): EnrichedEntryPoint {
  return {
    name: "handler",
    file_path: CALLER_FILE,
    start_line: 10,
    kind: "function",
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: (overrides.grep_lines ?? []).map(grep_hit),
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: overrides.refs ?? [],
      diagnosis: "callers-in-registry-unresolved",
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
    },
  };
}

function run(entry: EnrichedEntryPoint, language: Language): boolean {
  return check_dynamic_property_keyed_callback(entry, EMPTY_READER, language);
}

describe("check_dynamic_property_keyed_callback", () => {
  it("matches an Ariadne call ref flagged as dynamic dispatch", () => {
    const ref = make_ref({
      syntactic_features: { ...NO_SYNTACTIC_FEATURES, is_dynamic_dispatch: true },
    });
    expect(run(make_entry({ refs: [ref] }), "typescript")).toBe(true);
  });

  it("matches a TypeScript computed-index table lookup assigned then called", () => {
    const line =
      "const fn = (visitEachChildTable as Record<SyntaxKind, VisitEachChildFunction<any> | undefined>)[node.kind]; return fn === undefined ? node : fn(node, visitor, context);";
    expect(run(make_entry({ grep_lines: [line] }), "typescript")).toBe(true);
  });

  it("matches a JavaScript handler invoked through a computed string key", () => {
    expect(run(make_entry({ grep_lines: ["return handlers[eventName](payload);"] }), "javascript")).toBe(true);
  });

  it("matches an object literal indexed by a non-literal key and invoked", () => {
    const line = "return {RETRY: self.handle_retry, FAILURE: self.handle_failure}[self.state](task, req);";
    expect(run(make_entry({ grep_lines: [line] }), "python")).toBe(true);
  });

  it("matches a Python dict indexed by a variable command and invoked", () => {
    expect(run(make_entry({ grep_lines: ["return self.commands[command](*argv) or EX_OK"] }), "python")).toBe(true);
  });

  it("matches a Python lowering table keyed by an op member and invoked", () => {
    expect(run(make_entry({ grep_lines: ["lowerings[op](*args, **kwargs)"] }), "python")).toBe(true);
  });

  it("matches a Python getattr with a variable name argument", () => {
    const line = "handler = getattr(self, method, self.http_method_not_allowed)";
    expect(run(make_entry({ grep_lines: [line] }), "python")).toBe(true);
  });

  it("matches a Python getattr with an f-string name argument", () => {
    expect(run(make_entry({ grep_lines: ["handler_method = getattr(self, f\"method_{name}\")"] }), "python")).toBe(true);
  });

  it("matches a Python attrgetter with a formatted name argument", () => {
    const line = "getter = operator.attrgetter(\"visit_%s\" % visit_name)";
    expect(run(make_entry({ grep_lines: [line] }), "python")).toBe(true);
  });

  it("matches when a non-matching grep hit precedes a matching one", () => {
    const lines = ["def handler(self, *args):", "return self.fns[backend](cfg, *arg, **kw)"];
    expect(run(make_entry({ grep_lines: lines }), "python")).toBe(true);
  });

  it("does not match a literal string index key (resolvable dispatch)", () => {
    expect(run(make_entry({ grep_lines: ["return this.handlers[\"submit\"](payload);"] }), "typescript")).toBe(false);
  });

  it("does not match a literal integer index key", () => {
    expect(run(make_entry({ grep_lines: ["query = self.steps[0](session)"] }), "python")).toBe(false);
  });

  it("does not match a getattr with a literal string name (resolvable)", () => {
    expect(run(make_entry({ grep_lines: ["handler = getattr(self, \"get_absolute_url\")()"] }), "python")).toBe(false);
  });

  it("does not match an ordinary named call at a genuine unreachable site", () => {
    expect(run(make_entry({ grep_lines: ["return compute_total(items);"] }), "typescript")).toBe(false);
  });

  it("does not fire the getattr signal outside Python", () => {
    expect(run(make_entry({ grep_lines: ["const h = getattr(self, method);"] }), "typescript")).toBe(false);
  });

  it("does not match a registration decorator with no in-line dynamic invocation", () => {
    const line = "@register_lowering(aten.median.dim, type_promotion_kind=None)";
    expect(run(make_entry({ grep_lines: [line] }), "python")).toBe(false);
  });

  it("does not match a bare list-literal registration of callbacks", () => {
    const line = "self._subheader_processors = [self._process_rowsize_subheader, self._process_columnsize_subheader]";
    expect(run(make_entry({ grep_lines: [line] }), "python")).toBe(false);
  });

  it("does not match a Rust declarative-macro table registration", () => {
    const line = "register_attr! { autodiff_forward: autodiff::expand_forward }";
    expect(run(make_entry({ grep_lines: [line] }), "rust")).toBe(false);
  });

  it("does not match an entry with no call sites", () => {
    expect(run(make_entry(), "python")).toBe(false);
  });
});

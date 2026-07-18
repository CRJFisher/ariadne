import { describe, it, expect } from "vitest";
import {
  build_suppressed_entries,
  format_classification_tag,
  format_suppressed_section,
  sort_suppressed,
  type SuppressedClassification,
  type SuppressedEntryData,
} from "./format_suppressed";
import type {
  CallGraph,
  CallableNode,
  ClassifiedEntryPoint,
  FilePath,
  FunctionDefinition,
  Location,
  ParameterDefinition,
  ScopeId,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import { module_scope } from "@ariadnejs/types";

function make_location(
  file_path: string,
  start_line: number,
  end_line: number,
  start_column = 0,
  end_column = 1
): Location {
  return {
    file_path: file_path as FilePath,
    start_line,
    start_column,
    end_line,
    end_column,
  };
}

function make_scope_id(file_path: string, start_line: number): ScopeId {
  return module_scope(make_location(file_path, start_line, start_line));
}

interface MakeFunctionNodeInput {
  symbol_id: SymbolId;
  name: string;
  file_path: string;
  start_line: number;
  end_line: number;
  parameters?: readonly ParameterDefinition[];
  return_type?: string;
}

function make_function_node(input: MakeFunctionNodeInput): CallableNode {
  const {
    symbol_id,
    name,
    file_path,
    start_line,
    end_line,
    parameters = [],
    return_type = "void",
  } = input;
  const location = make_location(file_path, start_line, end_line);
  const definition: FunctionDefinition = {
    kind: "function",
    symbol_id,
    name: name as SymbolName,
    defining_scope_id: make_scope_id(location.file_path, location.start_line),
    location,
    is_exported: false,
    body_scope_id: make_scope_id(location.file_path, location.start_line),
    signature: {
      parameters,
      return_type: return_type as SymbolName | undefined,
    },
  };
  return {
    symbol_id,
    name: name as SymbolName,
    definition,
    location,
    enclosed_calls: [],
    is_test: false,
  };
}

describe("format_classification_tag", () => {
  it("formats framework_invoked with [group_id: framework]", () => {
    const tag = format_classification_tag({
      kind: "framework_invoked",
      group_id: "flask-route-decorator",
      framework: "flask",
    });
    expect(tag).toEqual("[flask-route-decorator: flask]");
  });

  it("formats dunder_protocol with [dunder_protocol: <protocol>]", () => {
    const tag = format_classification_tag({
      kind: "dunder_protocol",
      protocol: "__str__",
    });
    expect(tag).toEqual("[dunder_protocol: __str__]");
  });

  it("formats test_only as bare [test_only]", () => {
    const tag = format_classification_tag({ kind: "test_only" });
    expect(tag).toEqual("[test_only]");
  });

  it("formats indirect_only with [indirect_only: <via.type>] for function_reference", () => {
    const tag = format_classification_tag({
      kind: "indirect_only",
      via: { type: "function_reference", read_location: make_location("e.py", 1, 1) },
    });
    expect(tag).toEqual("[indirect_only: function_reference]");
  });

  it("formats indirect_only with [indirect_only: <via.type>] for collection_read", () => {
    const tag = format_classification_tag({
      kind: "indirect_only",
      via: {
        type: "collection_read",
        collection_id: "variable:foo.py:1:0:1:1:handlers" as SymbolId,
        read_location: make_location("foo.py", 1, 1),
      },
    });
    expect(tag).toEqual("[indirect_only: collection_read]");
  });
});

describe("sort_suppressed", () => {
  it("sorts by file_path, then start_line, then name", () => {
    const make_entry = (
      symbol_id: SymbolId,
      name: string,
      file_path: string,
      start_line: number,
      classification: SuppressedClassification = { kind: "test_only" }
    ): SuppressedEntryData => ({
      node: make_function_node({
        symbol_id,
        name,
        file_path,
        start_line,
        end_line: start_line + 1,
      }),
      classification,
    });

    const a = make_entry("function:z.py:5:0:6:1:zzz" as SymbolId, "zzz", "z.py", 5);
    const b = make_entry("function:a.py:10:0:11:1:aaa" as SymbolId, "aaa", "a.py", 10);
    const c = make_entry("function:a.py:5:0:6:1:bbb" as SymbolId, "bbb", "a.py", 5);

    const sorted = sort_suppressed([a, b, c]);

    // Expected order: a.py:5 (bbb), a.py:10 (aaa), z.py:5 (zzz)
    expect(sorted.map((e) => e.node.name)).toEqual(["bbb", "aaa", "zzz"]);
  });

  it("returns a new array (does not mutate input)", () => {
    const entries: SuppressedEntryData[] = [
      {
        node: make_function_node({
          symbol_id: "function:b.py:1:0:1:1:b" as SymbolId,
          name: "b",
          file_path: "b.py",
          start_line: 1,
          end_line: 1,
        }),
        classification: { kind: "test_only" },
      },
      {
        node: make_function_node({
          symbol_id: "function:a.py:1:0:1:1:a" as SymbolId,
          name: "a",
          file_path: "a.py",
          start_line: 1,
          end_line: 1,
        }),
        classification: { kind: "test_only" },
      },
    ];
    const original_first_name = entries[0].node.name;
    sort_suppressed(entries);
    // input order unchanged
    expect(entries[0].node.name).toEqual(original_first_name);
  });
});

describe("format_suppressed_section", () => {
  it("renders '(none)' for an empty list under the canonical header", () => {
    const text = format_suppressed_section([]);
    expect(text).toContain("Suppressed (known false positives):");
    expect(text).toContain("(none)");
    expect(text).not.toContain("Total: 0");
  });

  it("renders a single entry with signature, location, ref, and tag", () => {
    const node = make_function_node({
      symbol_id: "function:src/foo.py:12:0:14:1:__str__" as SymbolId,
      name: "__str__",
      file_path: "src/foo.py",
      start_line: 12,
      end_line: 14,
    });
    const text = format_suppressed_section([
      {
        node,
        classification: { kind: "dunder_protocol", protocol: "__str__" },
      },
    ]);
    expect(text).toContain("Suppressed (known false positives):");
    expect(text).toContain("__str__(): void [dunder_protocol: __str__]");
    expect(text).toContain("Location: src/foo.py:12");
    expect(text).toContain("Ref: src/foo.py:12#__str__");
    expect(text).toContain("Total: 1 suppressed");
  });

  it("includes a separator line above the header", () => {
    const text = format_suppressed_section([]);
    expect(text).toContain("=".repeat(60));
  });
});

describe("build_suppressed_entries", () => {
  it("attaches the call-graph node for each suppressed symbol", () => {
    const id = "function:foo.py:1:0:5:1:foo" as SymbolId;
    const node = make_function_node({
      symbol_id: id,
      name: "foo",
      file_path: "foo.py",
      start_line: 1,
      end_line: 5,
    });
    const call_graph: CallGraph = {
      nodes: new Map([[id, node]]),
      entry_points: [],
    };
    const known_false_positives: readonly ClassifiedEntryPoint[] = [
      { symbol_id: id, classification: { kind: "test_only" } },
    ];

    const entries = build_suppressed_entries(known_false_positives, call_graph);

    expect(entries).toEqual<SuppressedEntryData[]>([
      { node, classification: { kind: "test_only" } },
    ]);
  });

  it("skips suppressed entries whose node is missing from the call graph", () => {
    const id = "function:foo.py:1:0:5:1:foo" as SymbolId;
    const call_graph: CallGraph = {
      nodes: new Map(), // missing
      entry_points: [],
    };
    const entries = build_suppressed_entries(
      [{ symbol_id: id, classification: { kind: "test_only" } }],
      call_graph
    );

    expect(entries).toEqual<SuppressedEntryData[]>([]);
  });

  it("filters out 'true_entry_point' classifications defensively (never appears by contract)", () => {
    const id = "function:foo.py:1:0:5:1:foo" as SymbolId;
    const node = make_function_node({
      symbol_id: id,
      name: "foo",
      file_path: "foo.py",
      start_line: 1,
      end_line: 5,
    });
    const call_graph: CallGraph = {
      nodes: new Map([[id, node]]),
      entry_points: [],
    };
    const entries = build_suppressed_entries(
      [{ symbol_id: id, classification: { kind: "true_entry_point" } }],
      call_graph
    );

    expect(entries).toEqual<SuppressedEntryData[]>([]);
  });

  it("returns entries sorted by (file_path, line, name)", () => {
    const a_id = "function:z.py:5:0:6:1:zzz" as SymbolId;
    const b_id = "function:a.py:1:0:2:1:aaa" as SymbolId;
    const a_node = make_function_node({
      symbol_id: a_id,
      name: "zzz",
      file_path: "z.py",
      start_line: 5,
      end_line: 6,
    });
    const b_node = make_function_node({
      symbol_id: b_id,
      name: "aaa",
      file_path: "a.py",
      start_line: 1,
      end_line: 2,
    });
    const call_graph: CallGraph = {
      nodes: new Map([
        [a_id, a_node],
        [b_id, b_node],
      ]),
      entry_points: [],
    };

    const entries = build_suppressed_entries(
      [
        { symbol_id: a_id, classification: { kind: "test_only" } },
        { symbol_id: b_id, classification: { kind: "test_only" } },
      ],
      call_graph
    );

    expect(entries.map((e) => e.node.name)).toEqual(["aaa", "zzz"]);
  });
});

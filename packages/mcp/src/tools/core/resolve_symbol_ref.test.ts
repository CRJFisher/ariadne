import { describe, it, expect } from "vitest";
import {
  build_symbol_ref,
  find_node_by_symbol_ref,
  parse_symbol_ref,
  paths_match,
} from "./resolve_symbol_ref";
import type {
  CallGraph,
  CallableNode,
  SymbolId,
  FilePath,
  SymbolName,
  ScopeId,
} from "@ariadnejs/types";

function create_mock_node(
  id: string,
  name: string,
  file_path: string,
  start_line: number,
  end_line: number
): CallableNode {
  const symbol_id = id as SymbolId;
  return {
    symbol_id,
    name: name as SymbolName,
    definition: {
      symbol_id,
      name: name as SymbolName,
      kind: "function",
      location: {
        file_path: file_path as FilePath,
        start_line,
        start_column: 0,
        end_line,
        end_column: 1,
      },
      is_exported: false,
      defining_scope_id: "scope:module" as ScopeId,
      body_scope_id: "scope:module#body" as ScopeId,
      signature: {
        parameters: [],
        return_type: "void" as SymbolName,
      },
    },
    location: {
      file_path: file_path as FilePath,
      start_line,
      start_column: 0,
      end_line,
      end_column: 1,
    },
    enclosed_calls: [],
    is_test: false,
  };
}

describe("paths_match", () => {
  it("matches exact paths", () => {
    expect(paths_match("src/utils.ts", "src/utils.ts")).toBe(true);
  });

  it("matches relative path against absolute path", () => {
    expect(paths_match("/project/src/utils.ts", "src/utils.ts")).toBe(true);
    expect(paths_match("src/utils.ts", "/project/src/utils.ts")).toBe(true);
  });

  it("does NOT match partial path segments", () => {
    // "ared/utils.ts" must NOT match "shared/utils.ts"
    // because "ared" is not a complete path segment
    expect(paths_match("ared/utils.ts", "shared/utils.ts")).toBe(false);
    expect(paths_match("andlers.ts", "handlers.ts")).toBe(false);
  });

  it("matches filename at path boundary", () => {
    // "utils.ts" at a path boundary (after /) matches — this supports
    // relative path matching like "utils.ts" matching "src/utils.ts"
    expect(paths_match("utils.ts", "src/utils.ts")).toBe(true);
  });

  it("matches at path boundaries", () => {
    // "utils.ts" at start of longer path (no prefix char) matches
    expect(paths_match("utils.ts", "utils.ts")).toBe(true);
    // "src/utils.ts" ending longer path matches
    expect(paths_match("/project/src/utils.ts", "src/utils.ts")).toBe(true);
  });

  it("handles Windows-style path separators", () => {
    expect(paths_match("C:\\project\\src\\utils.ts", "src\\utils.ts")).toBe(true);
  });
});

describe("parse_symbol_ref", () => {
  it("parses standard format", () => {
    const result = parse_symbol_ref("src/handlers.ts:15#handle_request");
    expect(result).toEqual({
      file_path: "src/handlers.ts",
      line: 15,
      name: "handle_request",
    });
  });

  it("handles Windows paths with colons", () => {
    const result = parse_symbol_ref("C:/Users/foo/bar.ts:10#my_func");
    expect(result).toEqual({
      file_path: "C:/Users/foo/bar.ts",
      line: 10,
      name: "my_func",
    });
  });

  it("handles deep paths", () => {
    const result = parse_symbol_ref(
      "packages/core/src/utils/helpers.ts:42#helper_func"
    );
    expect(result).toEqual({
      file_path: "packages/core/src/utils/helpers.ts",
      line: 42,
      name: "helper_func",
    });
  });

  it("handles names with underscores", () => {
    const result = parse_symbol_ref("test.ts:1#__private_method__");
    expect(result).toEqual({
      file_path: "test.ts",
      line: 1,
      name: "__private_method__",
    });
  });

  it("throws on missing hash", () => {
    expect(() => parse_symbol_ref("test.ts:1")).toThrow("missing '#'");
  });

  it("throws on missing colon before line", () => {
    expect(() => parse_symbol_ref("test.ts#foo")).toThrow("missing ':'");
  });

  it("throws on non-numeric line", () => {
    expect(() => parse_symbol_ref("test.ts:abc#foo")).toThrow("not a number");
  });
});

describe("build_symbol_ref", () => {
  it("renders file_path:line#name from a node", () => {
    const node = create_mock_node(
      "symbol:handle_request",
      "handle_request",
      "src/handlers.ts",
      15,
      30
    );
    expect(build_symbol_ref(node)).toEqual("src/handlers.ts:15#handle_request");
  });

  it("round-trips through parse_symbol_ref", () => {
    const node = create_mock_node("symbol:foo", "foo", "src/utils.ts", 10, 20);
    expect(parse_symbol_ref(build_symbol_ref(node))).toEqual({
      file_path: "src/utils.ts",
      line: 10,
      name: "foo",
    });
  });
});

describe("find_node_by_symbol_ref", () => {
  it("finds node by exact match", () => {
    const node = create_mock_node(
      "symbol:foo",
      "foo",
      "src/utils.ts",
      10,
      20
    );
    const call_graph: CallGraph = {
      nodes: new Map([[node.symbol_id, node]]),
      entry_points: [node.symbol_id],
    };

    const result = find_node_by_symbol_ref(call_graph, {
      file_path: "src/utils.ts",
      line: 10,
      name: "foo",
    });

    expect(result).toBe(node);
  });

  it("matches relative path against absolute path", () => {
    const node = create_mock_node(
      "symbol:foo",
      "foo",
      "/Users/me/project/src/utils.ts",
      10,
      20
    );
    const call_graph: CallGraph = {
      nodes: new Map([[node.symbol_id, node]]),
      entry_points: [node.symbol_id],
    };

    const result = find_node_by_symbol_ref(call_graph, {
      file_path: "src/utils.ts",
      line: 10,
      name: "foo",
    });

    expect(result).toBe(node);
  });

  it("returns undefined when not found", () => {
    const node = create_mock_node(
      "symbol:foo",
      "foo",
      "src/utils.ts",
      10,
      20
    );
    const call_graph: CallGraph = {
      nodes: new Map([[node.symbol_id, node]]),
      entry_points: [node.symbol_id],
    };

    const result = find_node_by_symbol_ref(call_graph, {
      file_path: "src/utils.ts",
      line: 10,
      name: "bar", // Wrong name
    });

    expect(result).toBeUndefined();
  });

  it("returns undefined when line doesn't match", () => {
    const node = create_mock_node(
      "symbol:foo",
      "foo",
      "src/utils.ts",
      10,
      20
    );
    const call_graph: CallGraph = {
      nodes: new Map([[node.symbol_id, node]]),
      entry_points: [node.symbol_id],
    };

    const result = find_node_by_symbol_ref(call_graph, {
      file_path: "src/utils.ts",
      line: 11, // Wrong line
      name: "foo",
    });

    expect(result).toBeUndefined();
  });
});

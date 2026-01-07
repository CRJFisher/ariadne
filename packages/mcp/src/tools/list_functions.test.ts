/**
 * Tests for list_functions tool
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { list_functions, list_functions_schema } from "./list_functions";
import type { Project } from "@ariadnejs/core";
import type { CallGraph, CallableNode, SymbolId, FilePath } from "@ariadnejs/types";

describe("list_functions_schema", () => {
  it("should validate empty object", () => {
    const result = list_functions_schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept extra properties (ignore them)", () => {
    const result = list_functions_schema.safeParse({ extra: "value" });
    expect(result.success).toBe(true);
  });
});

describe("list_functions", () => {
  let mock_project: Project;

  beforeEach(() => {
    mock_project = {
      get_call_graph: vi.fn(),
    } as unknown as Project;
  });

  it("should return message when no entry points found", async () => {
    const mock_call_graph: CallGraph = {
      nodes: new Map(),
      entry_points: new Set(),
      edges: [],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_functions(mock_project);

    expect(result).toBe(
      "No entry points found (all functions are called by other functions)"
    );
  });

  it("should list entry points with their tree sizes", async () => {
    const node_id = "symbol:test_func" as SymbolId;
    const mock_node: CallableNode = {
      symbol_id: node_id,
      definition: {
        symbol_id: node_id,
        name: "test_func",
        kind: "function",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 10,
          start_column: 0,
          end_line: 20,
          end_column: 1,
        },
        scope_id: "scope:module" as any,
        signature: {
          parameters: [{ name: "x", type: "number" }],
          return_type: "void",
        },
      },
      location: {
        file_path: "test.ts" as FilePath,
        start_line: 10,
        start_column: 0,
        end_line: 20,
        end_column: 1,
      },
      callers: new Set(),
      enclosed_calls: [],
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[node_id, mock_node]]),
      entry_points: new Set([node_id]),
      edges: [],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_functions(mock_project);

    expect(result).toContain("Top-Level Functions (by call tree size):");
    expect(result).toContain("test_func(x: number): void");
    expect(result).toContain("test.ts:10");
    expect(result).toContain("Total: 1 entry point");
  });

  it("should sort entry points by tree size descending", async () => {
    const small_id = "symbol:small_func" as SymbolId;
    const large_id = "symbol:large_func" as SymbolId;
    const called_id = "symbol:called_func" as SymbolId;

    const small_node: CallableNode = {
      symbol_id: small_id,
      definition: {
        symbol_id: small_id,
        name: "small_func",
        kind: "function",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        scope_id: "scope:module" as any,
        signature: { parameters: [], return_type: "void" },
      },
      location: {
        file_path: "test.ts" as FilePath,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      },
      callers: new Set(),
      enclosed_calls: [],
    };

    const called_node: CallableNode = {
      symbol_id: called_id,
      definition: {
        symbol_id: called_id,
        name: "called_func",
        kind: "function",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 6,
          start_column: 0,
          end_line: 10,
          end_column: 1,
        },
        scope_id: "scope:module" as any,
        signature: { parameters: [], return_type: "void" },
      },
      location: {
        file_path: "test.ts" as FilePath,
        start_line: 6,
        start_column: 0,
        end_line: 10,
        end_column: 1,
      },
      callers: new Set([large_id]),
      enclosed_calls: [],
    };

    const large_node: CallableNode = {
      symbol_id: large_id,
      definition: {
        symbol_id: large_id,
        name: "large_func",
        kind: "function",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 11,
          start_column: 0,
          end_line: 20,
          end_column: 1,
        },
        scope_id: "scope:module" as any,
        signature: { parameters: [], return_type: "void" },
      },
      location: {
        file_path: "test.ts" as FilePath,
        start_line: 11,
        start_column: 0,
        end_line: 20,
        end_column: 1,
      },
      callers: new Set(),
      enclosed_calls: [
        {
          reference_id: "ref:call" as any,
          name: "called_func" as any,
          location: {} as any,
          scope_id: "scope:large_func" as any,
          type: "function_call",
          resolutions: [{ symbol_id: called_id, confidence: "high" }],
        },
      ],
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([
        [small_id, small_node],
        [large_id, large_node],
        [called_id, called_node],
      ]),
      entry_points: new Set([small_id, large_id]),
      edges: [],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_functions(mock_project);

    // large_func should appear first (has calls)
    const large_index = result.indexOf("large_func");
    const small_index = result.indexOf("small_func");
    expect(large_index).toBeLessThan(small_index);
  });

  it("should handle methods with parameters", async () => {
    const method_id = "symbol:MyClass.myMethod" as SymbolId;
    const method_node: CallableNode = {
      symbol_id: method_id,
      definition: {
        symbol_id: method_id,
        name: "myMethod",
        kind: "method",
        location: {
          file_path: "class.ts" as FilePath,
          start_line: 5,
          start_column: 2,
          end_line: 10,
          end_column: 3,
        },
        scope_id: "scope:MyClass" as any,
        parameters: [
          { name: "self", type: "MyClass" },
          { name: "value", type: "string" },
        ],
        return_type: "boolean",
      },
      location: {
        file_path: "class.ts" as FilePath,
        start_line: 5,
        start_column: 2,
        end_line: 10,
        end_column: 3,
      },
      callers: new Set(),
      enclosed_calls: [],
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[method_id, method_node]]),
      entry_points: new Set([method_id]),
      edges: [],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_functions(mock_project);

    expect(result).toContain("myMethod(self: MyClass, value: string): boolean");
  });

  it("should handle constructors", async () => {
    const ctor_id = "symbol:MyClass.constructor" as SymbolId;
    const ctor_node: CallableNode = {
      symbol_id: ctor_id,
      definition: {
        symbol_id: ctor_id,
        name: "constructor",
        kind: "constructor",
        location: {
          file_path: "class.ts" as FilePath,
          start_line: 2,
          start_column: 2,
          end_line: 4,
          end_column: 3,
        },
        scope_id: "scope:MyClass" as any,
        parameters: [{ name: "value", type: "number" }],
      },
      location: {
        file_path: "class.ts" as FilePath,
        start_line: 2,
        start_column: 2,
        end_line: 4,
        end_column: 3,
      },
      callers: new Set(),
      enclosed_calls: [],
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[ctor_id, ctor_node]]),
      entry_points: new Set([ctor_id]),
      edges: [],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_functions(mock_project);

    expect(result).toContain("constructor(value: number)");
  });

  it("should count unresolved calls", async () => {
    const func_id = "symbol:test_func" as SymbolId;
    const func_node: CallableNode = {
      symbol_id: func_id,
      definition: {
        symbol_id: func_id,
        name: "test_func",
        kind: "function",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        scope_id: "scope:module" as any,
        signature: { parameters: [], return_type: "void" },
      },
      location: {
        file_path: "test.ts" as FilePath,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      },
      callers: new Set(),
      enclosed_calls: [
        {
          reference_id: "ref:unresolved" as any,
          name: "external_func" as any,
          location: {} as any,
          scope_id: "scope:test_func" as any,
          type: "function_call",
          resolutions: [], // No resolutions = unresolved
        },
      ],
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[func_id, func_node]]),
      entry_points: new Set([func_id]),
      edges: [],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_functions(mock_project);

    expect(result).toContain("+ 1 unresolved");
  });
});

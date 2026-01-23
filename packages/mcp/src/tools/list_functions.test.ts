/**
 * Tests for list_functions tool
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { list_functions, list_functions_schema } from "./list_functions";
import type { Project } from "@ariadnejs/core";
import type { CallGraph, CallableNode, SymbolId, FilePath, SymbolName } from "@ariadnejs/types";

describe("list_functions_schema", () => {
  it("should validate empty object", () => {
    const result = list_functions_schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept extra properties (ignore them)", () => {
    const result = list_functions_schema.safeParse({ extra: "value" });
    expect(result.success).toBe(true);
  });

  it("should accept include_tests boolean", () => {
    const result_true = list_functions_schema.safeParse({ include_tests: true });
    expect(result_true.success).toBe(true);

    const result_false = list_functions_schema.safeParse({ include_tests: false });
    expect(result_false.success).toBe(true);
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
      entry_points: [],
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
      name: "test_func" as SymbolName,
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
      enclosed_calls: [],
      is_test: false,
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[node_id, mock_node]]),
      entry_points: [node_id],
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
      name: "small_func" as SymbolName,
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
      enclosed_calls: [],
      is_test: false,
    };

    const called_node: CallableNode = {
      symbol_id: called_id,
      name: "called_func" as SymbolName,
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
      enclosed_calls: [],
      is_test: false,
    };

    const large_node: CallableNode = {
      symbol_id: large_id,
      name: "large_func" as SymbolName,
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
      enclosed_calls: [
        {
          name: "called_func" as SymbolName,
          location: {} as any,
          scope_id: "scope:large_func" as any,
          call_type: "function",
          resolutions: [{ symbol_id: called_id, confidence: "high" }],
        },
      ],
      is_test: false,
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([
        [small_id, small_node],
        [large_id, large_node],
        [called_id, called_node],
      ]),
      entry_points: [small_id, large_id],
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
      name: "myMethod" as SymbolName,
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
      enclosed_calls: [],
      is_test: false,
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[method_id, method_node]]),
      entry_points: [method_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_functions(mock_project);

    expect(result).toContain("myMethod(self: MyClass, value: string): boolean");
  });

  it("should handle constructors", async () => {
    const ctor_id = "symbol:MyClass.constructor" as SymbolId;
    const ctor_node: CallableNode = {
      symbol_id: ctor_id,
      name: "constructor" as SymbolName,
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
      enclosed_calls: [],
      is_test: false,
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[ctor_id, ctor_node]]),
      entry_points: [ctor_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_functions(mock_project);

    expect(result).toContain("constructor(value: number)");
  });

  it("should count unresolved calls", async () => {
    const func_id = "symbol:test_func" as SymbolId;
    const func_node: CallableNode = {
      symbol_id: func_id,
      name: "test_func" as SymbolName,
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
      enclosed_calls: [
        {
          name: "external_func" as SymbolName,
          location: {} as any,
          scope_id: "scope:test_func" as any,
          call_type: "function",
          resolutions: [], // No resolutions = unresolved
        },
      ],
      is_test: false,
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[func_id, func_node]]),
      entry_points: [func_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_functions(mock_project);

    expect(result).toContain("+ 1 unresolved");
  });

  it("should mark test functions with [TEST] indicator", async () => {
    const test_func_id = "symbol:test_add" as SymbolId;
    const test_node: CallableNode = {
      symbol_id: test_func_id,
      name: "test_add" as SymbolName,
      definition: {
        symbol_id: test_func_id,
        name: "test_add",
        kind: "function",
        location: {
          file_path: "math.test.ts" as FilePath,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        scope_id: "scope:module" as any,
        signature: { parameters: [], return_type: "void" },
      },
      location: {
        file_path: "math.test.ts" as FilePath,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      },
      enclosed_calls: [],
      is_test: true,
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[test_func_id, test_node]]),
      entry_points: [test_func_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_functions(mock_project);

    expect(result).toContain("[TEST]");
    expect(result).toContain("test_add(): void");
  });

  it("should filter out test functions when include_tests is false", async () => {
    const prod_id = "symbol:main" as SymbolId;
    const test_id = "symbol:test_main" as SymbolId;

    const prod_node: CallableNode = {
      symbol_id: prod_id,
      name: "main" as SymbolName,
      definition: {
        symbol_id: prod_id,
        name: "main",
        kind: "function",
        location: {
          file_path: "app.ts" as FilePath,
          start_line: 1,
          start_column: 0,
          end_line: 10,
          end_column: 1,
        },
        scope_id: "scope:module" as any,
        signature: { parameters: [], return_type: "void" },
      },
      location: {
        file_path: "app.ts" as FilePath,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 1,
      },
      enclosed_calls: [],
      is_test: false,
    };

    const test_node: CallableNode = {
      symbol_id: test_id,
      name: "test_main" as SymbolName,
      definition: {
        symbol_id: test_id,
        name: "test_main",
        kind: "function",
        location: {
          file_path: "app.test.ts" as FilePath,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        scope_id: "scope:module" as any,
        signature: { parameters: [], return_type: "void" },
      },
      location: {
        file_path: "app.test.ts" as FilePath,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      },
      enclosed_calls: [],
      is_test: true,
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([
        [prod_id, prod_node],
        [test_id, test_node],
      ]),
      entry_points: [prod_id, test_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    // With include_tests: false, should only show production function
    const result = await list_functions(mock_project, { include_tests: false });

    expect(result).toContain("main(): void");
    expect(result).not.toContain("test_main");
    expect(result).not.toContain("[TEST]");
    expect(result).toContain("Total: 1 entry point");
  });

  it("should include test functions by default", async () => {
    const test_id = "symbol:test_func" as SymbolId;
    const test_node: CallableNode = {
      symbol_id: test_id,
      name: "test_func" as SymbolName,
      definition: {
        symbol_id: test_id,
        name: "test_func",
        kind: "function",
        location: {
          file_path: "app.test.ts" as FilePath,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        scope_id: "scope:module" as any,
        signature: { parameters: [], return_type: "void" },
      },
      location: {
        file_path: "app.test.ts" as FilePath,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      },
      enclosed_calls: [],
      is_test: true,
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[test_id, test_node]]),
      entry_points: [test_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    // Without specifying include_tests, should include tests by default
    const result = await list_functions(mock_project);

    expect(result).toContain("test_func(): void");
    expect(result).toContain("[TEST]");
  });
});

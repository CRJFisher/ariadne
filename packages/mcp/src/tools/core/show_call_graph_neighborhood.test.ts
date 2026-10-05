/**
 * Tests for show_call_graph_neighborhood tool
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  show_call_graph_neighborhood,
  show_call_graph_neighborhood_schema,
} from "./show_call_graph_neighborhood";
import type { Project } from "@ariadnejs/core";
import type {
  CallGraph,
  CallableNode,
  SymbolId,
  FilePath,
  SymbolName,
  ScopeId,
  FunctionDefinition,
} from "@ariadnejs/types";

/**
 * Helper to create a mock CallableNode
 */
function create_mock_node(
  id: string,
  name: string,
  file_path: string,
  start_line: number,
  end_line: number,
  enclosed_calls: CallableNode["enclosed_calls"] = [],
  is_test = false
): CallableNode & { definition: FunctionDefinition } {
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
    enclosed_calls,
    is_test,
  };
}

describe("show_call_graph_neighborhood_schema", () => {
  it("should require symbol_ref", () => {
    const result = show_call_graph_neighborhood_schema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should accept valid symbol_ref", () => {
    const result = show_call_graph_neighborhood_schema.safeParse({
      symbol_ref: "src/handlers.ts:15#handle_request",
    });
    expect(result.success).toBe(true);
  });

  it("should accept callers_depth as number", () => {
    const result = show_call_graph_neighborhood_schema.safeParse({
      symbol_ref: "test.ts:1#foo",
      callers_depth: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.callers_depth).toBe(2);
    }
  });

  it("should accept callers_depth as null for unlimited", () => {
    const result = show_call_graph_neighborhood_schema.safeParse({
      symbol_ref: "test.ts:1#foo",
      callers_depth: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.callers_depth).toBeNull();
    }
  });

  it("should accept callees_depth as number or null", () => {
    const result_number = show_call_graph_neighborhood_schema.safeParse({
      symbol_ref: "test.ts:1#foo",
      callees_depth: 3,
    });
    expect(result_number.success).toBe(true);

    const result_null = show_call_graph_neighborhood_schema.safeParse({
      symbol_ref: "test.ts:1#foo",
      callees_depth: null,
    });
    expect(result_null.success).toBe(true);
  });

  it("should accept show_full_signature boolean", () => {
    const result_true = show_call_graph_neighborhood_schema.safeParse({
      symbol_ref: "test.ts:1#foo",
      show_full_signature: true,
    });
    expect(result_true.success).toBe(true);

    const result_false = show_call_graph_neighborhood_schema.safeParse({
      symbol_ref: "test.ts:1#foo",
      show_full_signature: false,
    });
    expect(result_false.success).toBe(true);
  });

  it("should default show_full_signature to true", () => {
    const result = show_call_graph_neighborhood_schema.safeParse({
      symbol_ref: "test.ts:1#foo",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.show_full_signature).toBe(true);
    }
  });

  it("should accept files array for scoped analysis", () => {
    const result = show_call_graph_neighborhood_schema.safeParse({
      symbol_ref: "test.ts:1#foo",
      files: ["src/a.ts", "src/b.ts"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files).toEqual(["src/a.ts", "src/b.ts"]);
    }
  });

  it("should accept folders array for scoped analysis", () => {
    const result = show_call_graph_neighborhood_schema.safeParse({
      symbol_ref: "test.ts:1#foo",
      folders: ["src/utils", "lib/helpers"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.folders).toEqual(["src/utils", "lib/helpers"]);
    }
  });
});


describe("show_call_graph_neighborhood", () => {
  let mock_project: Pick<Project, "get_call_graph">;
  const TEST_PROJECT_PATH = "/test_project";
  const call_show = (
    request: Parameters<typeof show_call_graph_neighborhood>[1],
    project_path: string = TEST_PROJECT_PATH,
  ) => show_call_graph_neighborhood(mock_project, request, project_path);

  beforeEach(() => {
    mock_project = {
      get_call_graph: vi.fn(),
    };
  });

  it("should throw error for invalid symbol_ref format", async () => {
    const mock_call_graph: CallGraph = {
      nodes: new Map(),
      entry_points: [],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    await expect(
      call_show({
        symbol_ref: "invalid",
        show_full_signature: true,
      })
    ).rejects.toThrow("Invalid symbol_ref format");
  });

  it("should throw error when callable not found", async () => {
    const mock_call_graph: CallGraph = {
      nodes: new Map(),
      entry_points: [],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    await expect(
      call_show({
        symbol_ref: "test.ts:1#foo",
        show_full_signature: true,
      })
    ).rejects.toThrow("Could not find callable");
  });

  it("should show header with signature and location", async () => {
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
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "src/utils.ts:10#foo",
      show_full_signature: true,
    });

    expect(result).toContain("Call graph for: foo(): void");
    expect(result).toContain("Location: src/utils.ts:10-20");
  });

  it("should show 'none' message for entry point with no callers", async () => {
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
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "src/utils.ts:10#foo",
      show_full_signature: true,
    });

    expect(result).toContain("(none - this is an entry point)");
  });

  it("should show 'none' message for leaf function with no callees", async () => {
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
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "src/utils.ts:10#foo",
      show_full_signature: true,
    });

    expect(result).toContain("(none - this function makes no calls)");
  });

  it("should show callers tree", async () => {
    const callee = create_mock_node(
      "symbol:callee",
      "callee",
      "test.ts",
      1,
      5
    );
    const caller = create_mock_node(
      "symbol:caller",
      "caller",
      "test.ts",
      10,
      20,
      [
        {
          name: "callee" as SymbolName,
          location: {} as any,
          scope_id: "scope:caller" as any,
          call_type: "function",
          resolutions: [{ symbol_id: callee.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
        },
      ]
    );

    const call_graph: CallGraph = {
      nodes: new Map([
        [callee.symbol_id, callee],
        [caller.symbol_id, caller],
      ]),
      entry_points: [caller.symbol_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "test.ts:1#callee",
      show_full_signature: true,
    });

    expect(result).toContain("Callers (1 level up):");
    expect(result).toContain("caller(): void");
    expect(result).toContain("Location: test.ts:10-20");
  });

  it("should show callees tree", async () => {
    const callee = create_mock_node(
      "symbol:callee",
      "callee",
      "test.ts",
      1,
      5
    );
    const caller = create_mock_node(
      "symbol:caller",
      "caller",
      "test.ts",
      10,
      20,
      [
        {
          name: "callee" as SymbolName,
          location: {} as any,
          scope_id: "scope:caller" as any,
          call_type: "function",
          resolutions: [{ symbol_id: callee.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
        },
      ]
    );

    const call_graph: CallGraph = {
      nodes: new Map([
        [callee.symbol_id, callee],
        [caller.symbol_id, caller],
      ]),
      entry_points: [caller.symbol_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "test.ts:10#caller",
      show_full_signature: true,
    });

    expect(result).toContain("Callees (1 level down):");
    expect(result).toContain("callee(): void");
  });

  it("should detect cycles and mark with [cycle]", async () => {
    // Create a recursive function that calls itself
    const recursive = create_mock_node(
      "symbol:recursive",
      "recursive",
      "test.ts",
      1,
      10,
      [
        {
          name: "recursive" as SymbolName,
          location: {} as any,
          scope_id: "scope:recursive" as any,
          call_type: "function",
          resolutions: [{ symbol_id: "symbol:recursive" as SymbolId, confidence: "certain" as any, reason: { type: "direct" } }],
        },
      ]
    );

    const call_graph: CallGraph = {
      nodes: new Map([[recursive.symbol_id, recursive]]),
      entry_points: [recursive.symbol_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "test.ts:1#recursive",
      callees_depth: 3,
      show_full_signature: true,
    });

    expect(result).toContain("[cycle]");
  });

  it("should respect callers_depth limit", async () => {
    // Create a chain: c3 -> c2 -> c1 -> target
    const target = create_mock_node("symbol:target", "target", "test.ts", 1, 5);
    const c1 = create_mock_node("symbol:c1", "c1", "test.ts", 10, 15, [
      {
        name: "target" as SymbolName,
        location: {} as any,
        scope_id: "scope:c1" as any,
        call_type: "function",
        resolutions: [{ symbol_id: target.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
      },
    ]);
    const c2 = create_mock_node("symbol:c2", "c2", "test.ts", 20, 25, [
      {
        name: "c1" as SymbolName,
        location: {} as any,
        scope_id: "scope:c2" as any,
        call_type: "function",
        resolutions: [{ symbol_id: c1.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
      },
    ]);
    const c3 = create_mock_node("symbol:c3", "c3", "test.ts", 30, 35, [
      {
        name: "c2" as SymbolName,
        location: {} as any,
        scope_id: "scope:c3" as any,
        call_type: "function",
        resolutions: [{ symbol_id: c2.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
      },
    ]);

    const call_graph: CallGraph = {
      nodes: new Map([
        [target.symbol_id, target],
        [c1.symbol_id, c1],
        [c2.symbol_id, c2],
        [c3.symbol_id, c3],
      ]),
      entry_points: [c3.symbol_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    // With depth 1, should only show c1
    const result_depth1 = await call_show({
      symbol_ref: "test.ts:1#target",
      callers_depth: 1,
      show_full_signature: true,
    });
    expect(result_depth1).toContain("c1(): void");
    expect(result_depth1).not.toContain("c2(): void");

    // With depth 2, should show c1 and c2
    const result_depth2 = await call_show({
      symbol_ref: "test.ts:1#target",
      callers_depth: 2,
      show_full_signature: true,
    });
    expect(result_depth2).toContain("c1(): void");
    expect(result_depth2).toContain("c2(): void");
    expect(result_depth2).not.toContain("c3(): void");
  });

  it("respects callees_depth limit across a multi-level chain", async () => {
    // Chain: target -> h1 -> h2
    const h2 = create_mock_node("symbol:h2", "h2", "test.ts", 30, 35);
    const h1 = create_mock_node("symbol:h1", "h1", "test.ts", 20, 25, [
      {
        name: "h2" as SymbolName,
        location: {} as any,
        scope_id: "scope:h1" as any,
        call_type: "function",
        resolutions: [{ symbol_id: h2.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
      },
    ]);
    const target = create_mock_node("symbol:target", "target", "test.ts", 1, 5, [
      {
        name: "h1" as SymbolName,
        location: {} as any,
        scope_id: "scope:target" as any,
        call_type: "function",
        resolutions: [{ symbol_id: h1.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
      },
    ]);

    const call_graph: CallGraph = {
      nodes: new Map([
        [target.symbol_id, target],
        [h1.symbol_id, h1],
        [h2.symbol_id, h2],
      ]),
      entry_points: [target.symbol_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result_depth1 = await call_show({
      symbol_ref: "test.ts:1#target",
      callees_depth: 1,
      show_full_signature: true,
    });
    expect(result_depth1).toContain("h1(): void");
    expect(result_depth1).not.toContain("h2(): void");

    const result_depth2 = await call_show({
      symbol_ref: "test.ts:1#target",
      callees_depth: 2,
      show_full_signature: true,
    });
    expect(result_depth2).toContain("h1(): void");
    expect(result_depth2).toContain("h2(): void");
  });

  it("should show just name when show_full_signature is false", async () => {
    const node_id = "symbol:my_func" as SymbolId;
    const node: CallableNode = {
      symbol_id: node_id,
      name: "my_func" as SymbolName,
      definition: {
        symbol_id: node_id,
        name: "my_func" as SymbolName,
        kind: "function",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 1,
          start_column: 0,
          end_line: 10,
          end_column: 1,
        },
        is_exported: false,
        defining_scope_id: "scope:module" as ScopeId,
        body_scope_id: "scope:module#body" as ScopeId,
        signature: {
          parameters: [
            {
              kind: "parameter",
              symbol_id: "symbol:my_func#x" as SymbolId,
              name: "x" as SymbolName,
              defining_scope_id: "scope:module#body" as ScopeId,
              location: {
                file_path: "test.ts" as FilePath,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 1,
              },
              type: "number" as SymbolName,
            },
          ],
          return_type: "string" as SymbolName,
        },
      },
      location: {
        file_path: "test.ts" as FilePath,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 1,
      },
      enclosed_calls: [],
      is_test: false,
    };

    const call_graph: CallGraph = {
      nodes: new Map([[node_id, node]]),
      entry_points: [node_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "test.ts:1#my_func",
      show_full_signature: false,
    });

    // Header should still show full signature
    expect(result).toContain("Call graph for: my_func(x: number): string");
  });

  it("should use default depth of 1 when not specified", async () => {
    const node = create_mock_node("symbol:foo", "foo", "test.ts", 1, 5);
    const call_graph: CallGraph = {
      nodes: new Map([[node.symbol_id, node]]),
      entry_points: [node.symbol_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "test.ts:1#foo",
      show_full_signature: true,
    });

    expect(result).toContain("Callers (1 level up):");
    expect(result).toContain("Callees (1 level down):");
  });

  it("should handle mutual recursion (A calls B, B calls A)", async () => {
    const func_a = create_mock_node("symbol:func_a", "func_a", "test.ts", 1, 10);
    const func_b = create_mock_node("symbol:func_b", "func_b", "test.ts", 15, 25);

    // Update enclosed_calls after creation to reference each other
    (func_a as any).enclosed_calls = [
      {
        name: "func_b" as SymbolName,
        location: {} as any,
        scope_id: "scope:func_a" as any,
        call_type: "function",
        resolutions: [{ symbol_id: func_b.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
      },
    ];
    (func_b as any).enclosed_calls = [
      {
        name: "func_a" as SymbolName,
        location: {} as any,
        scope_id: "scope:func_b" as any,
        call_type: "function",
        resolutions: [{ symbol_id: func_a.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
      },
    ];

    const call_graph: CallGraph = {
      nodes: new Map([
        [func_a.symbol_id, func_a],
        [func_b.symbol_id, func_b],
      ]),
      entry_points: [],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "test.ts:1#func_a",
      callers_depth: 3,
      callees_depth: 3,
      show_full_signature: true,
    });

    // Should show func_b as both caller and callee, with cycle marker
    expect(result).toContain("func_b(): void");
    expect(result).toContain("[cycle]");
  });

  it("should show 'unlimited' label when depth is null", async () => {
    const node = create_mock_node("symbol:foo", "foo", "test.ts", 1, 5);
    const call_graph: CallGraph = {
      nodes: new Map([[node.symbol_id, node]]),
      entry_points: [node.symbol_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "test.ts:1#foo",
      callers_depth: null,
      callees_depth: null,
      show_full_signature: true,
    });

    expect(result).toContain("Callers (unlimited):");
    expect(result).toContain("Callees (unlimited):");
  });

  it("should produce deterministic ordering by file path, line, name", async () => {
    // Create callees with intentionally unsorted order
    const callee_z = create_mock_node("symbol:z_func", "z_func", "z_file.ts", 1, 5);
    const callee_a = create_mock_node("symbol:a_func", "a_func", "a_file.ts", 1, 5);
    const callee_m = create_mock_node("symbol:m_func", "m_func", "m_file.ts", 1, 5);

    const target = create_mock_node(
      "symbol:target",
      "target",
      "test.ts",
      10,
      20,
      [
        // Call them in z, a, m order to test sorting
        {
          name: "z_func" as SymbolName,
          location: {} as any,
          scope_id: "scope:target" as any,
          call_type: "function",
          resolutions: [{ symbol_id: callee_z.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
        },
        {
          name: "a_func" as SymbolName,
          location: {} as any,
          scope_id: "scope:target" as any,
          call_type: "function",
          resolutions: [{ symbol_id: callee_a.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
        },
        {
          name: "m_func" as SymbolName,
          location: {} as any,
          scope_id: "scope:target" as any,
          call_type: "function",
          resolutions: [{ symbol_id: callee_m.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
        },
      ]
    );

    const call_graph: CallGraph = {
      nodes: new Map([
        [target.symbol_id, target],
        [callee_z.symbol_id, callee_z],
        [callee_a.symbol_id, callee_a],
        [callee_m.symbol_id, callee_m],
      ]),
      entry_points: [target.symbol_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "test.ts:10#target",
      show_full_signature: true,
    });

    // Should be sorted alphabetically by file path: a_file.ts, m_file.ts, z_file.ts
    const a_pos = result.indexOf("a_func");
    const m_pos = result.indexOf("m_func");
    const z_pos = result.indexOf("z_func");

    expect(a_pos).toBeLessThan(m_pos);
    expect(m_pos).toBeLessThan(z_pos);
  });

  it("should deduplicate callees called from multiple sites", async () => {
    const callee = create_mock_node("symbol:helper", "helper", "test.ts", 1, 5);

    // Target calls helper twice (from different call sites)
    const target = create_mock_node(
      "symbol:target",
      "target",
      "test.ts",
      10,
      30,
      [
        {
          name: "helper" as SymbolName,
          location: { file_path: "test.ts" as FilePath, start_line: 15, start_column: 0, end_line: 15, end_column: 10 },
          scope_id: "scope:target" as any,
          call_type: "function",
          resolutions: [{ symbol_id: callee.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
        },
        {
          name: "helper" as SymbolName,
          location: { file_path: "test.ts" as FilePath, start_line: 25, start_column: 0, end_line: 25, end_column: 10 },
          scope_id: "scope:target" as any,
          call_type: "function",
          resolutions: [{ symbol_id: callee.symbol_id, confidence: "certain" as any, reason: { type: "direct" } }],
        },
      ]
    );

    const call_graph: CallGraph = {
      nodes: new Map([
        [target.symbol_id, target],
        [callee.symbol_id, callee],
      ]),
      entry_points: [target.symbol_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

    const result = await call_show({
      symbol_ref: "test.ts:10#target",
      show_full_signature: true,
    });

    // Count occurrences of "helper(): void" in the callees section
    const callees_section = result.split("Callees")[1];
    const helper_matches = callees_section.match(/helper\(\): void/g) || [];

    // Should appear exactly once (deduplicated)
    expect(helper_matches.length).toBe(1);
  });

  describe("Docstring output", () => {
    it("should include Docstring line when definition has a docstring", async () => {
      const base = create_mock_node("symbol:fn", "calculate", "stats.py", 10, 15);
      const node_with_doc: CallableNode = {
        ...base,
        definition: { ...base.definition, docstring: "Calculate the mean." },
      };
      const call_graph: CallGraph = {
        nodes: new Map([[node_with_doc.symbol_id, node_with_doc]]),
        entry_points: [node_with_doc.symbol_id],
      };
      vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

      const result = await call_show({
        symbol_ref: "stats.py:10#calculate",
        show_full_signature: true,
      });

      expect(result).toContain("Docstring: Calculate the mean.");
    });

    it("should omit Docstring line when definition has no docstring", async () => {
      const node = create_mock_node("symbol:fn", "calculate", "stats.py", 10, 15);
      const call_graph: CallGraph = {
        nodes: new Map([[node.symbol_id, node]]),
        entry_points: [node.symbol_id],
      };
      vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

      const result = await call_show({
        symbol_ref: "stats.py:10#calculate",
        show_full_signature: true,
      });

      expect(result).not.toContain("Docstring:");
    });

    it("should omit Docstring line when docstring is an array (class-style)", async () => {
      const base = create_mock_node("symbol:fn", "calculate", "stats.py", 10, 15);
      const node_with_array_doc: CallableNode = {
        ...base,
        definition: { ...base.definition, docstring: ["A class doc."] as any },
      };
      const call_graph: CallGraph = {
        nodes: new Map([[node_with_array_doc.symbol_id, node_with_array_doc]]),
        entry_points: [node_with_array_doc.symbol_id],
      };
      vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

      const result = await call_show({
        symbol_ref: "stats.py:10#calculate",
        show_full_signature: true,
      });

      expect(result).not.toContain("Docstring:");
    });

    it("should omit Docstring line when docstring is an empty string", async () => {
      const base = create_mock_node("symbol:fn", "calculate", "stats.py", 10, 15);
      const node_with_empty_doc: CallableNode = {
        ...base,
        definition: { ...base.definition, docstring: "" },
      };
      const call_graph: CallGraph = {
        nodes: new Map([[node_with_empty_doc.symbol_id, node_with_empty_doc]]),
        entry_points: [node_with_empty_doc.symbol_id],
      };
      vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

      const result = await call_show({
        symbol_ref: "stats.py:10#calculate",
        show_full_signature: true,
      });

      expect(result).not.toContain("Docstring:");
    });
  });

  describe("symbol_ref project-root guard", () => {
    it("throws a project-aware error when symbol_ref file_path is absolute and outside the project root", async () => {
      const empty_call_graph: CallGraph = {
        nodes: new Map(),
        entry_points: [],
      };
      vi.mocked(mock_project.get_call_graph).mockReturnValue(empty_call_graph);

      await expect(
        call_show(
          {
            symbol_ref: "/tmp/elsewhere/foo.ts:10#bar",
            show_full_signature: true,
          },
          "/test_project",
        ),
      ).rejects.toThrow(
        /symbol_ref file path '\/tmp\/elsewhere\/foo\.ts' is outside the loaded project root '\/test_project'/,
      );
    });

    it("does not trigger the project-root guard for relative symbol_ref paths", async () => {
      const empty_call_graph: CallGraph = {
        nodes: new Map(),
        entry_points: [],
      };
      vi.mocked(mock_project.get_call_graph).mockReturnValue(empty_call_graph);

      await expect(
        call_show({
          symbol_ref: "src/foo.ts:10#bar",
          show_full_signature: true,
        }),
      ).rejects.toThrow(/Could not find callable/);
    });

    it("accepts an absolute symbol_ref file_path inside the project root", async () => {
      const node = create_mock_node(
        "symbol:foo",
        "foo",
        "/test_project/src/utils.ts",
        10,
        20,
      );
      const call_graph: CallGraph = {
        nodes: new Map([[node.symbol_id, node]]),
        entry_points: [node.symbol_id],
      };
      vi.mocked(mock_project.get_call_graph).mockReturnValue(call_graph);

      const result = await call_show({
        symbol_ref: "/test_project/src/utils.ts:10#foo",
        show_full_signature: true,
      });

      expect(result).toContain("Call graph for: foo(): void");
    });
  });
});

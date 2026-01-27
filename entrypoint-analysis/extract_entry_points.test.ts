import { describe, it, expect } from "vitest";
import { build_signature, count_tree_size, detect_language } from "./extract_entry_points.js";
import type {
  AnyDefinition,
  CallGraph,
  CallableNode,
  SymbolId,
  SymbolName,
  ScopeId,
  FilePath,
  Location,
  CallReference,
  Resolution,
} from "@ariadnejs/types";

// ===== Test Helpers =====

/** Branded type helper — avoids verbose `as X` on every string */
const sym = (s: string) => s as unknown as SymbolId;
const name = (s: string) => s as unknown as SymbolName;
const scope = (s: string) => s as unknown as ScopeId;
const fp = (s: string) => s as unknown as FilePath;

function make_location(file_path: string, start_line: number): Location {
  return {
    file_path: fp(file_path),
    start_line,
    start_column: 0,
    end_line: start_line + 5,
    end_column: 1,
  };
}

function make_callable_node(
  node_name: string,
  symbol_id: string,
  enclosed_calls: CallReference[] = [],
): CallableNode {
  return {
    symbol_id: sym(symbol_id),
    name: name(node_name),
    location: make_location("src/test.ts", 1),
    definition: {
      kind: "function",
      name: name(node_name),
      is_exported: false,
      body_scope_id: scope("scope_1"),
    } as AnyDefinition,
    enclosed_calls,
    is_test: false,
  };
}

function make_call_ref(
  call_name: string,
  resolved_to: string[],
): CallReference {
  return {
    location: make_location("src/test.ts", 10),
    name: name(call_name),
    scope_id: scope("s1"),
    call_type: "function",
    resolutions: resolved_to.map((id) => ({
      symbol_id: sym(id),
      confidence: "certain" as const,
      reason: { type: "direct" as const },
    })),
    is_callback_invocation: false,
  };
}

// ===== build_signature =====

describe("build_signature", () => {
  it("builds signature for function definition", () => {
    // Use 'as unknown as AnyDefinition' to avoid needing full ParameterDefinition fields
    const def = {
      kind: "function",
      name: name("process_data"),
      is_exported: false,
      body_scope_id: scope("s1"),
      signature: {
        parameters: [
          { name: "input", type: "string" },
          { name: "count", type: "number" },
        ],
        return_type: "boolean",
      },
    } as unknown as AnyDefinition;

    expect(build_signature(def)).toBe("process_data(input: string, count: number): boolean");
  });

  it("builds signature for method definition", () => {
    const def = {
      kind: "method",
      name: name("get_value"),
      access_modifier: "public",
      static: false,
      parameters: [
        { name: "key", type: "string" },
      ],
      return_type: "any",
    } as unknown as AnyDefinition;

    expect(build_signature(def)).toBe("get_value(key: string): any");
  });

  it("builds signature for constructor definition", () => {
    const def = {
      kind: "constructor",
      name: name("constructor"),
      parameters: [
        { name: "config", type: "Config" },
      ],
    } as unknown as AnyDefinition;

    expect(build_signature(def)).toBe("constructor(config: Config)");
  });

  it("handles function with no parameters", () => {
    const def = {
      kind: "function",
      name: name("init"),
      is_exported: true,
      body_scope_id: scope("s1"),
      signature: {
        parameters: [],
        return_type: "void",
      },
    } as unknown as AnyDefinition;

    expect(build_signature(def)).toBe("init(): void");
  });

  it("uses 'any' for parameters without type annotation", () => {
    const def = {
      kind: "function",
      name: name("loose"),
      is_exported: false,
      body_scope_id: scope("s1"),
      signature: {
        parameters: [
          { name: "x" },
        ],
        return_type: "string",
      },
    } as unknown as AnyDefinition;

    expect(build_signature(def)).toBe("loose(x: any): string");
  });
});

// ===== count_tree_size =====

describe("count_tree_size", () => {
  it("returns 0 for a leaf node (no calls)", () => {
    const nodes = new Map<SymbolId, CallableNode>();
    const leaf = make_callable_node("leaf", "leaf_id");
    nodes.set(sym("leaf_id"), leaf);

    const call_graph: CallGraph = {
      nodes,
      entry_points: [sym("leaf_id")],
      indirect_reachability: new Map(),
    };

    expect(count_tree_size(sym("leaf_id"), call_graph, new Set())).toBe(0);
  });

  it("counts direct callees", () => {
    const nodes = new Map<SymbolId, CallableNode>();

    const child1 = make_callable_node("child1", "child1_id");
    const child2 = make_callable_node("child2", "child2_id");
    const parent = make_callable_node("parent", "parent_id", [
      make_call_ref("child1", ["child1_id"]),
      make_call_ref("child2", ["child2_id"]),
    ]);

    nodes.set(sym("parent_id"), parent);
    nodes.set(sym("child1_id"), child1);
    nodes.set(sym("child2_id"), child2);

    const call_graph: CallGraph = {
      nodes,
      entry_points: [sym("parent_id")],
      indirect_reachability: new Map(),
    };

    // parent calls 2 children, each adds 1 (the resolution) + 0 (leaf)
    expect(count_tree_size(sym("parent_id"), call_graph, new Set())).toBe(2);
  });

  it("handles cycles without infinite recursion", () => {
    const nodes = new Map<SymbolId, CallableNode>();

    const a = make_callable_node("a", "a_id", [make_call_ref("b", ["b_id"])]);
    const b = make_callable_node("b", "b_id", [make_call_ref("a", ["a_id"])]);

    nodes.set(sym("a_id"), a);
    nodes.set(sym("b_id"), b);

    const call_graph: CallGraph = {
      nodes,
      entry_points: [sym("a_id")],
      indirect_reachability: new Map(),
    };

    // a → b (count 1 for resolution + recurse b) → b → a (count 1 for resolution, already visited = 0) = 2
    expect(count_tree_size(sym("a_id"), call_graph, new Set())).toBe(2);
  });
});

// ===== detect_language =====

describe("detect_language", () => {
  it("detects TypeScript files", () => {
    expect(detect_language("src/index.ts")).toBe("typescript");
    expect(detect_language("src/component.tsx")).toBe("typescript");
  });

  it("detects JavaScript files", () => {
    expect(detect_language("lib/utils.js")).toBe("javascript");
    expect(detect_language("src/app.jsx")).toBe("javascript");
  });

  it("detects Python files", () => {
    expect(detect_language("main.py")).toBe("python");
  });

  it("detects Rust files", () => {
    expect(detect_language("src/lib.rs")).toBe("rust");
  });

  it("returns null for unsupported file types", () => {
    expect(detect_language("main.go")).toBeNull();
    expect(detect_language("App.java")).toBeNull();
    expect(detect_language("lib.cpp")).toBeNull();
    expect(detect_language("README.md")).toBeNull();
    expect(detect_language("style.css")).toBeNull();
  });
});

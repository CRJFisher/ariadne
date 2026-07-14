import { describe, it, expect } from "vitest";
import { count_tree_size } from "./count_tree_size";
import type {
  AnyDefinition,
  CallGraph,
  CallableNode,
  CallReference,
  Location,
  SymbolId,
  SymbolName,
  ScopeId,
  FilePath,
} from "@ariadnejs/types";

const sym = (s: string) => s as SymbolId;
const name = (s: string) => s as SymbolName;
const scope = (s: string) => s as ScopeId;
const fp = (s: string) => s as FilePath;

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
    } as object as AnyDefinition,
    enclosed_calls,
    is_test: false,
  };
}

function make_call_ref(call_name: string, resolved_to: string[]): CallReference {
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

describe("count_tree_size", () => {
  it("returns zero counts for a leaf node (no calls)", () => {
    const nodes = new Map<SymbolId, CallableNode>();
    nodes.set(sym("leaf_id"), make_callable_node("leaf", "leaf_id"));

    const call_graph: CallGraph = {
      nodes,
      entry_points: [sym("leaf_id")],
      indirect_reachability: new Map(),
    };

    expect(count_tree_size(sym("leaf_id"), call_graph, new Set())).toEqual({
      resolved: 0,
      unresolved: 0,
    });
  });

  it("counts direct callees as resolved", () => {
    const nodes = new Map<SymbolId, CallableNode>();
    nodes.set(sym("child1_id"), make_callable_node("child1", "child1_id"));
    nodes.set(sym("child2_id"), make_callable_node("child2", "child2_id"));
    nodes.set(
      sym("parent_id"),
      make_callable_node("parent", "parent_id", [
        make_call_ref("child1", ["child1_id"]),
        make_call_ref("child2", ["child2_id"]),
      ]),
    );

    const call_graph: CallGraph = {
      nodes,
      entry_points: [sym("parent_id")],
      indirect_reachability: new Map(),
    };

    expect(count_tree_size(sym("parent_id"), call_graph, new Set())).toEqual({
      resolved: 2,
      unresolved: 0,
    });
  });

  it("handles cycles without infinite recursion", () => {
    const nodes = new Map<SymbolId, CallableNode>();
    nodes.set(sym("a_id"), make_callable_node("a", "a_id", [make_call_ref("b", ["b_id"])]));
    nodes.set(sym("b_id"), make_callable_node("b", "b_id", [make_call_ref("a", ["a_id"])]));

    const call_graph: CallGraph = {
      nodes,
      entry_points: [sym("a_id")],
      indirect_reachability: new Map(),
    };

    expect(count_tree_size(sym("a_id"), call_graph, new Set())).toEqual({
      resolved: 2,
      unresolved: 0,
    });
  });

  it("counts a call site with no resolutions as unresolved", () => {
    const nodes = new Map<SymbolId, CallableNode>();
    nodes.set(
      sym("caller_id"),
      make_callable_node("caller", "caller_id", [make_call_ref("external", [])]),
    );

    const call_graph: CallGraph = {
      nodes,
      entry_points: [sym("caller_id")],
      indirect_reachability: new Map(),
    };

    expect(count_tree_size(sym("caller_id"), call_graph, new Set())).toEqual({
      resolved: 0,
      unresolved: 1,
    });
  });

  it("tallies resolved and unresolved calls independently", () => {
    const nodes = new Map<SymbolId, CallableNode>();
    nodes.set(sym("child_id"), make_callable_node("child", "child_id"));
    nodes.set(
      sym("parent_id"),
      make_callable_node("parent", "parent_id", [
        make_call_ref("child", ["child_id"]),
        make_call_ref("external", []),
      ]),
    );

    const call_graph: CallGraph = {
      nodes,
      entry_points: [sym("parent_id")],
      indirect_reachability: new Map(),
    };

    expect(count_tree_size(sym("parent_id"), call_graph, new Set())).toEqual({
      resolved: 1,
      unresolved: 1,
    });
  });

  it("propagates a subtree's unresolved count up through a resolved edge", () => {
    const nodes = new Map<SymbolId, CallableNode>();
    nodes.set(
      sym("child_id"),
      make_callable_node("child", "child_id", [make_call_ref("external", [])]),
    );
    nodes.set(
      sym("parent_id"),
      make_callable_node("parent", "parent_id", [make_call_ref("child", ["child_id"])]),
    );

    const call_graph: CallGraph = {
      nodes,
      entry_points: [sym("parent_id")],
      indirect_reachability: new Map(),
    };

    expect(count_tree_size(sym("parent_id"), call_graph, new Set())).toEqual({
      resolved: 1,
      unresolved: 1,
    });
  });
});

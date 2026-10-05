import { describe, it, expect } from "vitest";
import {
  build_callers_index,
  collect_callee_ids,
  sort_symbol_ids,
  traverse_callees,
  traverse_callers,
} from "./traverse_call_graph";
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
  end_line: number,
  enclosed_calls: CallableNode["enclosed_calls"] = []
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
    enclosed_calls,
    is_test: false,
  };
}

function call_to(
  callee_id: SymbolId,
  name: string,
  is_callback_invocation = false
): CallableNode["enclosed_calls"][number] {
  return {
    name: name as SymbolName,
    location: {} as any,
    scope_id: "scope:caller" as any,
    call_type: "function",
    ...(is_callback_invocation ? { is_callback_invocation: true } : {}),
    resolutions: [
      {
        symbol_id: callee_id,
        confidence: "certain" as any,
        reason: { type: "direct" },
      },
    ],
  };
}

describe("build_callers_index", () => {
  it("builds empty index for no calls", () => {
    const node = create_mock_node("symbol:foo", "foo", "test.ts", 1, 5);
    const call_graph: CallGraph = {
      nodes: new Map([[node.symbol_id, node]]),
      entry_points: [node.symbol_id],
    };

    const index = build_callers_index(call_graph);

    expect(index.size).toBe(0);
  });

  it("maps callee to caller", () => {
    const callee = create_mock_node("symbol:callee", "callee", "test.ts", 1, 5);
    const caller = create_mock_node(
      "symbol:caller",
      "caller",
      "test.ts",
      10,
      20,
      [call_to(callee.symbol_id, "callee")]
    );

    const call_graph: CallGraph = {
      nodes: new Map([
        [callee.symbol_id, callee],
        [caller.symbol_id, caller],
      ]),
      entry_points: [caller.symbol_id],
    };

    const index = build_callers_index(call_graph);

    expect(index.has(callee.symbol_id)).toBe(true);
    expect(index.get(callee.symbol_id)?.has(caller.symbol_id)).toBe(true);
  });

  it("handles multiple callers", () => {
    const callee = create_mock_node("symbol:callee", "callee", "test.ts", 1, 5);
    const caller1 = create_mock_node(
      "symbol:caller1",
      "caller1",
      "test.ts",
      10,
      20,
      [call_to(callee.symbol_id, "callee")]
    );
    const caller2 = create_mock_node(
      "symbol:caller2",
      "caller2",
      "test.ts",
      30,
      40,
      [call_to(callee.symbol_id, "callee")]
    );

    const call_graph: CallGraph = {
      nodes: new Map([
        [callee.symbol_id, callee],
        [caller1.symbol_id, caller1],
        [caller2.symbol_id, caller2],
      ]),
      entry_points: [caller1.symbol_id, caller2.symbol_id],
    };

    const index = build_callers_index(call_graph);

    expect(index.get(callee.symbol_id)?.size).toBe(2);
    expect(index.get(callee.symbol_id)?.has(caller1.symbol_id)).toBe(true);
    expect(index.get(callee.symbol_id)?.has(caller2.symbol_id)).toBe(true);
  });

  it("preserves genuine recursive self-calls", () => {
    const recursive_func = create_mock_node(
      "symbol:factorial",
      "factorial",
      "test.ts",
      1,
      10,
      // NOT a callback invocation - genuine recursive call
      [call_to("symbol:factorial" as SymbolId, "factorial")]
    );

    const call_graph: CallGraph = {
      nodes: new Map([[recursive_func.symbol_id, recursive_func]]),
      entry_points: [recursive_func.symbol_id],
    };

    const index = build_callers_index(call_graph);

    expect(index.has(recursive_func.symbol_id)).toBe(true);
    expect(
      index.get(recursive_func.symbol_id)?.has(recursive_func.symbol_id)
    ).toBe(true);
  });

  it("filters callback invocation self-calls", () => {
    // An anonymous callback that appears to call itself due to scope
    // resolution artifacts
    const callback_func = create_mock_node(
      "symbol:anonymous_callback",
      "<anonymous>",
      "test.ts",
      5,
      15,
      [call_to("symbol:anonymous_callback" as SymbolId, "<anonymous>", true)]
    );

    const call_graph: CallGraph = {
      nodes: new Map([[callback_func.symbol_id, callback_func]]),
      entry_points: [callback_func.symbol_id],
    };

    const index = build_callers_index(call_graph);

    expect(index.has(callback_func.symbol_id)).toBe(false);
  });

  it("preserves non-self callback invocations", () => {
    const target_func = create_mock_node("symbol:target", "target", "test.ts", 1, 5);
    const callback_func = create_mock_node(
      "symbol:callback",
      "<anonymous>",
      "test.ts",
      10,
      20,
      [call_to(target_func.symbol_id, "target", true)]
    );

    const call_graph: CallGraph = {
      nodes: new Map([
        [target_func.symbol_id, target_func],
        [callback_func.symbol_id, callback_func],
      ]),
      entry_points: [callback_func.symbol_id],
    };

    const index = build_callers_index(call_graph);

    expect(index.has(target_func.symbol_id)).toBe(true);
    expect(index.get(target_func.symbol_id)?.has(callback_func.symbol_id)).toBe(
      true
    );
  });
});

describe("traverse_callees", () => {
  /**
   * a -> b -> c: three-node chain used by the depth and structure cases.
   */
  function build_chain_graph(): CallGraph {
    const c = create_mock_node("symbol:c", "c", "test.ts", 21, 25);
    const b = create_mock_node("symbol:b", "b", "test.ts", 11, 15, [
      call_to(c.symbol_id, "c"),
    ]);
    const a = create_mock_node("symbol:a", "a", "test.ts", 1, 5, [
      call_to(b.symbol_id, "b"),
    ]);
    return {
      nodes: new Map([
        [a.symbol_id, a],
        [b.symbol_id, b],
        [c.symbol_id, c],
      ]),
      entry_points: [a.symbol_id],
    };
  }

  it("returns the full subtree when depth is unlimited", () => {
    const call_graph = build_chain_graph();

    const tree = traverse_callees(
      "symbol:a" as SymbolId,
      call_graph,
      null,
      0,
      new Set()
    );

    expect(tree?.symbol_id).toBe("symbol:a");
    expect(tree?.children.map((child) => child.symbol_id)).toEqual(["symbol:b"]);
    expect(tree?.children[0].children.map((child) => child.symbol_id)).toEqual([
      "symbol:c",
    ]);
  });

  it("truncates children beyond max_depth", () => {
    const call_graph = build_chain_graph();

    const tree = traverse_callees(
      "symbol:a" as SymbolId,
      call_graph,
      0,
      0,
      new Set()
    );

    expect(tree?.symbol_id).toBe("symbol:a");
    expect(tree?.children).toEqual([]);
  });

  it("marks revisited nodes as cycles", () => {
    const a_id = "symbol:a" as SymbolId;
    const b_id = "symbol:b" as SymbolId;
    const a = create_mock_node("symbol:a", "a", "test.ts", 1, 5, [
      call_to(b_id, "b"),
    ]);
    const b = create_mock_node("symbol:b", "b", "test.ts", 11, 15, [
      call_to(a_id, "a"),
    ]);
    const call_graph: CallGraph = {
      nodes: new Map([
        [a.symbol_id, a],
        [b.symbol_id, b],
      ]),
      entry_points: [],
    };

    const tree = traverse_callees(a_id, call_graph, null, 0, new Set());

    const cycle_node = tree?.children[0].children[0];
    expect(cycle_node?.symbol_id).toBe(a_id);
    expect(cycle_node?.is_cycle).toBe(true);
    expect(cycle_node?.children).toEqual([]);
  });

  it("deduplicates a callee called from multiple sites", () => {
    const helper_id = "symbol:helper" as SymbolId;
    const helper = create_mock_node("symbol:helper", "helper", "test.ts", 11, 15);
    const target = create_mock_node("symbol:target", "target", "test.ts", 1, 5, [
      call_to(helper_id, "helper"),
      call_to(helper_id, "helper"),
    ]);
    const call_graph: CallGraph = {
      nodes: new Map([
        [target.symbol_id, target],
        [helper.symbol_id, helper],
      ]),
      entry_points: [target.symbol_id],
    };

    const tree = traverse_callees(
      target.symbol_id,
      call_graph,
      null,
      0,
      new Set()
    );

    expect(tree?.children.map((child) => child.symbol_id)).toEqual([helper_id]);
  });

  it("orders children by file, line, then name", () => {
    const z_id = "symbol:z" as SymbolId;
    const early_id = "symbol:early" as SymbolId;
    const z = create_mock_node("symbol:z", "z", "a_file.ts", 5, 8);
    const early = create_mock_node("symbol:early", "early", "z_file.ts", 1, 3);
    const target = create_mock_node("symbol:target", "target", "m_file.ts", 1, 9, [
      call_to(early_id, "early"),
      call_to(z_id, "z"),
    ]);
    const call_graph: CallGraph = {
      nodes: new Map([
        [target.symbol_id, target],
        [z.symbol_id, z],
        [early.symbol_id, early],
      ]),
      entry_points: [target.symbol_id],
    };

    const tree = traverse_callees(
      target.symbol_id,
      call_graph,
      null,
      0,
      new Set()
    );

    // a_file.ts sorts before z_file.ts regardless of call order
    expect(tree?.children.map((child) => child.symbol_id)).toEqual([
      z_id,
      early_id,
    ]);
  });
});

describe("traverse_callers", () => {
  it("walks the callers index upward with depth limiting", () => {
    const leaf_id = "symbol:leaf" as SymbolId;
    const mid_id = "symbol:mid" as SymbolId;
    const root_id = "symbol:root" as SymbolId;
    const leaf = create_mock_node("symbol:leaf", "leaf", "test.ts", 21, 25);
    const mid = create_mock_node("symbol:mid", "mid", "test.ts", 11, 15, [
      call_to(leaf_id, "leaf"),
    ]);
    const root = create_mock_node("symbol:root", "root", "test.ts", 1, 5, [
      call_to(mid_id, "mid"),
    ]);
    const call_graph: CallGraph = {
      nodes: new Map([
        [leaf.symbol_id, leaf],
        [mid.symbol_id, mid],
        [root.symbol_id, root],
      ]),
      entry_points: [root_id],
    };
    const callers_index = build_callers_index(call_graph);

    const unlimited = traverse_callers(
      leaf_id,
      call_graph,
      callers_index,
      null,
      0,
      new Set()
    );
    expect(unlimited?.children.map((child) => child.symbol_id)).toEqual([mid_id]);
    expect(
      unlimited?.children[0].children.map((child) => child.symbol_id)
    ).toEqual([root_id]);

    const limited = traverse_callers(
      leaf_id,
      call_graph,
      callers_index,
      0,
      0,
      new Set()
    );
    expect(limited?.children).toEqual([]);
  });

  it("marks revisited callers as cycles", () => {
    const a_id = "symbol:a" as SymbolId;
    const b_id = "symbol:b" as SymbolId;
    const a = create_mock_node("symbol:a", "a", "test.ts", 1, 5, [
      call_to(b_id, "b"),
    ]);
    const b = create_mock_node("symbol:b", "b", "test.ts", 11, 15, [
      call_to(a_id, "a"),
    ]);
    const call_graph: CallGraph = {
      nodes: new Map([
        [a.symbol_id, a],
        [b.symbol_id, b],
      ]),
      entry_points: [],
    };
    const callers_index = build_callers_index(call_graph);

    const tree = traverse_callers(
      a_id,
      call_graph,
      callers_index,
      null,
      0,
      new Set()
    );

    const cycle_node = tree?.children[0].children[0];
    expect(cycle_node?.symbol_id).toBe(a_id);
    expect(cycle_node?.is_cycle).toBe(true);
    expect(cycle_node?.children).toEqual([]);
  });

  it("returns a leaf tree when nothing calls the target", () => {
    const only = create_mock_node("symbol:only", "only", "test.ts", 1, 5);
    const call_graph: CallGraph = {
      nodes: new Map([[only.symbol_id, only]]),
      entry_points: [only.symbol_id],
    };
    const callers_index = build_callers_index(call_graph);

    const tree = traverse_callers(
      only.symbol_id,
      call_graph,
      callers_index,
      null,
      0,
      new Set()
    );

    expect(tree?.symbol_id).toBe(only.symbol_id);
    expect(tree?.children).toEqual([]);
    expect(tree?.is_cycle).toBe(false);
  });
});

describe("callees a call names but the graph holds no node for", () => {
  // A call on an interface-typed receiver resolves to the interface member as
  // well as the implementations that run. The member declares no body, so the
  // graph holds no node for it.
  const member_id = "method:lib.ts:2:2:2:9:sweep" as SymbolId;

  function graph_with_absent_callee(): {
    call_graph: CallGraph;
    caller: CallableNode;
    impl_b: CallableNode;
    impl_a: CallableNode;
  } {
    const impl_b = create_mock_node("m:b.ts:1:9:sweep", "sweep", "b.ts", 1, 9);
    const impl_a = create_mock_node("m:a.ts:1:9:sweep", "sweep", "a.ts", 1, 9);
    const caller = create_mock_node("f:caller.ts:1:9:load", "load", "caller.ts", 1, 9, [
      {
        name: "sweep" as SymbolName,
        location: {} as never,
        scope_id: "scope:caller" as never,
        call_type: "method",
        resolutions: [
          { symbol_id: member_id, confidence: "certain" as never, reason: { type: "direct" } },
          { symbol_id: impl_b.symbol_id, confidence: "certain" as never, reason: { type: "direct" } },
          { symbol_id: impl_a.symbol_id, confidence: "certain" as never, reason: { type: "direct" } },
        ],
      },
    ]);
    return {
      call_graph: {
        nodes: new Map([
          [caller.symbol_id, caller],
          [impl_a.symbol_id, impl_a],
          [impl_b.symbol_id, impl_b],
        ]),
        entry_points: [],
      },
      caller,
      impl_a,
      impl_b,
    };
  }

  it("leaves a symbol the graph holds no node for out of a node's callees", () => {
    const { call_graph, caller, impl_a, impl_b } = graph_with_absent_callee();

    expect(collect_callee_ids(caller.enclosed_calls, call_graph)).toEqual([
      impl_b.symbol_id,
      impl_a.symbol_id,
    ]);
  });

  it("orders the callees that remain by file, so an absent symbol cannot scramble them", () => {
    const { call_graph, caller, impl_a, impl_b } = graph_with_absent_callee();

    const tree = traverse_callees(caller.symbol_id, call_graph, null, 0, new Set());

    expect(tree?.children.map((child) => child.symbol_id)).toEqual([
      impl_a.symbol_id,
      impl_b.symbol_id,
    ]);
  });

  it("sorts a symbol with no node after every symbol that has one, and ties by id", () => {
    const { call_graph, impl_a, impl_b } = graph_with_absent_callee();
    const other_absent = "method:lib.ts:3:3:3:9:flush" as SymbolId;

    expect(
      sort_symbol_ids([member_id, impl_b.symbol_id, other_absent, impl_a.symbol_id], call_graph)
    ).toEqual([impl_a.symbol_id, impl_b.symbol_id, member_id, other_absent]);
  });
});

import { describe, it, expect } from "vitest";
import {
  build_grep_index,
  build_signature,
  classify_accessor_line,
  count_tree_size,
  derive_definition_features,
  detect_language,
} from "./extract_entry_points.js";
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
    // Cast partial object to AnyDefinition (tests only need relevant fields)
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
    } as object as AnyDefinition;

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
    } as object as AnyDefinition;

    expect(build_signature(def)).toBe("get_value(key: string): any");
  });

  it("builds signature for constructor definition", () => {
    const def = {
      kind: "constructor",
      name: name("constructor"),
      parameters: [
        { name: "config", type: "Config" },
      ],
    } as object as AnyDefinition;

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
    } as object as AnyDefinition;

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
    } as object as AnyDefinition;

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

// ===== build_grep_index =====

describe("build_grep_index", () => {
  function as_lines(source: string): string[] {
    return source.split("\n");
  }

  it("indexes simple identifier-followed-by-paren calls", () => {
    const lines_by_file = new Map<string, string[]>([
      ["a.ts", as_lines("const x = foo();\nconst y = bar();")],
    ]);

    const index = build_grep_index(lines_by_file, new Map());

    expect(index.get("foo")).toEqual([
      { file_path: "a.ts", line: 1, content: "const x = foo();", captures: [] },
    ]);
    expect(index.get("bar")).toEqual([
      { file_path: "a.ts", line: 2, content: "const y = bar();", captures: [] },
    ]);
  });

  it("collects all occurrences of a repeated name across files", () => {
    const lines_by_file = new Map<string, string[]>([
      ["a.ts", as_lines("foo(); foo();")],
      ["b.ts", as_lines("foo();")],
    ]);

    const index = build_grep_index(lines_by_file, new Map());

    const foo_hits = index.get("foo") ?? [];
    expect(foo_hits).toHaveLength(3);
    expect(foo_hits.map((h) => `${h.file_path}:${h.line}`)).toEqual([
      "a.ts:1",
      "a.ts:1",
      "b.ts:1",
    ]);
  });

  it("ignores identifiers not followed by an open paren", () => {
    const lines_by_file = new Map<string, string[]>([
      ["a.ts", as_lines("const foo = 1;\nfoo.bar;\nfoo[0];")],
    ]);

    const index = build_grep_index(lines_by_file, new Map());

    expect(index.get("foo")).toBeUndefined();
    expect(index.get("bar")).toBeUndefined();
  });

  it("matches across whitespace between name and paren", () => {
    const lines_by_file = new Map<string, string[]>([
      ["a.ts", as_lines("foo  ();\n  bar (x);")],
    ]);

    const index = build_grep_index(lines_by_file, new Map());

    expect(index.get("foo")).toHaveLength(1);
    expect(index.get("bar")).toHaveLength(1);
  });

  it("supports $ and _ in identifiers", () => {
    const lines_by_file = new Map<string, string[]>([
      ["a.js", as_lines("$(selector); _private();")],
    ]);

    const index = build_grep_index(lines_by_file, new Map());

    expect(index.get("$")).toHaveLength(1);
    expect(index.get("_private")).toHaveLength(1);
  });

  it("attaches captures from call_refs_by_file_line when refs exist at the line", () => {
    const lines_by_file = new Map<string, string[]>([
      ["a.ts", as_lines("foo();")],
    ]);
    const refs_at_line: CallReference[] = [
      {
        location: make_location("a.ts", 1),
        name: name("foo"),
        scope_id: scope("s1"),
        call_type: "function",
        resolutions: [],
        is_callback_invocation: false,
      },
    ];
    const call_refs_by_file_line = new Map<string, Map<number, CallReference[]>>([
      ["a.ts", new Map([[1, refs_at_line]])],
    ]);

    const index = build_grep_index(lines_by_file, call_refs_by_file_line);

    expect(index.get("foo")?.[0].captures).toEqual(["@reference.call"]);
  });

  it("returns empty index for no source files", () => {
    const index = build_grep_index(new Map(), new Map());
    expect(index.size).toBe(0);
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

// ===== classify_accessor_line =====

describe("classify_accessor_line", () => {
  it("identifies a getter from a class accessor", () => {
    expect(classify_accessor_line("  get x() {")).toBe("getter");
  });

  it("identifies a setter from a class accessor", () => {
    expect(classify_accessor_line("  set value(v: number) {")).toBe("setter");
  });

  it("returns null for a regular method whose name starts with get", () => {
    expect(classify_accessor_line("  getThing() {")).toBeNull();
  });

  it("returns null for a regular method whose name starts with set", () => {
    expect(classify_accessor_line("  setThing(x) {")).toBeNull();
  });

  it("recognises modifiers preceding the accessor keyword", () => {
    expect(classify_accessor_line("  public static get x() {")).toBe("getter");
    expect(classify_accessor_line("  private set foo(v) {")).toBe("setter");
  });

  it("returns null for object-literal property assignments", () => {
    expect(classify_accessor_line("  get: 1,")).toBeNull();
    expect(classify_accessor_line("  set: 2,")).toBeNull();
  });

  it("returns null for plain function declarations", () => {
    expect(classify_accessor_line("function foo() {")).toBeNull();
  });
});

// ===== derive_definition_features =====

describe("derive_definition_features", () => {
  function make_node(
    overrides: {
      name?: string;
      symbol_id?: string;
      file_path?: string;
      start_line?: number;
      kind?: "function" | "method" | "constructor";
    } = {},
  ): CallableNode {
    const node_name = overrides.name ?? "fn";
    const file_path = overrides.file_path ?? "src/test.ts";
    const start_line = overrides.start_line ?? 1;
    const kind = overrides.kind ?? "function";
    return {
      symbol_id: sym(overrides.symbol_id ?? "fn_id"),
      name: name(node_name),
      location: {
        file_path: fp(file_path),
        start_line,
        start_column: 0,
        end_line: start_line + 2,
        end_column: 1,
      },
      definition: {
        kind,
        name: name(node_name),
        body_scope_id: scope("scope_1"),
      } as object as AnyDefinition,
      enclosed_calls: [],
      is_test: false,
    };
  }

  it("returns false / null for non-JS/TS files", () => {
    const node = make_node({ file_path: "src/main.py", kind: "method" });
    const out = derive_definition_features(node, new Set(), new Map());
    expect(out).toEqual({
      definition_is_object_literal_method: false,
      accessor_kind: null,
    });
  });

  it("flags an object-literal-method (kind=method but not in class_methods set)", () => {
    const node = make_node({
      file_path: "src/o.ts",
      symbol_id: "obj_method",
      kind: "method",
      start_line: 2,
    });
    const lines = new Map<string, string[]>([
      ["src/o.ts", ["const o = {", "  foo() { return 1; },", "};"]],
    ]);
    const out = derive_definition_features(node, new Set(), lines);
    expect(out).toEqual({
      definition_is_object_literal_method: true,
      accessor_kind: null,
    });
  });

  it("does NOT flag a class method whose symbol_id is in class_methods", () => {
    const node = make_node({
      file_path: "src/c.ts",
      symbol_id: "class_method",
      kind: "method",
      start_line: 2,
    });
    const lines = new Map<string, string[]>([
      ["src/c.ts", ["class C {", "  foo() {}", "}"]],
    ]);
    const class_methods = new Set<SymbolId>([sym("class_method")]);
    const out = derive_definition_features(node, class_methods, lines);
    expect(out).toEqual({
      definition_is_object_literal_method: false,
      accessor_kind: null,
    });
  });

  it("does NOT flag a standalone function (kind=function)", () => {
    const node = make_node({
      file_path: "src/f.ts",
      kind: "function",
      start_line: 1,
    });
    const lines = new Map<string, string[]>([
      ["src/f.ts", ["function foo() {", "  return 1;", "}"]],
    ]);
    const out = derive_definition_features(node, new Set(), lines);
    expect(out).toEqual({
      definition_is_object_literal_method: false,
      accessor_kind: null,
    });
  });

  it("captures accessor_kind for a class getter", () => {
    const node = make_node({
      file_path: "src/c.ts",
      symbol_id: "class_method",
      kind: "method",
      start_line: 2,
    });
    const lines = new Map<string, string[]>([
      ["src/c.ts", ["class C {", "  get name() { return this._n; }", "}"]],
    ]);
    const class_methods = new Set<SymbolId>([sym("class_method")]);
    const out = derive_definition_features(node, class_methods, lines);
    expect(out).toEqual({
      definition_is_object_literal_method: false,
      accessor_kind: "getter",
    });
  });

  it("captures accessor_kind for a class setter", () => {
    const node = make_node({
      file_path: "src/c.ts",
      symbol_id: "class_method",
      kind: "method",
      start_line: 2,
    });
    const lines = new Map<string, string[]>([
      ["src/c.ts", ["class C {", "  set name(v: string) { this._n = v; }", "}"]],
    ]);
    const class_methods = new Set<SymbolId>([sym("class_method")]);
    const out = derive_definition_features(node, class_methods, lines);
    expect(out).toEqual({
      definition_is_object_literal_method: false,
      accessor_kind: "setter",
    });
  });
});

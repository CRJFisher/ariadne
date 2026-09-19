import { describe, it, expect } from "vitest";
import type { IterationSource, SymbolName } from "@ariadnejs/types";
import type { SyntaxNode } from "tree-sitter";
import { parse_js, find_node_by_type } from "./test_utils";
import {
  extract_collection_source,
  extract_initializer_call,
  extract_initializer_call_arguments,
  extract_iteration_source,
  extract_read_source,
} from "./initializer_sources.javascript";

// ============================================================================

describe("extract_iteration_source", () => {
  /** The iteration source of the first identifier spelled `name` in `code`. */
  function iteration_source(code: string, name: string): IterationSource | undefined {
    const binding = parse_js(code)
      .descendantsOfType("identifier")
      .find((node) => node.text === name)!;
    return extract_iteration_source(binding);
  }

  it("binds each item a for…of loop iterates, through a name chain rooted at an identifier or `this`", () => {
    expect(iteration_source("for (const s of suites) {}", "s")).toEqual({
      container: ["suites"],
      yields: "item",
    });
    expect(iteration_source("for (const c of this._instances) {}", "c")).toEqual({
      container: ["this", "_instances"],
      yields: "item",
    });
  });

  it("binds a value when the loop iterates values(), and the value half of an entry pair it destructures", () => {
    expect(iteration_source("for (const c of m.values()) {}", "c")).toEqual({
      container: ["m"],
      yields: "value",
    });
    expect(iteration_source("for (const [id, c] of this._instances) {}", "c")).toEqual({
      container: ["this", "_instances"],
      yields: "entry_value",
    });
    expect(iteration_source("for (const [, c] of m.entries()) {}", "c")).toEqual({
      container: ["m"],
      yields: "entry_value",
    });
  });

  it("binds each item of an array pattern a declarator initialises from a container", () => {
    expect(iteration_source("const [first, second] = suites;", "second")).toEqual({
      container: ["suites"],
      yields: "item",
    });
  });

  it("has no source for a key, a for…in loop, an entries() item, or an iterable that is not a name chain", () => {
    expect(iteration_source("for (const [id, c] of m) {}", "id")).toEqual(undefined);
    expect(iteration_source("for (const k in obj) {}", "k")).toEqual(undefined);
    expect(iteration_source("for (const e of m.entries()) {}", "e")).toEqual(undefined);
    expect(iteration_source("for (const [k, v] of m.values()) {}", "v")).toEqual(undefined);
    expect(iteration_source("for (const x of make()) {}", "x")).toEqual(undefined);
    expect(iteration_source("for (const x of xs[0]) {}", "x")).toEqual(undefined);
  });
});

describe("extract_initializer_call_arguments", () => {
  function call_arguments(code: string): readonly (SymbolName | null)[] | undefined {
    const declarator = find_node_by_type(parse_js(code), "variable_declarator")!;
    return extract_initializer_call_arguments(declarator.childForFieldName("name")!);
  }

  it("reads the identifier arguments a call initialiser passes", () => {
    expect(call_arguments("const r = inject(Router)")).toEqual(["Router"]);
    expect(call_arguments("const p = make(Key, Value)")).toEqual(["Key", "Value"]);
  });

  it("holds a non-identifier argument's position open", () => {
    expect(call_arguments("const r = inject('token', Router)")).toEqual([null, "Router"]);
    expect(call_arguments("const r = inject(new Key(), Router)")).toEqual([null, "Router"]);
  });

  it("reads a construction's arguments, which type its parameters the same way", () => {
    expect(call_arguments("const r = new Holder(Router)")).toEqual(["Router"]);
  });

  it("reads an empty list for a call that passes nothing", () => {
    expect(call_arguments("const x = build()")).toEqual([]);
  });

  it("reads nothing for an initialiser that is not a call", () => {
    expect(call_arguments("const x = other")).toEqual(undefined);
    expect(call_arguments("const x = config['key']")).toEqual(undefined);
  });
});

describe("extract_initializer_call", () => {
  function initializer_call(code: string): readonly SymbolName[] | undefined {
    const declarator = find_node_by_type(parse_js(code), "variable_declarator")!;
    return extract_initializer_call(declarator.childForFieldName("name")!);
  }

  it("reads a plain call as a one-segment chain", () => {
    expect(initializer_call("const x = get_scope_boundary_extractor()")).toEqual([
      "get_scope_boundary_extractor",
    ]);
    expect(initializer_call("const r = inject(Router)")).toEqual(["inject"]);
  });

  it("reads a method call as its full callee chain", () => {
    expect(initializer_call("const i = s.getInfo()")).toEqual(["s", "getInfo"]);
    expect(initializer_call("const x = config.get('key')")).toEqual(["config", "get"]);
  });

  it("keeps `this` and a private name in the chain", () => {
    expect(initializer_call("const t = this.#tm.getTransaction()")).toEqual([
      "this",
      "#tm",
      "getTransaction",
    ]);
  });

  it("has no chain for a callee that is not a name chain", () => {
    expect(initializer_call("const p = make()()")).toBeUndefined();
    expect(initializer_call("const p = table[key]()")).toBeUndefined();
    expect(initializer_call("const p = super.make()")).toBeUndefined();
  });

  it("reads a construction as its constructor's name chain", () => {
    expect(initializer_call("const p = new cls(io)")).toEqual(["cls"]);
    expect(initializer_call("const u = new models.User()")).toEqual(["models", "User"]);
  });

  it("has no chain for an initialiser that is neither a call nor a construction", () => {
    expect(initializer_call("const x = 42")).toBeUndefined();
    expect(initializer_call("const x = Foo")).toBeUndefined();
    expect(initializer_call("const x = new (make())()")).toBeUndefined();
  });
});

// ============================================================================

describe("extract_collection_source", () => {
  it("should extract source from method call: config.get('key')", () => {
    const root = parse_js("const handler = config.get('key');");
    const declarator = find_node_by_type(root, "variable_declarator")!;
    const name_node = declarator.childForFieldName("name")!;
    const result = extract_collection_source(name_node);
    expect(result).toBe("config");
  });

  it("should extract source from subscript access: config['key']", () => {
    const root = parse_js("const handler = config['key'];");
    const declarator = find_node_by_type(root, "variable_declarator")!;
    const name_node = declarator.childForFieldName("name")!;
    const result = extract_collection_source(name_node);
    expect(result).toBe("config");
  });

  it("should return undefined for plain assignment: const x = 42", () => {
    const root = parse_js("const x = 42;");
    const declarator = find_node_by_type(root, "variable_declarator")!;
    const name_node = declarator.childForFieldName("name")!;
    const result = extract_collection_source(name_node);
    expect(result).toBeUndefined();
  });

  it("should return undefined for plain function call: const x = foo()", () => {
    const root = parse_js("const x = foo();");
    const declarator = find_node_by_type(root, "variable_declarator")!;
    const name_node = declarator.childForFieldName("name")!;
    const result = extract_collection_source(name_node);
    expect(result).toBeUndefined();
  });

  it("should return undefined for plain identifier initializer: const handler = someFunction", () => {
    const root = parse_js("const handler = someFunction;");
    const declaration = root.child(0)!;
    const declarator = declaration.namedChildren[0]!;
    const identifier = declarator.childForFieldName("name")!;

    const derived = extract_collection_source(identifier);
    expect(derived).toBeUndefined();
  });
});

// ============================================================================
// Collection Source Extraction
describe("extract_read_source", () => {
  /** The read source of the first identifier named `name` in `code`. */
  function read_source(code: string, name: string): ReturnType<typeof extract_read_source> {
    const find = (node: SyntaxNode): SyntaxNode | null =>
      (node.type === "identifier" || node.type === "property_identifier") && node.text === name
        ? node
        : node.children.reduce<SyntaxNode | null>((found, child) => found ?? find(child), null);
    return extract_read_source(find(parse_js(code))!);
  }

  it("reads the one name a declarator, a class field or a parameter default reads", () => {
    expect({
      declarator: read_source("const cls = Parser;", "cls"),
      field: read_source("class Feed { feed_type = DefaultFeed; }", "feed_type"),
      parameter: read_source("function trace(Info = TraceInfo) {}", "Info"),
    }).toEqual({
      declarator: { name_source: "Parser" },
      field: { name_source: "DefaultFeed" },
      parameter: { name_source: "TraceInfo" },
    });
  });

  it("reads the holder and member of a static member read: Ns.A", () => {
    expect({
      declarator: read_source("const alias = Ns.A;", "alias"),
      field: read_source("class Feed { feed_type = feedgenerator.DefaultFeed; }", "feed_type"),
      parameter: read_source("function trace(Info = trace.TraceInfo) {}", "Info"),
    }).toEqual({
      declarator: { member_source: { holder: "Ns", member: "A" } },
      field: { member_source: { holder: "feedgenerator", member: "DefaultFeed" } },
      parameter: { member_source: { holder: "trace", member: "TraceInfo" } },
    });
  });

  it("reads nothing from a get() retrieval, a subscript, a deeper chain, a call or an array-pattern default", () => {
    expect([
      read_source("const handler = config.get('key');", "handler"),
      read_source("const handler = config['key'];", "handler"),
      read_source("const handler = a.b.c;", "handler"),
      read_source("const p = make();", "p"),
      read_source("const [first = Fallback] = items;", "first"),
    ]).toEqual([{}, {}, {}, {}, {}]);
  });
});

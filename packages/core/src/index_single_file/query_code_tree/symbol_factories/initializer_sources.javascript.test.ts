import { describe, it, expect } from "vitest";
import type { SymbolName } from "@ariadnejs/types";
import { parse_js, find_node_by_type } from "./test_utils";
import {
  extract_collection_source,
  extract_initializer_call,
  extract_member_source,
} from "./initializer_sources.javascript";

// ============================================================================

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

  it("has no chain for an initialiser that is not a call", () => {
    expect(initializer_call("const x = 42")).toBeUndefined();
    expect(initializer_call("const x = new Foo()")).toBeUndefined();
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
describe("extract_member_source", () => {
  function member_source(code: string): ReturnType<typeof extract_member_source> {
    const declarator = find_node_by_type(parse_js(code), "variable_declarator")!;
    return extract_member_source(declarator.childForFieldName("name")!);
  }

  it("reads the holder and member of a static member alias: Ns.A", () => {
    expect(member_source("const alias = Ns.A;")).toEqual({ holder: "Ns", member: "A" });
  });

  it("has no member source for a get() retrieval, a subscript, or a deeper chain", () => {
    expect(member_source("const handler = config.get('key');")).toBeUndefined();
    expect(member_source("const handler = config['key'];")).toBeUndefined();
    expect(member_source("const handler = a.b.c;")).toBeUndefined();
  });
});

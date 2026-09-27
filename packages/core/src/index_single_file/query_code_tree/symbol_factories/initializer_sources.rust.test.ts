import { describe, it, expect } from "vitest";
import type { IterationSource } from "@ariadnejs/types";
import { parse_rust, find_node_by_type } from "./test_utils";
import {
  extract_collection_source,
  extract_iteration_source,
  extract_read_source,
} from "./initializer_sources.rust";

// ============================================================================

describe("extract_iteration_source", () => {
  /** The iteration source of the first identifier spelled `name` in `fn f() { <body> }`. */
  function iteration_source(body: string, name: string): IterationSource | undefined {
    const binding = parse_rust(`fn f() { ${body} }`)
      .descendantsOfType("identifier")
      .find((node) => node.text === name)!;
    return extract_iteration_source(binding);
  }

  it("binds each item a for loop iterates, by reference, through iter() or by value", () => {
    for (const body of ["for l in &layers {}", "for l in layers.iter() {}", "for l in layers {}"]) {
      expect(iteration_source(body, "l")).toEqual({ container: ["layers"], yields: "item" });
    }
    expect(iteration_source("for l in &self.layers {}", "l")).toEqual({
      container: ["self", "layers"],
      yields: "item",
    });
  });

  it("binds a value when the loop iterates values(), and the value half of an entry pair", () => {
    expect(iteration_source("for v in m.values() {}", "v")).toEqual({
      container: ["m"],
      yields: "value",
    });
    expect(iteration_source("for (k, v) in &m {}", "v")).toEqual({
      container: ["m"],
      yields: "entry_value",
    });
  });

  it("binds what iterating the counted iterator yields to the second name of an enumerate() pair", () => {
    expect(iteration_source("for (i, l) in layers.iter().enumerate() {}", "l")).toEqual({
      container: ["layers"],
      yields: "item",
    });
    expect(iteration_source("for (i, v) in self.named.values().enumerate() {}", "v")).toEqual({
      container: ["self", "named"],
      yields: "value",
    });
  });

  it("has no source for a key, an adapter it does not know, or an iterable that is not a name chain", () => {
    expect(iteration_source("for (k, v) in &m {}", "k")).toEqual(undefined);
    expect(iteration_source("for (i, l) in layers.iter().enumerate() {}", "i")).toEqual(undefined);
    expect(iteration_source("for (i, l) in layers.iter().rev() {}", "l")).toEqual(undefined);
    expect(iteration_source("for p in layers.iter().enumerate() {}", "p")).toEqual(undefined);
    expect(iteration_source("for l in make() {}", "l")).toEqual(undefined);
  });
});

describe("extract_collection_source", () => {
  it("extracts derived variable from method call", () => {
    const code = "let handler = config.get(\"key\");";
    const root = parse_rust(code);
    const let_decl = find_node_by_type(root, "let_declaration")!;
    const pattern = let_decl.childForFieldName("pattern")!;

    const derived = extract_collection_source(pattern);
    expect(derived).toBe("config");
  });

  it("extracts derived variable from index expression", () => {
    const code = "let handler = config[\"key\"];";
    const root = parse_rust(code);
    const let_decl = find_node_by_type(root, "let_declaration")!;
    const pattern = let_decl.childForFieldName("pattern")!;

    const derived = extract_collection_source(pattern);
    expect(derived).toBe("config");
  });

  it("returns undefined for plain assignment", () => {
    const code = "let handler = some_func;";
    const root = parse_rust(code);
    const let_decl = find_node_by_type(root, "let_declaration")!;
    const pattern = let_decl.childForFieldName("pattern")!;

    const derived = extract_collection_source(pattern);
    expect(derived).toBeUndefined();
  });
});

describe("extract_read_source", () => {
  function read_source_of(code: string) {
    const let_decl = find_node_by_type(parse_rust(code), "let_declaration")!;
    return extract_read_source(let_decl.childForFieldName("pattern")!);
  }

  it("reads the one name a `let` initialiser names, `self` included", () => {
    expect([
      read_source_of("fn f(&mut self) { let this = self; }"),
      read_source_of("let parser = base;"),
    ]).toEqual([{ name_source: "self" }, { name_source: "base" }]);
  });

  it("reads no name from a call, a reference or a path", () => {
    expect([
      read_source_of("fn f(&mut self) { let this = self.get_mut(); }"),
      read_source_of("fn f(&mut self) { let this = &mut *self; }"),
      read_source_of("let d = Foo::DEFAULT;"),
    ]).toEqual([{}, {}, {}]);
  });
});

describe("a `let` written without a value", () => {
  /** The first identifier spelled `name` in `fn f() { <body> }`: the `let`'s own name. */
  function declared(body: string, name: string) {
    return parse_rust(`fn f() { ${body} }`)
      .descendantsOfType("identifier")
      .find((node) => node.text === name)!;
  }

  it("names what every later assignment agrees on, and nothing they disagree on", () => {
    expect(extract_read_source(declared("let this; this = self;", "this"))).toEqual({ name_source: "self" });
    expect(extract_read_source(declared("let this; this = self; this = other;", "this"))).toEqual({});
    expect(extract_collection_source(declared("let h; h = config.get(k);", "h"))).toEqual("config");
  });
});

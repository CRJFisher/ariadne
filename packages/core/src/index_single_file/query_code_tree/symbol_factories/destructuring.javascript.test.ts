import { describe, it, expect } from "vitest";
import type { SyntaxNode } from "tree-sitter";
import { parse_js, find_node_by_type } from "./test_utils";
import { extract_destructured_binding } from "./destructuring.javascript";

/** The node the `.scm` captures for a shorthand destructured binding. */
function shorthand_binding(code: string): SyntaxNode {
  const node = find_node_by_type(parse_js(code), "shorthand_property_identifier_pattern");
  if (!node) throw new Error(`no shorthand binding in: ${code}`);
  return node;
}

/** The node the `.scm` captures for a renamed destructured binding. */
function pair_value_binding(code: string): SyntaxNode {
  const pair = find_node_by_type(parse_js(code), "pair_pattern");
  const value = pair?.childForFieldName("value");
  if (!value) throw new Error(`no pair-pattern value in: ${code}`);
  return value;
}

describe("extract_destructured_binding", () => {
  it("names the source identifier and the property key of a shorthand object pattern", () => {
    expect(
      extract_destructured_binding(shorthand_binding("const { storage } = options;"))
    ).toEqual({ source: "options", key: "storage" });
  });

  it("takes the key from the pair when the binding is renamed", () => {
    expect(
      extract_destructured_binding(pair_value_binding("const { storage: s } = options;"))
    ).toEqual({ source: "options", key: "storage" });
  });

  it("returns undefined for the key half of a renamed binding", () => {
    const pair = find_node_by_type(parse_js("const { storage: s } = options;"), "pair_pattern");
    const key = pair?.childForFieldName("key");
    expect(extract_destructured_binding(key!)).toBeUndefined();
  });

  it("returns undefined for a nested object pattern", () => {
    const inner = find_node_by_type(
      parse_js("const { inner: { storage } } = options;"),
      "shorthand_property_identifier_pattern"
    );
    expect(extract_destructured_binding(inner!)).toBeUndefined();
  });

  it("returns undefined for an array-pattern element", () => {
    const element = find_node_by_type(parse_js("const [first] = xs;"), "identifier");
    expect(extract_destructured_binding(element!)).toBeUndefined();
  });

  it("returns undefined for a rest binding", () => {
    const rest = find_node_by_type(parse_js("const { a, ...rest } = options;"), "rest_pattern");
    const rest_identifier = rest?.child(1);
    expect(extract_destructured_binding(rest_identifier!)).toBeUndefined();
  });

  it("returns undefined when the initializer is a call", () => {
    expect(
      extract_destructured_binding(shorthand_binding("const { storage } = make();"))
    ).toBeUndefined();
  });

  it("returns undefined when the initializer is a member expression", () => {
    expect(
      extract_destructured_binding(shorthand_binding("const { storage } = this.opts;"))
    ).toBeUndefined();
  });

  it("returns undefined for a destructured parameter", () => {
    expect(
      extract_destructured_binding(shorthand_binding("function f({ storage }) {}"))
    ).toBeUndefined();
  });

  it("returns undefined for a destructured for-of head", () => {
    expect(
      extract_destructured_binding(shorthand_binding("for (const { z } of items) {}"))
    ).toBeUndefined();
  });

  it("returns undefined for a destructuring assignment outside a declaration", () => {
    expect(
      extract_destructured_binding(shorthand_binding("({ storage } = options);"))
    ).toBeUndefined();
  });

  it("returns undefined for a plain declarator name", () => {
    const name = find_node_by_type(parse_js("const storage = options;"), "identifier");
    expect(extract_destructured_binding(name!)).toBeUndefined();
  });
});

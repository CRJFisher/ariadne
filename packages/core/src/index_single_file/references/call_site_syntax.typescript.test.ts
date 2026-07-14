import { describe, it, expect, test, beforeAll } from "vitest";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { SyntaxNode } from "tree-sitter";
import { extract_call_site_syntax_typescript } from "./call_site_syntax.typescript";
import { find_first_call } from "./call_site_syntax.test";

describe("extract_call_site_syntax_typescript", () => {
  let ts_parser: Parser;

  beforeAll(() => {
    ts_parser = new Parser();
    ts_parser.setLanguage(TypeScript.typescript);
  });

  function parse_ts_call(code: string): SyntaxNode {
    const tree = ts_parser.parse(code);
    const call = find_first_call(tree.rootNode, "call_expression");
    if (!call) throw new Error(`No call_expression in: ${code}`);
    return call;
  }

  describe("receiver_kind (all 8 variants)", () => {
    const cases: Array<{
      code: string;
      expected_kind: string;
    }> = [
      { code: "obj.m()", expected_kind: "identifier" },
      { code: "this.m()", expected_kind: "self_keyword" },
      { code: "super.m()", expected_kind: "self_keyword" },
      { code: "a.b.m()", expected_kind: "member_expression" },
      { code: "foo().m()", expected_kind: "call_chain" },
      { code: "arr[k].m()", expected_kind: "index_access" },
      { code: "(x as T).m()", expected_kind: "type_cast" },
      { code: "(x satisfies T).m()", expected_kind: "type_cast" },
      { code: "((x as T)).m()", expected_kind: "type_cast" },
      { code: "(((x as T))).m()", expected_kind: "type_cast" },
      { code: "(expr).m()", expected_kind: "parenthesized" },
      { code: "x!.m()", expected_kind: "non_null_assertion" },
      { code: "new Foo().m()", expected_kind: "call_chain" },
    ];

    test.each(cases)("$code → $expected_kind", ({ code, expected_kind }) => {
      const node = parse_ts_call(code);
      const syntax = extract_call_site_syntax_typescript(node);
      expect(syntax?.receiver_kind).toBe(expected_kind);
    });
  });

  describe("receiver_call_target_lexical_shape", () => {
    const cases: Array<{
      code: string;
      expected_hint: "class_like" | "function_like" | "unknown";
    }> = [
      { code: "SubClass().m()", expected_hint: "class_like" },
      { code: "foo().m()", expected_hint: "function_like" },
      { code: "(a + b)().m()", expected_hint: "unknown" },
      { code: "new Foo().m()", expected_hint: "class_like" },
    ];

    test.each(cases)("$code → $expected_hint", ({ code, expected_hint }) => {
      const node = parse_ts_call(code);
      const syntax = extract_call_site_syntax_typescript(node);
      expect(syntax?.receiver_kind).toBe("call_chain");
      expect(syntax?.receiver_call_target_lexical_shape).toBe(expected_hint);
    });
  });

  describe("index_key_is_literal", () => {
    const cases: Array<{
      code: string;
      expected_literal: boolean;
    }> = [
      { code: "arr[\"k\"].m()", expected_literal: true },
      { code: "arr[0].m()", expected_literal: true },
      { code: "arr[k].m()", expected_literal: false },
    ];

    test.each(cases)(
      "$code → literal=$expected_literal",
      ({ code, expected_literal }) => {
        const node = parse_ts_call(code);
        const syntax = extract_call_site_syntax_typescript(node);
        expect(syntax?.receiver_kind).toBe("index_access");
        expect(syntax?.index_key_is_literal).toBe(expected_literal);
      }
    );
  });

  describe("discriminator absence on non-applicable receiver kinds", () => {
    it("omits receiver_call_target_lexical_shape when receiver_kind !== call_chain", () => {
      const node = parse_ts_call("obj.m()");
      const syntax = extract_call_site_syntax_typescript(node);
      expect(syntax).toEqual({ receiver_kind: "identifier" });
    });

    it("omits index_key_is_literal when receiver_kind !== index_access", () => {
      const node = parse_ts_call("a.b.m()");
      const syntax = extract_call_site_syntax_typescript(node);
      expect(syntax).toEqual({ receiver_kind: "member_expression" });
    });
  });

  describe("non-method call nodes", () => {
    it("returns undefined for a plain function call", () => {
      const node = parse_ts_call("foo()");
      const syntax = extract_call_site_syntax_typescript(node);
      expect(syntax).toBeUndefined();
    });
  });
});

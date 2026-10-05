import { describe, it, expect, test, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { SyntaxNode } from "tree-sitter";
import { extract_call_site_syntax_python } from "./call_site_syntax.python";
import { find_first_call } from "./call_site_syntax.test";

describe("extract_call_site_syntax_python", () => {
  let py_parser: Parser;

  beforeAll(() => {
    py_parser = new Parser();
    py_parser.setLanguage(Python);
  });

  function parse_py_call(code: string): SyntaxNode {
    const tree = py_parser.parse(code);
    const call = find_first_call(tree.rootNode, "call");
    if (!call) throw new Error(`No call in: ${code}`);
    return call;
  }

  describe("receiver_kind (6 variants, no type_cast / non_null_assertion)", () => {
    const cases: Array<{
      code: string;
      expected_kind: string;
    }> = [
      { code: "obj.m()", expected_kind: "identifier" },
      { code: "self.m()", expected_kind: "self_keyword" },
      { code: "cls.m()", expected_kind: "self_keyword" },
      { code: "super().m()", expected_kind: "self_keyword" },
      { code: "a.b.m()", expected_kind: "member_expression" },
      { code: "foo().m()", expected_kind: "call_chain" },
      { code: "arr[k].m()", expected_kind: "index_access" },
      { code: "(expr).m()", expected_kind: "parenthesized" },
    ];

    test.each(cases)("$code → $expected_kind", ({ code, expected_kind }) => {
      const node = parse_py_call(code);
      const syntax = extract_call_site_syntax_python(node);
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
    ];

    test.each(cases)("$code → $expected_hint", ({ code, expected_hint }) => {
      const node = parse_py_call(code);
      const syntax = extract_call_site_syntax_python(node);
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
        const node = parse_py_call(code);
        const syntax = extract_call_site_syntax_python(node);
        expect(syntax?.receiver_kind).toBe("index_access");
        expect(syntax?.index_key_is_literal).toBe(expected_literal);
      }
    );
  });

  describe("non-method call nodes", () => {
    it("returns undefined for a plain function call", () => {
      const node = parse_py_call("foo()");
      const syntax = extract_call_site_syntax_python(node);
      expect(syntax).toBeUndefined();
    });
  });
});

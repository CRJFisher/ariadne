import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import { LANGUAGE_TO_TREESITTER_LANG } from "../query_code_tree/parsers";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type { SyntaxNode } from "tree-sitter";
import { extract_call_site_syntax } from "./call_site_syntax";

/**
 * Find the first call node (call_expression in TS/Rust, call in Python) under
 * a root. Shared by the language-leaf test files.
 */
export function find_first_call(
  root: SyntaxNode,
  call_type: string
): SyntaxNode | undefined {
  if (root.type === call_type) return root;
  for (let i = 0; i < root.namedChildCount; i++) {
    const child = root.namedChild(i);
    if (!child) continue;
    const hit = find_first_call(child, call_type);
    if (hit) return hit;
  }
  return undefined;
}

describe("extract_call_site_syntax language dispatch", () => {
  let ts_parser: Parser;
  let py_parser: Parser;
  let rust_parser: Parser;

  beforeAll(() => {
    ts_parser = new Parser();
    ts_parser.setLanguage(LANGUAGE_TO_TREESITTER_LANG.get("typescript")!);
    py_parser = new Parser();
    py_parser.setLanguage(Python);
    rust_parser = new Parser();
    rust_parser.setLanguage(Rust);
  });

  function parse_call(parser: Parser, code: string, call_type: string): SyntaxNode {
    const tree = parser.parse(code);
    const call = find_first_call(tree.rootNode, call_type);
    if (!call) throw new Error(`No ${call_type} in: ${code}`);
    return call;
  }

  it("routes typescript to the TS leaf", () => {
    const node = parse_call(ts_parser, "this.m()", "call_expression");
    expect(extract_call_site_syntax(node, "typescript")).toEqual({
      receiver_kind: "self_keyword",
    });
  });

  it("routes javascript to the TS leaf (shared grammar)", () => {
    const node = parse_call(ts_parser, "a.b.m()", "call_expression");
    expect(extract_call_site_syntax(node, "javascript")).toEqual({
      receiver_kind: "member_expression",
    });
  });

  it("routes python to the Python leaf", () => {
    const node = parse_call(py_parser, "self.m()", "call");
    expect(extract_call_site_syntax(node, "python")).toEqual({
      receiver_kind: "self_keyword",
    });
  });

  it("yields undefined for rust (no call-site syntax extraction)", () => {
    const node = parse_call(rust_parser, "fn f() { obj.m(); }", "call_expression");
    expect(extract_call_site_syntax(node, "rust")).toBeUndefined();
  });
});

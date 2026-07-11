import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import type { SyntaxNode } from "tree-sitter";
import type { CallbackContext, FilePath } from "@ariadnejs/types";
import { detect_callback_context } from "./callback.rust";

const file_path = "/test.rs" as FilePath;

function parse_rust(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(Rust);
  return parser.parse(code).rootNode;
}

function find_closure(root: SyntaxNode): SyntaxNode {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "closure_expression") return node;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  }
  const closure = visit(root);
  if (!closure) throw new Error("no closure_expression in parsed source");
  return closure;
}

const no_callback: CallbackContext = {
  is_callback: false,
  receiver_is_external: null,
  receiver_location: null,
};

describe("detect_callback_context", () => {
  it("returns the enclosing call context for a closure passed directly as an argument", () => {
    const root = parse_rust("fn main() { process(|x| x + 1); }");
    const result = detect_callback_context(find_closure(root), file_path);

    expect(result).toEqual({
      is_callback: true,
      receiver_is_external: null,
      receiver_location: {
        file_path,
        start_line: 1,
        start_column: 13,
        end_line: 1,
        end_column: 30,
      },
    });
  });

  it("captures the receiving call expression for a closure inside a method chain", () => {
    const root = parse_rust(
      "fn main() { items.iter().map(|x| x * 2).collect::<Vec<_>>(); }"
    );
    const result = detect_callback_context(find_closure(root), file_path);

    expect(result).toEqual({
      is_callback: true,
      receiver_is_external: null,
      receiver_location: {
        file_path,
        start_line: 1,
        start_column: 13,
        end_line: 1,
        end_column: 39,
      },
    });
  });

  it("returns the no-callback context for a closure bound to a variable", () => {
    const root = parse_rust("fn main() { let f = |x| x + 1; }");
    const result = detect_callback_context(find_closure(root), file_path);

    expect(result).toEqual(no_callback);
  });

  it("returns the no-callback context for a closure at file root with no enclosing call", () => {
    const root = parse_rust("let g = |x| x + 1;");
    const result = detect_callback_context(find_closure(root), file_path);

    expect(result).toEqual(no_callback);
  });

  it("returns the no-callback context for a closure inside a non-call bracketed node", () => {
    const root = parse_rust("fn main() { let arr = [|x| x + 1]; }");
    const result = detect_callback_context(find_closure(root), file_path);

    expect(result).toEqual(no_callback);
  });

  it("detects a closure nested within MAX_DEPTH ancestors of a call", () => {
    const root = parse_rust("fn main() { call(((((|x| x))))); }");
    const result = detect_callback_context(find_closure(root), file_path);

    expect(result).toEqual({
      is_callback: true,
      receiver_is_external: null,
      receiver_location: {
        file_path,
        start_line: 1,
        start_column: 13,
        end_line: 1,
        end_column: 31,
      },
    });
  });

  it("does not detect a closure nested beyond MAX_DEPTH ancestors of a call", () => {
    const root = parse_rust("fn main() { call((((((|x| x)))))); }");
    const result = detect_callback_context(find_closure(root), file_path);

    expect(result).toEqual(no_callback);
  });
});

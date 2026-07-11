import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import { RustScopeBoundaryExtractor } from "./rust_scope_boundary_extractor";
import type { FilePath } from "@ariadnejs/types";

const FILE = "test.rs" as FilePath;

function find_by_type(
  node: Parser.SyntaxNode,
  type: string
): Parser.SyntaxNode | null {
  if (node.type === type) return node;
  for (let i = 0; i < node.childCount; i++) {
    const found = find_by_type(node.child(i)!, type);
    if (found) return found;
  }
  return null;
}

describe("RustScopeBoundaryExtractor", () => {
  let parser: Parser;
  let extractor: RustScopeBoundaryExtractor;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
    extractor = new RustScopeBoundaryExtractor();
  });

  // The scope query captures class-family scopes on the body node, which has no
  // name field, so symbol and scope both resolve to the body node's location.
  describe("class-family body scopes", () => {
    it("maps a struct field_declaration_list body to a single scope location", () => {
      const code = "struct Point {\n    x: f64,\n    y: f64,\n}";
      const body = parser
        .parse(code)
        .rootNode.firstChild!.childForFieldName("body")!;
      expect(body.type).toBe("field_declaration_list");

      const boundaries = extractor.extract_boundaries(body, "class", FILE);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 14,
          end_line: 4,
          end_column: 1,
        },
        scope_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 14,
          end_line: 4,
          end_column: 1,
        },
      });
    });

    it("maps an enum enum_variant_list body to a single scope location", () => {
      const code = "enum Color {\n    Red,\n    Green,\n}";
      const body = parser
        .parse(code)
        .rootNode.firstChild!.childForFieldName("body")!;
      expect(body.type).toBe("enum_variant_list");

      const boundaries = extractor.extract_boundaries(body, "class", FILE);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 12,
          end_line: 4,
          end_column: 1,
        },
        scope_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 12,
          end_line: 4,
          end_column: 1,
        },
      });
    });

    it("maps a trait declaration_list body to a single scope location", () => {
      const code = "trait Drawable {\n    fn draw(&self);\n}";
      const body = parser
        .parse(code)
        .rootNode.firstChild!.childForFieldName("body")!;
      expect(body.type).toBe("declaration_list");

      const boundaries = extractor.extract_boundaries(body, "class", FILE);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 16,
          end_line: 3,
          end_column: 1,
        },
        scope_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 16,
          end_line: 3,
          end_column: 1,
        },
      });
    });
  });

  // Impl bodies are captured as `block` scopes, so they route through the base
  // block handling rather than the class override.
  describe("impl body block scope", () => {
    it("maps an impl declaration_list body to a single scope location", () => {
      const code = "impl Point {\n    fn new() -> Self { Self }\n}";
      const body = parser
        .parse(code)
        .rootNode.firstChild!.childForFieldName("body")!;
      expect(body.type).toBe("declaration_list");

      const boundaries = extractor.extract_boundaries(body, "block", FILE);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 12,
          end_line: 3,
          end_column: 1,
        },
        scope_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 12,
          end_line: 3,
          end_column: 1,
        },
      });
    });
  });

  describe("module scopes", () => {
    it("collapses the root source_file to a single location so the processor drops it", () => {
      const root = parser.parse("fn main() {}").rootNode;
      expect(root.type).toBe("source_file");

      const boundaries = extractor.extract_boundaries(root, "module", FILE);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 1,
          end_line: 1,
          end_column: 12,
        },
        scope_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 1,
          end_line: 1,
          end_column: 12,
        },
      });
    });

    it("splits an inline mod into its name symbol and its body scope", () => {
      const code = "mod utils {\n    fn helper() {}\n}";
      const mod = parser.parse(code).rootNode.firstChild!;
      expect(mod.type).toBe("mod_item");

      const boundaries = extractor.extract_boundaries(mod, "module", FILE);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 5,
          end_line: 1,
          end_column: 9,
        },
        scope_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 11,
          end_line: 3,
          end_column: 1,
        },
      });
    });
  });

  describe("function scopes", () => {
    it("splits a function into its name symbol and a parameters-to-body scope", () => {
      const code = "fn calculate(x: i32, y: i32) -> i32 {\n    x + y\n}";
      const func = parser.parse(code).rootNode.firstChild!;
      expect(func.type).toBe("function_item");

      const boundaries = extractor.extract_boundaries(func, "function", FILE);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 4,
          end_line: 1,
          end_column: 12,
        },
        scope_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 13,
          end_line: 3,
          end_column: 1,
        },
      });
    });

    it("uses the parameter list as the symbol for an anonymous closure", () => {
      const code = "fn main() { let f = |x: i32| x + 1; }";
      const closure = find_by_type(
        parser.parse(code).rootNode,
        "closure_expression"
      )!;

      const boundaries = extractor.extract_boundaries(closure, "function", FILE);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 21,
          end_line: 1,
          end_column: 28,
        },
        scope_location: {
          file_path: "test.rs",
          start_line: 1,
          start_column: 21,
          end_line: 1,
          end_column: 34,
        },
      });
    });
  });

  describe("block scopes", () => {
    it("maps an if_expression to a single scope location", () => {
      const code = "fn foo() {\n    if true {\n        let x = 1;\n    }\n}";
      const if_node = find_by_type(
        parser.parse(code).rootNode,
        "if_expression"
      )!;

      const boundaries = extractor.extract_boundaries(if_node, "block", FILE);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.rs",
          start_line: 2,
          start_column: 5,
          end_line: 4,
          end_column: 5,
        },
        scope_location: {
          file_path: "test.rs",
          start_line: 2,
          start_column: 5,
          end_line: 4,
          end_column: 5,
        },
      });
    });

    it("maps a match_arm to a single scope location", () => {
      const code = "fn foo() {\n    match x {\n        1 => bar(),\n        _ => baz(),\n    }\n}";
      const arm = find_by_type(parser.parse(code).rootNode, "match_arm")!;

      const boundaries = extractor.extract_boundaries(arm, "block", FILE);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.rs",
          start_line: 3,
          start_column: 9,
          end_line: 3,
          end_column: 19,
        },
        scope_location: {
          file_path: "test.rs",
          start_line: 3,
          start_column: 9,
          end_line: 3,
          end_column: 19,
        },
      });
    });

    it("maps an unsafe_block to a single scope location", () => {
      const code = "fn foo() {\n    unsafe {\n        let x = 1;\n    }\n}";
      const unsafe = find_by_type(
        parser.parse(code).rootNode,
        "unsafe_block"
      )!;

      const boundaries = extractor.extract_boundaries(unsafe, "block", FILE);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.rs",
          start_line: 2,
          start_column: 5,
          end_line: 4,
          end_column: 5,
        },
        scope_location: {
          file_path: "test.rs",
          start_line: 2,
          start_column: 5,
          end_line: 4,
          end_column: 5,
        },
      });
    });
  });
});

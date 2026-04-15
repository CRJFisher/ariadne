import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import { RustScopeBoundaryExtractor } from "./rust_scope_boundary_extractor";
import type { FilePath } from "@ariadnejs/types";

describe("RustScopeBoundaryExtractor", () => {
  let parser: Parser;
  let extractor: RustScopeBoundaryExtractor;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
    extractor = new RustScopeBoundaryExtractor();
  });

  describe("Struct boundaries", () => {
    it("should extract struct name and body boundaries", () => {
      const code = `struct Point {
    x: f64,
    y: f64,
}`;
      const tree = parser.parse(code);
      const struct_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        struct_node,
        "class",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 8,
        end_line: 1,
        end_column: 12,
      });

      expect(boundaries.scope_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 14,
        end_line: 4,
        end_column: 1,
      });
    });

    it("should handle unit struct (no body)", () => {
      const code = "struct Unit;";
      const tree = parser.parse(code);
      const struct_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        struct_node,
        "class",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual(boundaries.scope_location);
    });

    it("should handle tuple struct", () => {
      const code = "struct Pair(i32, i32);";
      const tree = parser.parse(code);
      const struct_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        struct_node,
        "class",
        "test.rs" as FilePath
      );

      // Tuple struct has an ordered_field_declaration_list body
      expect(boundaries.symbol_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 8,
        end_line: 1,
        end_column: 11,
      });

      expect(boundaries.scope_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 12,
        end_line: 1,
        end_column: 21,
      });
    });
  });

  describe("Enum boundaries", () => {
    it("should extract enum name and body boundaries", () => {
      const code = `enum Color {
    Red,
    Green,
    Blue,
}`;
      const tree = parser.parse(code);
      const enum_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        enum_node,
        "class",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 6,
        end_line: 1,
        end_column: 10,
      });

      expect(boundaries.scope_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 12,
        end_line: 5,
        end_column: 1,
      });
    });
  });

  describe("Trait boundaries", () => {
    it("should extract trait name and body boundaries", () => {
      const code = `trait Drawable {
    fn draw(&self);
}`;
      const tree = parser.parse(code);
      const trait_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        trait_node,
        "class",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 7,
        end_line: 1,
        end_column: 14,
      });

      expect(boundaries.scope_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 16,
        end_line: 3,
        end_column: 1,
      });
    });
  });

  describe("Impl boundaries", () => {
    it("should extract impl type and body boundaries", () => {
      const code = `impl Point {
    fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
}`;
      const tree = parser.parse(code);
      const impl_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        impl_node,
        "class",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 6,
        end_line: 1,
        end_column: 10,
      });

      expect(boundaries.scope_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 12,
        end_line: 5,
        end_column: 1,
      });
    });

    it("should extract trait impl boundaries with type field pointing to implementing type", () => {
      const code = `impl Display for Point {
    fn fmt(&self, f: &mut Formatter) -> Result {
        write!(f, "({}, {})", self.x, self.y)
    }
}`;
      const tree = parser.parse(code);
      const impl_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        impl_node,
        "class",
        "test.rs" as FilePath
      );

      // Symbol is "Point" (the implementing type), not "Display" (the trait)
      expect(boundaries.symbol_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 18,
        end_line: 1,
        end_column: 22,
      });

      expect(boundaries.scope_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 24,
        end_line: 5,
        end_column: 1,
      });
    });
  });

  describe("Module boundaries", () => {
    it("should handle root source_file node", () => {
      const code = "fn main() {}";
      const tree = parser.parse(code);
      const root_node = tree.rootNode;

      const boundaries = extractor.extract_boundaries(
        root_node,
        "module",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual(boundaries.scope_location);
      expect(boundaries.scope_location.start_line).toBe(1);
    });

    it("should handle inline mod declaration", () => {
      const code = `mod utils {
    fn helper() {}
}`;
      const tree = parser.parse(code);
      const mod_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        mod_node,
        "module",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 5,
        end_line: 1,
        end_column: 9,
      });

      expect(boundaries.scope_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 11,
        end_line: 3,
        end_column: 1,
      });
    });

    it("should handle external mod declaration (no body)", () => {
      const code = "mod external;";
      const tree = parser.parse(code);
      const mod_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        mod_node,
        "module",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual(boundaries.scope_location);
    });
  });

  describe("Field and variant list boundaries", () => {
    it("should handle field_declaration_list", () => {
      const code = `struct Foo {
    x: i32,
}`;
      const tree = parser.parse(code);
      const struct_node = tree.rootNode.firstChild!;
      const field_list = struct_node.childForFieldName("body")!;
      expect(field_list.type).toBe("field_declaration_list");

      const boundaries = extractor.extract_boundaries(
        field_list,
        "class",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual(boundaries.scope_location);
    });

    it("should handle enum_variant_list", () => {
      const code = `enum Dir {
    Up,
    Down,
}`;
      const tree = parser.parse(code);
      const enum_node = tree.rootNode.firstChild!;
      const variant_list = enum_node.childForFieldName("body")!;
      expect(variant_list.type).toBe("enum_variant_list");

      const boundaries = extractor.extract_boundaries(
        variant_list,
        "class",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual(boundaries.scope_location);
    });

    it("should handle declaration_list from trait", () => {
      const code = `trait Foo {
    fn bar(&self);
}`;
      const tree = parser.parse(code);
      const trait_node = tree.rootNode.firstChild!;
      const decl_list = trait_node.childForFieldName("body")!;
      expect(decl_list.type).toBe("declaration_list");

      const boundaries = extractor.extract_boundaries(
        decl_list,
        "class",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual(boundaries.scope_location);
    });
  });

  describe("Function boundaries", () => {
    it("should extract function name and scope boundaries", () => {
      const code = `fn calculate(x: i32, y: i32) -> i32 {
    x + y
}`;
      const tree = parser.parse(code);
      const func_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        func_node,
        "function",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 4,
        end_line: 1,
        end_column: 12,
      });

      expect(boundaries.scope_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 13,
        end_line: 3,
        end_column: 1,
      });
    });

    it("should extract closure boundaries", () => {
      const code = "fn main() { let f = |x: i32| x + 1; }";
      const tree = parser.parse(code);

      function find_by_type(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const found = find_by_type(node.child(i)!, type);
          if (found) return found;
        }
        return null;
      }

      const closure = find_by_type(tree.rootNode, "closure_expression")!;
      expect(closure).not.toBeNull();

      const boundaries = extractor.extract_boundaries(
        closure,
        "function",
        "test.rs" as FilePath
      );

      // Closures are anonymous: symbol_location falls back to parameters
      expect(boundaries.symbol_location).toEqual({
        file_path: "test.rs",
        start_line: 1,
        start_column: 21,
        end_line: 1,
        end_column: 28,
      });

      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_column).toBe(21);
    });
  });

  describe("Block boundaries", () => {
    it("should extract block scope for if statement", () => {
      const code = `fn foo() {
    if true {
        let x = 1;
    }
}`;
      const tree = parser.parse(code);
      const func_node = tree.rootNode.firstChild!;
      const body = func_node.childForFieldName("body")!;
      const if_node = body.firstNamedChild!;

      const boundaries = extractor.extract_boundaries(
        if_node,
        "block",
        "test.rs" as FilePath
      );

      expect(boundaries.symbol_location).toEqual(boundaries.scope_location);
    });
  });
});

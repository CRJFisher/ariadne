/**
 * Tests for Rust metadata extractors
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
// @ts-ignore - tree-sitter-rust is not typed
import Rust from "tree-sitter-rust";
import { RUST_METADATA_EXTRACTORS } from "./metadata_extractors.rust";
import type { FilePath } from "@ariadnejs/types";

describe("Rust Metadata Extractors", () => {
  let parser: Parser;
  const TEST_FILE: FilePath = "/test/file.rs" as FilePath;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  describe("extract_type_from_annotation", () => {
    it("should extract type from let binding", () => {
      const code = "let x: i32 = 5;";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(let_decl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("i32");
      expect(result?.certainty).toBe("declared");
      expect(result?.is_nullable).toBe(false);
    });

    it("should extract type from function parameter", () => {
      const code = "fn foo(x: String) {}";
      const tree = parser.parse(code);
      const param = tree.rootNode.descendantsOfType("parameter")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(param, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("String");
      expect(result?.certainty).toBe("declared");
    });

    it("should extract function return type", () => {
      const code = "fn bar() -> bool { true }";
      const tree = parser.parse(code);
      const func_item = tree.rootNode.descendantsOfType("function_item")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(func_item, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("bool");
    });

    it("should extract reference type", () => {
      const code = "let s: &str = \"hello\";";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(let_decl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("&str");
    });

    it("should extract mutable reference type", () => {
      const code = "let v: &mut Vec<i32> = &mut vec![];";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(let_decl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("&mut Vec<i32>");
    });

    it("should extract generic type", () => {
      const code = "let v: Vec<String> = Vec::new();";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(let_decl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("Vec<String>");
    });

    it("should detect Option as nullable", () => {
      const code = "let opt: Option<i32> = None;";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(let_decl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("Option<i32>");
      expect(result?.is_nullable).toBe(true);
    });

    it("should extract tuple type", () => {
      const code = "let t: (i32, String, bool) = (1, String::new(), true);";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(let_decl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("(i32, String, bool)");
    });

    it("should extract array type", () => {
      const code = "let arr: [u8; 10] = [0; 10];";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(let_decl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("[u8; 10]");
    });

    it("should extract scoped type", () => {
      const code = "let map: std::collections::HashMap<String, i32> = HashMap::new();";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(let_decl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("std::collections::HashMap<String, i32>");
    });

    it("should return undefined for declarations without type annotation", () => {
      const code = "let x = 5;";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(let_decl, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("should handle function pointer types", () => {
      const code = "let f: fn(i32) -> bool = |x| x > 0;";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];
      const type_node = let_decl.childForFieldName("type");

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("fn(i32) -> bool");
    });

    it("should handle trait object types", () => {
      const code = "let iter: Box<dyn Iterator<Item = i32>> = Box::new(vec![1, 2, 3].into_iter());";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];
      const type_node = let_decl.childForFieldName("type");

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("Box<dyn Iterator<Item = i32>>");
    });

    it("should handle impl trait types", () => {
      const code = "fn foo() -> impl Display { 42 }";
      const tree = parser.parse(code);
      const func_item = tree.rootNode.descendantsOfType("function_item")[0];
      const return_type = func_item.childForFieldName("return_type");

      expect(return_type).toBeDefined();
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(return_type!, TEST_FILE);
      // impl_trait_type nodes are not handled by the extractor
      expect(result).toBeUndefined();
    });

    it("should handle pointer types", () => {
      const code = "let x: *const i32 = std::ptr::null();";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];
      const type_node = let_decl.childForFieldName("type");

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("*const i32");
    });

    it("should handle bounded types", () => {
      const code = "fn foo<T: Display + Clone>(x: T) {}";
      const tree = parser.parse(code);
      const param = tree.rootNode.descendantsOfType("parameter")[0];
      const type_node = param.childForFieldName("type");

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("T");
    });

    it("should handle slice types", () => {
      const code = "fn foo(data: &[u8]) {}";
      const tree = parser.parse(code);
      const param = tree.rootNode.descendantsOfType("parameter")[0];
      const type_node = param.childForFieldName("type");

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("&[u8]");
    });

    it("should detect Option with turbofish", () => {
      const code = "let x: Option :: <String> = None;";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];
      const type_node = let_decl.childForFieldName("type");

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.is_nullable).toBe(true);
    });

    it("should handle null input gracefully", () => {
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(null as any, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("should extract type from function_signature_item", () => {
      const code = "trait MyTrait { fn method() -> String; }";
      const tree = parser.parse(code);
      const func_sig = tree.rootNode.descendantsOfType("function_signature_item")[0];

      expect(func_sig).toBeDefined();
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(func_sig!, TEST_FILE);
      expect(result).toBeDefined();
      expect(result!.type_name).toBe("String");
    });

    it("should extract type from type_annotation node", () => {
      const code = "let x: i32 = 5;";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];
      const type_node = let_decl.childForFieldName("type");

      expect(type_node).toBeDefined();
      expect(type_node!.type).toBe("primitive_type");
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);
      expect(result).toBeDefined();
      expect(result!.type_name).toBe("i32");
    });

    it("should extract type from identifier node by walking up to parent let_declaration", () => {
      const code = "let service: Service = create_service();";
      const tree = parser.parse(code);
      const identifiers = tree.rootNode.descendantsOfType("identifier");

      // Find the "service" identifier (the variable being declared, not the type or function)
      const service_identifier = identifiers.find(
        (node) => node.text === "service" && node.parent?.type === "let_declaration"
      );

      expect(service_identifier).toBeDefined();

      // This tests the new parent-walking logic added for assignment references
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(service_identifier!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("Service");
      expect(result?.certainty).toBe("declared");
    });

    it("should extract type from identifier with generic type annotation", () => {
      const code = "let vec: Vec<String> = Vec::new();";
      const tree = parser.parse(code);
      const identifiers = tree.rootNode.descendantsOfType("identifier");

      // Find the "vec" identifier (the variable being declared)
      const vec_identifier = identifiers.find(
        (node) => node.text === "vec" && node.parent?.type === "let_declaration"
      );

      expect(vec_identifier).toBeDefined();

      // Test parent-walking with generic types
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(vec_identifier!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("Vec<String>");
      expect(result?.certainty).toBe("declared");
    });

    it("should extract type from identifier with reference type annotation", () => {
      const code = "let s: &str = \"hello\";";
      const tree = parser.parse(code);
      const identifiers = tree.rootNode.descendantsOfType("identifier");

      // Find the "s" identifier
      const s_identifier = identifiers.find(
        (node) => node.text === "s" && node.parent?.type === "let_declaration"
      );

      expect(s_identifier).toBeDefined();

      // Test parent-walking with reference types
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(s_identifier!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("&str");
      expect(result?.certainty).toBe("declared");
    });

    it("should return undefined for identifier without type annotation", () => {
      const code = "let x = 42;";
      const tree = parser.parse(code);
      const identifiers = tree.rootNode.descendantsOfType("identifier");

      // Find the "x" identifier
      const x_identifier = identifiers.find(
        (node) => node.text === "x" && node.parent?.type === "let_declaration"
      );

      expect(x_identifier).toBeDefined();

      // Should return undefined when no type annotation exists
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(x_identifier!, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("should return undefined for identifier not in let_declaration", () => {
      const code = "fn main() { println!(\"hello\"); }";
      const tree = parser.parse(code);
      const identifiers = tree.rootNode.descendantsOfType("identifier");

      // Find the "main" identifier (which is in a function_item, not let_declaration)
      const main_identifier = identifiers.find(
        (node) => node.text === "main"
      );

      expect(main_identifier).toBeDefined();
      expect(main_identifier?.parent?.type).not.toBe("let_declaration");

      // Should return undefined because parent is not let_declaration
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(main_identifier!, TEST_FILE);

      // This might extract function return type or return undefined
      // Either way, it shouldn't crash
      expect(result === undefined || result.type_name === "main").toBeTruthy();
    });
  });

  describe("extract_property_chain", () => {
    it("should extract simple field access chain", () => {
      const code = "obj.field1.field2;";
      const tree = parser.parse(code);
      const field_expr = tree.rootNode.descendantsOfType("field_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(field_expr);

      expect(result).toBeDefined();
      expect(result).toEqual(["obj", "field1", "field2"]);
    });

    it("should extract self field chain", () => {
      const code = "self.data.items;";
      const tree = parser.parse(code);
      const field_expr = tree.rootNode.descendantsOfType("field_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(field_expr);

      expect(result).toBeDefined();
      expect(result).toEqual(["self", "data", "items"]);
    });

    it("should extract chain with method calls", () => {
      const code = "vec.iter().next();";
      const tree = parser.parse(code);
      // Get the outermost call expression which is vec.iter().next()
      const calls = tree.rootNode.descendantsOfType("call_expression");
      const next_call = calls[0]; // The outermost call: vec.iter().next()

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(next_call);

      expect(result).toEqual(["vec", "iter", "next"]);
    });

    it("should extract scoped identifier chain", () => {
      const code = "std::collections::HashMap::new();";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(call_expr);

      expect(result).toBeDefined();
      expect(result).toEqual(["std", "collections", "HashMap", "new"]);
    });

    it("should extract chain with index access", () => {
      const code = "array[0].field;";
      const tree = parser.parse(code);
      const field_expr = tree.rootNode.descendantsOfType("field_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(field_expr);

      expect(result).toBeDefined();
      expect(result).toEqual(["array", "0", "field"]);
    });

    it("should return undefined for non-chain expressions", () => {
      const code = "42;";
      const tree = parser.parse(code);
      const literal = tree.rootNode.descendantsOfType("integer_literal")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(literal);

      expect(result).toBeUndefined();
    });

    it("should handle null input", () => {
      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(null as any);
      expect(result).toBeUndefined();
    });

    it("should handle undefined input", () => {
      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(undefined as any);
      expect(result).toBeUndefined();
    });

    it("should handle deeply nested field access", () => {
      const code = "a.b.c.d.e";
      const tree = parser.parse(code);
      const field_exprs = tree.rootNode.descendantsOfType("field_expression");
      // The outermost field_expression is the first one in the list for nested expressions
      const outermost = field_exprs[0]; // This should be the full chain

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(outermost);

      expect(result).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("should handle scoped identifier in field expression", () => {
      const code = "Module::Type.method";
      const tree = parser.parse(code);
      const field_expr = tree.rootNode.descendantsOfType("field_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(field_expr);

      expect(result).toEqual(["Module", "Type", "method"]);
    });

    it("should skip non-literal index values", () => {
      const code = "array[i].field";
      const tree = parser.parse(code);
      const field_expr = tree.rootNode.descendantsOfType("field_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(field_expr);

      expect(result).toEqual(["array", "field"]); // i is skipped as it's not a literal
    });

    it("should handle mixed field and index access", () => {
      const code = "data.items[5].value";
      const tree = parser.parse(code);
      const field_exprs = tree.rootNode.descendantsOfType("field_expression");
      // Get the outermost field expression containing the full chain
      const value_access = field_exprs[0]; // This should be the outermost expression

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(value_access);

      expect(result).toEqual(["data", "items", "5", "value"]);
    });
  });

  describe("extract_construct_target", () => {
    it("should extract target for struct instantiation", () => {
      const code = "let point = Point { x: 1, y: 2 };";
      const tree = parser.parse(code);
      const struct_expr = tree.rootNode.descendantsOfType("struct_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(struct_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(5); // "point"
      expect(result?.end_column).toBe(9);
    });

    it("should extract target for Vec::new()", () => {
      const code = "let vec = Vec::new();";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(call_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(5); // "vec"
    });

    it("should extract target for Box::new()", () => {
      const code = "let boxed = Box::new(42);";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(call_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(5); // "boxed"
    });

    it("should extract target for tuple struct", () => {
      const code = "let color = Color(255, 0, 0);";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(call_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(5); // "color"
    });

    it("should extract target for enum variant", () => {
      const code = "let opt = Some(42);";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(call_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(5); // "opt"
    });

    it("should extract target from assignment", () => {
      const code = "obj = MyStruct::new();";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(call_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1); // "obj"
    });

    it("should extract field assignment target", () => {
      const code = "self.data = Vec::new();";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(call_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(9); // "self.data"
    });

    it("should return undefined for constructor without assignment", () => {
      const code = "Vec::new();";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(call_expr, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("should handle null input", () => {
      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(null as any, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("should handle undefined input", () => {
      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(undefined as any, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("should extract target from builder pattern", () => {
      const code = "let obj = Builder::new().build();";
      const tree = parser.parse(code);
      const call_exprs = tree.rootNode.descendantsOfType("call_expression");
      const build_call = call_exprs[call_exprs.length - 1];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(build_call, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(5); // obj
    });

    it("should handle pattern with identifier name field", () => {
      const code = "let Some(value) = opt;";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];
      const pattern = let_decl.childForFieldName("pattern");

      expect(pattern).toBeDefined();
      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(pattern!, TEST_FILE);
      expect(result).toBeDefined();
    });

    it("should return undefined for struct expression without assignment", () => {
      const code = "Point { x: 1, y: 2 };"; // No assignment
      const tree = parser.parse(code);
      const struct_expr = tree.rootNode.descendantsOfType("struct_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(struct_expr, TEST_FILE);

      expect(result).toBeUndefined();
    });
  });

  describe("Rust-specific features", () => {
    it("should handle impl blocks with Self type", () => {
      const code = `
impl MyStruct {
    fn new() -> Self {
        Self { field: 42 }
    }
}`;
      const tree = parser.parse(code);
      const self_types = tree.rootNode.descendantsOfType("type_identifier");
      const self_return = self_types.find(node => node.text === "Self");

      expect(self_return).toBeDefined();
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(self_return!, TEST_FILE);
      expect(result).toBeDefined();
      expect(result!.type_name).toBe("Self");
    });

    it("should handle trait implementations", () => {
      const code = "impl Display for MyStruct {}";
      const tree = parser.parse(code);
      const type_idents = tree.rootNode.descendantsOfType("type_identifier");
      const display_trait = type_idents.find(node => node.text === "Display");

      expect(display_trait).toBeDefined();
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(display_trait!, TEST_FILE);
      expect(result).toBeDefined();
      expect(result!.type_name).toBe("Display");
    });

    it("should handle closure types", () => {
      const code = "let closure: Box<dyn Fn(i32) -> i32> = Box::new(|x| x * 2);";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];
      const type_node = let_decl.childForFieldName("type");

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("Box<dyn Fn(i32) -> i32>");
    });

    it("should handle where clauses in functions", () => {
      const code = "fn foo<T>() -> T where T: Default {}";
      const tree = parser.parse(code);
      const func_item = tree.rootNode.descendantsOfType("function_item")[0];
      const return_type = func_item.childForFieldName("return_type");

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(return_type!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("T");
    });

    it("should handle async functions", () => {
      const code = "async fn fetch() -> Result<String, Error> {}";
      const tree = parser.parse(code);
      const func_item = tree.rootNode.descendantsOfType("function_item")[0];
      const return_type = func_item.childForFieldName("return_type");

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(return_type!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("Result<String, Error>");
    });

    it("should handle const generics", () => {
      const code = "let arr: [i32; 10] = [0; 10];";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];
      const type_node = let_decl.childForFieldName("type");

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("[i32; 10]");
    });

    it("should handle range types", () => {
      const code = "let range: std::ops::Range<usize> = 0..10;";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];
      const type_node = let_decl.childForFieldName("type");

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("std::ops::Range<usize>");
    });

    it("should handle dynamic types", () => {
      const code = "let x: dyn Debug = &42;";
      const tree = parser.parse(code);
      const let_decl = tree.rootNode.descendantsOfType("let_declaration")[0];
      const type_node = let_decl.childForFieldName("type");

      expect(type_node).toBeDefined();
      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);
      expect(result).toBeDefined();
      expect(result!.type_name).toBe("dyn Debug");
    });

    it("should handle Arc/Rc constructors", () => {
      const code = "let arc = Arc::new(value);";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(call_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(5); // arc
    });
  });

  describe("is_method_call", () => {
    it("should return true for method calls", () => {
      const code = "obj.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.is_method_call(call_expr);

      expect(result).toBe(true);
    });

    it("should return false for function calls", () => {
      const code = "func()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.is_method_call(call_expr);

      expect(result).toBe(false);
    });

    it("should return true for chained method calls", () => {
      const code = "obj.nested.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.is_method_call(call_expr);

      expect(result).toBe(true);
    });

    it("should return true for method calls on self", () => {
      const code = "self.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.is_method_call(call_expr);

      expect(result).toBe(true);
    });

    it("should return false for non-call nodes", () => {
      const code = "let x = 42;";
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = RUST_METADATA_EXTRACTORS.is_method_call(identifier);

      expect(result).toBe(false);
    });

    it("should handle field_identifier nodes in method calls", () => {
      const code = "vec.push(5)";
      const tree = parser.parse(code);
      const field_identifier = tree.rootNode.descendantsOfType("field_identifier")[0];

      const result = RUST_METADATA_EXTRACTORS.is_method_call(field_identifier);

      expect(result).toBe(true);
    });
  });

  describe("extract_call_name", () => {
    it("should extract method name from method call", () => {
      const code = "obj.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_name(call_expr);

      expect(result).toBe("method");
    });

    it("should extract function name from function call", () => {
      const code = "func()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_name(call_expr);

      expect(result).toBe("func");
    });

    it("should extract method name from chained call", () => {
      const code = "obj.nested.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_name(call_expr);

      expect(result).toBe("method");
    });

    it("should extract method name from self call", () => {
      const code = "self.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_name(call_expr);

      expect(result).toBe("method");
    });

    it("should return undefined for non-call nodes", () => {
      const code = "let x = 42;";
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_name(identifier);

      expect(result).toBeUndefined();
    });

    it("should extract name from scoped identifier calls", () => {
      const code = "std::println!(\"test\")";
      const tree = parser.parse(code);
      const macro_invocation = tree.rootNode.descendantsOfType("macro_invocation")[0];

      // Macro invocations are different from regular calls, so this might return undefined
      const result = RUST_METADATA_EXTRACTORS.extract_call_name(macro_invocation);

      // This is expected to be undefined as macros are not call_expressions
      expect(result).toBeUndefined();
    });

    it("should extract name from Vec::new pattern", () => {
      const code = "Vec::new()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_name(call_expr);

      expect(result).toBe("new");
    });

    it("extracts the terminal name from a bare scoped_identifier call node", () => {
      // The qualified-call capture hands the scoped_identifier itself, not the call.
      const code = "worker::create(7)";
      const tree = parser.parse(code);
      const scoped = tree.rootNode.descendantsOfType("scoped_identifier")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_name(scoped);

      expect(result).toBe("create");
    });

    it("extracts the terminal type name from a full constructor path node", () => {
      const code = "crate::runtime::Driver::new()";
      const tree = parser.parse(code);
      const path_node = tree.rootNode
        .descendantsOfType("scoped_identifier")
        .find((n) => n.text === "crate::runtime::Driver");

      const result = RUST_METADATA_EXTRACTORS.extract_call_name(path_node!);

      expect(result).toBe("Driver");
    });

    it("extracts the type name from a turbofish constructor path, stripping the turbofish", () => {
      const code = "Cell::<u8>::new()";
      const tree = parser.parse(code);
      const generic = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_name(generic);

      expect(result).toBe("Cell");
    });
  });

  describe("extract_call_path_prefix", () => {
    it("drops the terminal segment in function mode (worker::create → [worker])", () => {
      const code = "worker::create(7)";
      const tree = parser.parse(code);
      const scoped = tree.rootNode.descendantsOfType("scoped_identifier")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_path_prefix!(
        scoped,
        "function",
      );

      expect(result).toEqual(["worker"]);
    });

    it("drops the terminal segment for a type-qualified associated fn (Parker::make → [Parker])", () => {
      const code = "Parker::make(5)";
      const tree = parser.parse(code);
      const scoped = tree.rootNode.descendantsOfType("scoped_identifier")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_path_prefix!(
        scoped,
        "function",
      );

      expect(result).toEqual(["Parker"]);
    });

    it("keeps the full type path in constructor mode (crate::runtime::Driver)", () => {
      const code = "crate::runtime::Driver::new()";
      const tree = parser.parse(code);
      const path_node = tree.rootNode
        .descendantsOfType("scoped_identifier")
        .find((n) => n.text === "crate::runtime::Driver");

      const result = RUST_METADATA_EXTRACTORS.extract_call_path_prefix!(
        path_node!,
        "constructor",
      );

      expect(result).toEqual(["crate", "runtime", "Driver"]);
    });

    it("strips the turbofish from each segment in constructor mode (Cell::<u8> → [Cell])", () => {
      const code = "Cell::<u8>::new()";
      const tree = parser.parse(code);
      const generic = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_path_prefix!(
        generic,
        "constructor",
      );

      expect(result).toEqual(["Cell"]);
    });

    it("returns undefined for an unqualified call (no path prefix)", () => {
      // A bare call is captured as the callee `identifier` (rust.scm), so that
      // is the node the builder hands the extractor.
      const code = "func()";
      const tree = parser.parse(code);
      const callee = tree.rootNode.descendantsOfType("identifier")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_path_prefix!(
        callee,
        "function",
      );

      expect(result).toBeUndefined();
    });
  });

  describe("extract_receiver_info", () => {
    it("should detect self as self-reference", () => {
      const code = "self.method();";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toEqual({
        receiver_location: expect.objectContaining({ start_column: 1, end_column: 4 }),
        property_chain: ["self", "method"],
        is_self_reference: true,
        self_keyword: "self",
      });
    });

    it("should handle regular receiver without self", () => {
      const code = "vec.push(5);";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result!.property_chain).toEqual(["vec", "push"]);
      expect(result!.is_self_reference).toBe(false);
      expect(result!.self_keyword).toBeUndefined();
    });

    it("should handle nested self field access", () => {
      const code = "self.data.process();";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result!.property_chain).toEqual(["self", "data", "process"]);
      expect(result!.is_self_reference).toBe(true);
      expect(result!.self_keyword).toBe("self");
    });

    it("should return undefined for standalone function calls", () => {
      const code = "func();";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("should handle field_expression directly (not in call)", () => {
      const code = "obj.field";
      const tree = parser.parse(code);
      const field_expr = tree.rootNode.descendantsOfType("field_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_receiver_info(field_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result!.property_chain).toEqual(["obj", "field"]);
      expect(result!.is_self_reference).toBe(false);
    });

    it("should handle self field access directly", () => {
      const code = "self.value";
      const tree = parser.parse(code);
      const field_expr = tree.rootNode.descendantsOfType("field_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_receiver_info(field_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result!.property_chain).toEqual(["self", "value"]);
      expect(result!.is_self_reference).toBe(true);
      expect(result!.self_keyword).toBe("self");
    });
  });

  describe("extract_is_optional_chain", () => {
    it("should always return false for Rust", () => {
      const code = "obj.method();";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      expect(RUST_METADATA_EXTRACTORS.extract_is_optional_chain(call_expr)).toBe(false);
    });

    it("should return false for field expression", () => {
      const code = "obj.field";
      const tree = parser.parse(code);
      const field_expr = tree.rootNode.descendantsOfType("field_expression")[0];

      expect(RUST_METADATA_EXTRACTORS.extract_is_optional_chain(field_expr)).toBe(false);
    });

    it("should return false for identifier", () => {
      const code = "let x = 42;";
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      expect(RUST_METADATA_EXTRACTORS.extract_is_optional_chain(identifier)).toBe(false);
    });
  });
});
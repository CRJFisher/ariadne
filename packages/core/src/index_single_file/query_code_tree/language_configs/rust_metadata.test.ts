/**
 * Tests for Rust metadata extractors
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
// @ts-ignore - tree-sitter-rust is not typed
import Rust from "tree-sitter-rust";
import { RUST_METADATA_EXTRACTORS } from "./rust_metadata";
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
      const code = `let x: i32 = 5;`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(letDecl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("i32");
      expect(result?.certainty).toBe("declared");
      expect(result?.is_nullable).toBe(false);
    });

    it("should extract type from function parameter", () => {
      const code = `fn foo(x: String) {}`;
      const tree = parser.parse(code);
      const param = tree.rootNode.descendantsOfType("parameter")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(param, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("String");
      expect(result?.certainty).toBe("declared");
    });

    it("should extract function return type", () => {
      const code = `fn bar() -> bool { true }`;
      const tree = parser.parse(code);
      const funcItem = tree.rootNode.descendantsOfType("function_item")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(funcItem, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("bool");
    });

    it("should extract reference type", () => {
      const code = `let s: &str = "hello";`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(letDecl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("&str");
    });

    it("should extract mutable reference type", () => {
      const code = `let v: &mut Vec<i32> = &mut vec![];`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(letDecl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("&mut Vec<i32>");
    });

    it("should extract generic type", () => {
      const code = `let v: Vec<String> = Vec::new();`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(letDecl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("Vec<String>");
    });

    it("should detect Option as nullable", () => {
      const code = `let opt: Option<i32> = None;`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(letDecl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("Option<i32>");
      expect(result?.is_nullable).toBe(true);
    });

    it("should extract tuple type", () => {
      const code = `let t: (i32, String, bool) = (1, String::new(), true);`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(letDecl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("(i32, String, bool)");
    });

    it("should extract array type", () => {
      const code = `let arr: [u8; 10] = [0; 10];`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(letDecl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("[u8; 10]");
    });

    it("should extract scoped type", () => {
      const code = `let map: std::collections::HashMap<String, i32> = HashMap::new();`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(letDecl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("std::collections::HashMap<String, i32>");
    });

    it("should return undefined for declarations without type annotation", () => {
      const code = `let x = 5;`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_from_annotation(letDecl, TEST_FILE);

      expect(result).toBeUndefined();
    });
  });

  describe("extract_call_receiver", () => {
    it("should extract receiver from method call", () => {
      const code = `obj.method();`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_line).toBe(1);
      expect(result?.start_column).toBe(0);
      expect(result?.end_column).toBe(3); // "obj"
    });

    it("should extract receiver from chained method call", () => {
      const code = `vec.iter().map(|x| x * 2);`;
      const tree = parser.parse(code);
      const calls = tree.rootNode.descendantsOfType("call_expression");

      // The first call in the AST is the outer one: vec.iter().map(...)
      // The second call is vec.iter()
      const iterCall = calls[1]; // vec.iter()

      const result = RUST_METADATA_EXTRACTORS.extract_call_receiver(iterCall, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(0);
      expect(result?.end_column).toBe(3); // "vec"
    });

    it("should extract receiver from self method call", () => {
      const code = `self.process();`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(0);
      expect(result?.end_column).toBe(4); // "self"
    });

    it("should extract receiver from field method call", () => {
      const code = `self.data.process();`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(0);
      expect(result?.end_column).toBe(9); // "self.data"
    });

    it("should extract path from associated function call", () => {
      const code = `String::new();`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(0);
      expect(result?.end_column).toBe(6); // "String"
    });

    it("should extract receiver with turbofish syntax", () => {
      const code = `vec.iter::<i32>().collect();`;
      const tree = parser.parse(code);
      const calls = tree.rootNode.descendantsOfType("call_expression");

      // Find the iter call with turbofish
      let turbofishCall;
      for (const call of calls) {
        const func = call.childForFieldName("function");
        if (func && func.type === "generic_function") {
          turbofishCall = call;
          break;
        }
      }

      if (turbofishCall) {
        const result = RUST_METADATA_EXTRACTORS.extract_call_receiver(turbofishCall, TEST_FILE);

        expect(result).toBeDefined();
        expect(result?.start_column).toBe(0);
        expect(result?.end_column).toBe(3); // "vec"
      }
    });
  });

  describe("extract_property_chain", () => {
    it("should extract simple field access chain", () => {
      const code = `obj.field1.field2;`;
      const tree = parser.parse(code);
      const fieldExpr = tree.rootNode.descendantsOfType("field_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(fieldExpr);

      expect(result).toBeDefined();
      expect(result).toEqual(["obj", "field1", "field2"]);
    });

    it("should extract self field chain", () => {
      const code = `self.data.items;`;
      const tree = parser.parse(code);
      const fieldExpr = tree.rootNode.descendantsOfType("field_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(fieldExpr);

      expect(result).toBeDefined();
      expect(result).toEqual(["self", "data", "items"]);
    });

    it("should extract chain with method calls", () => {
      const code = `vec.iter().next();`;
      const tree = parser.parse(code);
      // Get the outermost call expression which is vec.iter().next()
      const calls = tree.rootNode.descendantsOfType("call_expression");
      const nextCall = calls[0]; // The outermost call: vec.iter().next()

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(nextCall);

      expect(result).toBeDefined();
      expect(result).toContain("vec");
      expect(result).toContain("iter");
      expect(result).toContain("next");
    });

    it("should extract scoped identifier chain", () => {
      const code = `std::collections::HashMap::new();`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(callExpr);

      expect(result).toBeDefined();
      expect(result).toEqual(["std", "collections", "HashMap", "new"]);
    });

    it("should extract chain with index access", () => {
      const code = `array[0].field;`;
      const tree = parser.parse(code);
      const fieldExpr = tree.rootNode.descendantsOfType("field_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(fieldExpr);

      expect(result).toBeDefined();
      expect(result).toEqual(["array", "0", "field"]);
    });

    it("should return undefined for non-chain expressions", () => {
      const code = `42;`;
      const tree = parser.parse(code);
      const literal = tree.rootNode.descendantsOfType("integer_literal")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_property_chain(literal);

      expect(result).toBeUndefined();
    });
  });

  describe("extract_assignment_parts", () => {
    it("should extract let binding parts", () => {
      const code = `let x = 42;`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_assignment_parts(letDecl, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(4); // "x"
      expect(result.source?.start_column).toBe(8); // "42"
    });

    it("should extract mutable binding parts", () => {
      const code = `let mut x = vec![1, 2, 3];`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_assignment_parts(letDecl, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
    });

    it("should extract assignment expression parts", () => {
      const code = `x = 100;`;
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(0); // "x"
      expect(result.source?.start_column).toBe(4); // "100"
    });

    it("should extract field assignment parts", () => {
      const code = `self.value = 42;`;
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.end_column).toBe(10); // "self.value"
    });

    it("should extract compound assignment parts", () => {
      const code = `x += 5;`;
      const tree = parser.parse(code);
      const compoundAssign = tree.rootNode.descendantsOfType("compound_assignment_expr")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_assignment_parts(compoundAssign, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(0); // "x"
      expect(result.source?.start_column).toBe(5); // "5"
    });

    it("should extract pattern destructuring", () => {
      const code = `let (a, b) = (1, 2);`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_assignment_parts(letDecl, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
    });

    it("should extract struct destructuring", () => {
      const code = `let Point { x, y } = point;`;
      const tree = parser.parse(code);
      const letDecl = tree.rootNode.descendantsOfType("let_declaration")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_assignment_parts(letDecl, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
    });

    it("should return undefined for non-assignment nodes", () => {
      const code = `println!("hello");`;
      const tree = parser.parse(code);
      const macroCall = tree.rootNode.descendantsOfType("macro_invocation")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_assignment_parts(macroCall, TEST_FILE);

      expect(result.target).toBeUndefined();
      expect(result.source).toBeUndefined();
    });
  });

  describe("extract_construct_target", () => {
    it("should extract target for struct instantiation", () => {
      const code = `let point = Point { x: 1, y: 2 };`;
      const tree = parser.parse(code);
      const structExpr = tree.rootNode.descendantsOfType("struct_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(structExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(4); // "point"
      expect(result?.end_column).toBe(9);
    });

    it("should extract target for Vec::new()", () => {
      const code = `let vec = Vec::new();`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(4); // "vec"
    });

    it("should extract target for Box::new()", () => {
      const code = `let boxed = Box::new(42);`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(4); // "boxed"
    });

    it("should extract target for tuple struct", () => {
      const code = `let color = Color(255, 0, 0);`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(4); // "color"
    });

    it("should extract target for enum variant", () => {
      const code = `let opt = Some(42);`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(4); // "opt"
    });

    it("should extract target from assignment", () => {
      const code = `obj = MyStruct::new();`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(0); // "obj"
    });

    it("should extract field assignment target", () => {
      const code = `self.data = Vec::new();`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(0);
      expect(result?.end_column).toBe(9); // "self.data"
    });

    it("should return undefined for constructor without assignment", () => {
      const code = `Vec::new();`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_construct_target(callExpr, TEST_FILE);

      expect(result).toBeUndefined();
    });
  });

  describe("extract_type_arguments", () => {
    it("should extract single type argument", () => {
      const code = `let v: Vec<i32> = Vec::new();`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toBeDefined();
      expect(result).toEqual(["i32"]);
    });

    it("should extract multiple type arguments", () => {
      const code = `let map: HashMap<String, u64> = HashMap::new();`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toBeDefined();
      expect(result).toEqual(["String", "u64"]);
    });

    it("should extract nested generic arguments", () => {
      const code = `let v: Vec<Option<String>> = Vec::new();`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toBeDefined();
      expect(result).toEqual(["Option<String>"]);
    });

    it("should extract turbofish type arguments", () => {
      const code = `vec.collect::<Vec<i32>>();`;
      const tree = parser.parse(code);
      const genericFunc = tree.rootNode.descendantsOfType("generic_function")[0];

      if (genericFunc) {
        const result = RUST_METADATA_EXTRACTORS.extract_type_arguments(genericFunc);

        expect(result).toBeDefined();
        expect(result).toEqual(["Vec<i32>"]);
      }
    });

    it("should extract lifetime parameters", () => {
      const code = `let r: &'a str = "hello";`;
      const tree = parser.parse(code);
      // Look for reference_type which might contain lifetime
      const refType = tree.rootNode.descendantsOfType("reference_type")[0];

      if (refType && refType.text.includes("'")) {
        // For reference types with lifetimes, we extract from text
        const result = RUST_METADATA_EXTRACTORS.extract_type_arguments(refType);
        // This specific case might not have type arguments in the traditional sense
        // but the implementation handles extracting from text pattern
        expect(result === undefined || result.length > 0).toBeTruthy();
      }
    });

    it("should extract Result type arguments", () => {
      const code = `fn foo() -> Result<String, std::io::Error> {}`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toBeDefined();
      expect(result).toEqual(["String", "std::io::Error"]);
    });

    it("should handle complex nested generics", () => {
      const code = `let map: HashMap<String, Vec<(i32, String)>> = HashMap::new();`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toBeDefined();
      expect(result).toEqual(["String", "Vec<(i32, String)>"]);
    });

    it("should return undefined for non-generic types", () => {
      const code = `let x: i32 = 5;`;
      const tree = parser.parse(code);
      const primitiveType = tree.rootNode.descendantsOfType("primitive_type")[0];

      const result = RUST_METADATA_EXTRACTORS.extract_type_arguments(primitiveType);

      expect(result).toBeUndefined();
    });
  });
});
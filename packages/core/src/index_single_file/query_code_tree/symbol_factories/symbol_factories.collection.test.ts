import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";
import { detect_function_collection as detect_python_collection, extract_derived_from as extract_python_derived } from "./symbol_factories.python";
import { detect_function_collection as detect_rust_collection, extract_derived_from as extract_rust_derived } from "./symbol_factories.rust";
import { detect_function_collection as detect_js_collection } from "./symbol_factories.javascript";
import type { FilePath } from "@ariadnejs/types";

describe("Collection Resolution Tests", () => {
  let python_parser: Parser;
  let rust_parser: Parser;
  let ts_parser: Parser;

  beforeAll(() => {
    python_parser = new Parser();
    python_parser.setLanguage(Python);
    rust_parser = new Parser();
    rust_parser.setLanguage(Rust);
    ts_parser = new Parser();
    ts_parser.setLanguage(TypeScript.typescript);
  });

  const TEST_FILE = "/test/file" as FilePath;

  describe("TypeScript/JavaScript Support", () => {
    it("should detect object with function references", () => {
      const code = "const handlers = { a: fn1, b: fn2 };";
      const tree = ts_parser.parse(code);
      const declaration = tree.rootNode.child(0)!; // lexical_declaration
      const declarator = declaration.namedChildren[0]!; // variable_declarator

      const result = detect_js_collection(declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Object");
      expect(result?.stored_references).toHaveLength(2);
      expect(result?.stored_references).toContain("fn1");
      expect(result?.stored_references).toContain("fn2");
    });

    it("should detect object spread operator", () => {
      const code = "const handlers = { ...BASE_HANDLERS, extra: fn1 };";
      const tree = ts_parser.parse(code);
      const declaration = tree.rootNode.child(0)!;
      const declarator = declaration.namedChildren[0]!;

      const result = detect_js_collection(declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Object");
      expect(result?.stored_references).toContain("BASE_HANDLERS");
      expect(result?.stored_references).toContain("fn1");
    });

    it("should detect array with function references", () => {
      const code = "const handlers = [fn1, fn2];";
      const tree = ts_parser.parse(code);
      const declaration = tree.rootNode.child(0)!;
      const declarator = declaration.namedChildren[0]!;

      const result = detect_js_collection(declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Array");
      expect(result?.stored_references).toHaveLength(2);
      expect(result?.stored_references).toContain("fn1");
    });

    it("should detect array spread operator", () => {
      const code = "const handlers = [...BASE_HANDLERS, fn1];";
      const tree = ts_parser.parse(code);
      const declaration = tree.rootNode.child(0)!;
      const declarator = declaration.namedChildren[0]!;

      const result = detect_js_collection(declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Array");
      expect(result?.stored_references).toContain("BASE_HANDLERS");
      expect(result?.stored_references).toContain("fn1");
    });
  });

  describe("Python Support", () => {
    it("should detect list of functions", () => {
      const code = "handlers = [fn1, fn2]";
      const tree = python_parser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === "expression_statement") {
        assignment = assignment.child(0)!;
      }

      const result = detect_python_collection(assignment, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Array");
      expect(result?.stored_references).toHaveLength(2);
      expect(result?.stored_references).toContain("fn1");
      expect(result?.stored_references).toContain("fn2");
    });

    it("should detect list splat operator", () => {
      const code = "handlers = [*BASE_HANDLERS, fn1]";
      const tree = python_parser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === "expression_statement") {
        assignment = assignment.child(0)!;
      }

      const result = detect_python_collection(assignment, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Array");
      expect(result?.stored_references).toContain("BASE_HANDLERS");
      expect(result?.stored_references).toContain("fn1");
    });

    it("should detect dict of functions", () => {
      const code = "config = {'a': fn1, 'b': fn2}";
      const tree = python_parser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === "expression_statement") {
        assignment = assignment.child(0)!;
      }

      const result = detect_python_collection(assignment, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Object");
      expect(result?.stored_references).toHaveLength(2);
    });

    it("should detect dict splat operator", () => {
      const code = "config = {**BASE_CONFIG, 'extra': fn1}";
      const tree = python_parser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === "expression_statement") {
        assignment = assignment.child(0)!;
      }

      const result = detect_python_collection(assignment, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Object");
      expect(result?.stored_references).toContain("BASE_CONFIG");
      expect(result?.stored_references).toContain("fn1");
    });

    it("should detect tuple of functions", () => {
      const code = "handlers = (fn1, fn2)";
      const tree = python_parser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === "expression_statement") {
        assignment = assignment.child(0)!;
      }

      const result = detect_python_collection(assignment, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Array");
      expect(result?.stored_references).toHaveLength(2);
    });

    it("should extract derived variable from method call", () => {
      const code = "handler = config.get('key')";
      const tree = python_parser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === "expression_statement") {
        assignment = assignment.child(0)!;
      }
      const identifier = assignment.child(0)!; // handler

      const derived = extract_python_derived(identifier);
      expect(derived).toBe("config");
    });

    it("should extract derived variable from subscript", () => {
      const code = "handler = config['key']";
      const tree = python_parser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === "expression_statement") {
        assignment = assignment.child(0)!;
      }
      const identifier = assignment.child(0)!;

      const derived = extract_python_derived(identifier);
      expect(derived).toBe("config");
    });
  });

  describe("Rust Support", () => {
    it("should detect array of functions", () => {
      const code = "let handlers = [fn1, fn2];";
      const tree = rust_parser.parse(code);
      const declaration = tree.rootNode.child(0)!; // let_declaration
      
      const result = detect_rust_collection(declaration, TEST_FILE);
      
      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Array");
      expect(result?.stored_references).toHaveLength(2);
      expect(result?.stored_references).toContain("fn1");
    });

    it("should detect vec! macro", () => {
      const code = "let handlers = vec![fn1, fn2];";
      const tree = rust_parser.parse(code);
      const declaration = tree.rootNode.child(0)!;
      
      const result = detect_rust_collection(declaration, TEST_FILE);
      
      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Array");
      expect(result?.stored_references).toHaveLength(2);
    });

    it("should detect HashMap macro", () => {
      const code = "let config = HashMap::from([('k', fn1)]);";
      // Note: HashMap::from is a call expression, not a macro invocation in tree-sitter usually,
      // but let's test the macro case if we support hashmap!
      // If we only support macro_invocation, we should test that.
      // Let's test a hypothetical hashmap! macro
      const code_macro = "let config = hashmap!{'k' => fn1};";
      const tree = rust_parser.parse(code_macro);
      const declaration = tree.rootNode.child(0)!;
      
      const result = detect_rust_collection(declaration, TEST_FILE);
      
      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Map");
      expect(result?.stored_references).toContain("fn1");
    });

    it("should extract derived variable from method call", () => {
      const code = "let handler = config.get(\"key\");";
      const tree = rust_parser.parse(code);
      const declaration = tree.rootNode.child(0)!;
      const pattern = declaration.childForFieldName("pattern")!; // identifier
      
      const derived = extract_rust_derived(pattern);
      expect(derived).toBe("config");
    });

    it("should extract derived variable from index expression", () => {
      const code = "let handler = config[\"key\"];";
      const tree = rust_parser.parse(code);
      const declaration = tree.rootNode.child(0)!;
      const pattern = declaration.childForFieldName("pattern")!;
      
      const derived = extract_rust_derived(pattern);
      expect(derived).toBe("config");
    });
  });
});

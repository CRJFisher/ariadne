
import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import { detect_function_collection as detect_python_collection, extract_derived_from as extract_python_derived } from "./python_builder";
import { detect_function_collection as detect_rust_collection, extract_derived_from as extract_rust_derived } from "./rust_builder_helpers";
import { node_to_location } from "../../node_utils";

describe("Collection Resolution Tests", () => {
  let pythonParser: Parser;
  let rustParser: Parser;

  beforeAll(() => {
    pythonParser = new Parser();
    pythonParser.setLanguage(Python);
    rustParser = new Parser();
    rustParser.setLanguage(Rust);
  });

  const TEST_FILE = "/test/file";

  describe("Python Support", () => {
    it("should detect list of functions", () => {
      const code = "handlers = [fn1, fn2]";
      const tree = pythonParser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === 'expression_statement') {
        assignment = assignment.child(0)!;
      }
      
      const result = detect_python_collection(assignment, TEST_FILE);
      
      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Array");
      expect(result?.stored_references).toHaveLength(2);
      expect(result?.stored_references).toContain("fn1");
      expect(result?.stored_references).toContain("fn2");
    });

    it("should detect dict of functions", () => {
      const code = "config = {'a': fn1, 'b': fn2}";
      const tree = pythonParser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === 'expression_statement') {
        assignment = assignment.child(0)!;
      }
      
      const result = detect_python_collection(assignment, TEST_FILE);
      
      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Object");
      expect(result?.stored_references).toHaveLength(2);
    });

    it("should detect tuple of functions", () => {
      const code = "handlers = (fn1, fn2)";
      const tree = pythonParser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === 'expression_statement') {
        assignment = assignment.child(0)!;
      }
      
      const result = detect_python_collection(assignment, TEST_FILE);
      
      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Array");
      expect(result?.stored_references).toHaveLength(2);
    });

    it("should extract derived variable from method call", () => {
      const code = "handler = config.get('key')";
      const tree = pythonParser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === 'expression_statement') {
        assignment = assignment.child(0)!;
      }
      const identifier = assignment.child(0)!; // handler
      
      const derived = extract_python_derived(identifier);
      expect(derived).toBe("config");
    });

    it("should extract derived variable from subscript", () => {
      const code = "handler = config['key']";
      const tree = pythonParser.parse(code);
      let assignment = tree.rootNode.child(0)!;
      if (assignment.type === 'expression_statement') {
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
      const tree = rustParser.parse(code);
      const declaration = tree.rootNode.child(0)!; // let_declaration
      
      const result = detect_rust_collection(declaration, TEST_FILE);
      
      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Array");
      expect(result?.stored_references).toHaveLength(2);
      expect(result?.stored_references).toContain("fn1");
    });

    it("should detect vec! macro", () => {
      const code = "let handlers = vec![fn1, fn2];";
      const tree = rustParser.parse(code);
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
      const codeMacro = "let config = hashmap!{'k' => fn1};";
      const tree = rustParser.parse(codeMacro);
      const declaration = tree.rootNode.child(0)!;
      
      const result = detect_rust_collection(declaration, TEST_FILE);
      
      expect(result).toBeDefined();
      expect(result?.collection_type).toBe("Map");
      expect(result?.stored_references).toContain("fn1");
    });

    it("should extract derived variable from method call", () => {
      const code = "let handler = config.get(\"key\");";
      const tree = rustParser.parse(code);
      const declaration = tree.rootNode.child(0)!;
      const pattern = declaration.childForFieldName("pattern")!; // identifier
      
      const derived = extract_rust_derived(pattern);
      expect(derived).toBe("config");
    });

    it("should extract derived variable from index expression", () => {
      const code = "let handler = config[\"key\"];";
      const tree = rustParser.parse(code);
      const declaration = tree.rootNode.child(0)!;
      const pattern = declaration.childForFieldName("pattern")!;
      
      const derived = extract_rust_derived(pattern);
      expect(derived).toBe("config");
    });
  });
});

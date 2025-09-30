/**
 * Tests for JavaScript metadata extractors
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./javascript_metadata";
import type { FilePath } from "@ariadnejs/types";

describe("JavaScript Metadata Extractors", () => {
  let parser: Parser;
  const TEST_FILE: FilePath = "/test/file.js" as FilePath;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  describe("extract_type_from_annotation", () => {
    it("should extract type from JSDoc @type annotation", () => {
      const code = `
        /** @type {string} */
        const name = "test";
      `;
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      // JSDoc type extraction from preceding comment
      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("string");
      expect(result?.certainty).toBe("inferred");
    });

    it("should extract type from JSDoc @returns annotation", () => {
      const code = `
        /** @returns {boolean} */
        function check() {
          return true;
        }
      `;
      const tree = parser.parse(code);
      const funcDecl = tree.rootNode.descendantsOfType("function_declaration")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(funcDecl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("boolean");
    });

    it("should detect nullable types", () => {
      const code = `
        /** @type {string|null} */
        const nullable = null;
      `;
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.is_nullable).toBe(true);
    });
  });

  describe("extract_call_receiver", () => {
    it("should extract receiver from method call", () => {
      const code = `obj.method()`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_line).toBe(1);
      expect(result?.start_column).toBe(0);
      expect(result?.end_column).toBe(3);
    });

    it("should extract receiver from chained method call", () => {
      const code = `user.profile.getName()`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      // Should get location of "user.profile"
      expect(result?.start_column).toBe(0);
      expect(result?.end_column).toBe(12);
    });

    it("should extract 'this' as receiver", () => {
      const code = `this.doSomething()`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(0);
      expect(result?.end_column).toBe(4);
    });
  });

  describe("extract_property_chain", () => {
    it("should extract simple property chain", () => {
      const code = `a.b.c`;
      const tree = parser.parse(code);
      const memberExpr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(memberExpr);

      expect(result).toEqual(["a", "b", "c"]);
    });

    it("should extract chain with method call", () => {
      const code = `obj.prop.method()`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(callExpr);

      expect(result).toEqual(["obj", "prop", "method"]);
    });

    it("should handle optional chaining", () => {
      const code = `obj?.prop?.method`;
      const tree = parser.parse(code);
      const memberExpr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(memberExpr);

      // Should still extract the chain even with optional chaining
      expect(result).toBeDefined();
      expect(result).toContain("obj");
    });

    it("should handle 'this' in property chain", () => {
      const code = `this.data.items`;
      const tree = parser.parse(code);
      const memberExpr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(memberExpr);

      expect(result).toEqual(["this", "data", "items"]);
    });

    it("should handle computed property with string literal", () => {
      const code = `obj["prop"]["key"]`;
      const tree = parser.parse(code);
      const subscriptExpr = tree.rootNode.descendantsOfType("subscript_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(subscriptExpr);

      expect(result).toEqual(["obj", "prop", "key"]);
    });
  });

  describe("extract_assignment_parts", () => {
    it("should extract parts from simple assignment", () => {
      const code = `x = y`;
      const tree = parser.parse(code);
      const assignExpr = tree.rootNode.descendantsOfType("assignment_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(assignExpr, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(0);
      expect(result.source?.start_column).toBe(4);
    });

    it("should extract parts from variable declaration", () => {
      const code = `const x = getValue()`;
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(varDeclarator, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(6); // position of 'x'
      expect(result.source?.start_column).toBe(10); // position of 'getValue()'
    });

    it("should extract parts from property assignment", () => {
      const code = `obj.prop = value`;
      const tree = parser.parse(code);
      const assignExpr = tree.rootNode.descendantsOfType("assignment_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(assignExpr, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.end_column).toBe(8); // end of 'obj.prop'
    });

    it("should handle destructuring assignment", () => {
      const code = `const {a, b} = obj`;
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(varDeclarator, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(6); // position of {a, b}
    });

    it("should handle augmented assignment", () => {
      const code = `x += 5`;
      const tree = parser.parse(code);
      const augmentedAssign = tree.rootNode.descendantsOfType("augmented_assignment_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(augmentedAssign, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(0); // position of 'x'
      expect(result.source?.start_column).toBe(5); // position of '5'
    });
  });

  describe("extract_construct_target", () => {
    it("should extract target from new expression in variable declaration", () => {
      const code = `const obj = new MyClass()`;
      const tree = parser.parse(code);
      const newExpr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(newExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(6); // position of 'obj'
      expect(result?.end_column).toBe(9);
    });

    it("should extract target from new expression in property assignment", () => {
      const code = `this.prop = new Thing()`;
      const tree = parser.parse(code);
      const newExpr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(newExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(0); // position of 'this.prop'
      expect(result?.end_column).toBe(9);
    });

    it("should extract target from let declaration", () => {
      const code = `let x = new Map()`;
      const tree = parser.parse(code);
      const newExpr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(newExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(4); // position of 'x'
    });
  });

  describe("extract_type_arguments", () => {
    it("should extract type arguments from JSDoc generics", () => {
      const code = `/** @type {Array.<string>} */`;
      const tree = parser.parse(code);
      // Parse the comment text directly since JSDoc is in comments
      const comment = tree.rootNode.descendantsOfType("comment")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(comment);

      expect(result).toEqual(["string"]);
    });

    it("should extract multiple type arguments from JSDoc", () => {
      const code = `/** @type {Object.<string, number>} */`;
      const tree = parser.parse(code);
      const comment = tree.rootNode.descendantsOfType("comment")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(comment);

      expect(result).toEqual(["string", "number"]);
    });

    it("should return undefined for non-generic types", () => {
      const code = `const x = 5`;
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(identifier);

      expect(result).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle deeply nested property chains", () => {
      const code = `app.config.database.connection.host`;
      const tree = parser.parse(code);
      const memberExpr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(memberExpr);

      expect(result).toEqual(["app", "config", "database", "connection", "host"]);
    });

    it("should handle super method calls", () => {
      const code = `super.method()`;
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
    });

    it("should handle arrow function assignments", () => {
      const code = `const fn = () => {}`;
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(varDeclarator, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
    });
  });
});
/**
 * Tests for JavaScript metadata extractors
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
// @ts-ignore - TypeScript grammar is available but not typed
import TypeScript from "tree-sitter-typescript";
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
      const code = "obj.method()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_line).toBe(1);
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(3);
    });

    it("should extract receiver from chained method call", () => {
      const code = "user.profile.getName()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      // Should get location of "user.profile"
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(12);
    });

    it("should extract 'this' as receiver", () => {
      const code = "this.doSomething()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(4);
    });

    it("should extract receiver from static/class method call", () => {
      // JavaScript static methods: ClassName.method()
      const code = "Math.floor(3.7)";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(4); // end of "Math"
    });

    it("should extract receiver from member_expression node for static call", () => {
      // Test when the member_expression node is passed directly (as captured by queries)
      const code = "UserManager.create()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      // In JS, call_expression has a function field which is the member_expression
      const func = callExpr.childForFieldName("function");
      expect(func?.type).toBe("member_expression");

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(func!, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(11); // end of "UserManager"
    });
  });

  describe("extract_property_chain", () => {
    it("should extract simple property chain", () => {
      const code = "a.b.c";
      const tree = parser.parse(code);
      const memberExpr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(memberExpr);

      expect(result).toEqual(["a", "b", "c"]);
    });

    it("should extract chain with method call", () => {
      const code = "obj.prop.method()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(callExpr);

      expect(result).toEqual(["obj", "prop", "method"]);
    });

    it("should handle optional chaining", () => {
      const code = "obj?.prop?.method";
      const tree = parser.parse(code);
      const memberExpr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(memberExpr);

      // Should still extract the chain even with optional chaining
      expect(result).toBeDefined();
      expect(result).toContain("obj");
    });

    it("should handle 'this' in property chain", () => {
      const code = "this.data.items";
      const tree = parser.parse(code);
      const memberExpr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(memberExpr);

      expect(result).toEqual(["this", "data", "items"]);
    });

    it("should handle computed property with string literal", () => {
      const code = "obj[\"prop\"][\"key\"]";
      const tree = parser.parse(code);
      const subscriptExpr = tree.rootNode.descendantsOfType("subscript_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(subscriptExpr);

      expect(result).toEqual(["obj", "prop", "key"]);
    });
  });

  describe("extract_assignment_parts", () => {
    it("should extract parts from simple assignment", () => {
      const code = "x = y";
      const tree = parser.parse(code);
      const assignExpr = tree.rootNode.descendantsOfType("assignment_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(assignExpr, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(1);
      expect(result.source?.start_column).toBe(5);
    });

    it("should extract parts from variable declaration", () => {
      const code = "const x = getValue()";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(varDeclarator, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(7); // position of 'x'
      expect(result.source?.start_column).toBe(11); // position of 'getValue()'
    });

    it("should extract parts from property assignment", () => {
      const code = "obj.prop = value";
      const tree = parser.parse(code);
      const assignExpr = tree.rootNode.descendantsOfType("assignment_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(assignExpr, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.end_column).toBe(8); // end of 'obj.prop'
    });

    it("should handle destructuring assignment", () => {
      const code = "const {a, b} = obj";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(varDeclarator, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(7); // position of {a, b}
    });

    it("should handle augmented assignment", () => {
      const code = "x += 5";
      const tree = parser.parse(code);
      const augmentedAssign = tree.rootNode.descendantsOfType("augmented_assignment_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(augmentedAssign, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(1); // position of 'x'
      expect(result.source?.start_column).toBe(6); // position of '5'
    });
  });

  describe("extract_construct_target", () => {
    it("should extract target from new expression in variable declaration", () => {
      const code = "const obj = new MyClass()";
      const tree = parser.parse(code);
      const newExpr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(newExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(7); // position of 'obj'
      expect(result?.end_column).toBe(9);
    });

    it("should extract target from new expression in property assignment", () => {
      const code = "this.prop = new Thing()";
      const tree = parser.parse(code);
      const newExpr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(newExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1); // position of 'this.prop'
      expect(result?.end_column).toBe(9);
    });

    it("should extract target from let declaration", () => {
      const code = "let x = new Map()";
      const tree = parser.parse(code);
      const newExpr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(newExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(5); // position of 'x'
    });
  });

  describe("extract_type_arguments", () => {
    it("should extract type arguments from JSDoc generics", () => {
      const code = "/** @type {Array.<string>} */";
      const tree = parser.parse(code);
      // Parse the comment text directly since JSDoc is in comments
      const comment = tree.rootNode.descendantsOfType("comment")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(comment);

      expect(result).toEqual(["string"]);
    });

    it("should extract multiple type arguments from JSDoc", () => {
      const code = "/** @type {Object.<string, number>} */";
      const tree = parser.parse(code);
      const comment = tree.rootNode.descendantsOfType("comment")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(comment);

      expect(result).toEqual(["string", "number"]);
    });

    it("should return undefined for non-generic types", () => {
      const code = "const x = 5";
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(identifier);

      expect(result).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle deeply nested property chains", () => {
      const code = "app.config.database.connection.host";
      const tree = parser.parse(code);
      const memberExpr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(memberExpr);

      expect(result).toEqual(["app", "config", "database", "connection", "host"]);
    });

    it("should handle super method calls", () => {
      const code = "super.method()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeDefined();
    });

    it("should handle arrow function assignments", () => {
      const code = "const fn = () => {}";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(varDeclarator, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
    });

    it("should return undefined for standalone function calls without receiver", () => {
      const code = "regularFunction()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(callExpr, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("should handle member expression without call", () => {
      const code = "obj.prop";
      const tree = parser.parse(code);
      const memberExpr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(memberExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(3);
    });

    it("should handle super in property chains", () => {
      const code = "super.parent.grandparent";
      const tree = parser.parse(code);
      const memberExpr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(memberExpr);

      expect(result).toEqual(["super", "parent", "grandparent"]);
    });

    it("should handle nested subscript expressions", () => {
      const code = "obj[\"key1\"][\"key2\"][\"key3\"]";
      const tree = parser.parse(code);
      const subscriptExpr = tree.rootNode.descendantsOfType("subscript_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(subscriptExpr);

      expect(result).toEqual(["obj", "key1", "key2", "key3"]);
    });

    it("should handle single quotes in bracket notation", () => {
      const code = "obj['singleQuote']";
      const tree = parser.parse(code);
      const subscriptExpr = tree.rootNode.descendantsOfType("subscript_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(subscriptExpr);

      expect(result).toEqual(["obj", "singleQuote"]);
    });

    it("should ignore non-string bracket indices", () => {
      const code = "obj[123]";
      const tree = parser.parse(code);
      const subscriptExpr = tree.rootNode.descendantsOfType("subscript_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(subscriptExpr);

      expect(result).toEqual(["obj"]);
    });

    it("should return undefined for empty property chains", () => {
      const code = "42";
      const tree = parser.parse(code);
      const numberNode = tree.rootNode.descendantsOfType("number")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(numberNode);

      expect(result).toBeUndefined();
    });

    it("should handle variable declaration without initialization", () => {
      const code = "let x;";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(varDeclarator, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeUndefined();
    });

    it("should return both undefined for unrecognized assignment node types", () => {
      const code = "const x = 5";
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(identifier, TEST_FILE);

      expect(result.source).toBeUndefined();
      expect(result.target).toBeUndefined();
    });

    it("should return undefined for standalone constructor calls", () => {
      const code = "new MyClass()";
      const tree = parser.parse(code);
      const newExpr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(newExpr, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("should return undefined when no JSDoc comment exists", () => {
      const code = "const x = 5;";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("should return undefined for JSDoc without type annotation", () => {
      const code = `
        /** Just a comment */
        const x = 5;
      `;
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("should handle @return singular form in JSDoc", () => {
      const code = `
        /** @return {string} */
        function getValue() {
          return "test";
        }
      `;
      const tree = parser.parse(code);
      const funcDecl = tree.rootNode.descendantsOfType("function_declaration")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(funcDecl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("string");
    });

    it("should detect undefined as nullable", () => {
      const code = `
        /** @type {string|undefined} */
        const maybeString = undefined;
      `;
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.is_nullable).toBe(true);
    });

    it("should handle mixed bracket and dot notation", () => {
      const code = "obj.prop[\"key\"].nested";
      const tree = parser.parse(code);
      // Get the outermost expression which contains the full chain
      const exprStatement = tree.rootNode.child(0);
      const memberExpr = exprStatement?.child(0);

      if (memberExpr) {
        const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(memberExpr);
        expect(result).toEqual(["obj", "prop", "key", "nested"]);
      } else {
        // Fallback if AST structure is different
        const firstMemberExpr = tree.rootNode.descendantsOfType("member_expression")[0];
        const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(firstMemberExpr);
        expect(result).toBeDefined();
        expect(result).toContain("nested");
      }
    });

    it("should handle nested optional chaining with method calls", () => {
      const code = "obj?.method()?.prop?.another()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      // Get the outer call expression
      const outerCall = tree.rootNode.descendantsOfType("call_expression")[1] || callExpr;
      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(outerCall);

      expect(result).toBeDefined();
      expect(result?.length).toBeGreaterThan(0);
    });

    it("should handle constructor in return statement", () => {
      const code = "function create() { return new MyClass(); }";
      const tree = parser.parse(code);
      const newExpr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(newExpr, TEST_FILE);

      expect(result).toBeUndefined(); // Not assigned to a variable
    });

    it("should handle deeply nested constructor", () => {
      const code = "const result = someFn(anotherFn(new MyClass()));";
      const tree = parser.parse(code);
      const newExpr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(newExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(7); // position of 'result'
    });

    it("should verify multi-line location accuracy", () => {
      const code = `const obj = {
  prop: new MyClass()
};`;
      const tree = parser.parse(code);
      const newExpr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(newExpr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_line).toBe(1);
      expect(result?.start_column).toBe(7); // position of 'obj'
    });
  });
});

describe("TypeScript Metadata Extractors", () => {
  let parser: Parser;
  const TEST_FILE: FilePath = "/test/file.ts" as FilePath;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  describe("extract_type_from_annotation - TypeScript", () => {
    it("should extract type identifier from TypeScript annotation", () => {
      const code = "const x: MyType = {};";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("MyType");
      expect(result?.certainty).toBe("declared");
    });

    it("should extract predefined types", () => {
      const code = "const str: string = \"\";";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("string");
      expect(result?.certainty).toBe("declared");
    });

    it("should extract generic types", () => {
      const code = "const arr: Array<string> = [];";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("Array<string>");
      expect(result?.certainty).toBe("declared");
    });

    it("should handle union types", () => {
      const code = "const val: string | number = 5;";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("string | number");
    });

    it("should handle intersection types", () => {
      const code = "const val: TypeA & TypeB = {};";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("TypeA & TypeB");
    });

    it("should handle tuple types", () => {
      const code = "const tuple: [string, number] = [\"a\", 1];";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("[string, number]");
    });

    it("should handle function types", () => {
      const code = "const fn: (x: number) => string = (x) => String(x);";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("(x: number) => string");
    });

    it("should handle nullable TypeScript types", () => {
      const code = "const val: string | null = null;";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.is_nullable).toBe(true);
    });

    it("should handle undefined in TypeScript union", () => {
      const code = "const val: string | undefined = undefined;";
      const tree = parser.parse(code);
      const varDeclarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(varDeclarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.is_nullable).toBe(true);
    });
  });

  describe("extract_type_arguments - TypeScript", () => {
    it("should extract type arguments from TypeScript generics", () => {
      const code = "const map: Map<string, number> = new Map();";
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      if (genericType) {
        const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(genericType);

        expect(result).toEqual(["string", "number"]);
      }
    });

    it("should extract single type argument", () => {
      const code = "const arr: Array<string> = [];";
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      if (genericType) {
        const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(genericType);

        expect(result).toEqual(["string"]);
      }
    });

    it("should handle nested generic types", () => {
      const code = "const nested: Promise<Array<string>> = Promise.resolve([]);";
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      if (genericType) {
        const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(genericType);

        expect(result).toBeDefined();
        expect(result?.length).toBeGreaterThan(0);
      }
    });

    it("should return undefined for non-generic types", () => {
      const code = "const x: string = \"test\";";
      const tree = parser.parse(code);
      const typeAnnotation = tree.rootNode.descendantsOfType("type_annotation")[0];

      if (typeAnnotation) {
        const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(typeAnnotation);

        expect(result).toBeUndefined();
      }
    });
  });

  describe("is_method_call", () => {
    it("should return true for method calls", () => {
      const code = "obj.method()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.is_method_call(callExpr);

      expect(result).toBe(true);
    });

    it("should return false for function calls", () => {
      const code = "func()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.is_method_call(callExpr);

      expect(result).toBe(false);
    });

    it("should return true for chained method calls", () => {
      const code = "obj.nested.method()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.is_method_call(callExpr);

      expect(result).toBe(true);
    });

    it("should return true for method calls on 'this'", () => {
      const code = "this.method()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.is_method_call(callExpr);

      expect(result).toBe(true);
    });

    it("should return false for non-call nodes", () => {
      const code = "const x = 42";
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.is_method_call(identifier);

      expect(result).toBe(false);
    });
  });

  describe("extract_call_name", () => {
    it("should extract method name from method call", () => {
      const code = "obj.method()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(callExpr);

      expect(result).toBe("method");
    });

    it("should extract function name from function call", () => {
      const code = "func()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(callExpr);

      expect(result).toBe("func");
    });

    it("should extract method name from chained call", () => {
      const code = "obj.nested.method()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(callExpr);

      expect(result).toBe("method");
    });

    it("should extract method name from 'this' call", () => {
      const code = "this.method()";
      const tree = parser.parse(code);
      const callExpr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(callExpr);

      expect(result).toBe("method");
    });

    it("should return undefined for non-call nodes", () => {
      const code = "const x = 42";
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(identifier);

      expect(result).toBeUndefined();
    });

    it("should extract name from constructor call", () => {
      const code = "new Array()";
      const tree = parser.parse(code);
      const newExpr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(newExpr);

      // new_expression is not a call_expression, so should return undefined
      expect(result).toBeUndefined();
    });
  });
});
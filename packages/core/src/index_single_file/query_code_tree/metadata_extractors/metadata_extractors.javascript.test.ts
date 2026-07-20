/**
 * Tests for JavaScript metadata extractors
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
// @ts-ignore - TypeScript grammar is available but not typed
import TypeScript from "tree-sitter-typescript";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./metadata_extractors.javascript";
import { TYPESCRIPT_METADATA_EXTRACTORS } from "./metadata_extractors.typescript";
import type { FilePath } from "@ariadnejs/types";

describe("JavaScript Metadata Extractors", () => {
  let parser: Parser;
  const TEST_FILE: FilePath = "/test/file.js" as FilePath;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  describe("extract_type_from_annotation", () => {
    it("extract type from JSDoc @type annotation", () => {
      const code = `
        /** @type {string} */
        const name = "test";
      `;
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      // JSDoc type extraction from preceding comment
      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("string");
      expect(result?.certainty).toBe("inferred");
    });

    it("extract type from JSDoc @returns annotation", () => {
      const code = `
        /** @returns {boolean} */
        function check() {
          return true;
        }
      `;
      const tree = parser.parse(code);
      const func_decl = tree.rootNode.descendantsOfType("function_declaration")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(func_decl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("boolean");
    });

    it("detect nullable types", () => {
      const code = `
        /** @type {string|null} */
        const nullable = null;
      `;
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.is_nullable).toBe(true);
    });
  });

  describe("extract_property_chain", () => {
    it("extract simple property chain", () => {
      const code = "a.b.c";
      const tree = parser.parse(code);
      const member_expr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(member_expr);

      expect(result).toEqual(["a", "b", "c"]);
    });

    it("extract chain with method call", () => {
      const code = "obj.prop.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(call_expr);

      expect(result).toEqual(["obj", "prop", "method"]);
    });

    it("handle optional chaining", () => {
      const code = "obj?.prop?.method";
      const tree = parser.parse(code);
      const member_expr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(member_expr);

      expect(result).toEqual(["obj", "prop", "method"]);
    });

    it("handle 'this' in property chain", () => {
      const code = "this.data.items";
      const tree = parser.parse(code);
      const member_expr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(member_expr);

      expect(result).toEqual(["this", "data", "items"]);
    });

    it("handle computed property with string literal", () => {
      const code = "obj[\"prop\"][\"key\"]";
      const tree = parser.parse(code);
      const subscript_expr = tree.rootNode.descendantsOfType("subscript_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(subscript_expr);

      expect(result).toEqual(["obj", "prop", "key"]);
    });
  });

  describe("extract_receiver_info chain_call_arguments", () => {
    it("captures an intermediate call's identifier argument aligned to the chain", () => {
      const code = "injector.get(Token).handle()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const info = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(info?.property_chain).toEqual(["injector", "get", "handle"]);
      expect(info?.chain_call_arguments).toEqual([null, ["Token"], []]);
    });

    it("preserves positional index for a non-identifier argument", () => {
      const code = "injector.get(options, Token).handle()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const info = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(info?.chain_call_arguments).toEqual([null, ["options", "Token"], []]);
    });

    it("omits the field for a literal-only intermediate call", () => {
      const code = "builder.add(5).build()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const info = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(info?.chain_call_arguments).toBeUndefined();
    });

    it("omits the field for a plain method call with no intermediate call", () => {
      const code = "user.getName()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const info = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(info?.chain_call_arguments).toBeUndefined();
    });
  });

  describe("extract_construct_target", () => {
    it("takes the declared variable as target in a variable declaration", () => {
      const code = "const obj = new MyClass()";
      const tree = parser.parse(code);
      const new_expr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(new_expr, TEST_FILE);

      expect(result).toEqual({ file_path: TEST_FILE, start_line: 1, start_column: 7, end_line: 1, end_column: 9 });
    });

    it("takes the assignment left-hand side as target in a property assignment", () => {
      const code = "this.prop = new Thing()";
      const tree = parser.parse(code);
      const new_expr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(new_expr, TEST_FILE);

      expect(result).toEqual({ file_path: TEST_FILE, start_line: 1, start_column: 1, end_line: 1, end_column: 9 });
    });

    it("takes the declared variable as target in a let declaration", () => {
      const code = "let x = new Map()";
      const tree = parser.parse(code);
      const new_expr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(new_expr, TEST_FILE);

      expect(result).toEqual({ file_path: TEST_FILE, start_line: 1, start_column: 5, end_line: 1, end_column: 5 });
    });
  });

  describe("edge cases", () => {
    it("handle deeply nested property chains", () => {
      const code = "app.config.database.connection.host";
      const tree = parser.parse(code);
      const member_expr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(member_expr);

      expect(result).toEqual(["app", "config", "database", "connection", "host"]);
    });

    it("handle super in property chains", () => {
      const code = "super.parent.grandparent";
      const tree = parser.parse(code);
      const member_expr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(member_expr);

      expect(result).toEqual(["super", "parent", "grandparent"]);
    });

    it("handle nested subscript expressions", () => {
      const code = "obj[\"key1\"][\"key2\"][\"key3\"]";
      const tree = parser.parse(code);
      const subscript_expr = tree.rootNode.descendantsOfType("subscript_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(subscript_expr);

      expect(result).toEqual(["obj", "key1", "key2", "key3"]);
    });

    it("handle single quotes in bracket notation", () => {
      const code = "obj['singleQuote']";
      const tree = parser.parse(code);
      const subscript_expr = tree.rootNode.descendantsOfType("subscript_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(subscript_expr);

      expect(result).toEqual(["obj", "singleQuote"]);
    });

    it("ignore non-string bracket indices", () => {
      const code = "obj[123]";
      const tree = parser.parse(code);
      const subscript_expr = tree.rootNode.descendantsOfType("subscript_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(subscript_expr);

      expect(result).toEqual(["obj"]);
    });

    it("return undefined for empty property chains", () => {
      const code = "42";
      const tree = parser.parse(code);
      const number_node = tree.rootNode.descendantsOfType("number")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(number_node);

      expect(result).toBeUndefined();
    });

    it("return undefined for standalone constructor calls", () => {
      const code = "new MyClass()";
      const tree = parser.parse(code);
      const new_expr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(new_expr, TEST_FILE);

      expect(result).toBeUndefined();
    });
  });

  describe("extract_receiver_info", () => {
    it("detects 'this' as self-reference", () => {
      const code = "this.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toEqual({
        receiver_location: { file_path: TEST_FILE, start_line: 1, start_column: 1, end_line: 1, end_column: 4 },
        property_chain: ["this", "method"],
        is_self_reference: true,
        self_keyword: "this",
      });
    });

    it("detects 'super' as self-reference", () => {
      const code = "super.process()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toEqual({
        receiver_location: { file_path: TEST_FILE, start_line: 1, start_column: 1, end_line: 1, end_column: 5 },
        property_chain: ["super", "process"],
        is_self_reference: true,
        self_keyword: "super",
      });
    });

    it("omits self_keyword for a regular object receiver", () => {
      const code = "obj.getName()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toEqual({
        receiver_location: { file_path: TEST_FILE, start_line: 1, start_column: 1, end_line: 1, end_column: 3 },
        property_chain: ["obj", "getName"],
        is_self_reference: false,
      });
    });

    it("captures the full chain for a nested property receiver", () => {
      const code = "a.b.c.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toEqual({
        receiver_location: { file_path: TEST_FILE, start_line: 1, start_column: 1, end_line: 1, end_column: 5 },
        property_chain: ["a", "b", "c", "method"],
        is_self_reference: false,
      });
    });

    it("detects 'this' at the root of a nested chain", () => {
      const code = "this.data.items.push(1)";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toEqual({
        receiver_location: { file_path: TEST_FILE, start_line: 1, start_column: 1, end_line: 1, end_column: 15 },
        property_chain: ["this", "data", "items", "push"],
        is_self_reference: true,
        self_keyword: "this",
      });
    });

    it("handles a member_expression passed outside a call", () => {
      const code = "obj.prop";
      const tree = parser.parse(code);
      const member_expr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(member_expr, TEST_FILE);

      expect(result).toEqual({
        receiver_location: { file_path: TEST_FILE, start_line: 1, start_column: 1, end_line: 1, end_column: 3 },
        property_chain: ["obj", "prop"],
        is_self_reference: false,
      });
    });

    it("returns undefined for plain function calls", () => {
      const code = "doSomething()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("resolves the receiver through an optional chain", () => {
      const code = "obj?.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toEqual({
        receiver_location: { file_path: TEST_FILE, start_line: 1, start_column: 1, end_line: 1, end_column: 3 },
        property_chain: ["obj", "method"],
        is_self_reference: false,
      });
    });
  });

  describe("extract_is_optional_chain", () => {
    it("return true for call with optional chain on receiver", () => {
      const code = "obj?.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      expect(JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(call_expr)).toBe(true);
    });

    it("return false for regular method call", () => {
      const code = "obj.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      expect(JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(call_expr)).toBe(false);
    });

    it("return true for member_expression with optional chain", () => {
      const code = "obj?.prop";
      const tree = parser.parse(code);
      const member_expr = tree.rootNode.descendantsOfType("member_expression")[0];

      expect(JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(member_expr)).toBe(true);
    });

    it("return false for regular member_expression", () => {
      const code = "obj.prop";
      const tree = parser.parse(code);
      const member_expr = tree.rootNode.descendantsOfType("member_expression")[0];

      expect(JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(member_expr)).toBe(false);
    });

    it("detect optional chaining deep in nested member_expression", () => {
      const code = "a.b?.c.d";
      const tree = parser.parse(code);
      const member_expr = tree.rootNode.descendantsOfType("member_expression")[0];

      expect(JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(member_expr)).toBe(true);
    });

    it("return false for fully non-optional nested chain", () => {
      const code = "a.b.c.d";
      const tree = parser.parse(code);
      const member_expr = tree.rootNode.descendantsOfType("member_expression")[0];

      expect(JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(member_expr)).toBe(false);
    });

    it("return true for chained optional call", () => {
      const code = "obj?.prop?.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      expect(JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(call_expr)).toBe(true);
    });

    it("return false for non-call non-member nodes", () => {
      const code = "42";
      const tree = parser.parse(code);
      const number_node = tree.rootNode.descendantsOfType("number")[0];

      expect(JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(number_node)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("return undefined when no JSDoc comment exists", () => {
      const code = "const x = 5;";
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("return undefined for JSDoc without type annotation", () => {
      const code = `
        /** Just a comment */
        const x = 5;
      `;
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("handle @return singular form in JSDoc", () => {
      const code = `
        /** @return {string} */
        function getValue() {
          return "test";
        }
      `;
      const tree = parser.parse(code);
      const func_decl = tree.rootNode.descendantsOfType("function_declaration")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(func_decl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("string");
    });

    it("detect undefined as nullable", () => {
      const code = `
        /** @type {string|undefined} */
        const maybeString = undefined;
      `;
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.is_nullable).toBe(true);
    });

    it("handle mixed bracket and dot notation", () => {
      const code = "obj.prop[\"key\"].nested";
      const tree = parser.parse(code);
      const member_expr = tree.rootNode.descendantsOfType("member_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(member_expr);

      expect(result).toEqual(["obj", "prop", "key", "nested"]);
    });

    it("handle nested optional chaining with method calls", () => {
      const code = "obj?.method()?.prop?.another()";
      const tree = parser.parse(code);
      // DFS order: outermost call first
      const outer_call = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(outer_call);

      expect(result).toEqual(["obj", "method", "prop", "another"]);
    });

    it("handle constructor in return statement", () => {
      const code = "function create() { return new MyClass(); }";
      const tree = parser.parse(code);
      const new_expr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(new_expr, TEST_FILE);

      expect(result).toBeUndefined(); // Not assigned to a variable
    });

    it("handle deeply nested constructor", () => {
      const code = "const result = someFn(anotherFn(new MyClass()));";
      const tree = parser.parse(code);
      const new_expr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(new_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(7); // position of 'result'
    });

    it("verify multi-line location accuracy", () => {
      const code = `const obj = {
  prop: new MyClass()
};`;
      const tree = parser.parse(code);
      const new_expr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(new_expr, TEST_FILE);

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
    it("extract type identifier from TypeScript annotation", () => {
      const code = "const x: MyType = {};";
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("MyType");
      expect(result?.certainty).toBe("declared");
    });

    it("extract predefined types", () => {
      const code = "const str: string = \"\";";
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("string");
      expect(result?.certainty).toBe("declared");
    });

    it("extract generic types", () => {
      const code = "const arr: Array<string> = [];";
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("Array<string>");
      expect(result?.certainty).toBe("declared");
    });

    it("handle union types", () => {
      const code = "const val: string | number = 5;";
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("string | number");
    });

    it("handle intersection types", () => {
      const code = "const val: TypeA & TypeB = {};";
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("TypeA & TypeB");
    });

    it("handle tuple types", () => {
      const code = "const tuple: [string, number] = [\"a\", 1];";
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("[string, number]");
    });

    it("handle function types", () => {
      const code = "const fn: (x: number) => string = (x) => String(x);";
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("(x: number) => string");
    });

    it("handle nullable TypeScript types", () => {
      const code = "const val: string | null = null;";
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.is_nullable).toBe(true);
    });

    it("handle undefined in TypeScript union", () => {
      const code = "const val: string | undefined = undefined;";
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.is_nullable).toBe(true);
    });
  });

  describe("is_method_call", () => {
    it("return true for method calls", () => {
      const code = "obj.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.is_method_call(call_expr);

      expect(result).toBe(true);
    });

    it("return false for function calls", () => {
      const code = "func()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.is_method_call(call_expr);

      expect(result).toBe(false);
    });

    it("return true for chained method calls", () => {
      const code = "obj.nested.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.is_method_call(call_expr);

      expect(result).toBe(true);
    });

    it("return true for method calls on 'this'", () => {
      const code = "this.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.is_method_call(call_expr);

      expect(result).toBe(true);
    });

    it("return false for non-call nodes", () => {
      const code = "const x = 42";
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.is_method_call(identifier);

      expect(result).toBe(false);
    });
  });

  describe("extract_call_name", () => {
    it("extract method name from method call", () => {
      const code = "obj.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(call_expr);

      expect(result).toBe("method");
    });

    it("extract function name from function call", () => {
      const code = "func()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(call_expr);

      expect(result).toBe("func");
    });

    it("extract method name from chained call", () => {
      const code = "obj.nested.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(call_expr);

      expect(result).toBe("method");
    });

    it("extract method name from 'this' call", () => {
      const code = "this.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(call_expr);

      expect(result).toBe("method");
    });

    it("return undefined for non-call nodes", () => {
      const code = "const x = 42";
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(identifier);

      expect(result).toBeUndefined();
    });

    it("extract name from constructor call", () => {
      const code = "new Array()";
      const tree = parser.parse(code);
      const new_expr = tree.rootNode.descendantsOfType("new_expression")[0];

      const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name(new_expr);

      // new_expression is not a call_expression, so should return undefined
      expect(result).toBeUndefined();
    });
  });
});

describe("TYPESCRIPT_METADATA_EXTRACTORS", () => {
  let parser: Parser;
  const TEST_FILE: FilePath = "/test/file.ts" as FilePath;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  describe("extract_type_from_annotation", () => {
    it("handle type_identifier node directly", () => {
      const code = "const x: MyType = {};";
      const tree = parser.parse(code);
      const type_ident = tree.rootNode.descendantsOfType("type_identifier")[0];

      expect(type_ident).toBeDefined();
      const result = TYPESCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(type_ident, TEST_FILE);

      expect(result).toBeDefined();
      expect(result!.type_name).toBe("MyType");
      expect(result!.certainty).toBe("declared");
      expect(result!.is_nullable).toBe(false);
    });

    it("extract base type name from generic_type node", () => {
      const code = "const arr: Array<string> = [];";
      const tree = parser.parse(code);
      const generic_type = tree.rootNode.descendantsOfType("generic_type")[0];

      expect(generic_type).toBeDefined();
      const result = TYPESCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(generic_type, TEST_FILE);

      expect(result).toBeDefined();
      expect(result!.type_name).toBe("Array");
      expect(result!.certainty).toBe("declared");
    });

    it("handle nested_type_identifier (e.g. Status.Active)", () => {
      const code = "const val: Status.Active = Status.Active;";
      const tree = parser.parse(code);
      const nested_type = tree.rootNode.descendantsOfType("nested_type_identifier")[0];

      expect(nested_type).toBeDefined();
      const result = TYPESCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(nested_type, TEST_FILE);

      expect(result).toBeDefined();
      expect(result!.type_name).toBe("Status.Active");
      expect(result!.certainty).toBe("declared");
    });

    it("fall back to JS extractor for variable_declarator with type annotation", () => {
      const code = "const x: string = \"\";";
      const tree = parser.parse(code);
      const var_declarator = tree.rootNode.descendantsOfType("variable_declarator")[0];

      const result = TYPESCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(var_declarator, TEST_FILE);

      expect(result).toBeDefined();
      expect(result!.type_name).toBe("string");
      expect(result!.certainty).toBe("declared");
    });

    it("fall back to JS extractor for JSDoc on function", () => {
      const code = `
        /** @returns {boolean} */
        function check() { return true; }
      `;
      const tree = parser.parse(code);
      const func_decl = tree.rootNode.descendantsOfType("function_declaration")[0];

      const result = TYPESCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(func_decl, TEST_FILE);

      expect(result).toBeDefined();
      expect(result!.type_name).toBe("boolean");
    });
  });

  describe("delegated methods", () => {
    it("delegate is_method_call to JS extractor", () => {
      const code = "obj.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      expect(TYPESCRIPT_METADATA_EXTRACTORS.is_method_call(call_expr)).toBe(true);
    });

    it("delegate extract_call_name to JS extractor", () => {
      const code = "obj.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      expect(TYPESCRIPT_METADATA_EXTRACTORS.extract_call_name(call_expr)).toBe("method");
    });

    it("delegate extract_is_optional_chain to JS extractor", () => {
      const code = "obj?.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      expect(TYPESCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(call_expr)).toBe(true);
    });

    it("delegate extract_receiver_info to JS extractor", () => {
      const code = "this.method()";
      const tree = parser.parse(code);
      const call_expr = tree.rootNode.descendantsOfType("call_expression")[0];

      const result = TYPESCRIPT_METADATA_EXTRACTORS.extract_receiver_info(call_expr, TEST_FILE);

      expect(result).toBeDefined();
      expect(result!.is_self_reference).toBe(true);
      expect(result!.self_keyword).toBe("this");
      expect(result!.property_chain).toEqual(["this", "method"]);
    });
  });
});
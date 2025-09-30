/**
 * Tests for JavaScript language configuration with builder pattern
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import type { SyntaxNode } from "tree-sitter";
import { JAVASCRIPT_BUILDER_CONFIG } from "./javascript_builder";
import { DefinitionBuilder } from "../../definitions/definition_builder";
import type { ProcessingContext, RawCapture } from "../scope_processor";
import type { Location, ScopeId } from "@ariadnejs/types";

describe("JavaScript Builder Configuration", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  // Helper function to create test context
  function createTestContext(): ProcessingContext {
    const test_scope_id = "module:test.js:1:0:100:0:<module>" as ScopeId;

    return {
      scopes: new Map(),
      scope_depths: new Map(),
      root_scope_id: test_scope_id,
      get_scope_id: (location: Location) => test_scope_id,
    };
  }

  // Helper function to create a raw capture from code
  function createCapture(code: string, captureName: string, nodeType: string): RawCapture {
    const ast = parser.parse(code);
    const node = findNodeByType(ast.rootNode, nodeType);
    if (!node) {
      throw new Error(`Could not find node of type ${nodeType} in code`);
    }

    return {
      name: captureName,
      node: node as any,
      text: node.text,
    };
  }

  // Helper function to find first node of specific type
  function findNodeByType(node: SyntaxNode, type: string): SyntaxNode | null {
    if (node.type === type) return node;

    for (let i = 0; i < node.childCount; i++) {
      const found = findNodeByType(node.child(i)!, type);
      if (found) return found;
    }
    return null;
  }

  describe("JAVASCRIPT_BUILDER_CONFIG", () => {
    it("should export a valid LanguageBuilderConfig", () => {
      expect(JAVASCRIPT_BUILDER_CONFIG).toBeDefined();
      expect(JAVASCRIPT_BUILDER_CONFIG).toBeInstanceOf(Map);
      expect(JAVASCRIPT_BUILDER_CONFIG.size).toBeGreaterThan(0);
    });

    it("should contain definition capture mappings with process functions", () => {
      const definitionMappings = [
        "def.class",
        "def.method",
        "def.constructor",
        "def.function",
        "def.arrow",
        "def.param",
        "def.parameter",
        "def.variable",
        "def.field",
        "def.property",
      ];

      for (const mapping of definitionMappings) {
        expect(JAVASCRIPT_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = JAVASCRIPT_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    it("should contain import capture mappings with process functions", () => {
      const importMappings = [
        "def.import",
        "import.named",
        "import.default",
        "import.namespace",
      ];

      for (const mapping of importMappings) {
        expect(JAVASCRIPT_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = JAVASCRIPT_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    describe("Process Functions", () => {
      it("should process class definitions", () => {
        const code = "class MyClass { }";
        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        // Find the class name identifier
        const ast = parser.parse(code);
        const classNode = findNodeByType(ast.rootNode, "class_declaration");
        const nameNode = classNode?.childForFieldName("name");

        if (!nameNode) {
          throw new Error("Could not find class name");
        }

        const capture: RawCapture = {
          name: "def.class",
          node: nameNode as any,
          text: nameNode.text,
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("def.class");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const definitions = builder.build();
        expect(definitions).toHaveLength(1);
        expect(definitions[0].kind).toBe("class");
        expect(definitions[0].name).toBe("MyClass");
      });

      it("should process function definitions", () => {
        const code = "function myFunction() { }";
        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        const funcNode = findNodeByType(ast.rootNode, "function_declaration");
        const nameNode = funcNode?.childForFieldName("name");

        if (!nameNode) {
          throw new Error("Could not find function name");
        }

        const capture: RawCapture = {
          name: "def.function",
          node: nameNode as any,
          text: nameNode.text,
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("def.function");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const definitions = builder.build();
        expect(definitions).toHaveLength(1);
        expect(definitions[0].kind).toBe("function");
        expect(definitions[0].name).toBe("myFunction");
      });

      it("should process variable definitions", () => {
        const code = "const myVar = 123;";
        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        const varNode = findNodeByType(ast.rootNode, "variable_declarator");
        const nameNode = varNode?.childForFieldName("name");

        if (!nameNode) {
          throw new Error("Could not find variable name");
        }

        const capture: RawCapture = {
          name: "def.variable",
          node: nameNode as any,
          text: nameNode.text,
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("def.variable");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const definitions = builder.build();
        expect(definitions).toHaveLength(1);
        expect(definitions[0].kind).toBe("constant");
        expect(definitions[0].name).toBe("myVar");
      });

      it("should process method definitions in classes", () => {
        const code = `
          class MyClass {
            myMethod() { }
          }
        `;
        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);

        // First add the class
        const classNode = findNodeByType(ast.rootNode, "class_declaration");
        const classNameNode = classNode?.childForFieldName("name");

        if (!classNameNode) {
          throw new Error("Could not find class name");
        }

        const classCapture: RawCapture = {
          name: "def.class",
          node: classNameNode as any,
          text: classNameNode.text,
        };

        const classProcessor = JAVASCRIPT_BUILDER_CONFIG.get("def.class");
        classProcessor?.process(classCapture, builder, context);

        // Then add the method
        const methodNode = findNodeByType(ast.rootNode, "method_definition");
        const methodNameNode = methodNode?.childForFieldName("name");

        if (!methodNameNode) {
          throw new Error("Could not find method name");
        }

        const methodCapture: RawCapture = {
          name: "def.method",
          node: methodNameNode as any,
          text: methodNameNode.text,
        };

        const methodProcessor = JAVASCRIPT_BUILDER_CONFIG.get("def.method");
        methodProcessor?.process(methodCapture, builder, context);

        const definitions = builder.build();
        expect(definitions).toHaveLength(1);
        expect(definitions[0].kind).toBe("class");

        const classDef = definitions[0] as any;
        expect(classDef.methods).toHaveLength(1);
        expect(classDef.methods[0].name).toBe("myMethod");
      });

      it("should process import statements", () => {
        const code = "import React from 'react';";
        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        const importClause = findNodeByType(ast.rootNode, "import_clause");
        const nameNode = importClause?.child(0); // Default import identifier

        if (!nameNode) {
          throw new Error("Could not find import name");
        }

        const capture: RawCapture = {
          name: "import.default",
          node: nameNode as any,
          text: nameNode.text,
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("import.default");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const definitions = builder.build();
        expect(definitions).toHaveLength(1);
        expect(definitions[0].kind).toBe("import");
        expect(definitions[0].name).toBe("React");

        const importDef = definitions[0] as any;
        expect(importDef.is_default).toBe(true);
        expect(importDef.import_path).toBe("react");
      });

      it("should process arrow function assignments", () => {
        const code = "const myFunc = () => {};";
        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        const varNode = findNodeByType(ast.rootNode, "variable_declarator");
        const nameNode = varNode?.childForFieldName("name");

        if (!nameNode) {
          throw new Error("Could not find arrow function name");
        }

        const capture: RawCapture = {
          name: "def.arrow",
          node: nameNode as any,
          text: nameNode.text,
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("def.arrow");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const definitions = builder.build();
        expect(definitions).toHaveLength(1);
        expect(definitions[0].kind).toBe("function");
        expect(definitions[0].name).toBe("myFunc");
      });

      it("should process class properties", () => {
        const code = `
          class MyClass {
            myProperty = 42;
          }
        `;
        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);

        // First add the class
        const classNode = findNodeByType(ast.rootNode, "class_declaration");
        const classNameNode = classNode?.childForFieldName("name");

        if (!classNameNode) {
          throw new Error("Could not find class name");
        }

        const classCapture: RawCapture = {
          name: "def.class",
          node: classNameNode as any,
          text: classNameNode.text,
        };

        const classProcessor = JAVASCRIPT_BUILDER_CONFIG.get("def.class");
        classProcessor?.process(classCapture, builder, context);

        // Then add the property
        const fieldNode = findNodeByType(ast.rootNode, "field_definition");
        const propNode = fieldNode?.childForFieldName("property");

        if (!propNode) {
          throw new Error("Could not find property name");
        }

        const propCapture: RawCapture = {
          name: "def.field",
          node: propNode as any,
          text: propNode.text,
        };

        const propProcessor = JAVASCRIPT_BUILDER_CONFIG.get("def.field");
        propProcessor?.process(propCapture, builder, context);

        const definitions = builder.build();
        expect(definitions).toHaveLength(1);
        expect(definitions[0].kind).toBe("class");

        const classDef = definitions[0] as any;
        expect(classDef.properties).toHaveLength(1);
        expect(classDef.properties[0].name).toBe("myProperty");
      });

      it("should process function parameters", () => {
        const code = "function myFunc(param1, param2) { }";
        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);

        // First add the function
        const funcNode = findNodeByType(ast.rootNode, "function_declaration");
        const funcNameNode = funcNode?.childForFieldName("name");

        if (!funcNameNode) {
          throw new Error("Could not find function name");
        }

        const funcCapture: RawCapture = {
          name: "def.function",
          node: funcNameNode as any,
          text: funcNameNode.text,
        };

        const funcProcessor = JAVASCRIPT_BUILDER_CONFIG.get("def.function");
        funcProcessor?.process(funcCapture, builder, context);

        // Then add the parameters
        const paramsNode = funcNode?.childForFieldName("parameters");
        if (!paramsNode) {
          throw new Error("Could not find parameters");
        }

        for (const child of paramsNode.namedChildren) {
          if (child.type === "identifier") {
            const paramCapture: RawCapture = {
              name: "def.param",
              node: child as any,
              text: child.text,
            };

            const paramProcessor = JAVASCRIPT_BUILDER_CONFIG.get("def.param");
            paramProcessor?.process(paramCapture, builder, context);
          }
        }

        const definitions = builder.build();
        expect(definitions).toHaveLength(1);
        expect(definitions[0].kind).toBe("function");

        const funcDef = definitions[0] as any;
        expect(funcDef.signature.parameters).toHaveLength(2);
      });
    });

    describe("Field Coverage", () => {
      it("should have 100% coverage of all required Definition fields", () => {
        const code = `
          export class MyClass extends BaseClass {
            myProperty = "value";

            constructor(param) { }

            public myMethod(arg: string): void { }
          }
        `;

        const context = createTestContext();
        const builder = new DefinitionBuilder(context);
        const ast = parser.parse(code);

        // Process class definition
        const classNode = findNodeByType(ast.rootNode, "class_declaration");
        const classNameNode = classNode?.childForFieldName("name");

        if (classNameNode) {
          const classCapture: RawCapture = {
            name: "def.class",
            node: classNameNode as any,
            text: classNameNode.text,
          };
          const classProcessor = JAVASCRIPT_BUILDER_CONFIG.get("def.class");
          classProcessor?.process(classCapture, builder, context);
        }

        const definitions = builder.build();
        expect(definitions).toHaveLength(1);

        const classDef = definitions[0];

        // Check all required fields are populated
        expect(classDef.kind).toBe("class");
        expect(classDef.symbol_id).toBeDefined();
        expect(classDef.name).toBe("MyClass");
        expect(classDef.location).toBeDefined();
        expect(classDef.scope_id).toBeDefined();
        expect(classDef.availability).toBeDefined();

        // Check location has all subfields
        expect(classDef.location.line).toBeGreaterThan(0);
        expect(classDef.location.column).toBeGreaterThanOrEqual(0);
        expect(classDef.location.end_line).toBeGreaterThan(0);
        expect(classDef.location.end_column).toBeGreaterThanOrEqual(0);

        // Check availability has scope field
        expect(classDef.availability.scope).toBeDefined();
      });
    });
  });
});
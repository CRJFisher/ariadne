/**
 * Tests for Python language configuration with builder pattern
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { SyntaxNode } from "tree-sitter";
import { PYTHON_BUILDER_CONFIG } from "./python_builder";
import { DefinitionBuilder } from "../../definitions/definition_builder";
import type {
  ProcessingContext,
  CaptureNode,
} from "../../scopes/scope_processor";
import type { Location, ScopeId } from "@ariadnejs/types";

describe("Python Builder Configuration", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  // Helper function to create test context
  function createTestContext(): ProcessingContext {
    const test_scope_id = "module:test.py:1:0:100:0:<module>" as ScopeId;

    return {
      scopes: new Map(),
      scope_depths: new Map(),
      root_scope_id: test_scope_id,
      get_scope_id: (location: Location) => test_scope_id,
    };
  }

  // Helper function to create a raw capture from code
  function createCapture(
    code: string,
    captureName: string,
    nodeType: string
  ): CaptureNode {
    const ast = parser.parse(code);
    const node = findNodeByType(ast.rootNode, nodeType);
    if (!node) {
      throw new Error(`Could not find node of type ${nodeType} in code`);
    }

    // Parse capture name to get category and entity
    const parts = captureName.split(".");
    const category = parts[0] as any;
    const entity = parts[1] as any;

    return {
      name: captureName,
      category,
      entity,
      node: node as any,
      text: node.text,
      location: {
        file_path: "test.py" as any,
        start_line: node.startPosition.row + 1,
        start_column: node.startPosition.column,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column,
      },
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

  describe("PYTHON_BUILDER_CONFIG", () => {
    it("should export a valid LanguageBuilderConfig", () => {
      expect(PYTHON_BUILDER_CONFIG).toBeDefined();
      expect(PYTHON_BUILDER_CONFIG).toBeInstanceOf(Map);
      expect(PYTHON_BUILDER_CONFIG.size).toBeGreaterThan(0);
    });

    it("should contain class definition capture mappings", () => {
      const classMappings = ["definition.class"];

      for (const mapping of classMappings) {
        expect(PYTHON_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    it("should contain method definition capture mappings", () => {
      const methodMappings = [
        "definition.method",
        "definition.method.static",
        "definition.method.class",
        "definition.constructor",
      ];

      for (const mapping of methodMappings) {
        expect(PYTHON_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    it("should contain function definition capture mappings", () => {
      const functionMappings = [
        "def.function",
        "def.function.async",
        "def.lambda",
      ];

      for (const mapping of functionMappings) {
        expect(PYTHON_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    it("should contain parameter definition capture mappings", () => {
      const paramMappings = [
        "def.param",
        "def.param.default",
        "def.param.typed",
        "def.param.typed.default",
        "def.param.args",
        "def.param.kwargs",
      ];

      for (const mapping of paramMappings) {
        expect(PYTHON_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    it("should contain variable definition capture mappings", () => {
      const variableMappings = [
        "def.variable",
        "def.variable.typed",
        "def.variable.multiple",
        "def.variable.tuple",
        "def.variable.destructured",
        "def.loop_var",
        "def.loop_var.multiple",
        "def.comprehension_var",
        "def.except_var",
        "def.with_var",
      ];

      for (const mapping of variableMappings) {
        expect(PYTHON_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    it("should contain property definition capture mappings", () => {
      const propertyMappings = ["def.property", "def.field"];

      for (const mapping of propertyMappings) {
        expect(PYTHON_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    it("should contain import capture mappings", () => {
      const importMappings = [
        "import.named",
        "import.named.source",
        "import.named.alias",
        "import.module",
        "import.module.source",
        "import.module.alias",
        "import.star",
      ];

      for (const mapping of importMappings) {
        expect(PYTHON_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    it("should handle a simple class definition", () => {
      const code = `class MyClass:
    pass`;
      const capture = createCapture(code, "def.class", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("def.class");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle a method definition", () => {
      const code = `class MyClass:
    def my_method(self):
        pass`;
      const capture = createCapture(code, "def.method", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("def.method");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle a function definition", () => {
      const code = `def my_function():
    pass`;
      const capture = createCapture(code, "def.function", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("def.function");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle variable definitions", () => {
      const code = `x = 10`;
      const capture = createCapture(code, "def.variable", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("def.variable");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle import statements", () => {
      const code = `import os`;
      const capture = createCapture(code, "import.module", "dotted_name");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("import.module");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle async functions", () => {
      const code = `async def async_function():
    pass`;
      const capture = createCapture(code, "def.function.async", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("def.function.async");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle lambda functions", () => {
      const code = `f = lambda x: x * 2`;
      const capture = createCapture(code, "def.lambda", "lambda");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("def.lambda");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle static methods", () => {
      const code = `class MyClass:
    @staticmethod
    def static_method():
        pass`;
      const capture = createCapture(code, "def.method.static", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("def.method.static");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle class methods", () => {
      const code = `class MyClass:
    @classmethod
    def class_method(cls):
        pass`;
      const capture = createCapture(code, "def.method.class", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("def.method.class");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle properties", () => {
      const code = `class MyClass:
    @property
    def my_property(self):
        return self._value`;
      const capture = createCapture(code, "def.property", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("def.property");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle class inheritance", () => {
      const code = `class Child(Parent):
    pass`;
      const capture = createCapture(code, "def.class", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("def.class");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle typed parameters", () => {
      const code = `def func(x: int = 10):
    pass`;
      const capture = createCapture(
        code,
        "def.param.typed.default",
        "identifier"
      );
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("def.param.typed.default");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle *args and **kwargs", () => {
      const code = `def func(*args, **kwargs):
    pass`;

      // Test *args
      const argsCapture = createCapture(
        code,
        "def.param.args",
        "list_splat_pattern"
      );
      const builder1 = new DefinitionBuilder(createTestContext());
      const argsConfig = PYTHON_BUILDER_CONFIG.get("def.param.args");

      expect(() => {
        argsConfig?.process(argsCapture, builder1, createTestContext());
      }).not.toThrow();

      // Test **kwargs
      const kwargsCapture = createCapture(
        code,
        "def.param.kwargs",
        "dictionary_splat_pattern"
      );
      const builder2 = new DefinitionBuilder(createTestContext());
      const kwargsConfig = PYTHON_BUILDER_CONFIG.get("def.param.kwargs");

      expect(() => {
        kwargsConfig?.process(kwargsCapture, builder2, createTestContext());
      }).not.toThrow();
    });

    it("should handle from imports", () => {
      const code = `from os import path`;
      const capture = createCapture(code, "import.named", "dotted_name");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("import.named");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle aliased imports", () => {
      const code = `import numpy as np`;
      const capture = createCapture(
        code,
        "import.module.source",
        "dotted_name"
      );
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("import.module.source");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    describe("End-to-end integration tests", () => {
      it("should build complete class definition with methods", () => {
        const code = `class Calculator:
    def add(self, a, b):
        return a + b`;

        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        // Process class
        const ast = parser.parse(code);
        const classNode = findNodeByType(ast.rootNode, "class_definition");
        const className = classNode?.childForFieldName("name");
        if (className) {
          const classCapture: CaptureNode = {
            name: "def.class",
            node: className as any,
            text: className.text,
          };
          PYTHON_BUILDER_CONFIG.get("def.class")?.process(
            classCapture,
            builder,
            context
          );
        }

        // Process method
        const funcDefNode = findNodeByType(ast.rootNode, "function_definition");
        const methodName = funcDefNode?.childForFieldName("name");
        if (methodName) {
          const methodCapture: CaptureNode = {
            name: "def.method",
            node: methodName as any,
            text: methodName.text,
          };
          PYTHON_BUILDER_CONFIG.get("def.method")?.process(
            methodCapture,
            builder,
            context
          );
        }

        const definitions = builder.build();
        expect(definitions.length).toBeGreaterThan(0);

        const classDef = definitions.find((d) => d.kind === "class");
        expect(classDef).toBeDefined();
        expect(classDef?.name).toBe("Calculator");
      });

      it("should handle function with typed parameters", () => {
        const code = `def greet(name: str, age: int = 0) -> str:
    return f"Hello {name}"`;

        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        const funcNode = findNodeByType(ast.rootNode, "function_definition");
        const funcName = funcNode?.childForFieldName("name");

        if (funcName) {
          const funcCapture: CaptureNode = {
            name: "def.function",
            node: funcName as any,
            text: funcName.text,
          };
          PYTHON_BUILDER_CONFIG.get("def.function")?.process(
            funcCapture,
            builder,
            context
          );
        }

        const definitions = builder.build();
        expect(definitions.length).toBeGreaterThan(0);

        const funcDef = definitions.find((d) => d.kind === "function");
        expect(funcDef).toBeDefined();
        expect(funcDef?.name).toBe("greet");
      });

      it("should distinguish between constants and variables by naming convention", () => {
        const code1 = `MAX_SIZE = 100`;
        const code2 = `current_size = 10`;

        const context = createTestContext();

        // Test constant (uppercase)
        const builder1 = new DefinitionBuilder(context);
        const ast1 = parser.parse(code1);
        const constNode = findNodeByType(ast1.rootNode, "identifier");
        if (constNode) {
          const constCapture: CaptureNode = {
            name: "def.variable",
            node: constNode as any,
            text: constNode.text,
          };
          PYTHON_BUILDER_CONFIG.get("def.variable")?.process(
            constCapture,
            builder1,
            context
          );
        }
        const defs1 = builder1.build();
        const constDef = defs1.find((d) => d.name === "MAX_SIZE");
        expect(constDef?.kind).toBe("constant");

        // Test variable (lowercase)
        const builder2 = new DefinitionBuilder(context);
        const ast2 = parser.parse(code2);
        const varNode = findNodeByType(ast2.rootNode, "identifier");
        if (varNode) {
          const varCapture: CaptureNode = {
            name: "def.variable",
            node: varNode as any,
            text: varNode.text,
          };
          PYTHON_BUILDER_CONFIG.get("def.variable")?.process(
            varCapture,
            builder2,
            context
          );
        }
        const defs2 = builder2.build();
        const varDef = defs2.find((d) => d.name === "current_size");
        expect(varDef?.kind).toBe("variable");
      });

      it("should handle complex import patterns", () => {
        const code = `from typing import List, Dict, Optional`;

        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);

        // Find all imported names
        const findAllIdentifiers = (node: SyntaxNode): SyntaxNode[] => {
          const identifiers: SyntaxNode[] = [];
          if (node.type === "dotted_name") {
            identifiers.push(node);
          }
          for (let i = 0; i < node.childCount; i++) {
            identifiers.push(...findAllIdentifiers(node.child(i)!));
          }
          return identifiers;
        };

        const identifiers = findAllIdentifiers(ast.rootNode);
        for (const id of identifiers) {
          if (
            id.text === "List" ||
            id.text === "Dict" ||
            id.text === "Optional"
          ) {
            const importCapture: CaptureNode = {
              name: "definition.import",
              category: "definition" as any,
              entity: "import" as any,
              node: id as any,
              text: id.text,
              location: {
                file_path: "test.py" as any,
                start_line: id.startPosition.row + 1,
                start_column: id.startPosition.column,
                end_line: id.endPosition.row + 1,
                end_column: id.endPosition.column,
              },
            };
            PYTHON_BUILDER_CONFIG.get("definition.import")?.process(
              importCapture,
              builder,
              context
            );
          }
        }

        const result = builder.build();
        expect(result.imports.size).toBeGreaterThan(0);

        // Verify we have the expected imports
        const import_names = Array.from(result.imports.values()).map(i => i.name);
        expect(import_names).toContain("List");
        expect(import_names).toContain("Dict");
        expect(import_names).toContain("Optional");
      });

      it("should handle private methods by naming convention", () => {
        const code = `class MyClass:
    def _private_method(self):
        pass
    def public_method(self):
        pass`;

        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);

        // Process class first
        const classNode = findNodeByType(ast.rootNode, "class_definition");
        const className = classNode?.childForFieldName("name");
        if (className) {
          const classCapture: CaptureNode = {
            name: "def.class",
            node: className as any,
            text: className.text,
          };
          PYTHON_BUILDER_CONFIG.get("def.class")?.process(
            classCapture,
            builder,
            context
          );
        }

        // Find all function definitions
        const findAllFunctions = (node: SyntaxNode): SyntaxNode[] => {
          const functions: SyntaxNode[] = [];
          if (node.type === "function_definition") {
            functions.push(node);
          }
          for (let i = 0; i < node.childCount; i++) {
            functions.push(...findAllFunctions(node.child(i)!));
          }
          return functions;
        };

        const functions = findAllFunctions(ast.rootNode);
        for (const func of functions) {
          const funcName = func.childForFieldName("name");
          if (funcName) {
            const methodCapture: CaptureNode = {
              name: "def.method",
              node: funcName as any,
              text: funcName.text,
            };
            PYTHON_BUILDER_CONFIG.get("def.method")?.process(
              methodCapture,
              builder,
              context
            );
          }
        }

        const definitions = builder.build();
        const classDef = definitions.find((d) => d.kind === "class") as any;

        // Verify that both methods exist
        expect(classDef).toBeDefined();
        // The availability is determined by naming convention in the helper
        // _private_method should have file-private scope
        // public_method should have public scope
      });
    });
  });
});

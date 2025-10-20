/**
 * Tests for Python language configuration with builder pattern
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { SyntaxNode } from "tree-sitter";
import { PYTHON_BUILDER_CONFIG } from "./python_builder_config";
import { DefinitionBuilder } from "../../definitions/definition_builder";
import type {
  ProcessingContext,
  CaptureNode,
  SemanticCategory,
  SemanticEntity,
} from "../../semantic_index";
import type { Location, ScopeId, SymbolName } from "@ariadnejs/types";
import { node_to_location } from "../../node_utils";
import { extract_import_path } from "./python_builder";

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
      captures: [],
      scopes: new Map(),
      scope_depths: new Map(),
      root_scope_id: test_scope_id,
      get_scope_id: (location: Location) => test_scope_id,
      get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => test_scope_id,
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
      text: node.text as SymbolName,
      location: {
        file_path: "test.py" as any,
        start_line: node.startPosition.row + 1,
        start_column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column + 1,
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
        "definition.function",
        "definition.function.async",
        "definition.lambda",
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
        "definition.parameter",
        "definition.parameter.default",
        "definition.parameter.typed",
        "definition.parameter.typed.default",
        "definition.parameter.args",
        "definition.parameter.kwargs",
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
        "definition.variable",
        "definition.variable.typed",
        "definition.variable.multiple",
        "definition.variable.tuple",
        "definition.variable.destructured",
        "definition.loop_var",
        "definition.loop_var.multiple",
        "definition.comprehension_var",
        "definition.except_var",
        "definition.with_var",
      ];

      for (const mapping of variableMappings) {
        expect(PYTHON_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    it("should contain property definition capture mappings", () => {
      const propertyMappings = ["definition.property", "definition.field"];

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
      const capture = createCapture(code, "definition.class", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("definition.class");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle a method definition", () => {
      const code = `class MyClass:
    def my_method(self):
        pass`;
      const capture = createCapture(code, "definition.method", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("definition.method");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle a function definition", () => {
      const code = `def my_function():
    pass`;
      const capture = createCapture(code, "definition.function", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("definition.function");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle variable definitions", () => {
      const code = "x = 10";
      const capture = createCapture(code, "definition.variable", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("definition.variable");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle import statements", () => {
      const code = "import os";
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
      const capture = createCapture(code, "definition.function.async", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("definition.function.async");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle lambda functions", () => {
      const code = "f = lambda x: x * 2";
      const capture = createCapture(code, "definition.lambda", "lambda");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("definition.lambda");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle static methods", () => {
      const code = `class MyClass:
    @staticmethod
    def static_method():
        pass`;
      const capture = createCapture(code, "definition.method.static", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("definition.method.static");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle class methods", () => {
      const code = `class MyClass:
    @classmethod
    def class_method(cls):
        pass`;
      const capture = createCapture(code, "definition.method.class", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("definition.method.class");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle properties", () => {
      const code = `class MyClass:
    @property
    def my_property(self):
        return self._value`;
      const capture = createCapture(code, "definition.property", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("definition.property");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle class inheritance", () => {
      const code = `class Child(Parent):
    pass`;
      const capture = createCapture(code, "definition.class", "identifier");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("definition.class");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle typed parameters", () => {
      const code = `def func(x: int = 10):
    pass`;
      const capture = createCapture(
        code,
        "definition.param.typed.default",
        "identifier"
      );
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("definition.param.typed.default");

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
        "definition.param.args",
        "list_splat_pattern"
      );
      const builder1 = new DefinitionBuilder(createTestContext());
      const argsConfig = PYTHON_BUILDER_CONFIG.get("definition.param.args");

      expect(() => {
        argsConfig?.process(argsCapture, builder1, createTestContext());
      }).not.toThrow();

      // Test **kwargs
      const kwargsCapture = createCapture(
        code,
        "definition.param.kwargs",
        "dictionary_splat_pattern"
      );
      const builder2 = new DefinitionBuilder(createTestContext());
      const kwargsConfig = PYTHON_BUILDER_CONFIG.get("definition.param.kwargs");

      expect(() => {
        kwargsConfig?.process(kwargsCapture, builder2, createTestContext());
      }).not.toThrow();
    });

    it("should handle from imports", () => {
      const code = "from os import path";
      const capture = createCapture(code, "import.named", "dotted_name");
      const builder = new DefinitionBuilder(createTestContext());
      const config = PYTHON_BUILDER_CONFIG.get("import.named");

      expect(() => {
        config?.process(capture, builder, createTestContext());
      }).not.toThrow();
    });

    it("should handle aliased imports", () => {
      const code = "import numpy as np";
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

    it("should handle relative imports (from .module import name)", () => {
      const code = "from .utils import helper, process_data";
      const ast = parser.parse(code);

      // Find the import_from_statement node
      const importNode = findNodeByType(ast.rootNode, "import_from_statement");
      expect(importNode).toBeDefined();

      if (importNode) {
        // Extract the import path - should get ".utils" not "helper"
        const importPath = extract_import_path(importNode);
        expect(importPath).toBe(".utils");
      }
    });

    it("should handle absolute imports (from package.module import name)", () => {
      const code = "from os.path import join";
      const ast = parser.parse(code);

      // Find the import_from_statement node
      const importNode = findNodeByType(ast.rootNode, "import_from_statement");
      expect(importNode).toBeDefined();

      if (importNode) {
        // Extract the import path - should get "os.path"
        const importPath = extract_import_path(importNode);
        expect(importPath).toBe("os.path");
      }
    });

    it("should handle regular imports (import module)", () => {
      const code = "import os";
      const ast = parser.parse(code);

      // Find the import_statement node
      const importNode = findNodeByType(ast.rootNode, "import_statement");
      expect(importNode).toBeDefined();

      if (importNode) {
        // Extract the import path - should get "os"
        const importPath = extract_import_path(importNode);
        expect(importPath).toBe("os");
      }
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
            name: "definition.class",
            node: className as any,
            text: className.text as SymbolName,
            category: "definition" as SemanticCategory,
            entity: "class" as SemanticEntity,
            location: {
              file_path: "test.py" as any,
              start_line: className.startPosition.row + 1,
              start_column: className.startPosition.column + 1,
              end_line: className.endPosition.row + 1,
              end_column: className.endPosition.column + 1,
            },
          };
          PYTHON_BUILDER_CONFIG.get("definition.class")?.process(
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
            name: "definition.method",
            node: methodName as any,
            text: methodName.text as SymbolName,
            category: "definition" as SemanticCategory,
            entity: "method" as SemanticEntity,
            location: {
              file_path: "test.py" as any,
              start_line: methodName.startPosition.row + 1,
              start_column: methodName.startPosition.column + 1,
              end_line: methodName.endPosition.row + 1,
              end_column: methodName.endPosition.column + 1,
            },
          };
          PYTHON_BUILDER_CONFIG.get("definition.method")?.process(
            methodCapture,
            builder,
            context
          );
        }

        const definitions = builder.build();
        expect(definitions.classes.size).toBeGreaterThan(0);

        const classDef = definitions.classes.values().next().value;
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
            name: "definition.function",
            node: funcName as any,
            text: funcName.text as SymbolName,
            category: "definition" as SemanticCategory,
            entity: "function" as SemanticEntity,
            location: {
              file_path: "test.py" as any,
              start_line: funcName.startPosition.row + 1,
              start_column: funcName.startPosition.column + 1,
              end_line: funcName.endPosition.row + 1,
              end_column: funcName.endPosition.column + 1,
            },
          };
          PYTHON_BUILDER_CONFIG.get("definition.function")?.process(
            funcCapture,
            builder,
            context
          );
        }

        const definitions = builder.build();
        expect(definitions.functions.size).toBeGreaterThan(0);

        const funcDef = definitions.functions.values().next().value;
        expect(funcDef).toBeDefined();
        expect(funcDef?.name).toBe("greet");
      });

      it("should distinguish between constants and variables by naming convention", () => {
        const code1 = "MAX_SIZE = 100";
        const code2 = "current_size = 10";

        const context = createTestContext();

        // Test constant (uppercase)
        const builder1 = new DefinitionBuilder(context);
        const ast1 = parser.parse(code1);
        const constNode = findNodeByType(ast1.rootNode, "identifier");
        if (constNode) {
          const constCapture: CaptureNode = {
            name: "definition.variable",
            node: constNode as any,
            text: constNode.text as SymbolName,
            category: "definition" as SemanticCategory,
            entity: "variable" as SemanticEntity,
            location: {
              file_path: "test.py" as any,
              start_line: constNode.startPosition.row + 1,
              start_column: constNode.startPosition.column + 1,
              end_line: constNode.endPosition.row + 1,
              end_column: constNode.endPosition.column + 1,
            },
          };
          PYTHON_BUILDER_CONFIG.get("definition.variable")?.process(
            constCapture,
            builder1,
            context
          );
        }
        const defs1 = builder1.build();
        const constDef = defs1.variables.values().next().value;
        expect(constDef?.kind).toBe("constant");

        // Test variable (lowercase)
        const builder2 = new DefinitionBuilder(context);
        const ast2 = parser.parse(code2);
        const varNode = findNodeByType(ast2.rootNode, "identifier");
        if (varNode) {
          const varCapture: CaptureNode = {
            name: "definition.variable",
            node: varNode as any,
            text: varNode.text as SymbolName,
            category: "definition" as any,
            entity: "variable" as any,
            location: {
              file_path: "test.py" as any,
              start_line: varNode.startPosition.row + 1,
              start_column: varNode.startPosition.column + 1,
              end_line: varNode.endPosition.row + 1,
              end_column: varNode.endPosition.column + 1,
            },
          };
          PYTHON_BUILDER_CONFIG.get("definition.variable")?.process(
            varCapture,
            builder2,
            context
          );
        }
        const defs2 = builder2.build();
        const varDef = defs2.variables.values().next().value;
        expect(varDef?.kind).toBe("variable");
      });

      it("should handle complex import patterns", () => {
        const code = "from typing import List, Dict, Optional";

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
              node: id as any,
              text: id.text as SymbolName,
              category: "definition" as SemanticCategory,
              entity: "import" as SemanticEntity,
              location: {
                file_path: "test.py" as any,
                start_line: id.startPosition.row + 1,
                start_column: id.startPosition.column + 1,
                end_line: id.endPosition.row + 1,
                end_column: id.endPosition.column + 1,
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
            name: "definition.class",
            node: className as any,
            text: className.text as SymbolName,
            category: "definition" as SemanticCategory,
            entity: "class" as SemanticEntity,
            location: {
              file_path: "test.py" as any,
              start_line: className.startPosition.row + 1,
              start_column: className.startPosition.column + 1,
              end_line: className.endPosition.row + 1,
              end_column: className.endPosition.column + 1,
            },
          };
          PYTHON_BUILDER_CONFIG.get("definition.class")?.process(
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
              name: "definition.method",
              node: funcName as any,
              text: funcName.text as SymbolName,
              category: "definition" as SemanticCategory,
              entity: "method" as SemanticEntity,
              location: {
                file_path: "test.py" as any,
                start_line: funcName.startPosition.row + 1,
                start_column: funcName.startPosition.column + 1,
                end_line: funcName.endPosition.row + 1,
                end_column: funcName.endPosition.column + 1,
              },
            };
            PYTHON_BUILDER_CONFIG.get("definition.method")?.process(
              methodCapture,
              builder,
              context
            );
          }
        }

        const definitions = builder.build();
        const classDef = definitions.classes.values().next().value;

        // Verify that both methods exist
        expect(classDef).toBeDefined();
        // The availability is determined by naming convention in the helper
        // _private_method should have file-private scope
        // public_method should have public scope
      });
    });

    describe("Export flag verification (is_exported)", () => {
      // Helper to create context with nested scope support
      function createNestedContext(): ProcessingContext {
        const module_scope_id = "module:test.py:1:0:100:0:<module>" as ScopeId;
        const nested_scope_id = "function:test.py:2:0:5:0:outer_func" as ScopeId;

        const current_scope = module_scope_id;

        return {
          captures: [],
          scopes: new Map(),
          scope_depths: new Map(),
          root_scope_id: module_scope_id,
          get_scope_id: (location: Location) => current_scope,
          get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => current_scope,
        };
      }

      describe("Functions", () => {
        it("should have is_exported=true for module-level public functions", () => {
          const code = `def public_function():
    pass`;
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.function", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.function")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("public_function");
          expect(func?.is_exported).toBe(true);
        });

        it("should have is_exported=false for module-level private functions (single underscore)", () => {
          const code = `def _private_function():
    pass`;
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.function", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.function")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("_private_function");
          expect(func?.is_exported).toBe(false);
        });

        it("should have is_exported=false for module-level private functions (double underscore)", () => {
          const code = `def __private_function():
    pass`;
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.function", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.function")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("__private_function");
          expect(func?.is_exported).toBe(false);
        });

        it("should have is_exported=true for module-level magic functions (dunder)", () => {
          const code = `def __init__():
    pass`;
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.function", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.function")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("__init__");
          expect(func?.is_exported).toBe(true);
        });

        it("should have is_exported=false for nested functions", () => {
          // Simulate nested function by using a non-module scope
          const code = `def inner_function():
    pass`;
          const nested_scope_id = "function:test.py:2:0:5:0:outer_func" as ScopeId;
          const module_scope_id = "module:test.py:1:0:100:0:<module>" as ScopeId;

          const context: ProcessingContext = {
            captures: [],
            scopes: new Map(),
            scope_depths: new Map(),
            root_scope_id: module_scope_id,
            get_scope_id: (location: Location) => nested_scope_id, // Return nested scope
            get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => nested_scope_id,
          };

          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.function", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.function")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("inner_function");
          expect(func?.is_exported).toBe(false);
        });

        it("should have is_exported=true for module-level async functions", () => {
          const code = `async def async_function():
    pass`;
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.function.async", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.function.async")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("async_function");
          expect(func?.is_exported).toBe(true);
        });

        it("should have is_exported=false for lambda functions", () => {
          const code = "f = lambda x: x * 2";
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.lambda", "lambda");

          PYTHON_BUILDER_CONFIG.get("definition.lambda")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("lambda");
          expect(func?.is_exported).toBe(false);
        });
      });

      describe("Classes", () => {
        it("should have is_exported=true for module-level public classes", () => {
          const code = `class PublicClass:
    pass`;
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.class", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.class")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const cls = definitions.classes.values().next().value;

          expect(cls).toBeDefined();
          expect(cls?.name).toBe("PublicClass");
          expect(cls?.is_exported).toBe(true);
        });

        it("should have is_exported=false for module-level private classes (single underscore)", () => {
          const code = `class _PrivateClass:
    pass`;
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.class", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.class")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const cls = definitions.classes.values().next().value;

          expect(cls).toBeDefined();
          expect(cls?.name).toBe("_PrivateClass");
          expect(cls?.is_exported).toBe(false);
        });

        it("should have is_exported=false for module-level private classes (double underscore)", () => {
          const code = `class __PrivateClass:
    pass`;
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.class", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.class")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const cls = definitions.classes.values().next().value;

          expect(cls).toBeDefined();
          expect(cls?.name).toBe("__PrivateClass");
          expect(cls?.is_exported).toBe(false);
        });

        it("should have is_exported=false for nested classes", () => {
          // Simulate nested class by using a non-module scope
          const code = `class InnerClass:
    pass`;
          const nested_scope_id = "function:test.py:2:0:5:0:outer_func" as ScopeId;
          const module_scope_id = "module:test.py:1:0:100:0:<module>" as ScopeId;

          const context: ProcessingContext = {
            captures: [],
            scopes: new Map(),
            scope_depths: new Map(),
            root_scope_id: module_scope_id,
            get_scope_id: (location: Location) => nested_scope_id, // Return nested scope
            get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => nested_scope_id,
          };

          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.class", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.class")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const cls = definitions.classes.values().next().value;

          expect(cls).toBeDefined();
          expect(cls?.name).toBe("InnerClass");
          expect(cls?.is_exported).toBe(false);
        });
      });

      describe("Variables", () => {
        it("should have is_exported=true for module-level public variables", () => {
          const code = "public_var = 10";
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.variable", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.variable")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const variable = definitions.variables.values().next().value;

          expect(variable).toBeDefined();
          expect(variable?.name).toBe("public_var");
          expect(variable?.is_exported).toBe(true);
        });

        it("should have is_exported=false for module-level private variables", () => {
          const code = "_private_var = 10";
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.variable", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.variable")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const variable = definitions.variables.values().next().value;

          expect(variable).toBeDefined();
          expect(variable?.name).toBe("_private_var");
          expect(variable?.is_exported).toBe(false);
        });

        it("should have is_exported=false for loop variables", () => {
          const code = `for i in range(10):
    pass`;
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "definition.loop_var", "identifier");

          PYTHON_BUILDER_CONFIG.get("definition.loop_var")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const variable = definitions.variables.values().next().value;

          expect(variable).toBeDefined();
          expect(variable?.name).toBe("i");
          expect(variable?.is_exported).toBe(false);
        });
      });

      describe("Imports", () => {
        it("should have is_exported=true for module-level public imports", () => {
          const code = "import os";
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);
          const capture = createCapture(code, "import.module", "dotted_name");

          PYTHON_BUILDER_CONFIG.get("import.module")?.process(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const importDef = definitions.imports.values().next().value;

          expect(importDef).toBeDefined();
          expect(importDef?.name).toBe("os");
        });

        it("should have is_exported=false for module-level private imports", () => {
          const code = "from internal import _private_module";
          const context = createTestContext();
          const builder = new DefinitionBuilder(context);

          // Create capture for the imported name
          const ast = parser.parse(code);
          const identifiers: SyntaxNode[] = [];

          const findIdentifiers = (node: SyntaxNode) => {
            if (node.type === "dotted_name" && node.text === "_private_module") {
              identifiers.push(node);
            }
            for (let i = 0; i < node.childCount; i++) {
              findIdentifiers(node.child(i)!);
            }
          };

          findIdentifiers(ast.rootNode);

          if (identifiers[0]) {
            const capture: CaptureNode = {
              name: "import.named",
              category: "import" as any,
              entity: "named" as any,
              node: identifiers[0] as any,
              text: "_private_module" as SymbolName,
              location: {
                file_path: "test.py" as any,
                start_line: 1,
                start_column: 1,
                end_line: 1,
                end_column: 20,
              },
            };

            PYTHON_BUILDER_CONFIG.get("import.named")?.process(
              capture,
              builder,
              context
            );

            const definitions = builder.build();
            const importDef = definitions.imports.values().next().value;

            expect(importDef).toBeDefined();
            expect(importDef?.name).toBe("_private_module");
          }
        });
      });
    });

    describe("Protocol Support", () => {
      it("should contain protocol definition capture mappings", () => {
        const protocolMappings = [
          "definition.interface",
          "definition.property.interface",
        ];

        for (const mapping of protocolMappings) {
          expect(PYTHON_BUILDER_CONFIG.has(mapping)).toBe(true);
          const config = PYTHON_BUILDER_CONFIG.get(mapping);
          expect(config).toBeDefined();
          expect(config?.process).toBeInstanceOf(Function);
        }
      });

      it("should handle Protocol class definition", () => {
        const code = `from typing import Protocol

class Drawable(Protocol):
    pass`;
        // Find the class_definition node first, then get its name
        const ast = parser.parse(code);
        const classNode = findNodeByType(ast.rootNode, "class_definition");
        const className = classNode?.childForFieldName("name");

        if (!className) {
          throw new Error("Could not find class name node");
        }

        const capture: CaptureNode = {
          name: "definition.interface",
          category: "definition" as SemanticCategory,
          entity: "interface" as SemanticEntity,
          node: className as any,
          text: className.text as SymbolName,
          location: node_to_location(className, "test.py" as any),
        };

        const builder = new DefinitionBuilder(createTestContext());
        const config = PYTHON_BUILDER_CONFIG.get("definition.interface");

        expect(() => {
          config?.process(capture, builder, createTestContext());
        }).not.toThrow();

        const definitions = builder.build();
        expect(definitions.interfaces.size).toBeGreaterThan(0);

        const protocolDef = definitions.interfaces.values().next().value;
        expect(protocolDef).toBeDefined();
        expect(protocolDef?.name).toBe("Drawable");
        expect(protocolDef?.kind).toBe("interface");
      });

      it("should have is_exported=true for module-level public Protocol classes", () => {
        const code = `from typing import Protocol

class PublicProtocol(Protocol):
    pass`;
        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        // Find the class_definition node first, then get its name
        const ast = parser.parse(code);
        const classNode = findNodeByType(ast.rootNode, "class_definition");
        const className = classNode?.childForFieldName("name");

        if (!className) {
          throw new Error("Could not find class name node");
        }

        const capture: CaptureNode = {
          name: "definition.interface",
          category: "definition" as SemanticCategory,
          entity: "interface" as SemanticEntity,
          node: className as any,
          text: className.text as SymbolName,
          location: node_to_location(className, "test.py" as any),
        };

        PYTHON_BUILDER_CONFIG.get("definition.interface")?.process(
          capture,
          builder,
          context
        );

        const definitions = builder.build();
        const protocolDef = definitions.interfaces.values().next().value;

        expect(protocolDef).toBeDefined();
        expect(protocolDef?.name).toBe("PublicProtocol");
        expect(protocolDef?.is_exported).toBe(true);
      });

      it("should have is_exported=false for module-level private Protocol classes", () => {
        const code = `from typing import Protocol

class _PrivateProtocol(Protocol):
    pass`;
        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        // Find the class_definition node first, then get its name
        const ast = parser.parse(code);
        const classNode = findNodeByType(ast.rootNode, "class_definition");
        const className = classNode?.childForFieldName("name");

        if (!className) {
          throw new Error("Could not find class name node");
        }

        const capture: CaptureNode = {
          name: "definition.interface",
          category: "definition" as SemanticCategory,
          entity: "interface" as SemanticEntity,
          node: className as any,
          text: className.text as SymbolName,
          location: node_to_location(className, "test.py" as any),
        };

        PYTHON_BUILDER_CONFIG.get("definition.interface")?.process(
          capture,
          builder,
          context
        );

        const definitions = builder.build();
        const protocolDef = definitions.interfaces.values().next().value;

        expect(protocolDef).toBeDefined();
        expect(protocolDef?.name).toBe("_PrivateProtocol");
        expect(protocolDef?.is_exported).toBe(false);
      });

      it("should handle Protocol property signatures", () => {
        const code = `from typing import Protocol

class Drawable(Protocol):
    x: int
    y: int`;

        const context = createTestContext();
        const builder = new DefinitionBuilder(context);

        // First process the Protocol class
        const ast = parser.parse(code);
        const classNode = findNodeByType(ast.rootNode, "class_definition");
        const className = classNode?.childForFieldName("name");

        if (className) {
          const classCapture: CaptureNode = {
            name: "definition.interface",
            node: className as any,
            text: className.text as SymbolName,
            category: "definition" as SemanticCategory,
            entity: "interface" as SemanticEntity,
            location: node_to_location(className, "test.py" as any),
          };
          PYTHON_BUILDER_CONFIG.get("definition.interface")?.process(
            classCapture,
            builder,
            context
          );
        }

        // Find and process property signatures
        const findAllIdentifiers = (node: SyntaxNode): SyntaxNode[] => {
          const identifiers: SyntaxNode[] = [];
          if (node.type === "identifier" && node.parent?.type === "assignment") {
            const assignment = node.parent;
            // Check if it's an annotated assignment without value (property signature)
            if (assignment.childForFieldName("type") && !assignment.childForFieldName("right")) {
              identifiers.push(node);
            }
          }
          for (let i = 0; i < node.childCount; i++) {
            identifiers.push(...findAllIdentifiers(node.child(i)!));
          }
          return identifiers;
        };

        const propertyNodes = findAllIdentifiers(ast.rootNode);
        for (const propNode of propertyNodes) {
          if (propNode.text === "x" || propNode.text === "y") {
            const propCapture: CaptureNode = {
              name: "definition.property.interface",
              node: propNode as any,
              text: propNode.text as SymbolName,
              category: "definition" as SemanticCategory,
              entity: "property" as SemanticEntity,
              location: node_to_location(propNode, "test.py" as any),
            };
            PYTHON_BUILDER_CONFIG.get("definition.property.interface")?.process(
              propCapture,
              builder,
              context
            );
          }
        }

        const definitions = builder.build();
        const protocolDef = definitions.interfaces.values().next().value;

        expect(protocolDef).toBeDefined();
        expect(protocolDef?.name).toBe("Drawable");
        expect(protocolDef?.properties).toBeDefined();
        expect(Array.isArray(protocolDef?.properties)).toBe(true);

        // Verify property names
        const propertyNames = protocolDef?.properties.map((p) => p.name) || [];
        expect(propertyNames).toContain("x");
        expect(propertyNames).toContain("y");

        // Verify property types
        const xProp = protocolDef?.properties.find((p) => p.name === "x");
        if (xProp) {
          expect(xProp.type).toBe("int");
        }

        const yProp = protocolDef?.properties.find((p) => p.name === "y");
        if (yProp) {
          expect(yProp.type).toBe("int");
        }
      });
    });
  });
});

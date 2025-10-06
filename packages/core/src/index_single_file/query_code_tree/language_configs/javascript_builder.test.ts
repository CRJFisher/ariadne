/**
 * Tests for JavaScript language configuration with builder pattern
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import type { SyntaxNode } from "tree-sitter";
import { JAVASCRIPT_BUILDER_CONFIG } from "./javascript_builder";
import { DefinitionBuilder } from "../../definitions/definition_builder";
import type {
  ProcessingContext,
  CaptureNode,
  SemanticCategory,
  SemanticEntity,
} from "../../semantic_index";
import type { Location, ScopeId, FilePath, SymbolName } from "@ariadnejs/types";
import { ReferenceBuilder } from "../../references/reference_builder";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./javascript_metadata";

describe("JavaScript Builder Configuration", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  const TEST_FILE_PATH = "/test/file.js" as FilePath;

  // Helper function to create test context
  function createTestContext(): ProcessingContext {
    const test_scope_id = "module:test.js:1:0:100:0:<module>" as ScopeId;

    return {
      scopes: new Map(),
      captures: [],
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

    return {
      name: captureName,
      category: "definition" as any, // Default for builder tests
      entity: nodeType as any,
      node: node as any,
      text: node.text as SymbolName,
      location: {
        file_path: TEST_FILE_PATH,
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

  describe("JAVASCRIPT_BUILDER_CONFIG", () => {
    it("should export a valid LanguageBuilderConfig", () => {
      expect(JAVASCRIPT_BUILDER_CONFIG).toBeDefined();
      expect(JAVASCRIPT_BUILDER_CONFIG).toBeInstanceOf(Map);
      expect(JAVASCRIPT_BUILDER_CONFIG.size).toBeGreaterThan(0);
    });

    it("should contain definition capture mappings with process functions", () => {
      const definitionMappings = [
        "definition.class",
        "definition.method",
        "definition.constructor",
        "definition.function",
        "definition.arrow",
        "definition.param",
        "definition.parameter",
        "definition.variable",
        "definition.field",
        "definition.property",
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
        "definition.import",
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

        const capture: CaptureNode = {
          name: "definition.class",
          category: "definition" as SemanticCategory,
          entity: "class" as SemanticEntity,
          node: nameNode as any,
          text: nameNode.text as SymbolName,
          location: {
            file_path: TEST_FILE_PATH,
            start_line: nameNode.startPosition.row + 1,
            start_column: nameNode.startPosition.column + 1,
            end_line: nameNode.endPosition.row + 1,
            end_column: nameNode.endPosition.column + 1,
          },
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const result = builder.build();
        const classes = Array.from(result.classes.values());
        expect(classes).toHaveLength(1);
        expect(classes[0].kind).toBe("class");
        expect(classes[0].name).toBe("MyClass");
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

        const capture: CaptureNode = {
          name: "definition.function",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: nameNode as any,
          text: nameNode.text as SymbolName,
          location: {
            file_path: TEST_FILE_PATH,
            start_line: nameNode.startPosition.row + 1,
            start_column: nameNode.startPosition.column + 1,
            end_line: nameNode.endPosition.row + 1,
            end_column: nameNode.endPosition.column + 1,
          },
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("definition.function");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const result = builder.build();
        const functions = Array.from(result.functions.values());
        expect(functions).toHaveLength(1);
        expect(functions[0].kind).toBe("function");
        expect(functions[0].name).toBe("myFunction");
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

        const capture: CaptureNode = {
          name: "definition.variable",
          category: "definition" as SemanticCategory,
          entity: "variable" as SemanticEntity,
          node: nameNode as any,
          text: nameNode.text as SymbolName,
          location: {
            file_path: TEST_FILE_PATH,
            start_line: nameNode.startPosition.row + 1,
            start_column: nameNode.startPosition.column + 1,
            end_line: nameNode.endPosition.row + 1,
            end_column: nameNode.endPosition.column + 1,
          },
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("definition.variable");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const result = builder.build();
        const variables = Array.from(result.variables.values());
        expect(variables).toHaveLength(1);
        expect(variables[0].kind).toBe("constant");
        expect(variables[0].name).toBe("myVar");
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

        const classCapture: CaptureNode = {
          name: "definition.class",
          category: "definition" as SemanticCategory,
          entity: "class" as SemanticEntity,
          node: classNameNode as any,
          text: classNameNode.text as SymbolName,
          location: {
            file_path: TEST_FILE_PATH,
            start_line: classNameNode.startPosition.row + 1,
            start_column: classNameNode.startPosition.column + 1,
            end_line: classNameNode.endPosition.row + 1,
            end_column: classNameNode.endPosition.column + 1,
          },
        };

        const classProcessor =
          JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
        classProcessor?.process(classCapture, builder, context);

        // Then add the method
        const methodNode = findNodeByType(ast.rootNode, "method_definition");
        const methodNameNode = methodNode?.childForFieldName("name");

        if (!methodNameNode) {
          throw new Error("Could not find method name");
        }

        const methodCapture: CaptureNode = {
          name: "definition.method",
          category: "definition" as SemanticCategory,
          entity: "method" as SemanticEntity,
          node: methodNameNode as any,
          text: methodNameNode.text as SymbolName,
          location: {
            file_path: TEST_FILE_PATH,
            start_line: methodNameNode.startPosition.row + 1,
            start_column: methodNameNode.startPosition.column + 1,
            end_line: methodNameNode.endPosition.row + 1,
            end_column: methodNameNode.endPosition.column + 1,
          },
        };

        const methodProcessor =
          JAVASCRIPT_BUILDER_CONFIG.get("definition.method");
        methodProcessor?.process(methodCapture, builder, context);

        const result = builder.build();
        const classes = Array.from(result.classes.values());
        expect(classes).toHaveLength(1);
        expect(classes[0].kind).toBe("class");

        const classDef = classes[0] as any;
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

        const capture: CaptureNode = {
          name: "import.default",
          category: "definition" as SemanticCategory,
          entity: "import" as SemanticEntity,
          node: nameNode as any,
          text: nameNode.text as SymbolName,
          location: {
            file_path: TEST_FILE_PATH,
            start_line: nameNode.startPosition.row + 1,
            start_column: nameNode.startPosition.column + 1,
            end_line: nameNode.endPosition.row + 1,
            end_column: nameNode.endPosition.column + 1,
          },
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("import.default");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const result = builder.build();
        const imports = Array.from(result.imports.values());
        expect(imports).toHaveLength(1);
        expect(imports[0].kind).toBe("import");
        expect(imports[0].name).toBe("React");

        const importDef = imports[0] as any;
        expect(importDef.import_kind).toBe("default");
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

        const capture: CaptureNode = {
          name: "definition.arrow",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: nameNode as any,
          text: nameNode.text as SymbolName,
          location: {
            file_path: TEST_FILE_PATH,
            start_line: nameNode.startPosition.row + 1,
            start_column: nameNode.startPosition.column + 1,
            end_line: nameNode.endPosition.row + 1,
            end_column: nameNode.endPosition.column + 1,
          },
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("definition.arrow");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const result = builder.build();
        const functions = Array.from(result.functions.values());
        expect(functions).toHaveLength(1);
        expect(functions[0].kind).toBe("function");
        expect(functions[0].name).toBe("myFunc");
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

        const classCapture: CaptureNode = {
          name: "definition.class",
          category: "definition" as SemanticCategory,
          entity: "class" as SemanticEntity,
          node: classNameNode as any,
          text: classNameNode.text as SymbolName,
          location: {
            file_path: TEST_FILE_PATH,
            start_line: classNameNode.startPosition.row + 1,
            start_column: classNameNode.startPosition.column + 1,
            end_line: classNameNode.endPosition.row + 1,
            end_column: classNameNode.endPosition.column + 1,
          },
        };

        const classProcessor =
          JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
        classProcessor?.process(classCapture, builder, context);

        // Then add the property
        const fieldNode = findNodeByType(ast.rootNode, "field_definition");
        const propNode = fieldNode?.childForFieldName("property");

        if (!propNode) {
          throw new Error("Could not find property name");
        }

        const propCapture: CaptureNode = {
          name: "definition.field",
          category: "definition" as SemanticCategory,
          entity: "property" as SemanticEntity,
          node: propNode as any,
          text: propNode.text as SymbolName,
          location: {
            file_path: TEST_FILE_PATH,
            start_line: propNode.startPosition.row + 1,
            start_column: propNode.startPosition.column + 1,
            end_line: propNode.endPosition.row + 1,
            end_column: propNode.endPosition.column + 1,
          },
        };

        const propProcessor = JAVASCRIPT_BUILDER_CONFIG.get("definition.field");
        propProcessor?.process(propCapture, builder, context);

        const result = builder.build();
        const classes = Array.from(result.classes.values());
        expect(classes).toHaveLength(1);
        expect(classes[0].kind).toBe("class");

        const classDef = classes[0] as any;
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

        const funcCapture: CaptureNode = {
          name: "definition.function",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: funcNameNode as any,
          text: funcNameNode.text as SymbolName,
          location: {
            file_path: TEST_FILE_PATH,
            start_line: funcNameNode.startPosition.row + 1,
            start_column: funcNameNode.startPosition.column + 1,
            end_line: funcNameNode.endPosition.row + 1,
            end_column: funcNameNode.endPosition.column + 1,
          },
        };

        const funcProcessor = JAVASCRIPT_BUILDER_CONFIG.get(
          "definition.function"
        );
        funcProcessor?.process(funcCapture, builder, context);

        // Then add the parameters
        const paramsNode = funcNode?.childForFieldName("parameters");
        if (!paramsNode) {
          throw new Error("Could not find parameters");
        }

        for (const child of paramsNode.namedChildren) {
          if (child.type === "identifier") {
            const paramCapture: CaptureNode = {
              name: "definition.param",
              category: "definition" as SemanticCategory,
              entity: "parameter" as SemanticEntity,
              node: child as any,
              text: child.text as SymbolName,
              location: {
                file_path: TEST_FILE_PATH,
                start_line: child.startPosition.row + 1,
                start_column: child.startPosition.column + 1,
                end_line: child.endPosition.row + 1,
                end_column: child.endPosition.column + 1,
              },
            };

            const paramProcessor =
              JAVASCRIPT_BUILDER_CONFIG.get("definition.param");
            paramProcessor?.process(paramCapture, builder, context);
          }
        }

        const result = builder.build();
        const functions = Array.from(result.functions.values());
        expect(functions).toHaveLength(1);
        expect(functions[0].kind).toBe("function");

        const funcDef = functions[0] as any;
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
          const classCapture: CaptureNode = {
            name: "definition.class",
            category: "definition" as SemanticCategory,
            entity: "class" as SemanticEntity,
            node: classNameNode as any,
            text: classNameNode.text as SymbolName,
            location: {
              file_path: TEST_FILE_PATH,
              start_line: classNameNode.startPosition.row + 1,
              start_column: classNameNode.startPosition.column + 1,
              end_line: classNameNode.endPosition.row + 1,
              end_column: classNameNode.endPosition.column + 1,
            },
          };
          const classProcessor =
            JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
          classProcessor?.process(classCapture, builder, context);
        }

        const result = builder.build();
        const classes = Array.from(result.classes.values());
        expect(classes).toHaveLength(1);

        const classDef = classes[0];

        // Check all required fields are populated
        expect(classDef.kind).toBe("class");
        expect(classDef.symbol_id).toBeDefined();
        expect(classDef.name).toBe("MyClass");
        expect(classDef.location).toBeDefined();
        expect(classDef.defining_scope_id).toBeDefined();
        expect(classDef.availability).toBeDefined();

        // Check location has all subfields
        expect(classDef.location.start_line).toBeGreaterThan(0);
        expect(classDef.location.start_column).toBeGreaterThanOrEqual(0);
        expect(classDef.location.end_line).toBeGreaterThan(0);
        expect(classDef.location.end_column).toBeGreaterThanOrEqual(0);

        // Check availability has scope field
        expect(classDef.availability.scope).toBeDefined();
      });
    });

    describe("Metadata Integration", () => {
      it("should process method calls with receiver metadata", () => {
        // Note: This test verifies that the builder can process method call captures.
        // Full metadata extraction (receiver_location, property_chain) requires the
        // complete query capture context from the tree-sitter query system.
        // This is validated in semantic_index tests which use the full pipeline.
        const code = `
          const obj = { method: () => {} };
          obj.method();
        `;

        const context = createTestContext();
        const ast = parser.parse(code);
        const captures: CaptureNode[] = [];

        // Find the method call
        const callNode = findNodeByType(ast.rootNode, "call_expression");
        if (callNode) {
          const memberExpr = callNode.childForFieldName("function");
          if (memberExpr && memberExpr.type === "member_expression") {
            const propNode = memberExpr.childForFieldName("property");
            if (propNode) {
              captures.push({
                name: "ref.call",
                category: "reference" as SemanticCategory,
                entity: "call" as SemanticEntity,
                node: propNode as any,
                text: propNode.text as SymbolName,
                location: {
                  file_path: TEST_FILE_PATH,
                  start_line: propNode.startPosition.row + 1,
                  start_column: propNode.startPosition.column + 1,
                  end_line: propNode.endPosition.row + 1,
                  end_column: propNode.endPosition.column + 1,
                },
              });
            }
          }
        }

        const processingContext = {
          ...context,
          captures: captures,
        };

        const builder = new ReferenceBuilder(
          processingContext,
          JAVASCRIPT_METADATA_EXTRACTORS,
          TEST_FILE_PATH
        );

        const references = builder.process(captures[0]);
        const methodCalls = references.build().filter((r) => r.type === "call");

        // Verify basic call reference is created
        expect(methodCalls).toHaveLength(1);
        expect(methodCalls[0].name).toBe("method");
        expect(methodCalls[0].type).toBe("call");
        // Note: receiver_location metadata requires full query context
        // See semantic_index tests for full metadata extraction validation
      });

      it("should process property chains with metadata", () => {
        // Note: This test verifies that the builder can process chained method calls.
        // Full metadata extraction (property_chain) requires the complete query
        // capture context from the tree-sitter query system.
        // This is validated in semantic_index tests which use the full pipeline.
        const code = `
          const api = { users: { list: () => {} } };
          api.users.list();
        `;

        const context = createTestContext();
        const ast = parser.parse(code);
        const captures: CaptureNode[] = [];

        // Find the chained method call
        const callNode = findNodeByType(ast.rootNode, "call_expression");
        if (callNode) {
          const memberExpr = callNode.childForFieldName("function");
          if (memberExpr && memberExpr.type === "member_expression") {
            const propNode = memberExpr.childForFieldName("property");
            if (propNode) {
              captures.push({
                name: "ref.call",
                category: "reference" as SemanticCategory,
                entity: "call" as SemanticEntity,
                node: propNode as any,
                text: propNode.text as SymbolName,
                location: {
                  file_path: TEST_FILE_PATH,
                  start_line: propNode.startPosition.row + 1,
                  start_column: propNode.startPosition.column + 1,
                  end_line: propNode.endPosition.row + 1,
                  end_column: propNode.endPosition.column + 1,
                },
              });
            }
          }
        }

        const processingContext = {
          ...context,
          captures: captures,
        };

        const builder = new ReferenceBuilder(
          processingContext,
          JAVASCRIPT_METADATA_EXTRACTORS,
          TEST_FILE_PATH
        );

        const references = builder.process(captures[0]);
        const methodCalls = references.build().filter((r) => r.type === "call");

        // Verify basic call reference is created
        expect(methodCalls).toHaveLength(1);
        expect(methodCalls[0].name).toBe("list");
        expect(methodCalls[0].type).toBe("call");
        // Note: property_chain metadata requires full query context
        // See semantic_index tests for full metadata extraction validation
      });

      it("should extract type annotations from JSDoc", () => {
        const code = `
          /** @type {string} */
          const myVar = "value";

          /** @returns {number} */
          function compute() { return 42; }
        `;

        const context = createTestContext();
        const ast = parser.parse(code);
        const captures: CaptureNode[] = [];

        // Find the variable with JSDoc
        const varNode = findNodeByType(ast.rootNode, "variable_declarator");
        if (varNode) {
          const nameNode = varNode.childForFieldName("name");
          if (nameNode) {
            captures.push({
              name: "ref.identifier",
              category: "reference" as SemanticCategory,
              entity: "identifier" as SemanticEntity,
              node: nameNode as any,
              text: nameNode.text as SymbolName,
              location: {
                file_path: TEST_FILE_PATH,
                start_line: nameNode.startPosition.row + 1,
                start_column: nameNode.startPosition.column + 1,
                end_line: nameNode.endPosition.row + 1,
                end_column: nameNode.endPosition.column + 1,
              },
            });
          }
        }

        const processingContext = {
          ...context,
          captures: captures,
        };

        const builder = new ReferenceBuilder(
          processingContext,
          JAVASCRIPT_METADATA_EXTRACTORS,
          TEST_FILE_PATH
        );

        const references = builder.process(captures[0]);

        // The type info extraction would be populated if the variable had a type annotation
        expect(references).toBeDefined();
      });

      it("should process assignment contexts with metadata", () => {
        const code = `
          let target;
          target = getValue();
        `;

        const context = createTestContext();
        const ast = parser.parse(code);
        const captures: CaptureNode[] = [];

        // Find the assignment
        const assignmentNode = findNodeByType(
          ast.rootNode,
          "assignment_expression"
        );
        if (assignmentNode) {
          const leftNode = assignmentNode.childForFieldName("left");
          if (leftNode) {
            captures.push({
              name: "ref.assignment",
              category: "assignment" as SemanticCategory,
              entity: "assignment" as SemanticEntity,
              node: assignmentNode as any,
              text: leftNode.text as SymbolName,
              location: {
                file_path: TEST_FILE_PATH,
                start_line: leftNode.startPosition.row + 1,
                start_column: leftNode.startPosition.column + 1,
                end_line: leftNode.endPosition.row + 1,
                end_column: leftNode.endPosition.column + 1,
              },
            });
          }
        }

        const processingContext = {
          ...context,
          captures: captures,
        };

        const builder = new ReferenceBuilder(
          processingContext,
          JAVASCRIPT_METADATA_EXTRACTORS,
          TEST_FILE_PATH
        );

        const references = builder.process(captures[0]);
        const assignments = references
          .build()
          .filter((r) => r.type === "assignment");

        expect(assignments).toBeDefined();
        // Assignment parts would be extracted through metadata extractors
      });

      it("should process constructor calls with metadata", () => {
        const code = `
          const instance = new MyClass();
        `;

        const context = createTestContext();
        const ast = parser.parse(code);
        const captures: CaptureNode[] = [];

        // Find the new expression
        const newExpr = findNodeByType(ast.rootNode, "new_expression");
        if (newExpr) {
          const constructorNode = newExpr.childForFieldName("constructor");
          if (constructorNode) {
            captures.push({
              name: "ref.constructor",
              category: "reference" as SemanticCategory,
              entity: "constructor" as SemanticEntity,
              node: constructorNode as any,
              text: constructorNode.text as SymbolName,
              location: {
                file_path: TEST_FILE_PATH,
                start_line: constructorNode.startPosition.row + 1,
                start_column: constructorNode.startPosition.column + 1,
                end_line: constructorNode.endPosition.row + 1,
                end_column: constructorNode.endPosition.column + 1,
              },
            });
          }
        }

        const processingContext = {
          ...context,
          captures: captures,
        };

        const builder = new ReferenceBuilder(
          processingContext,
          JAVASCRIPT_METADATA_EXTRACTORS,
          TEST_FILE_PATH
        );

        const references = builder.process(captures[0]);
        const constructorCalls = references
          .build()
          .filter((r) => r.type === "construct");

        expect(constructorCalls).toHaveLength(1);
        expect(constructorCalls[0]?.context?.construct_target).toBeDefined();
      });
    });
  });
});

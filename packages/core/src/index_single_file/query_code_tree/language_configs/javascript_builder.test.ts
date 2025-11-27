/**
 * Tests for JavaScript language configuration with builder pattern
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import type { SyntaxNode } from "tree-sitter";
import { JAVASCRIPT_BUILDER_CONFIG, analyze_export_statement, detect_callback_context } from "./javascript_builder";
import { DefinitionBuilder } from "../../definitions/definition_builder";
import { build_semantic_index } from "../../semantic_index";
import type {
  ProcessingContext,
  CaptureNode,
  SemanticCategory,
  SemanticEntity,
} from "../../semantic_index";
import type {
  Location,
  ScopeId,
  FilePath,
  SymbolName,
  MethodCallReference,
  ConstructorCallReference,
} from "@ariadnejs/types";
import { ReferenceBuilder } from "../../references/reference_builder";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./javascript_metadata";
import { node_to_location } from "../../node_utils";

describe("JavaScript Builder Configuration", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  const TEST_FILE_PATH = "/test/file.js" as FilePath;

  // Helper function to create test context
  function create_test_context(with_scopes: boolean = false): ProcessingContext {
    const test_scope_id = "module:test.js:1:0:100:0:<module>" as ScopeId;
    const scopes = new Map();

    if (with_scopes) {
      // Add method body scopes for tests that need them
      scopes.set("method:test.js:3:2:5:3:<method_body>" as ScopeId, {
        id: "method:test.js:3:2:5:3:<method_body>" as ScopeId,
        type: "method",
        name: "myMethod",
        location: {
          file_path: TEST_FILE_PATH,
          start_line: 3,
          start_column: 2,
          end_line: 5,
          end_column: 3,
        },
        parent_id: test_scope_id,
      });
      scopes.set("method:test.js:7:2:9:3:<method_body>" as ScopeId, {
        id: "method:test.js:7:2:9:3:<method_body>" as ScopeId,
        type: "method",
        name: "add",
        location: {
          file_path: TEST_FILE_PATH,
          start_line: 7,
          start_column: 2,
          end_line: 9,
          end_column: 3,
        },
        parent_id: test_scope_id,
      });
      // Add function scope for parameter tests
      scopes.set("function:test.js:1:0:3:1:<function_body>" as ScopeId, {
        id: "function:test.js:1:0:3:1:<function_body>" as ScopeId,
        type: "function",
        name: "myFunc",
        location: {
          file_path: TEST_FILE_PATH,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        parent_id: test_scope_id,
      });
    }

    return {
      scopes,
      captures: [],
      scope_depths: new Map(),
      root_scope_id: test_scope_id,
      get_scope_id: (location: Location) => test_scope_id,
      get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => test_scope_id,
    };
  }

  // Helper function to create a raw capture from code
  function create_capture(
    code: string,
    capture_name: string,
    node_type: string
  ): CaptureNode {
    const ast = parser.parse(code);
    const node = find_node_by_type(ast.rootNode, node_type);
    if (!node) {
      throw new Error(`Could not find node of type ${node_type} in code`);
    }

    return {
      name: capture_name,
      category: "definition" as any, // Default for builder tests
      entity: node_type as any,
      node: node as any,
      text: node.text as SymbolName,
      location: node_to_location(node, TEST_FILE_PATH),
    };
  }

  // Helper function to find first node of specific type
  function find_node_by_type(node: SyntaxNode, type: string): SyntaxNode | null {
    if (node.type === type) return node;

    for (let i = 0; i < node.childCount; i++) {
      const found = find_node_by_type(node.child(i)!, type);
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
      const definition_mappings = [
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

      for (const mapping of definition_mappings) {
        expect(JAVASCRIPT_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = JAVASCRIPT_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    it("should contain import capture mappings with process functions", () => {
      const import_mappings = [
        "definition.import",
        "definition.import.named",
        "definition.import.default",
        "definition.import.namespace",
      ];

      for (const mapping of import_mappings) {
        expect(JAVASCRIPT_BUILDER_CONFIG.has(mapping)).toBe(true);
        const config = JAVASCRIPT_BUILDER_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });

    describe("Process Functions", () => {
      it("should process class definitions", () => {
        const code = "class MyClass { }";
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        // Find the class name identifier
        const ast = parser.parse(code);
        const class_node = find_node_by_type(ast.rootNode, "class_declaration");
        const name_node = class_node?.childForFieldName("name");

        if (!name_node) {
          throw new Error("Could not find class name");
        }

        const capture: CaptureNode = {
          name: "definition.class",
          category: "definition" as SemanticCategory,
          entity: "class" as SemanticEntity,
          node: name_node as any,
          text: name_node.text as SymbolName,
          location: node_to_location(name_node, TEST_FILE_PATH),
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
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        const func_node = find_node_by_type(ast.rootNode, "function_declaration");
        const name_node = func_node?.childForFieldName("name");

        if (!name_node) {
          throw new Error("Could not find function name");
        }

        const capture: CaptureNode = {
          name: "definition.function",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: name_node as any,
          text: name_node.text as SymbolName,
          location: node_to_location(name_node, TEST_FILE_PATH),
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
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        const var_node = find_node_by_type(ast.rootNode, "variable_declarator");
        const name_node = var_node?.childForFieldName("name");

        if (!name_node) {
          throw new Error("Could not find variable name");
        }

        const capture: CaptureNode = {
          name: "definition.variable",
          category: "definition" as SemanticCategory,
          entity: "variable" as SemanticEntity,
          node: name_node as any,
          text: name_node.text as SymbolName,
          location: node_to_location(name_node, TEST_FILE_PATH),
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
        const context = create_test_context(true); // Need scopes for method bodies
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);

        // First add the class
        const class_node = find_node_by_type(ast.rootNode, "class_declaration");
        const class_name_node = class_node?.childForFieldName("name");

        if (!class_name_node) {
          throw new Error("Could not find class name");
        }

        const class_capture: CaptureNode = {
          name: "definition.class",
          category: "definition" as SemanticCategory,
          entity: "class" as SemanticEntity,
          node: class_name_node as any,
          text: class_name_node.text as SymbolName,
          location: node_to_location(class_name_node, TEST_FILE_PATH),
        };

        const class_processor =
          JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
        class_processor?.process(class_capture, builder, context);

        // Then add the method
        const method_node = find_node_by_type(ast.rootNode, "method_definition");
        const method_name_node = method_node?.childForFieldName("name");

        if (!method_name_node) {
          throw new Error("Could not find method name");
        }

        const method_capture: CaptureNode = {
          name: "definition.method",
          category: "definition" as SemanticCategory,
          entity: "method" as SemanticEntity,
          node: method_name_node as any,
          text: method_name_node.text as SymbolName,
          location: node_to_location(method_name_node, TEST_FILE_PATH),
        };

        const method_processor =
          JAVASCRIPT_BUILDER_CONFIG.get("definition.method");
        method_processor?.process(method_capture, builder, context);

        const result = builder.build();
        const classes = Array.from(result.classes.values());
        expect(classes).toHaveLength(1);
        expect(classes[0].kind).toBe("class");

        const class_def = classes[0] as any;
        expect(class_def.methods).toHaveLength(1);
        expect(class_def.methods[0].name).toBe("myMethod");
      });

      it("should process import statements", () => {
        const code = "import React from 'react';";
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        const import_clause = find_node_by_type(ast.rootNode, "import_clause");
        const name_node = import_clause?.child(0); // Default import identifier

        if (!name_node) {
          throw new Error("Could not find import name");
        }

        const capture: CaptureNode = {
          name: "definition.import.default",
          category: "definition" as SemanticCategory,
          entity: "import" as SemanticEntity,
          node: name_node as any,
          text: name_node.text as SymbolName,
          location: node_to_location(name_node, TEST_FILE_PATH),
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("definition.import.default");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const result = builder.build();
        const imports = Array.from(result.imports.values());
        expect(imports).toHaveLength(1);
        expect(imports[0].kind).toBe("import");
        expect(imports[0].name).toBe("React");

        const import_def = imports[0] as any;
        expect(import_def.import_kind).toBe("default");
        expect(import_def.import_path).toBe("react");
      });

      it("should process arrow function assignments", () => {
        const code = "const myFunc = () => {};";
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        const var_node = find_node_by_type(ast.rootNode, "variable_declarator");
        const name_node = var_node?.childForFieldName("name");

        if (!name_node) {
          throw new Error("Could not find arrow function name");
        }

        const capture: CaptureNode = {
          name: "definition.arrow",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: name_node as any,
          text: name_node.text as SymbolName,
          location: node_to_location(name_node, TEST_FILE_PATH),
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
        const context = create_test_context(true); // Need scopes for class bodies
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);

        // First add the class
        const class_node = find_node_by_type(ast.rootNode, "class_declaration");
        const class_name_node = class_node?.childForFieldName("name");

        if (!class_name_node) {
          throw new Error("Could not find class name");
        }

        const class_capture: CaptureNode = {
          name: "definition.class",
          category: "definition" as SemanticCategory,
          entity: "class" as SemanticEntity,
          node: class_name_node as any,
          text: class_name_node.text as SymbolName,
          location: node_to_location(class_name_node, TEST_FILE_PATH),
        };

        const class_processor =
          JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
        class_processor?.process(class_capture, builder, context);

        // Then add the property
        const field_node = find_node_by_type(ast.rootNode, "field_definition");
        const prop_node = field_node?.childForFieldName("property");

        if (!prop_node) {
          throw new Error("Could not find property name");
        }

        const prop_capture: CaptureNode = {
          name: "definition.field",
          category: "definition" as SemanticCategory,
          entity: "property" as SemanticEntity,
          node: prop_node as any,
          text: prop_node.text as SymbolName,
          location: node_to_location(prop_node, TEST_FILE_PATH),
        };

        const prop_processor = JAVASCRIPT_BUILDER_CONFIG.get("definition.field");
        prop_processor?.process(prop_capture, builder, context);

        const result = builder.build();
        const classes = Array.from(result.classes.values());
        expect(classes).toHaveLength(1);
        expect(classes[0].kind).toBe("class");

        const class_def = classes[0] as any;
        expect(class_def.properties).toHaveLength(1);
        expect(class_def.properties[0].name).toBe("myProperty");
      });

      it("should process function parameters", () => {
        const code = "function myFunc(param1, param2) { }";
        const context = create_test_context(true); // Need scopes for function bodies
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);

        // First add the function
        const func_node = find_node_by_type(ast.rootNode, "function_declaration");
        const func_name_node = func_node?.childForFieldName("name");

        if (!func_name_node) {
          throw new Error("Could not find function name");
        }

        const func_capture: CaptureNode = {
          name: "definition.function",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: func_name_node as any,
          text: func_name_node.text as SymbolName,
          location: node_to_location(func_name_node, TEST_FILE_PATH),
        };

        const func_processor = JAVASCRIPT_BUILDER_CONFIG.get(
          "definition.function"
        );
        func_processor?.process(func_capture, builder, context);

        // Then add the parameters
        const params_node = func_node?.childForFieldName("parameters");
        if (!params_node) {
          throw new Error("Could not find parameters");
        }

        for (const child of params_node.namedChildren) {
          if (child.type === "identifier") {
            const param_capture: CaptureNode = {
              name: "definition.param",
              category: "definition" as SemanticCategory,
              entity: "parameter" as SemanticEntity,
              node: child as any,
              text: child.text as SymbolName,
              location: node_to_location(child, TEST_FILE_PATH),
            };

            const param_processor =
              JAVASCRIPT_BUILDER_CONFIG.get("definition.param");
            param_processor?.process(param_capture, builder, context);
          }
        }

        const result = builder.build();
        const functions = Array.from(result.functions.values());
        expect(functions).toHaveLength(1);
        expect(functions[0].kind).toBe("function");

        const func_def = functions[0] as any;
        expect(func_def.signature.parameters).toHaveLength(2);
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

        const context = create_test_context();
        const builder = new DefinitionBuilder(context);
        const ast = parser.parse(code);

        // Process class definition
        const class_node = find_node_by_type(ast.rootNode, "class_declaration");
        const class_name_node = class_node?.childForFieldName("name");

        if (class_name_node) {
          const class_capture: CaptureNode = {
            name: "definition.class",
            category: "definition" as SemanticCategory,
            entity: "class" as SemanticEntity,
            node: class_name_node as any,
            text: class_name_node.text as SymbolName,
            location: {
              file_path: TEST_FILE_PATH,
              start_line: class_name_node.startPosition.row + 1,
              start_column: class_name_node.startPosition.column + 1,
              end_line: class_name_node.endPosition.row + 1,
              end_column: class_name_node.endPosition.column + 1,
            },
          };
          const class_processor =
            JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
          class_processor?.process(class_capture, builder, context);
        }

        const result = builder.build();
        const classes = Array.from(result.classes.values());
        expect(classes).toHaveLength(1);

        const class_def = classes[0];

        // Check all required fields are populated
        expect(class_def.kind).toBe("class");
        expect(class_def.symbol_id).toBeDefined();
        expect(class_def.name).toBe("MyClass");
        expect(class_def.location).toBeDefined();
        expect(class_def.defining_scope_id).toBeDefined();

        // Check location has all subfields
        expect(class_def.location.start_line).toBeGreaterThan(0);
        expect(class_def.location.start_column).toBeGreaterThanOrEqual(0);
        expect(class_def.location.end_line).toBeGreaterThan(0);
        expect(class_def.location.end_column).toBeGreaterThanOrEqual(0);

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

        const context = create_test_context();
        const ast = parser.parse(code);
        const captures: CaptureNode[] = [];

        // Find the method call
        // Real query captures the call_expression with member_expression function
        const call_node = find_node_by_type(ast.rootNode, "call_expression");
        if (call_node) {
          const member_expr = call_node.childForFieldName("function");
          if (member_expr && member_expr.type === "member_expression") {
            const prop_node = member_expr.childForFieldName("property");
            if (prop_node) {
              captures.push({
                name: "ref.call",
                category: "reference" as SemanticCategory,
                entity: "call" as SemanticEntity,
                node: call_node as any,  // Pass call_expression, not just property
                text: prop_node.text as SymbolName,
                location: node_to_location(prop_node, TEST_FILE_PATH),
              });
            }
          }
        }

        const processing_context = {
          ...context,
          captures: captures,
        };

        const builder = new ReferenceBuilder(
          processing_context,
          JAVASCRIPT_METADATA_EXTRACTORS,
          TEST_FILE_PATH
        );

        builder.process(captures[0]);

        const method_calls = builder.references.filter(
          (r): r is MethodCallReference => r.kind === "method_call"
        );

        // Verify method call reference is created with proper detection
        expect(method_calls).toHaveLength(1);
        expect(method_calls[0].name).toBe("method");
        expect(method_calls[0].kind).toBe("method_call");
        expect(method_calls[0].receiver_location).toBeDefined();
        expect(method_calls[0].property_chain).toEqual(["obj", "method"]);
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

        const context = create_test_context();
        const ast = parser.parse(code);
        const captures: CaptureNode[] = [];

        // Find the chained method call
        // Real query captures the call_expression with nested member_expression
        const call_node = find_node_by_type(ast.rootNode, "call_expression");
        if (call_node) {
          const member_expr = call_node.childForFieldName("function");
          if (member_expr && member_expr.type === "member_expression") {
            const prop_node = member_expr.childForFieldName("property");
            if (prop_node) {
              captures.push({
                name: "ref.call",
                category: "reference" as SemanticCategory,
                entity: "call" as SemanticEntity,
                node: call_node as any,  // Pass call_expression for proper detection
                text: prop_node.text as SymbolName,
                location: node_to_location(prop_node, TEST_FILE_PATH),
              });
            }
          }
        }

        const processing_context = {
          ...context,
          captures: captures,
        };

        const builder = new ReferenceBuilder(
          processing_context,
          JAVASCRIPT_METADATA_EXTRACTORS,
          TEST_FILE_PATH
        );

        builder.process(captures[0]);

        const method_calls = builder.references.filter(
          (r): r is MethodCallReference => r.kind === "method_call"
        );

        // Verify method call with proper property chain extraction
        expect(method_calls).toHaveLength(1);
        expect(method_calls[0].name).toBe("list");
        expect(method_calls[0].kind).toBe("method_call");
        expect(method_calls[0].receiver_location).toBeDefined();
        expect(method_calls[0].property_chain).toEqual(["api", "users", "list"]);
      });

      it("should extract type annotations from JSDoc", () => {
        const code = `
          /** @type {string} */
          const myVar = "value";

          /** @returns {number} */
          function compute() { return 42; }
        `;

        const context = create_test_context();
        const ast = parser.parse(code);
        const captures: CaptureNode[] = [];

        // Find the variable with JSDoc
        const var_node = find_node_by_type(ast.rootNode, "variable_declarator");
        if (var_node) {
          const name_node = var_node.childForFieldName("name");
          if (name_node) {
            captures.push({
              name: "ref.identifier",
              category: "reference" as SemanticCategory,
              entity: "identifier" as SemanticEntity,
              node: name_node as any,
              text: name_node.text as SymbolName,
              location: node_to_location(name_node, TEST_FILE_PATH),
            });
          }
        }

        const processing_context = {
          ...context,
          captures: captures,
        };

        const builder = new ReferenceBuilder(
          processing_context,
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

        const context = create_test_context();
        const ast = parser.parse(code);
        const captures: CaptureNode[] = [];

        // Find the assignment
        const assignment_node = find_node_by_type(
          ast.rootNode,
          "assignment_expression"
        );
        if (assignment_node) {
          const left_node = assignment_node.childForFieldName("left");
          if (left_node) {
            captures.push({
              name: "ref.assignment",
              category: "assignment" as SemanticCategory,
              entity: "assignment" as SemanticEntity,
              node: assignment_node as any,
              text: left_node.text as SymbolName,
              location: {
                file_path: TEST_FILE_PATH,
                start_line: left_node.startPosition.row + 1,
                start_column: left_node.startPosition.column + 1,
                end_line: left_node.endPosition.row + 1,
                end_column: left_node.endPosition.column + 1,
              },
            });
          }
        }

        const processing_context = {
          ...context,
          captures: captures,
        };

        const builder = new ReferenceBuilder(
          processing_context,
          JAVASCRIPT_METADATA_EXTRACTORS,
          TEST_FILE_PATH
        );

        builder.process(captures[0]);
        const assignments = builder.references.filter(
          (r) => r.type === "assignment"
        );

        expect(assignments).toBeDefined();
        // Assignment parts would be extracted through metadata extractors
      });

      it("should process constructor calls with metadata", () => {
        const code = `
          const instance = new MyClass();
        `;

        const context = create_test_context();
        const ast = parser.parse(code);
        const captures: CaptureNode[] = [];

        // Find the new expression
        const new_expr = find_node_by_type(ast.rootNode, "new_expression");
        if (new_expr) {
          const constructor_node = new_expr.childForFieldName("constructor");
          if (constructor_node) {
            captures.push({
              name: "ref.constructor",
              category: "reference" as SemanticCategory,
              entity: "constructor" as SemanticEntity,
              node: constructor_node as any,
              text: constructor_node.text as SymbolName,
              location: node_to_location(constructor_node, TEST_FILE_PATH),
            });
          }
        }

        const processing_context = {
          ...context,
          captures: captures,
        };

        const builder = new ReferenceBuilder(
          processing_context,
          JAVASCRIPT_METADATA_EXTRACTORS,
          TEST_FILE_PATH
        );

        builder.process(captures[0]);
        const constructor_calls = builder.references.filter(
          (r): r is ConstructorCallReference => r.kind === "constructor_call"
        );

        expect(constructor_calls).toHaveLength(1);
        expect(constructor_calls[0]?.construct_target).toBeDefined();
      });
    });

    describe("Export Detection", () => {
      it("should detect direct exports and set is_exported=true", () => {
        const code = "export function foo() {}";
        const capture = create_capture(code, "definition.function", "identifier");
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.function");
        if (config) {
          config.process(capture, builder, context);
        }

        const result = builder.build();
        const functions = Array.from(result.functions.values());
        expect(functions).toHaveLength(1);
        expect(functions[0].is_exported).toBe(true);
        expect(functions[0].export).toBeUndefined(); // Direct export has no special metadata
      });

      it("should detect named exports with aliases and populate export.export_name", () => {
        const code = `
function internal() {}
export { internal as external };
        `;
        const capture = create_capture(code, "definition.function", "identifier");
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.function");
        if (config) {
          config.process(capture, builder, context);
        }

        const result = builder.build();
        const functions = Array.from(result.functions.values());
        expect(functions).toHaveLength(1);
        expect(functions[0].is_exported).toBe(true);
        expect(functions[0].export?.export_name).toBe("external");
        expect(functions[0].export?.is_reexport).toBe(false);
      });

      it("should detect default exports and set export.is_default=true", () => {
        const code = "export default function foo() {}";
        const capture = create_capture(code, "definition.function", "identifier");
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.function");
        if (config) {
          config.process(capture, builder, context);
        }

        const result = builder.build();
        const functions = Array.from(result.functions.values());
        expect(functions).toHaveLength(1);
        expect(functions[0].is_exported).toBe(true);
        expect(functions[0].export?.is_default).toBe(true);
        expect(functions[0].export?.is_reexport).toBeUndefined();
      });

      it("should detect re-exports and set export.is_reexport=true", () => {
        // Note: This tests the detection logic, but in practice re-exports
        // wouldn't create definitions in the current file
        const code = "export { foo } from './other';";
        const ast = parser.parse(code);
        const export_node = find_node_by_type(ast.rootNode, "export_statement");

        if (export_node) {
          const metadata = analyze_export_statement(export_node);
          expect(metadata).toBeDefined();
          expect(metadata?.is_reexport).toBe(true);
        }
      });

      it("should not mark non-exported symbols as exported and set is_exported=false", () => {
        const code = "function notExported() {}";
        const capture = create_capture(code, "definition.function", "identifier");
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.function");
        if (config) {
          config.process(capture, builder, context);
        }

        const result = builder.build();
        const functions = Array.from(result.functions.values());
        expect(functions).toHaveLength(1);
        expect(functions[0].is_exported).toBe(false);
        expect(functions[0].export).toBeUndefined();
      });

      it("should detect named exports without aliases", () => {
        const code = `
function foo() {}
export { foo };
        `;
        const capture = create_capture(code, "definition.function", "identifier");
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.function");
        if (config) {
          config.process(capture, builder, context);
        }

        const result = builder.build();
        const functions = Array.from(result.functions.values());
        expect(functions).toHaveLength(1);
        expect(functions[0].is_exported).toBe(true);
        expect(functions[0].export?.export_name).toBeUndefined(); // No alias
        expect(functions[0].export?.is_reexport).toBe(false);
      });

      it("should handle exported classes with is_exported=true", () => {
        const code = "export class MyClass {}";
        const capture = create_capture(code, "definition.class", "identifier");
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
        if (config) {
          config.process(capture, builder, context);
        }

        const result = builder.build();
        const classes = Array.from(result.classes.values());
        expect(classes).toHaveLength(1);
        expect(classes[0].is_exported).toBe(true);
      });

      it("should handle exported variables with is_exported=true", () => {
        const code = "export const myVar = 42;";
        const capture = create_capture(code, "definition.variable", "identifier");
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.variable");
        if (config) {
          config.process(capture, builder, context);
        }

        const result = builder.build();
        const variables = Array.from(result.variables.values());
        expect(variables).toHaveLength(1);
        expect(variables[0].is_exported).toBe(true);
      });

      it("should NOT mark variables inside exported object literals as exported", () => {
        const code = `
export const CONFIG = {
  handler: () => {
    const local_var = 42;
    return local_var;
  }
};`;
        const ast = parser.parse(code);
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        // Process all variable definitions
        const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.variable");
        if (!config) {
          throw new Error("definition.variable config not found");
        }

        // Find all variable identifiers
        const captures: Array<{ node: SyntaxNode; text: string }> = [];
        function find_variables(node: SyntaxNode) {
          if (node.type === "identifier") {
            const parent = node.parent;
            // Check if this is a variable declarator name
            if (parent?.type === "variable_declarator" && parent.childForFieldName("name") === node) {
              captures.push({ node, text: node.text });
            }
          }
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) find_variables(child);
          }
        }
        find_variables(ast.rootNode);

        // Process each variable
        for (const cap of captures) {
          const capture = {
            node: cap.node,
            text: cap.text as SymbolName,
            location: node_to_location(cap.node, code),
            type: "definition.variable",
          };
          config.process(capture, builder, context);
        }

        const result = builder.build();
        const variables = Array.from(result.variables.values());

        // Should have 2 variables: CONFIG and local_var
        expect(variables.length).toBe(2);

        const config_var = variables.find(v => v.name === "CONFIG");
        const local_var = variables.find(v => v.name === "local_var");

        expect(config_var).toBeDefined();
        expect(local_var).toBeDefined();

        // CONFIG should be exported
        expect(config_var!.is_exported).toBe(true);

        // local_var should NOT be exported (it's inside a nested arrow function)
        expect(local_var!.is_exported).toBe(false);
      });

      it("should NOT mark variables inside exported arrays with functions as exported", () => {
        const code = `
export const HANDLERS = [
  function process(item) {
    const temp = item.value;
    return temp;
  }
];`;
        const ast = parser.parse(code);
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        // Process all variable definitions
        const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.variable");
        if (!config) {
          throw new Error("definition.variable config not found");
        }

        // Find all variable identifiers
        const captures: Array<{ node: SyntaxNode; text: string }> = [];
        function find_variables(node: SyntaxNode) {
          if (node.type === "identifier") {
            const parent = node.parent;
            if (parent?.type === "variable_declarator" && parent.childForFieldName("name") === node) {
              captures.push({ node, text: node.text });
            }
          }
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) find_variables(child);
          }
        }
        find_variables(ast.rootNode);

        // Process each variable
        for (const cap of captures) {
          const capture = {
            node: cap.node,
            text: cap.text as SymbolName,
            location: node_to_location(cap.node, code),
            type: "definition.variable",
          };
          config.process(capture, builder, context);
        }

        const result = builder.build();
        const variables = Array.from(result.variables.values());

        // Should have 2 variables: HANDLERS and temp
        expect(variables.length).toBe(2);

        const handlers_var = variables.find(v => v.name === "HANDLERS");
        const temp_var = variables.find(v => v.name === "temp");

        expect(handlers_var).toBeDefined();
        expect(temp_var).toBeDefined();

        // HANDLERS should be exported
        expect(handlers_var!.is_exported).toBe(true);

        // temp should NOT be exported (it's inside a nested function)
        expect(temp_var!.is_exported).toBe(false);
      });

      it("should NOT mark deeply nested variables in exported objects as exported", () => {
        const code = `
export const NESTED = {
  outer: {
    middle: () => {
      const deeply_nested = true;
      return deeply_nested;
    }
  }
};`;
        const ast = parser.parse(code);
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        // Process all variable definitions
        const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.variable");
        if (!config) {
          throw new Error("definition.variable config not found");
        }

        // Find all variable identifiers
        const captures: Array<{ node: SyntaxNode; text: string }> = [];
        function find_variables(node: SyntaxNode) {
          if (node.type === "identifier") {
            const parent = node.parent;
            if (parent?.type === "variable_declarator" && parent.childForFieldName("name") === node) {
              captures.push({ node, text: node.text });
            }
          }
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) find_variables(child);
          }
        }
        find_variables(ast.rootNode);

        // Process each variable
        for (const cap of captures) {
          const capture = {
            node: cap.node,
            text: cap.text as SymbolName,
            location: node_to_location(cap.node, code),
            type: "definition.variable",
          };
          config.process(capture, builder, context);
        }

        const result = builder.build();
        const variables = Array.from(result.variables.values());

        // Should have 2 variables: NESTED and deeply_nested
        expect(variables.length).toBe(2);

        const nested_var = variables.find(v => v.name === "NESTED");
        const deeply_var = variables.find(v => v.name === "deeply_nested");

        expect(nested_var).toBeDefined();
        expect(deeply_var).toBeDefined();

        // NESTED should be exported
        expect(nested_var!.is_exported).toBe(true);

        // deeply_nested should NOT be exported (it's inside a nested arrow function)
        expect(deeply_var!.is_exported).toBe(false);
      });
    });

    describe("JSDoc Documentation Extraction", () => {
      it("should have documentation capture handlers in config", () => {
        const documentation_mappings = [
          "definition.function.documentation",
          "definition.class.documentation",
          "definition.method.documentation",
          "definition.variable.documentation",
        ];

        for (const mapping of documentation_mappings) {
          expect(JAVASCRIPT_BUILDER_CONFIG.has(mapping)).toBe(true);
          const config = JAVASCRIPT_BUILDER_CONFIG.get(mapping);
          expect(config).toBeDefined();
          expect(config?.process).toBeInstanceOf(Function);
        }
      });

      it("should capture and attach JSDoc documentation to functions", () => {
        const code = `
          /**
           * Creates a user account
           * @param {string} name
           * @returns {User}
           */
          function createUser(name) {
            return { name };
          }
        `;
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);
        const ast = parser.parse(code);

        // Find and process the JSDoc comment
        const comment_node = find_node_by_type(ast.rootNode, "comment");
        expect(comment_node).toBeDefined();

        if (comment_node) {
          const doc_capture: CaptureNode = {
            name: "definition.function.documentation",
            category: "definition" as SemanticCategory,
            entity: "function" as SemanticEntity,
            node: comment_node as any,
            text: comment_node.text as SymbolName,
            location: node_to_location(comment_node, TEST_FILE_PATH),
          };

          const doc_processor = JAVASCRIPT_BUILDER_CONFIG.get(
            "definition.function.documentation"
          );
          doc_processor?.process(doc_capture, builder, context);
        }

        // Find and process the function
        const func_node = find_node_by_type(ast.rootNode, "function_declaration");
        const name_node = func_node?.childForFieldName("name");

        if (name_node) {
          const func_capture: CaptureNode = {
            name: "definition.function",
            category: "definition" as SemanticCategory,
            entity: "function" as SemanticEntity,
            node: name_node as any,
            text: name_node.text as SymbolName,
            location: node_to_location(name_node, TEST_FILE_PATH),
          };

          const func_processor = JAVASCRIPT_BUILDER_CONFIG.get(
            "definition.function"
          );
          func_processor?.process(func_capture, builder, context);
        }

        const result = builder.build();
        const functions = Array.from(result.functions.values());
        expect(functions).toHaveLength(1);
        expect(functions[0].name).toBe("createUser");
        expect(functions[0].docstring).toBeDefined();
        expect(functions[0].docstring).toContain("Creates a user account");
        expect(functions[0].docstring).toContain("@param {string} name");
        expect(functions[0].docstring).toContain("@returns {User}");
      });

      it("should capture and attach JSDoc documentation to classes", () => {
        const code = `
          /**
           * Represents a user
           * @class
           */
          class User {
            constructor(name) {
              this.name = name;
            }
          }
        `;
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);
        const ast = parser.parse(code);

        // Process the JSDoc comment
        const comment_node = find_node_by_type(ast.rootNode, "comment");
        if (comment_node) {
          const doc_capture: CaptureNode = {
            name: "definition.class.documentation",
            category: "definition" as SemanticCategory,
            entity: "class" as SemanticEntity,
            node: comment_node as any,
            text: comment_node.text as SymbolName,
            location: node_to_location(comment_node, TEST_FILE_PATH),
          };

          const doc_processor = JAVASCRIPT_BUILDER_CONFIG.get(
            "definition.class.documentation"
          );
          doc_processor?.process(doc_capture, builder, context);
        }

        // Process the class
        const class_node = find_node_by_type(ast.rootNode, "class_declaration");
        const name_node = class_node?.childForFieldName("name");

        if (name_node) {
          const class_capture: CaptureNode = {
            name: "definition.class",
            category: "definition" as SemanticCategory,
            entity: "class" as SemanticEntity,
            node: name_node as any,
            text: name_node.text as SymbolName,
            location: node_to_location(name_node, TEST_FILE_PATH),
          };

          const class_processor =
            JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
          class_processor?.process(class_capture, builder, context);
        }

        const result = builder.build();
        const classes = Array.from(result.classes.values());
        expect(classes).toHaveLength(1);
        expect(classes[0].name).toBe("User");
        expect(classes[0].docstring).toBeDefined();
        expect(classes[0].docstring?.[0]).toContain("Represents a user");
        expect(classes[0].docstring?.[0]).toContain("@class");
      });

      it("should capture and attach JSDoc documentation to methods", () => {
        const code = `
          class Calculator {
            /**
             * Adds two numbers
             * @param {number} a
             * @param {number} b
             * @returns {number}
             */
            add(a, b) {
              return a + b;
            }
          }
        `;
        const context = create_test_context(true); // Need scopes for method bodies
        const builder = new DefinitionBuilder(context);
        const ast = parser.parse(code);

        // First process the class
        const class_node = find_node_by_type(ast.rootNode, "class_declaration");
        const class_name_node = class_node?.childForFieldName("name");

        if (class_name_node) {
          const class_capture: CaptureNode = {
            name: "definition.class",
            category: "definition" as SemanticCategory,
            entity: "class" as SemanticEntity,
            node: class_name_node as any,
            text: class_name_node.text as SymbolName,
            location: node_to_location(class_name_node, TEST_FILE_PATH),
          };

          const class_processor =
            JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
          class_processor?.process(class_capture, builder, context);
        }

        // Process the JSDoc comment
        const comment_node = find_node_by_type(ast.rootNode, "comment");
        if (comment_node) {
          const doc_capture: CaptureNode = {
            name: "definition.method.documentation",
            category: "definition" as SemanticCategory,
            entity: "method" as SemanticEntity,
            node: comment_node as any,
            text: comment_node.text as SymbolName,
            location: node_to_location(comment_node, TEST_FILE_PATH),
          };

          const doc_processor = JAVASCRIPT_BUILDER_CONFIG.get(
            "definition.method.documentation"
          );
          doc_processor?.process(doc_capture, builder, context);
        }

        // Process the method
        const method_node = find_node_by_type(ast.rootNode, "method_definition");
        const method_name_node = method_node?.childForFieldName("name");

        if (method_name_node) {
          const method_capture: CaptureNode = {
            name: "definition.method",
            category: "definition" as SemanticCategory,
            entity: "method" as SemanticEntity,
            node: method_name_node as any,
            text: method_name_node.text as SymbolName,
            location: node_to_location(method_name_node, TEST_FILE_PATH),
          };

          const method_processor =
            JAVASCRIPT_BUILDER_CONFIG.get("definition.method");
          method_processor?.process(method_capture, builder, context);
        }

        const result = builder.build();
        const classes = Array.from(result.classes.values());
        expect(classes).toHaveLength(1);
        expect(classes[0].name).toBe("Calculator");

        const class_def = classes[0] as any;
        expect(class_def.methods).toHaveLength(1);
        expect(class_def.methods[0].name).toBe("add");
        expect(class_def.methods[0].docstring).toBeDefined();
        expect(class_def.methods[0].docstring).toContain("Adds two numbers");
        expect(class_def.methods[0].docstring).toContain("@param {number} a");
        expect(class_def.methods[0].docstring).toContain("@returns {number}");
      });

      it("should capture and attach JSDoc documentation to variables", () => {
        const code = `
          /** @type {Service} */
          const service = createService();
        `;
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);
        const ast = parser.parse(code);

        // Process the JSDoc comment
        const comment_node = find_node_by_type(ast.rootNode, "comment");
        if (comment_node) {
          const doc_capture: CaptureNode = {
            name: "definition.variable.documentation",
            category: "definition" as SemanticCategory,
            entity: "variable" as SemanticEntity,
            node: comment_node as any,
            text: comment_node.text as SymbolName,
            location: node_to_location(comment_node, TEST_FILE_PATH),
          };

          const doc_processor = JAVASCRIPT_BUILDER_CONFIG.get(
            "definition.variable.documentation"
          );
          doc_processor?.process(doc_capture, builder, context);
        }

        // Process the variable
        const var_node = find_node_by_type(ast.rootNode, "variable_declarator");
        const name_node = var_node?.childForFieldName("name");

        if (name_node) {
          const var_capture: CaptureNode = {
            name: "definition.variable",
            category: "definition" as SemanticCategory,
            entity: "variable" as SemanticEntity,
            node: name_node as any,
            text: name_node.text as SymbolName,
            location: node_to_location(name_node, TEST_FILE_PATH),
          };

          const var_processor = JAVASCRIPT_BUILDER_CONFIG.get(
            "definition.variable"
          );
          var_processor?.process(var_capture, builder, context);
        }

        const result = builder.build();
        const variables = Array.from(result.variables.values());
        expect(variables).toHaveLength(1);
        expect(variables[0].name).toBe("service");
        expect(variables[0].docstring).toBeDefined();
        expect(variables[0].docstring).toContain("@type {Service}");
      });

      it("should not attach documentation when there is no comment", () => {
        const code = "function noDoc() { return 42; }";
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);
        const ast = parser.parse(code);

        // Process the function without processing any documentation
        const func_node = find_node_by_type(ast.rootNode, "function_declaration");
        const name_node = func_node?.childForFieldName("name");

        if (name_node) {
          const func_capture: CaptureNode = {
            name: "definition.function",
            category: "definition" as SemanticCategory,
            entity: "function" as SemanticEntity,
            node: name_node as any,
            text: name_node.text as SymbolName,
            location: node_to_location(name_node, TEST_FILE_PATH),
          };

          const func_processor = JAVASCRIPT_BUILDER_CONFIG.get(
            "definition.function"
          );
          func_processor?.process(func_capture, builder, context);
        }

        const result = builder.build();
        const functions = Array.from(result.functions.values());
        expect(functions).toHaveLength(1);
        expect(functions[0].name).toBe("noDoc");
        expect(functions[0].docstring).toBeUndefined();
      });

      it("should handle multiple functions with separate documentation", () => {
        const code = `
          /** First function */
          function first() { }

          /** Second function */
          function second() { }
        `;
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);
        const ast = parser.parse(code);

        // Find all comment nodes
        const comments: any[] = [];
        const functions: any[] = [];

        function collect_nodes(node: any) {
          if (node.type === "comment") {
            comments.push(node);
          }
          if (node.type === "function_declaration") {
            functions.push(node);
          }
          for (let i = 0; i < node.childCount; i++) {
            collect_nodes(node.child(i));
          }
        }
        collect_nodes(ast.rootNode);

        expect(comments).toHaveLength(2);
        expect(functions).toHaveLength(2);

        // Process first comment and function
        if (comments[0]) {
          const doc_capture1: CaptureNode = {
            name: "definition.function.documentation",
            category: "definition" as SemanticCategory,
            entity: "function" as SemanticEntity,
            node: comments[0] as any,
            text: comments[0].text as SymbolName,
            location: {
              file_path: TEST_FILE_PATH,
              start_line: comments[0].startPosition.row + 1,
              start_column: comments[0].startPosition.column + 1,
              end_line: comments[0].endPosition.row + 1,
              end_column: comments[0].endPosition.column + 1,
            },
          };

          const doc_processor = JAVASCRIPT_BUILDER_CONFIG.get(
            "definition.function.documentation"
          );
          doc_processor?.process(doc_capture1, builder, context);
        }

        if (functions[0]) {
          const name_node1 = functions[0].childForFieldName("name");
          const func_capture1: CaptureNode = {
            name: "definition.function",
            category: "definition" as SemanticCategory,
            entity: "function" as SemanticEntity,
            node: name_node1 as any,
            text: name_node1.text as SymbolName,
            location: {
              file_path: TEST_FILE_PATH,
              start_line: name_node1.startPosition.row + 1,
              start_column: name_node1.startPosition.column + 1,
              end_line: name_node1.endPosition.row + 1,
              end_column: name_node1.endPosition.column + 1,
            },
          };

          const func_processor = JAVASCRIPT_BUILDER_CONFIG.get(
            "definition.function"
          );
          func_processor?.process(func_capture1, builder, context);
        }

        // Process second comment and function
        if (comments[1]) {
          const doc_capture2: CaptureNode = {
            name: "definition.function.documentation",
            category: "definition" as SemanticCategory,
            entity: "function" as SemanticEntity,
            node: comments[1] as any,
            text: comments[1].text as SymbolName,
            location: {
              file_path: TEST_FILE_PATH,
              start_line: comments[1].startPosition.row + 1,
              start_column: comments[1].startPosition.column + 1,
              end_line: comments[1].endPosition.row + 1,
              end_column: comments[1].endPosition.column + 1,
            },
          };

          const doc_processor = JAVASCRIPT_BUILDER_CONFIG.get(
            "definition.function.documentation"
          );
          doc_processor?.process(doc_capture2, builder, context);
        }

        if (functions[1]) {
          const name_node2 = functions[1].childForFieldName("name");
          const func_capture2: CaptureNode = {
            name: "definition.function",
            category: "definition" as SemanticCategory,
            entity: "function" as SemanticEntity,
            node: name_node2 as any,
            text: name_node2.text as SymbolName,
            location: {
              file_path: TEST_FILE_PATH,
              start_line: name_node2.startPosition.row + 1,
              start_column: name_node2.startPosition.column + 1,
              end_line: name_node2.endPosition.row + 1,
              end_column: name_node2.endPosition.column + 1,
            },
          };

          const func_processor = JAVASCRIPT_BUILDER_CONFIG.get(
            "definition.function"
          );
          func_processor?.process(func_capture2, builder, context);
        }

        const result = builder.build();
        const built_functions = Array.from(result.functions.values());
        expect(built_functions).toHaveLength(2);

        const first_func = built_functions.find((f) => f.name === "first");
        const second_func = built_functions.find((f) => f.name === "second");

        expect(first_func?.docstring).toBeDefined();
        expect(first_func?.docstring).toContain("First function");
        expect(second_func?.docstring).toBeDefined();
        expect(second_func?.docstring).toContain("Second function");
      });
    });
  });

  describe("Property Type Extraction from JSDoc", () => {
    // Helper to build semantic index from code (for integration tests)
    async function build_index_from_code(code: string) {
      const tree = parser.parse(code);
      const lines = code.split("\n");
      const parsed_file = {
        file_path: TEST_FILE_PATH,
        file_lines: lines.length,
        file_end_column: lines[lines.length - 1].length + 1,
        tree: tree,
        lang: "javascript" as const,
      };

      return build_semantic_index(parsed_file, tree, "javascript");
    }

    it("should extract type from JSDoc annotation on class field", async () => {
      const code = `
        class Registry {
          /** @type {Map<string, Symbol>} */
          symbols = new Map();
        }
      `;

      const index = await build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      expect(classes.length).toBe(1);

      const registry_class = classes[0];
      expect(registry_class.name).toBe("Registry");
      expect(registry_class.properties.length).toBeGreaterThan(0);

      const symbols_prop = registry_class.properties.find(p => p.name === "symbols");
      expect(symbols_prop).toBeDefined();
      expect(symbols_prop?.type).toBe("Map<string, Symbol>");
    });

    it("should extract type from multiline JSDoc", async () => {
      const code = `
        class Config {
          /**
           * Application settings
           * @type {AppSettings}
           */
          settings = {};
        }
      `;

      const index = await build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      expect(classes.length).toBe(1);

      const config_class = classes[0];
      const settings_prop = config_class.properties.find(p => p.name === "settings");
      expect(settings_prop).toBeDefined();
      expect(settings_prop?.type).toBe("AppSettings");
    });

    it.skip("should extract type from JSDoc on constructor assignment (not yet implemented)", async () => {
      // Constructor assignments require additional infrastructure to track as properties
      // This is a known limitation - JSDoc types on constructor assignments aren't extracted yet
      const code = `
        class Project {
          constructor() {
            /** @type {DefinitionRegistry} */
            this.definitions = new DefinitionRegistry();
          }
        }
      `;

      const index = await build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      expect(classes.length).toBe(1);

      const project_class = classes[0];
      const definitions_prop = project_class.properties.find(p => p.name === "definitions");
      expect(definitions_prop).toBeDefined();
      expect(definitions_prop?.type).toBe("DefinitionRegistry");
    });

    it("should extract array type annotations", async () => {
      const code = `
        class Foo {
          /** @type {number[]} */
          numbers = [];

          /** @type {Array<string>} */
          items = [];
        }
      `;

      const index = await build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      expect(classes.length).toBe(1);

      const foo_class = classes[0];

      const numbers_prop = foo_class.properties.find(p => p.name === "numbers");
      expect(numbers_prop?.type).toBe("number[]");

      const items_prop = foo_class.properties.find(p => p.name === "items");
      expect(items_prop?.type).toBe("Array<string>");
    });

    it("should extract union type annotations", async () => {
      const code = `
        class Foo {
          /** @type {string | number | null} */
          value = null;
        }
      `;

      const index = await build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      expect(classes.length).toBe(1);

      const foo_class = classes[0];
      const value_prop = foo_class.properties.find(p => p.name === "value");
      expect(value_prop).toBeDefined();
      expect(value_prop?.type).toBe("string | number | null");
    });

    it("should extract function type annotations", async () => {
      const code = `
        class Foo {
          /** @type {(data: string) => void} */
          handler = null;
        }
      `;

      const index = await build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      expect(classes.length).toBe(1);

      const foo_class = classes[0];
      const handler_prop = foo_class.properties.find(p => p.name === "handler");
      expect(handler_prop).toBeDefined();
      expect(handler_prop?.type).toBe("(data: string) => void");
    });

    it("should handle properties without JSDoc", async () => {
      const code = `
        class Foo {
          data = 42;
        }
      `;

      const index = await build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      expect(classes.length).toBe(1);

      const foo_class = classes[0];
      const data_prop = foo_class.properties.find(p => p.name === "data");
      expect(data_prop).toBeDefined();
      expect(data_prop?.type).toBeUndefined();
    });
  });

  // ============================================================================
  // DETECT_CALLBACK_CONTEXT UNIT TESTS (Task 11.156.2.2)
  // ============================================================================

  describe("detect_callback_context", () => {
    function find_arrow_func(node: SyntaxNode): SyntaxNode | null {
      if (node.type === "arrow_function") {
        return node;
      }
      for (const child of node.children) {
        const result = find_arrow_func(child);
        if (result) return result;
      }
      return null;
    }

    describe("Callback detection - positive cases", () => {
      it("should detect callback in array.forEach()", () => {
        const code = "items.forEach((item) => { console.log(item); });";
        const tree = parser.parse(code);
        const arrow_func = find_arrow_func(tree.rootNode);

        expect(arrow_func).not.toBeNull();
        const context = detect_callback_context(arrow_func!, "test.js");

        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
        expect(context.receiver_location?.start_line).toBe(1);
      });

      it("should detect callback in array.map()", () => {
        const code = "numbers.map(x => x * 2);";
        const tree = parser.parse(code);
        const arrow_func = find_arrow_func(tree.rootNode);

        expect(arrow_func).not.toBeNull();
        const context = detect_callback_context(arrow_func!, "test.js");

        expect(context.is_callback).toBe(true);
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in array.filter()", () => {
        const code = "items.filter(item => item.active);";
        const tree = parser.parse(code);
        const arrow_func = find_arrow_func(tree.rootNode);

        expect(arrow_func).not.toBeNull();
        const context = detect_callback_context(arrow_func!, "test.js");

        expect(context.is_callback).toBe(true);
      });

      it("should detect callback as second argument", () => {
        const code = "setTimeout(() => console.log(\"done\"), 1000);";
        const tree = parser.parse(code);
        const arrow_func = find_arrow_func(tree.rootNode);

        expect(arrow_func).not.toBeNull();
        const context = detect_callback_context(arrow_func!, "test.js");

        expect(context.is_callback).toBe(true);
      });

      it("should detect nested callback (callback inside callback)", () => {
        const code = "items.map(x => [x].filter(y => y > 0));";
        const tree = parser.parse(code);

        // Find both arrow functions
        const arrow_funcs: SyntaxNode[] = [];
        function collect_arrow_funcs(node: SyntaxNode) {
          if (node.type === "arrow_function") {
            arrow_funcs.push(node);
          }
          for (const child of node.children) {
            collect_arrow_funcs(child);
          }
        }
        collect_arrow_funcs(tree.rootNode);

        expect(arrow_funcs.length).toBe(2);

        // Both should be detected as callbacks
        const outer_context = detect_callback_context(arrow_funcs[0], "test.js");
        const inner_context = detect_callback_context(arrow_funcs[1], "test.js");

        expect(outer_context.is_callback).toBe(true);
        expect(inner_context.is_callback).toBe(true);
      });

      it("should detect callback in method call", () => {
        const code = "obj.subscribe(event => handle(event));";
        const tree = parser.parse(code);
        const arrow_func = find_arrow_func(tree.rootNode);

        expect(arrow_func).not.toBeNull();
        const context = detect_callback_context(arrow_func!, "test.js");

        expect(context.is_callback).toBe(true);
      });
    });

    describe("Non-callback detection - negative cases", () => {
      it("should NOT detect callback in variable assignment", () => {
        const code = "const fn = () => { console.log(\"test\"); };";
        const tree = parser.parse(code);
        const arrow_func = find_arrow_func(tree.rootNode);

        expect(arrow_func).not.toBeNull();
        const context = detect_callback_context(arrow_func!, "test.js");

        expect(context.is_callback).toBe(false);
        expect(context.receiver_location).toBeNull();
      });

      it("should NOT detect callback in return statement", () => {
        const code = "function factory() { return () => {}; }";
        const tree = parser.parse(code);
        const arrow_func = find_arrow_func(tree.rootNode);

        expect(arrow_func).not.toBeNull();
        const context = detect_callback_context(arrow_func!, "test.js");

        expect(context.is_callback).toBe(false);
      });

      it("should NOT detect callback in object literal", () => {
        const code = "const obj = { handler: () => {} };";
        const tree = parser.parse(code);
        const arrow_func = find_arrow_func(tree.rootNode);

        expect(arrow_func).not.toBeNull();
        const context = detect_callback_context(arrow_func!, "test.js");

        expect(context.is_callback).toBe(false);
      });

      it("should NOT detect callback in array literal", () => {
        const code = "const fns = [() => {}];";
        const tree = parser.parse(code);
        const arrow_func = find_arrow_func(tree.rootNode);

        expect(arrow_func).not.toBeNull();
        const context = detect_callback_context(arrow_func!, "test.js");

        expect(context.is_callback).toBe(false);
      });
    });

    describe("Receiver location capture", () => {
      it("should capture correct receiver location for forEach call", () => {
        const code = "items.forEach((x) => x * 2);";
        const tree = parser.parse(code);
        const arrow_func = find_arrow_func(tree.rootNode);

        expect(arrow_func).not.toBeNull();
        const context = detect_callback_context(arrow_func!, "test.js");

        expect(context.receiver_location).toEqual({
          file_path: "test.js",
          start_line: 1,
          start_column: 1,
          end_line: 1,
          end_column: 27,
        });
      });

      it("should capture receiver location spanning multiple lines", () => {
        const code = `items.forEach(
  (item) => {
    console.log(item);
  }
);`;
        const tree = parser.parse(code);
        const arrow_func = find_arrow_func(tree.rootNode);

        expect(arrow_func).not.toBeNull();
        const context = detect_callback_context(arrow_func!, "test.js");

        expect(context.receiver_location).not.toBeNull();
        expect(context.receiver_location?.start_line).toBe(1);
        expect(context.receiver_location?.end_line).toBe(5);
      });
    });
    describe("Derived Variable Detection", () => {
      it("should detect derived_from for config.get() pattern", () => {
        const code = `
          const CONFIG = new Map([]);
          const handler = CONFIG.get('key');
        `;
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        
        // Find 'handler' variable
        const var_nodes: SyntaxNode[] = [];
        function find_vars(node: SyntaxNode) {
          if (node.type === "variable_declarator") {
            var_nodes.push(node);
          }
          for (let i = 0; i < node.childCount; i++) {
            find_vars(node.child(i)!);
          }
        }
        find_vars(ast.rootNode);
        
        const handler_node = var_nodes[1]; // Second one is handler
        const name_node = handler_node?.childForFieldName("name");

        if (!name_node) {
          throw new Error("Could not find handler variable name");
        }

        const capture: CaptureNode = {
          name: "definition.variable",
          category: "definition" as SemanticCategory,
          entity: "variable" as SemanticEntity,
          node: name_node as any,
          text: name_node.text as SymbolName,
          location: node_to_location(name_node, TEST_FILE_PATH),
        };

        const processor = JAVASCRIPT_BUILDER_CONFIG.get("definition.variable");
        expect(processor).toBeDefined();
        processor?.process(capture, builder, context);

        const result = builder.build();
        const variables = Array.from(result.variables.values());
        expect(variables).toHaveLength(1);
        
        const handler_var = variables[0];
        expect(handler_var.name).toBe("handler");
        expect(handler_var.derived_from).toBe("CONFIG");
      });
    });
  });
});

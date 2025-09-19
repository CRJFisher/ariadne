/**
 * Comprehensive tests for type tracking utilities
 */

import { describe, it, expect, beforeEach } from "vitest";
import type {
  Location,
  FilePath,
  LocationKey,
  SymbolName,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import {
  location_key,
} from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity, SemanticCategory } from "../../capture_types";
import type { TypeInfo } from "./type_info";
import {
  TypeSource,
  AssignmentContext,
  ReturnContext,
  TypedReferenceContext,
  TypeConstraint,
  build_typed_assignment_map,
  build_typed_return_map,
  build_type_annotation_map,
  connect_assignment_type,
  connect_return_type,
  connect_type_annotation,
} from "./type_tracking";

describe("Type Tracking", () => {
  const mockFilePath = "test.ts" as FilePath;
  const mockLocation: Location = {
    file_path: mockFilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
  };

  const mockScope: LexicalScope = {
    id: "scope_1" as ScopeId,
    parent_id: null,
    name: "testFunction" as SymbolName,
    type: "function",
    location: {
      file_path: mockFilePath,
      line: 1,
      column: 0,
      end_line: 10, // Extended to line 10 to include test captures
      end_column: 10,
    },
    child_ids: [],
    symbols: new Map(),
  };

  const mockScopes = new Map<ScopeId, LexicalScope>([
    [mockScope.id, mockScope],
  ]);

  describe("TypeInfo Interface", () => {
    it("should define correct structure with required fields", () => {
      const typeInfo: TypeInfo = {
        type_name: "string" as SymbolName,
        certainty: "declared",
        source: {
          kind: "annotation",
          location: mockLocation,
        },
      };

      expect(typeInfo.type_name).toBe("string");
      expect(typeInfo.certainty).toBe("declared");
      expect(typeInfo.source.kind).toBe("annotation");
      expect(typeInfo.source.location).toEqual(mockLocation);
    });

    it("should support all certainty levels", () => {
      const certaintyLevels = ["declared", "inferred", "ambiguous"] as const;

      for (const certainty of certaintyLevels) {
        const typeInfo: TypeInfo = {
          type_name: "test" as SymbolName,
          certainty,
          source: {
            kind: "annotation",
            location: mockLocation,
          },
        };

        expect(typeInfo.certainty).toBe(certainty);
      }
    });

    it("should support optional fields", () => {
      const stringType: TypeInfo = {
        type_name: "string" as SymbolName,
        certainty: "declared",
        source: { kind: "annotation", location: mockLocation },
      };

      const fullTypeInfo: TypeInfo = {
        type_name: "ComplexType" as SymbolName,
        certainty: "declared",
        source: {
          kind: "annotation",
          location: mockLocation,
        },
        type_params: [stringType],
        is_nullable: true,
        is_array: false,
      };

      expect(fullTypeInfo.type_name).toBeDefined();
      expect(fullTypeInfo.type_params).toHaveLength(1);
      expect(fullTypeInfo.is_nullable).toBe(true);
      expect(fullTypeInfo.is_array).toBe(false);
    });
  });

  describe("TypeSource Interface", () => {
    it("should define correct structure for all source kinds", () => {
      const sourceKinds = ["annotation", "assignment", "return", "literal", "construction", "import"] as const;

      for (const kind of sourceKinds) {
        const source: TypeSource = {
          kind,
          location: mockLocation,
        };

        expect(source.kind).toBe(kind);
        expect(source.location).toEqual(mockLocation);
      }
    });

    it("should support optional source location", () => {
      const sourceLocation: Location = {
        file_path: mockFilePath,
        line: 2,
          column: 0,
        end_line: 2,
          end_column: 5,
      };

      const source: TypeSource = {
        kind: "assignment",
        location: mockLocation,
        source_location: sourceLocation,
      };

      expect(source.source_location).toEqual(sourceLocation);
    });
  });

  describe("AssignmentContext Interface", () => {
    it("should define correct structure", () => {
      const context: AssignmentContext = {
        target_location: mockLocation,
        source_location: {
          file_path: mockFilePath,
          line: 1,
          column: 10,
          end_line: 1,
          end_column: 15,
        },
        source_type: {
          type_name: "string" as SymbolName,
          certainty: "inferred",
          source: { kind: "literal", location: mockLocation },
        },
        previous_type: {
          type_name: "unknown" as SymbolName,
          certainty: "ambiguous",
          source: { kind: "assignment", location: mockLocation },
        },
        is_narrowing: true,
        scope_id: mockScope.id,
      };

      expect(context.target_location).toEqual(mockLocation);
      expect(context.source_type?.type_name).toBe("string");
      expect(context.previous_type?.type_name).toBe("unknown");
      expect(context.is_narrowing).toBe(true);
      expect(context.scope_id).toBe(mockScope.id);
    });

    it("should support minimal structure", () => {
      const minimalContext: AssignmentContext = {
        target_location: mockLocation,
        source_location: mockLocation,
        scope_id: mockScope.id,
      };

      expect(minimalContext.source_type).toBeUndefined();
      expect(minimalContext.previous_type).toBeUndefined();
      expect(minimalContext.is_narrowing).toBeUndefined();
    });
  });

  describe("ReturnContext Interface", () => {
    it("should define correct structure", () => {
      const context: ReturnContext = {
        location: mockLocation,
        function_scope_id: mockScope.id,
        returned_type: {
          type_name: "number" as SymbolName,
          certainty: "inferred",
          source: { kind: "return", location: mockLocation },
        },
        is_conditional: true,
      };

      expect(context.location).toEqual(mockLocation);
      expect(context.function_scope_id).toBe(mockScope.id);
      expect(context.returned_type?.type_name).toBe("number");
      expect(context.is_conditional).toBe(true);
    });

    it("should support minimal structure", () => {
      const minimalContext: ReturnContext = {
        location: mockLocation,
        function_scope_id: mockScope.id,
      };

      expect(minimalContext.returned_type).toBeUndefined();
      expect(minimalContext.is_conditional).toBeUndefined();
    });
  });

  describe("build_typed_assignment_map", () => {
    describe("Success Cases", () => {
      it("should build assignment map from captures", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.ASSIGNMENT,
            entity: SemanticEntity.VARIABLE,
            text: "variable",
            node_location: mockLocation,
            modifiers: {},
          context: {},
          },
        ];

        const result = build_typed_assignment_map(captures);

        expect(result.size).toBe(1);
        const context = result.get(location_key(mockLocation));
        expect(context).toBeDefined();
        expect(context!.target_location).toEqual(mockLocation);
        expect(context!.source_location).toEqual(mockLocation);
        expect(context!.scope_id).toBe("");
      });

      it("should handle source node locations", () => {
        const sourceNode = {
          startPosition: { row: 0, column: 10 },
          endPosition: { row: 0, column: 15 },
        } as any;

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.ASSIGNMENT,
            entity: SemanticEntity.VARIABLE,
            text: "variable",
            node_location: mockLocation,
            modifiers: {},
            context: {
              source_node: sourceNode,
            },
          },
        ];

        const result = build_typed_assignment_map(captures);

        expect(result.size).toBe(1);
        const context = result.get(location_key(mockLocation));
        expect(context!.source_location.line).toBe(1);
        expect(context!.source_location.column).toBe(11);
      });

      it("should infer types from constructor calls", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.ASSIGNMENT,
            entity: SemanticEntity.VARIABLE,
            text: "MyClass",
            node_location: mockLocation,
            modifiers: {},
            context: {
              construct_target: {} as any,
            },
          },
        ];

        const result = build_typed_assignment_map(captures);

        expect(result.size).toBe(1);
        const context = result.get(location_key(mockLocation));
        expect(context!.source_type).toBeDefined();
        expect(context!.source_type!.type_name).toBe("MyClass");
        expect(context!.source_type!.source.kind).toBe("construction");
      });

      it("should infer types from string literals", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.ASSIGNMENT,
            entity: SemanticEntity.VARIABLE,
            text: '"hello world"',
            node_location: mockLocation,
            modifiers: {},
          context: {},
          },
        ];

        const result = build_typed_assignment_map(captures);

        expect(result.size).toBe(1);
        const context = result.get(location_key(mockLocation));
        expect(context!.source_type).toBeDefined();
        expect(context!.source_type!.type_name).toBe("string");
        expect(context!.source_type!.source.kind).toBe("literal");
      });

      it("should infer types from number literals", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.ASSIGNMENT,
            entity: SemanticEntity.VARIABLE,
            text: "42",
            node_location: mockLocation,
            modifiers: {},
          context: {},
          },
        ];

        const result = build_typed_assignment_map(captures);

        expect(result.size).toBe(1);
        const context = result.get(location_key(mockLocation));
        expect(context!.source_type!.type_name).toBe("number");
      });

      it("should infer types from boolean literals", () => {
        const boolLiterals = ["true", "false"];

        for (const literal of boolLiterals) {
          const captures: NormalizedCapture[] = [
            {
              category: SemanticCategory.REFERENCE,
              entity: SemanticEntity.VARIABLE,
              text: literal,
              node_location: mockLocation,
              modifiers: {},
          context: {},
            },
          ];

          const result = build_typed_assignment_map(captures);
          const context = result.get(location_key(mockLocation));
          expect(context!.source_type!.type_name).toBe("boolean");
        }
      });

      it("should infer types from null and undefined", () => {
        const nullishValues = [
          { text: "null", expected: "null" },
          { text: "undefined", expected: "undefined" },
        ];

        for (const { text, expected } of nullishValues) {
          const captures: NormalizedCapture[] = [
            {
              category: SemanticCategory.REFERENCE,
              entity: SemanticEntity.VARIABLE,
              text,
              node_location: mockLocation,
              modifiers: {},
          context: {},
            },
          ];

          const result = build_typed_assignment_map(captures);
          const context = result.get(location_key(mockLocation));
          expect(context!.source_type!.type_name).toBe(expected);
        }
      });

      it("should handle multiple assignments", () => {
        const location2: Location = {
          ...mockLocation,
          line: 2,
          column: 0,
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.ASSIGNMENT,
            entity: SemanticEntity.VARIABLE,
            text: "var1",
            node_location: mockLocation,
            modifiers: {},
          context: {},
          },
          {
            category: SemanticCategory.ASSIGNMENT,
            entity: SemanticEntity.VARIABLE,
            text: "var2",
            node_location: location2,
            modifiers: {},
          context: {},
          },
        ];

        const result = build_typed_assignment_map(captures);

        expect(result.size).toBe(2);
        expect(result.has(location_key(mockLocation))).toBe(true);
        expect(result.has(location_key(location2))).toBe(true);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty captures array", () => {
        const result = build_typed_assignment_map([]);
        expect(result.size).toBe(0);
      });

      it("should handle captures without context", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.ASSIGNMENT,
            entity: SemanticEntity.VARIABLE,
            text: "variable",
            node_location: mockLocation,
            modifiers: {},
            context: undefined,
          },
        ];

        const result = build_typed_assignment_map(captures);

        expect(result.size).toBe(1);
        const context = result.get(location_key(mockLocation));
        expect(context!.source_location).toEqual(mockLocation);
      });

      it("should handle captures with no inferable type", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.ASSIGNMENT,
            entity: SemanticEntity.VARIABLE,
            text: "unknownVariable",
            node_location: mockLocation,
            modifiers: {},
          context: {},
          },
        ];

        const result = build_typed_assignment_map(captures);

        expect(result.size).toBe(1);
        const context = result.get(location_key(mockLocation));
        expect(context!.source_type).toBeUndefined();
      });
    });
  });

  describe("build_typed_return_map", () => {
    describe("Success Cases", () => {
      it("should build return map from captures", () => {
        const functionScope: LexicalScope = {
          id: "func_scope" as ScopeId,
          parent_id: null,
          name: "testFunc" as SymbolName,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const scopes = new Map([
          [functionScope.id, functionScope],
        ]);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.RETURN,
            entity: SemanticEntity.VARIABLE,
            text: "result",
            node_location: {
              file_path: mockFilePath,
              line: 5,
              column: 0,
              end_line: 5,
              end_column: 10,
            },
            modifiers: {},
            context: {},
          },
        ];

        const result = build_typed_return_map(captures, functionScope, scopes);

        expect(result.size).toBe(1);
        const context = result.get(location_key(captures[0].node_location));
        expect(context).toBeDefined();
        expect(context!.function_scope_id).toBe(functionScope.id);
        expect(context!.is_conditional).toBe(false);
      });

      it("should infer types from return values", () => {
        const functionScope: LexicalScope = {
          id: "func_scope" as ScopeId,
          parent_id: null,
          name: "func" as SymbolName,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const scopes = new Map([
          [functionScope.id, functionScope],
        ]);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.RETURN,
            entity: SemanticEntity.VARIABLE,
            text: '"return value"',
            node_location: {
              file_path: mockFilePath,
              line: 5,
              column: 0,
              end_line: 5,
              end_column: 10,
            },
            modifiers: {},
            context: {},
          },
        ];

        const result = build_typed_return_map(captures, functionScope, scopes);

        expect(result.size).toBe(1);
        const context = result.get(location_key(captures[0].node_location));
        expect(context!.returned_type).toBeDefined();
        expect(context!.returned_type!.type_name).toBe("string");
      });

      it("should handle nested function scopes", () => {
        const outerFunction: LexicalScope = {
          id: "outer_func" as ScopeId,
          parent_id: null,
          name: "outerFunc" as SymbolName,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 20,
            end_column: 0,
          },
          child_ids: ["inner_func" as ScopeId],
          symbols: new Map(),
        };

        const innerFunction: LexicalScope = {
          id: "inner_func" as ScopeId,
          parent_id: outerFunction.id,
          name: "innerFunc" as SymbolName,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 5,
            column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const scopes = new Map([
          [outerFunction.id, outerFunction],
          [innerFunction.id, innerFunction],
        ]);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "inner_result",
            node_location: {
              file_path: mockFilePath,
              line: 7,
          column: 0,
              end_line: 7,
          end_column: 10,
            },
            modifiers: {},
          context: {},
          },
        ];

        const result = build_typed_return_map(captures, outerFunction, scopes);

        expect(result.size).toBe(1);
        const context = result.get(location_key(captures[0].node_location));
        expect(context!.function_scope_id).toBe(innerFunction.id);
      });

      it("should handle method and constructor scopes", () => {
        const methodScope: LexicalScope = {
          id: "method_scope" as ScopeId,
          parent_id: null,
          name: "testMethod" as SymbolName,
          type: "method",
          location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const constructorScope: LexicalScope = {
          id: "constructor_scope" as ScopeId,
          parent_id: null,
          name: "constructor" as SymbolName,
          type: "constructor",
          location: {
            file_path: mockFilePath,
            line: 15,
            column: 0,
            end_line: 20,
            end_column: 0,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const scopes = new Map([
          [methodScope.id, methodScope],
          [constructorScope.id, constructorScope],
        ]);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "method_result",
            node_location: {
              file_path: mockFilePath,
              line: 5,
          column: 0,
              end_line: 5,
          end_column: 10,
            },
            modifiers: {},
          context: {},
          },
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "this",
            node_location: {
              file_path: mockFilePath,
              line: 17,
          column: 0,
              end_line: 17,
          end_column: 10,
            },
            modifiers: {},
          context: {},
          },
        ];

        const result = build_typed_return_map(captures, methodScope, scopes);

        // FIXED: Now correctly only includes returns within the root scope
        expect(result.size).toBe(1); // Only the method return (line 5) should be included

        const methodContext = result.get(location_key(captures[0].node_location));
        const constructorContext = result.get(location_key(captures[1].node_location));

        // Only the method context should be found (within scope boundaries)
        expect(methodContext!.function_scope_id).toBe(methodScope.id);
        expect(constructorContext).toBeUndefined(); // Outside scope boundaries
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty captures array", () => {
        const result = build_typed_return_map([], mockScope, mockScopes);
        expect(result.size).toBe(0);
      });

      it("should skip returns not in function scopes", () => {
        const blockScope: LexicalScope = {
          id: "block_scope" as ScopeId,
          parent_id: null,
          name: null,
          type: "block",
          location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const scopes = new Map([
          [blockScope.id, blockScope],
        ]);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "invalid_return",
            node_location: {
              file_path: mockFilePath,
              line: 5,
          column: 0,
              end_line: 5,
          end_column: 10,
            },
            modifiers: {},
          context: {},
          },
        ];

        const result = build_typed_return_map(captures, blockScope, scopes);

        expect(result.size).toBe(0);
      });

      it("should handle returns with no function scope", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "orphan_return",
            node_location: {
              file_path: mockFilePath,
              line: 100,
          column: 0, // Outside any scope
              end_line: 100,
          end_column: 10,
            },
            modifiers: {},
          context: {},
          },
        ];

        const result = build_typed_return_map(captures, mockScope, mockScopes);

        // FIXED: Now correctly excludes returns outside scope boundaries
        expect(result.size).toBe(0); // Should be 0 - capture is outside scope
      });
    });
  });

  describe("build_type_annotation_map", () => {
    describe("Success Cases", () => {
      it("should build type annotation map from captures", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "string",
            node_location: mockLocation,
            modifiers: {},
          context: {},
          },
        ];

        const result = build_type_annotation_map(captures);

        expect(result.size).toBe(1);
        const typeInfo = result.get(location_key(mockLocation));
        expect(typeInfo).toBeDefined();
        expect(typeInfo!.type_name).toBe("string");
        expect(typeInfo!.certainty).toBe("declared");
        expect(typeInfo!.source.kind).toBe("annotation");
      });

      it("should detect nullable types from modifiers", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "string",
            node_location: mockLocation,
            modifiers: { is_optional: true },
            context: {},
          },
        ];

        const result = build_type_annotation_map(captures);

        expect(result.size).toBe(1);
        const typeInfo = result.get(location_key(mockLocation));
        expect(typeInfo!.is_nullable).toBe(true);
      });

      it("should detect array types from text", () => {
        const arrayTexts = ["string[]", "Array<string>", "number[]"];

        for (const text of arrayTexts) {
          const captures: NormalizedCapture[] = [
            {
              category: SemanticCategory.DEFINITION,
              entity: SemanticEntity.TYPE,
              text,
              node_location: mockLocation,
              modifiers: {},
          context: {},
            },
          ];

          const result = build_type_annotation_map(captures);
          const typeInfo = result.get(location_key(mockLocation));
          expect(typeInfo!.is_array).toBe(true);
        }
      });

      it("should handle multiple type annotations", () => {
        const location2: Location = {
          ...mockLocation,
          line: 2,
          column: 0,
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "string",
            node_location: mockLocation,
            modifiers: {},
          context: {},
          },
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "number",
            node_location: location2,
            modifiers: {},
          context: {},
          },
        ];

        const result = build_type_annotation_map(captures);

        expect(result.size).toBe(2);
        expect(result.get(location_key(mockLocation))!.type_name).toBe("string");
        expect(result.get(location_key(location2))!.type_name).toBe("number");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty captures array", () => {
        const result = build_type_annotation_map([]);
        expect(result.size).toBe(0);
      });

      it("should handle captures without modifiers", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "boolean",
            node_location: mockLocation,
            modifiers: {},
          context: {},
          },
        ];

        const result = build_type_annotation_map(captures);

        expect(result.size).toBe(1);
        const typeInfo = result.get(location_key(mockLocation));
        expect(typeInfo!.is_nullable).toBe(false);
      });

      it("should handle complex type names", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "Promise<Result<T, Error>>",
            node_location: mockLocation,
            modifiers: {},
          context: {},
          },
        ];

        const result = build_type_annotation_map(captures);

        expect(result.size).toBe(1);
        const typeInfo = result.get(location_key(mockLocation));
        expect(typeInfo!.type_name).toBe("Promise<Result<T, Error>>");
        expect(typeInfo!.is_array).toBe(false);
      });
    });
  });

  describe("TypedReferenceContext Interface", () => {
    it("should define correct structure", () => {
      const constraint: TypeConstraint = {
        kind: "narrowing",
        target_type: {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        },
        condition: "typeof x === 'string'",
      };

      const context: TypedReferenceContext = {
        inferred_type: {
          type_name: "any" as SymbolName,
          certainty: "ambiguous",
          source: { kind: "assignment", location: mockLocation },
        },
        assignment_context: {
          target_location: mockLocation,
          source_location: mockLocation,
          scope_id: mockScope.id,
        },
        return_context: {
          location: mockLocation,
          function_scope_id: mockScope.id,
        },
        receiver_type: {
          type_name: "MyClass" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        },
        property_type: {
          type_name: "number" as SymbolName,
          certainty: "inferred",
          source: { kind: "assignment", location: mockLocation },
        },
        type_constraints: [constraint],
      };

      expect(context.inferred_type?.type_name).toBe("any");
      expect(context.assignment_context?.scope_id).toBe(mockScope.id);
      expect(context.return_context?.function_scope_id).toBe(mockScope.id);
      expect(context.receiver_type?.type_name).toBe("MyClass");
      expect(context.property_type?.type_name).toBe("number");
      expect(context.type_constraints).toHaveLength(1);
      expect(context.type_constraints![0].kind).toBe("narrowing");
    });

    it("should support minimal structure", () => {
      const minimal: TypedReferenceContext = {};

      expect(minimal.inferred_type).toBeUndefined();
      expect(minimal.assignment_context).toBeUndefined();
      expect(minimal.return_context).toBeUndefined();
      expect(minimal.receiver_type).toBeUndefined();
      expect(minimal.property_type).toBeUndefined();
      expect(minimal.type_constraints).toBeUndefined();
    });
  });

  describe("TypeConstraint Interface", () => {
    it("should define correct structure for all constraint kinds", () => {
      const constraintKinds = ["narrowing", "widening", "cast", "guard"] as const;

      for (const kind of constraintKinds) {
        const constraint: TypeConstraint = {
          kind,
          target_type: {
              type_name: "string" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
          condition: "test condition",
        };

        expect(constraint.kind).toBe(kind);
        expect(constraint.target_type.type_name).toBe("string");
        expect(constraint.condition).toBe("test condition");
      }
    });

    it("should support optional condition", () => {
      const constraint: TypeConstraint = {
        kind: "cast",
        target_type: {
          type_name: "number" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        },
      };

      expect(constraint.condition).toBeUndefined();
    });
  });

  describe("connect_assignment_type", () => {
    describe("Success Cases", () => {
      it("should connect location to assignment context", () => {
        const context: AssignmentContext = {
          target_location: mockLocation,
          source_location: mockLocation,
          scope_id: mockScope.id,
        };

        const assignmentMap = new Map<string, AssignmentContext>([
          [location_key(mockLocation), context],
        ]);

        const result = connect_assignment_type(mockLocation, assignmentMap);

        expect(result).toBe(context);
      });

      it("should return undefined for unknown location", () => {
        const unknownLocation: Location = {
          file_path: mockFilePath,
          line: 99,
          column: 0,
          end_line: 99,
          end_column: 10,
        };

        const assignmentMap = new Map<string, AssignmentContext>();

        const result = connect_assignment_type(unknownLocation, assignmentMap);

        expect(result).toBeUndefined();
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty assignment map", () => {
        const result = connect_assignment_type(mockLocation, new Map());
        expect(result).toBeUndefined();
      });
    });
  });

  describe("connect_return_type", () => {
    describe("Success Cases", () => {
      it("should connect location to return context", () => {
        const context: ReturnContext = {
          location: mockLocation,
          function_scope_id: mockScope.id,
        };

        const returnMap = new Map<string, ReturnContext>([
          [location_key(mockLocation), context],
        ]);

        const result = connect_return_type(mockLocation, returnMap);

        expect(result).toBe(context);
      });

      it("should return undefined for unknown location", () => {
        const unknownLocation: Location = {
          file_path: mockFilePath,
          line: 99,
          column: 0,
          end_line: 99,
          end_column: 10,
        };

        const returnMap = new Map<string, ReturnContext>();

        const result = connect_return_type(unknownLocation, returnMap);

        expect(result).toBeUndefined();
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty return map", () => {
        const result = connect_return_type(mockLocation, new Map());
        expect(result).toBeUndefined();
      });
    });
  });

  describe("connect_type_annotation", () => {
    describe("Success Cases", () => {
      it("should connect location to type annotation", () => {
        const typeInfo: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const typeMap = new Map<LocationKey, TypeInfo>([
          [location_key(mockLocation), typeInfo],
        ]);

        const result = connect_type_annotation(mockLocation, typeMap);

        expect(result).toBe(typeInfo);
      });

      it("should return undefined for unknown location", () => {
        const unknownLocation: Location = {
          file_path: mockFilePath,
          line: 99,
          column: 0,
          end_line: 99,
          end_column: 10,
        };

        const typeMap = new Map<LocationKey, TypeInfo>();

        const result = connect_type_annotation(unknownLocation, typeMap);

        expect(result).toBeUndefined();
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty type map", () => {
        const result = connect_type_annotation(mockLocation, new Map());
        expect(result).toBeUndefined();
      });
    });
  });

  describe("Integration Tests", () => {
    it("should process complete type tracking pipeline", () => {
      // Setup captures for different type tracking scenarios
      const assignmentCaptures: NormalizedCapture[] = [
        {
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          text: '"assigned value"',
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
      ];

      const returnCaptures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          text: "42",
          node_location: {
            file_path: mockFilePath,
            line: 5,
          column: 0,
            end_line: 5,
          end_column: 10,
          },
          modifiers: {},
          context: {},
        },
      ];

      const typeCaptures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "string",
          node_location: {
            file_path: mockFilePath,
            line: 1,
          column: 20,
            end_line: 1,
          end_column: 26,
          },
          modifiers: {},
          context: {},
        },
      ];

      // Build maps
      const assignmentMap = build_typed_assignment_map(assignmentCaptures);
      const returnMap = build_typed_return_map(returnCaptures, mockScope, mockScopes);
      const typeMap = build_type_annotation_map(typeCaptures);

      // Verify maps were built correctly
      expect(assignmentMap.size).toBe(1);
      expect(returnMap.size).toBe(1);
      expect(typeMap.size).toBe(1);

      // Test connection functions
      const assignmentContext = connect_assignment_type(mockLocation, assignmentMap);
      const typeAnnotation = connect_type_annotation(typeCaptures[0].node_location, typeMap);

      expect(assignmentContext).toBeDefined();
      expect(assignmentContext!.source_type!.type_name).toBe("string");
      expect(typeAnnotation).toBeDefined();
      expect(typeAnnotation!.type_name).toBe("string");
    });

    it("should handle complex type inference scenarios", () => {
      const complexCaptures: NormalizedCapture[] = [
        {
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          text: "new MyClass()",
          node_location: mockLocation,
          modifiers: {},
          context: {
            construct_target: {} as any,
          },
        },
        {
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          text: "[1, 2, 3]",
          node_location: {
            file_path: mockFilePath,
            line: 2,
          column: 0,
            end_line: 2,
          end_column: 10,
          },
          modifiers: {},
          context: {},
        },
      ];

      const assignmentMap = build_typed_assignment_map(complexCaptures);

      expect(assignmentMap.size).toBe(2);

      const constructorContext = assignmentMap.get(location_key(mockLocation));
      expect(constructorContext!.source_type!.source.kind).toBe("construction");

      // Array literal won't be automatically inferred without more complex analysis
      const arrayContext = assignmentMap.get(location_key(complexCaptures[1].node_location));
      expect(arrayContext!.source_type).toBeUndefined();
    });

    it("should handle malformed captures gracefully", () => {
      const location2: Location = {
        ...mockLocation,
        line: 2,
        column: 0,
      };

      // Captures with missing required fields
      const malformedCaptures: NormalizedCapture[] = [
        {
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          text: "",  // Empty text
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
        {
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          text: "variable",
          node_location: location2,
          modifiers: {},
          context: {
            source_node: undefined,  // Undefined source node
          },
        },
      ];

      const assignmentMap = build_typed_assignment_map(malformedCaptures);

      expect(assignmentMap.size).toBe(2);

      const emptyTextContext = assignmentMap.get(location_key(mockLocation));
      expect(emptyTextContext).toBeDefined();
      expect(emptyTextContext!.source_type).toBeUndefined(); // Can't infer from empty text

      const nullSourceContext = assignmentMap.get(location_key(location2));
      expect(nullSourceContext).toBeDefined();
      expect(nullSourceContext!.source_location).toEqual(location2); // Falls back to node location
    });

    it("should handle deeply nested scope hierarchies", () => {
      const grandparentScope: LexicalScope = {
        id: "grandparent" as ScopeId,
        parent_id: null,
        name: "GrandparentClass" as SymbolName,
        type: "class",
        location: {
          file_path: mockFilePath,
          line: 1,
          column: 0,
          end_line: 50,
          end_column: 0,
        },
        child_ids: ["parent" as ScopeId],
        symbols: new Map(),
      };

      const parentScope: LexicalScope = {
        id: "parent" as ScopeId,
        parent_id: grandparentScope.id,
        name: "parentMethod" as SymbolName,
        type: "method",
        location: {
          file_path: mockFilePath,
          line: 10,
          column: 0,
          end_line: 30,
          end_column: 0,
        },
        child_ids: ["child" as ScopeId],
        symbols: new Map(),
      };

      const childScope: LexicalScope = {
        id: "child" as ScopeId,
        parent_id: parentScope.id,
        name: "innerFunction" as SymbolName,
        type: "function",
        location: {
          file_path: mockFilePath,
          line: 15,
          column: 0,
          end_line: 25,
          end_column: 0,
        },
        child_ids: [],
        symbols: new Map(),
      };

      const nestedScopes = new Map([
        [grandparentScope.id, grandparentScope],
        [parentScope.id, parentScope],
        [childScope.id, childScope],
      ]);

      const deeplyNestedCaptures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          text: "nested_return",
          node_location: {
            file_path: mockFilePath,
            line: 20,
            column: 0,
            end_line: 20,
            end_column: 10,
          },
          modifiers: {},
          context: {},
        },
      ];

      const returnMap = build_typed_return_map(deeplyNestedCaptures, grandparentScope, nestedScopes);

      expect(returnMap.size).toBe(1);
      const context = returnMap.get(location_key(deeplyNestedCaptures[0].node_location));
      expect(context!.function_scope_id).toBe(childScope.id);  // Should find innermost function scope
    });

    it("should handle complex type annotations with special characters", () => {
      const complexTypeCaptures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "Map<K extends string, V extends Record<string, any>>",
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "(() => void) | null",
          node_location: {
            file_path: mockFilePath,
            line: 2,
            column: 0,
            end_line: 2,
            end_column: 20,
          },
          modifiers: { is_optional: true },
          context: {},
        },
      ];

      const typeMap = build_type_annotation_map(complexTypeCaptures);

      expect(typeMap.size).toBe(2);

      const genericType = typeMap.get(location_key(mockLocation));
      expect(genericType!.type_name).toBe("Map<K extends string, V extends Record<string, any>>");
      expect(genericType!.is_array).toBe(false);

      const unionType = typeMap.get(location_key(complexTypeCaptures[1].node_location));
      expect(unionType!.type_name).toBe("(() => void) | null");
      expect(unionType!.is_nullable).toBe(true);
    });
  });

  describe("Private Utility Function Coverage", () => {
    describe("contains_location boundary conditions", () => {
      it("should handle exact line and column boundaries", () => {
        // Create scopes with precise boundaries to test contains_location function
        const preciseScope: LexicalScope = {
          id: "precise_scope" as ScopeId,
          parent_id: null,
          name: "preciseFunction" as SymbolName,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 10,
            column: 5,
            end_line: 15,
            end_column: 20,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const scopes = new Map([[preciseScope.id, preciseScope]]);

        // Test exact boundary conditions
        const boundaryCaptures: NormalizedCapture[] = [
          // Point exactly at start boundary
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "start_boundary",
            node_location: {
              file_path: mockFilePath,
              line: 10,
              column: 5,
              end_line: 10,
              end_column: 15,
            },
            modifiers: {},
            context: {},
          },
          // Point exactly at end boundary
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "end_boundary",
            node_location: {
              file_path: mockFilePath,
              line: 15,
              column: 20,
              end_line: 15,
              end_column: 25,
            },
            modifiers: {},
            context: {},
          },
          // Point just before start column on same line
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "before_start",
            node_location: {
              file_path: mockFilePath,
              line: 10,
              column: 4,
              end_line: 10,
              end_column: 5,
            },
            modifiers: {},
            context: {},
          },
          // Point just after end column on same line
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "after_end",
            node_location: {
              file_path: mockFilePath,
              line: 15,
              column: 21,
              end_line: 15,
              end_column: 25,
            },
            modifiers: {},
            context: {},
          },
        ];

        const returnMap = build_typed_return_map(boundaryCaptures, preciseScope, scopes);

        // Should include points at exact boundaries
        expect(returnMap.has(location_key(boundaryCaptures[0].node_location))).toBe(true);
        expect(returnMap.has(location_key(boundaryCaptures[1].node_location))).toBe(true);

        // Should exclude points outside boundaries
        expect(returnMap.has(location_key(boundaryCaptures[2].node_location))).toBe(false);
        expect(returnMap.has(location_key(boundaryCaptures[3].node_location))).toBe(false);
      });

      it("should handle single-line scopes correctly", () => {
        const singleLineScope: LexicalScope = {
          id: "single_line" as ScopeId,
          parent_id: null,
          name: "inlineFunction" as SymbolName,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 5,
            column: 10,
            end_line: 5,
            end_column: 30,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const scopes = new Map([[singleLineScope.id, singleLineScope]]);

        const singleLineCaptures: NormalizedCapture[] = [
          // Point within single line scope
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "within_scope",
            node_location: {
              file_path: mockFilePath,
              line: 5,
              column: 15,
              end_line: 5,
              end_column: 20,
            },
            modifiers: {},
            context: {},
          },
          // Point before scope on same line
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "before_scope",
            node_location: {
              file_path: mockFilePath,
              line: 5,
              column: 5,
              end_line: 5,
              end_column: 8,
            },
            modifiers: {},
            context: {},
          },
          // Point after scope on same line
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "after_scope",
            node_location: {
              file_path: mockFilePath,
              line: 5,
              column: 35,
              end_line: 5,
              end_column: 40,
            },
            modifiers: {},
            context: {},
          },
        ];

        const returnMap = build_typed_return_map(singleLineCaptures, singleLineScope, scopes);

        // Only the point within scope should be included
        expect(returnMap.size).toBe(1);
        expect(returnMap.has(location_key(singleLineCaptures[0].node_location))).toBe(true);
        expect(returnMap.has(location_key(singleLineCaptures[1].node_location))).toBe(false);
        expect(returnMap.has(location_key(singleLineCaptures[2].node_location))).toBe(false);
      });

      it("should handle multi-line scopes with complex nesting", () => {
        const outerScope: LexicalScope = {
          id: "outer" as ScopeId,
          parent_id: null,
          name: "outerFunction" as SymbolName,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 50,
            end_column: 0,
          },
          child_ids: ["inner1" as ScopeId, "inner2" as ScopeId],
          symbols: new Map(),
        };

        const innerScope1: LexicalScope = {
          id: "inner1" as ScopeId,
          parent_id: outerScope.id,
          name: "innerFunction1" as SymbolName,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 10,
            column: 2,
            end_line: 20,
            end_column: 2,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const innerScope2: LexicalScope = {
          id: "inner2" as ScopeId,
          parent_id: outerScope.id,
          name: "innerFunction2" as SymbolName,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 25,
            column: 2,
            end_line: 35,
            end_column: 2,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const complexScopes = new Map([
          [outerScope.id, outerScope],
          [innerScope1.id, innerScope1],
          [innerScope2.id, innerScope2],
        ]);

        const complexCaptures: NormalizedCapture[] = [
          // Point in first inner scope
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "in_inner1",
            node_location: {
              file_path: mockFilePath,
              line: 15,
              column: 5,
              end_line: 15,
              end_column: 10,
            },
            modifiers: {},
            context: {},
          },
          // Point in second inner scope
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "in_inner2",
            node_location: {
              file_path: mockFilePath,
              line: 30,
              column: 5,
              end_line: 30,
              end_column: 10,
            },
            modifiers: {},
            context: {},
          },
          // Point in outer scope but not in any inner scope
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "in_outer_only",
            node_location: {
              file_path: mockFilePath,
              line: 5,
              column: 5,
              end_line: 5,
              end_column: 10,
            },
            modifiers: {},
            context: {},
          },
        ];

        const returnMap = build_typed_return_map(complexCaptures, outerScope, complexScopes);

        expect(returnMap.size).toBe(3);

        // Should find the most specific (innermost) function scope for each point
        const context1 = returnMap.get(location_key(complexCaptures[0].node_location));
        const context2 = returnMap.get(location_key(complexCaptures[1].node_location));
        const context3 = returnMap.get(location_key(complexCaptures[2].node_location));

        expect(context1!.function_scope_id).toBe(innerScope1.id);
        expect(context2!.function_scope_id).toBe(innerScope2.id);
        expect(context3!.function_scope_id).toBe(outerScope.id);
      });
    });

    describe("type inference edge cases", () => {
      it("should handle type annotation map with all type categories", () => {
        const allTypeCaptures: NormalizedCapture[] = [
          // Primitive types
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "string", node_location: mockLocation, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "number", node_location: { ...mockLocation, line: 2 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "boolean", node_location: { ...mockLocation, line: 3 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "symbol", node_location: { ...mockLocation, line: 4 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "bigint", node_location: { ...mockLocation, line: 5 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "undefined", node_location: { ...mockLocation, line: 6 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "null", node_location: { ...mockLocation, line: 7 }, modifiers: {}, context: {} },

          // Built-in types
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "Date", node_location: { ...mockLocation, line: 8 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "RegExp", node_location: { ...mockLocation, line: 9 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "Error", node_location: { ...mockLocation, line: 10 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "Promise", node_location: { ...mockLocation, line: 11 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "Map", node_location: { ...mockLocation, line: 12 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "Set", node_location: { ...mockLocation, line: 13 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "Array", node_location: { ...mockLocation, line: 14 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "Object", node_location: { ...mockLocation, line: 15 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "Function", node_location: { ...mockLocation, line: 16 }, modifiers: {}, context: {} },

          // Special types
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "any", node_location: { ...mockLocation, line: 17 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "unknown", node_location: { ...mockLocation, line: 18 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "never", node_location: { ...mockLocation, line: 19 }, modifiers: {}, context: {} },
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "void", node_location: { ...mockLocation, line: 20 }, modifiers: {}, context: {} },

          // User-defined type
          { category: SemanticCategory.DEFINITION, entity: SemanticEntity.TYPE, text: "MyCustomType", node_location: { ...mockLocation, line: 21 }, modifiers: {}, context: {} },
        ];

        const typeMap = build_type_annotation_map(allTypeCaptures);

        expect(typeMap.size).toBe(21);

        // Verify each type has proper type_id generation
        allTypeCaptures.forEach(capture => {
          const typeInfo = typeMap.get(location_key(capture.node_location));
          expect(typeInfo).toBeDefined();
          expect(typeInfo!.type_name).toBe(capture.text);
          expect(typeInfo!.certainty).toBe("declared");
        });
      });
    });

    describe("infer_type_from_text edge cases", () => {
      it("should handle all literal inference patterns", () => {
        const literalTestCaptures: NormalizedCapture[] = [
          // String literals with different quote styles
          { category: SemanticCategory.ASSIGNMENT, entity: SemanticEntity.VARIABLE, text: '"double quotes"', node_location: { ...mockLocation, line: 1 }, modifiers: {}, context: {} },
          { category: SemanticCategory.ASSIGNMENT, entity: SemanticEntity.VARIABLE, text: "'single quotes'", node_location: { ...mockLocation, line: 2 }, modifiers: {}, context: {} },
          { category: SemanticCategory.ASSIGNMENT, entity: SemanticEntity.VARIABLE, text: "`template literal`", node_location: { ...mockLocation, line: 3 }, modifiers: {}, context: {} },

          // Number literals
          { category: SemanticCategory.ASSIGNMENT, entity: SemanticEntity.VARIABLE, text: "42", node_location: { ...mockLocation, line: 4 }, modifiers: {}, context: {} },
          { category: SemanticCategory.ASSIGNMENT, entity: SemanticEntity.VARIABLE, text: "3.14", node_location: { ...mockLocation, line: 5 }, modifiers: {}, context: {} },
          { category: SemanticCategory.ASSIGNMENT, entity: SemanticEntity.VARIABLE, text: "0", node_location: { ...mockLocation, line: 6 }, modifiers: {}, context: {} },

          // Boolean literals
          { category: SemanticCategory.ASSIGNMENT, entity: SemanticEntity.VARIABLE, text: "true", node_location: { ...mockLocation, line: 7 }, modifiers: {}, context: {} },
          { category: SemanticCategory.ASSIGNMENT, entity: SemanticEntity.VARIABLE, text: "false", node_location: { ...mockLocation, line: 8 }, modifiers: {}, context: {} },

          // Null/undefined
          { category: SemanticCategory.ASSIGNMENT, entity: SemanticEntity.VARIABLE, text: "null", node_location: { ...mockLocation, line: 9 }, modifiers: {}, context: {} },
          { category: SemanticCategory.ASSIGNMENT, entity: SemanticEntity.VARIABLE, text: "undefined", node_location: { ...mockLocation, line: 10 }, modifiers: {}, context: {} },

          // Non-literal (should not be inferred)
          { category: SemanticCategory.ASSIGNMENT, entity: SemanticEntity.VARIABLE, text: "variableName", node_location: { ...mockLocation, line: 11 }, modifiers: {}, context: {} },
        ];

        const assignmentMap = build_typed_assignment_map(literalTestCaptures);

        expect(assignmentMap.size).toBe(11);

        // Check string literals
        expect(assignmentMap.get(location_key(literalTestCaptures[0].node_location))!.source_type!.type_name).toBe("string");
        expect(assignmentMap.get(location_key(literalTestCaptures[1].node_location))!.source_type!.type_name).toBe("string");
        expect(assignmentMap.get(location_key(literalTestCaptures[2].node_location))!.source_type!.type_name).toBe("string");

        // Check number literals
        expect(assignmentMap.get(location_key(literalTestCaptures[3].node_location))!.source_type!.type_name).toBe("number");
        expect(assignmentMap.get(location_key(literalTestCaptures[4].node_location))!.source_type!.type_name).toBe("number");
        expect(assignmentMap.get(location_key(literalTestCaptures[5].node_location))!.source_type!.type_name).toBe("number");

        // Check boolean literals
        expect(assignmentMap.get(location_key(literalTestCaptures[6].node_location))!.source_type!.type_name).toBe("boolean");
        expect(assignmentMap.get(location_key(literalTestCaptures[7].node_location))!.source_type!.type_name).toBe("boolean");

        // Check null/undefined
        expect(assignmentMap.get(location_key(literalTestCaptures[8].node_location))!.source_type!.type_name).toBe("null");
        expect(assignmentMap.get(location_key(literalTestCaptures[9].node_location))!.source_type!.type_name).toBe("undefined");

        // Check non-literal (should not be inferred)
        expect(assignmentMap.get(location_key(literalTestCaptures[10].node_location))!.source_type).toBeUndefined();
      });
    });

    describe("error conditions and boundary cases", () => {
      it("should handle captures with undefined context gracefully", () => {
        const undefinedContextCaptures: NormalizedCapture[] = [
          {
            category: SemanticCategory.ASSIGNMENT,
            entity: SemanticEntity.VARIABLE,
            text: "variable",
            node_location: mockLocation,
            modifiers: {},
            context: undefined as any,
          },
        ];

        const assignmentMap = build_typed_assignment_map(undefinedContextCaptures);

        expect(assignmentMap.size).toBe(1);
        const context = assignmentMap.get(location_key(mockLocation));
        expect(context).toBeDefined();
        expect(context!.source_location).toEqual(mockLocation);
        expect(context!.source_type).toBeUndefined();
      });

      it("should handle scopes with circular parent references gracefully", () => {
        // Create scopes with circular references
        const scope1: LexicalScope = {
          id: "scope1" as ScopeId,
          parent_id: "scope2" as ScopeId,
          name: "function1" as SymbolName,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const scope2: LexicalScope = {
          id: "scope2" as ScopeId,
          parent_id: "scope1" as ScopeId,  // Circular reference
          name: "function2" as SymbolName,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 5,
            column: 0,
            end_line: 8,
            end_column: 0,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const circularScopes = new Map([
          [scope1.id, scope1],
          [scope2.id, scope2],
        ]);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "test",
            node_location: {
              file_path: mockFilePath,
              line: 6,
              column: 0,
              end_line: 6,
              end_column: 5,
            },
            modifiers: {},
            context: {},
          },
        ];

        // This should not cause infinite recursion
        const returnMap = build_typed_return_map(captures, scope1, circularScopes);

        expect(returnMap.size).toBe(1);
        const context = returnMap.get(location_key(captures[0].node_location));
        expect(context).toBeDefined();
        // Should find one of the function scopes despite circular references
        expect([scope1.id, scope2.id]).toContain(context!.function_scope_id);
      });

      it("should handle empty scope maps", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "orphan",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const emptyScopes = new Map<ScopeId, LexicalScope>();
        const rootScope: LexicalScope = {
          id: "root" as ScopeId,
          parent_id: null,
          name: "root" as SymbolName,
          type: "module",
          location: mockLocation,
          child_ids: [],
          symbols: new Map(),
        };

        const returnMap = build_typed_return_map(captures, rootScope, emptyScopes);

        // Should handle gracefully - when rootScope is not in scopes map, no entries are created
        expect(returnMap.size).toBe(0);
      });
    });
  });
});
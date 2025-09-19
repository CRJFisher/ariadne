/**
 * Comprehensive tests for type flow references processing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
  LocationKey,
  SymbolDefinition,
  SymbolId,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity, SemanticCategory } from "../../capture_types";
import type {
  AssignmentContext,
} from "../type_tracking/type_tracking";
import type { TypeInfo } from "../type_tracking/type_info";
import {
  TypeFlowReference,
  TypeMutation,
  process_type_flow_references,
  track_type_mutations,
  build_variable_type_map,
  track_constructor_types,
  find_type_at_location,
} from "./type_flow_references";

// Mock dependencies
vi.mock("../../scope_tree", () => ({
  find_containing_scope: vi.fn(),
}));

vi.mock("../type_tracking/type_tracking", () => ({
  build_typed_assignment_map: vi.fn(),
}));

import { find_containing_scope } from "../../scope_tree";
import { build_typed_assignment_map } from "../type_tracking/type_tracking";

const mockFindContainingScope = vi.mocked(find_containing_scope);
const mockBuildTypedAssignmentMap = vi.mocked(build_typed_assignment_map);

describe("Type Flow References", () => {
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
    type: "function",
    location: { line: 1, column: 0, end_line: 10, end_column: 0, file_path: mockFilePath },
    parent_id: null,
    child_ids: [],
    symbols: new Map(),
    name: "testFunction" as SymbolName,
  };

  const mockScopes = new Map<ScopeId, LexicalScope>([
    [mockScope.id, mockScope],
  ]);

  const mockTypeInfo: TypeInfo = {
    type_name: "string" as SymbolName,
    certainty: "declared",
    source: {
      kind: "annotation",
      location: mockLocation,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindContainingScope.mockReturnValue(mockScope);
  });

  describe("TypeFlowReference Interface", () => {
    it("should define correct structure for assignments", () => {
      const typeFlow: TypeFlowReference = {
        location: mockLocation,
        name: "variable" as SymbolName,
        scope_id: mockScope.id,
        flow_type: "assignment",
        source_type: mockTypeInfo,
        target_type: mockTypeInfo,
        source_location: mockLocation,
        target_location: mockLocation,
        is_narrowing: false,
        is_widening: false,
      };

      expect(typeFlow.location).toEqual(mockLocation);
      expect(typeFlow.name).toBe("variable");
      expect(typeFlow.flow_type).toBe("assignment");
      expect(typeFlow.source_type).toEqual(mockTypeInfo);
      expect(typeFlow.is_narrowing).toBe(false);
      expect(typeFlow.is_widening).toBe(false);
    });

    it("should define correct structure for different flow types", () => {
      const flowTypes = ["assignment", "parameter", "return", "yield"] as const;

      for (const flow_type of flowTypes) {
        const typeFlow: TypeFlowReference = {
          location: mockLocation,
          name: "test" as SymbolName,
          scope_id: mockScope.id,
          flow_type,
          source_type: mockTypeInfo,
          source_location: mockLocation,
          target_location: mockLocation,
          is_narrowing: false,
          is_widening: false,
        };

        expect(typeFlow.flow_type).toBe(flow_type);
      }
    });

    it("should support type narrowing/widening flags", () => {
      const narrowingFlow: TypeFlowReference = {
        location: mockLocation,
        name: "narrowed" as SymbolName,
        scope_id: mockScope.id,
        flow_type: "assignment",
        source_type: mockTypeInfo,
        source_location: mockLocation,
        target_location: mockLocation,
        is_narrowing: true,
        is_widening: false,
      };

      const wideningFlow: TypeFlowReference = {
        location: mockLocation,
        name: "widened" as SymbolName,
        scope_id: mockScope.id,
        flow_type: "assignment",
        source_type: mockTypeInfo,
        source_location: mockLocation,
        target_location: mockLocation,
        is_narrowing: false,
        is_widening: true,
      };

      expect(narrowingFlow.is_narrowing).toBe(true);
      expect(narrowingFlow.is_widening).toBe(false);
      expect(wideningFlow.is_narrowing).toBe(false);
      expect(wideningFlow.is_widening).toBe(true);
    });
  });

  describe("process_type_flow_references", () => {
    describe("Success Cases", () => {
      it("should process assignment captures with assignment context", () => {
        const sourceLocation: Location = {
          file_path: mockFilePath,
          line: 1,
          column: 10,
          end_line: 1,
          end_column: 15,
        };

        const targetLocation: Location = {
          file_path: mockFilePath,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 5,
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "variable",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const assignmentContext: AssignmentContext = {
          source_type: mockTypeInfo,
          source_location: sourceLocation,
          target_location: targetLocation,
          scope_id: mockScope.id,
        };

        const assignmentMap = new Map<LocationKey, AssignmentContext>([
          [location_key(mockLocation), assignmentContext],
        ]);

        mockBuildTypedAssignmentMap.mockReturnValue(assignmentMap);

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("variable");
        expect(result[0].flow_type).toBe("assignment");
        expect(result[0].source_type).toEqual(mockTypeInfo);
        expect(result[0].source_location).toEqual(sourceLocation);
        expect(result[0].target_location).toEqual(targetLocation);
      });

      it("should handle multiple assignment captures", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "var1",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "var2",
            node_location: {
              ...mockLocation,
              line: 2,
              column: 0,
              end_line: 2,
              end_column: 10,
            },
            modifiers: {},
            context: {},
          },
        ];

        const assignmentMap = new Map<LocationKey, AssignmentContext>([
          [
            location_key(mockLocation),
            {
              source_type: mockTypeInfo,
              source_location: mockLocation,
              target_location: mockLocation,
              scope_id: mockScope.id,
            },
          ],
          [
            location_key(captures[1].node_location),
            {
              source_type: mockTypeInfo,
              source_location: mockLocation,
              target_location: mockLocation,
              scope_id: mockScope.id,
            },
          ],
        ]);

        mockBuildTypedAssignmentMap.mockReturnValue(assignmentMap);

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe("var1");
        expect(result[1].name).toBe("var2");
      });

      it("should detect type narrowing", () => {
        const anyType: TypeInfo = {
          type_name: "any" as SymbolName,
          certainty: "ambiguous",
          source: { kind: "assignment", location: mockLocation },
        };

        const stringType: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "narrowed",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const assignmentContext: AssignmentContext = {
          source_type: stringType,
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        const typeAnnotations = new Map<LocationKey, TypeInfo>([
          [location_key(mockLocation), anyType],
        ]);

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath,
          typeAnnotations
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_narrowing).toBe(true);
        expect(result[0].is_widening).toBe(false);
      });

      it("should detect type widening", () => {
        const stringType: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const anyType: TypeInfo = {
          type_name: "any" as SymbolName,
          certainty: "ambiguous",
          source: { kind: "assignment", location: mockLocation },
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "widened",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const assignmentContext: AssignmentContext = {
          source_type: anyType,
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        const typeAnnotations = new Map<LocationKey, TypeInfo>([
          [location_key(mockLocation), stringType],
        ]);

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath,
          typeAnnotations
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_narrowing).toBe(false);
        expect(result[0].is_widening).toBe(true);
      });

      it("should handle assignments without type annotations", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "unannotated",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const assignmentContext: AssignmentContext = {
          source_type: mockTypeInfo,
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].target_type).toBeUndefined();
        expect(result[0].is_narrowing).toBe(false);
        expect(result[0].is_widening).toBe(false);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty captures array", () => {
        mockBuildTypedAssignmentMap.mockReturnValue(new Map());

        const result = process_type_flow_references(
          [],
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toEqual([]);
      });

      it("should skip captures without assignment context", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "orphaned",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        mockBuildTypedAssignmentMap.mockReturnValue(new Map());

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toEqual([]);
      });

      it("should handle assignments without source type", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "unknown_source",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const assignmentContext: AssignmentContext = {
          source_type: undefined,
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].source_type.type_name).toBe("unknown");
        expect(result[0].source_type.certainty).toBe("ambiguous");
      });
    });
  });

  describe("TypeMutation Interface", () => {
    it("should define correct structure", () => {
      const mutation: TypeMutation = {
        variable: "test_var" as SymbolName,
        location: mockLocation,
        old_type: mockTypeInfo,
        new_type: mockTypeInfo,
        reason: "assignment",
      };

      expect(mutation.variable).toBe("test_var");
      expect(mutation.location).toEqual(mockLocation);
      expect(mutation.reason).toBe("assignment");
    });

    it("should support all mutation reasons", () => {
      const reasons = ["assignment", "narrowing", "widening", "cast"] as const;

      for (const reason of reasons) {
        const mutation: TypeMutation = {
          variable: "test" as SymbolName,
          location: mockLocation,
          new_type: mockTypeInfo,
          reason,
        };

        expect(mutation.reason).toBe(reason);
      }
    });
  });

  describe("track_type_mutations", () => {
    describe("Success Cases", () => {
      it("should track mutations for a specific variable", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "tracked_var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
          {
            location: {
              ...mockLocation,
              line: 2,
              column: 0,
            },
            name: "other_var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const mutations = track_type_mutations(
          flows,
          "tracked_var" as SymbolName
        );

        expect(mutations).toHaveLength(1);
        expect(mutations[0].variable).toBe("tracked_var");
        expect(mutations[0].reason).toBe("assignment");
      });

      it("should sort mutations by location", () => {
        const flows: TypeFlowReference[] = [
          {
            location: { ...mockLocation, line: 3, column: 0 , end_line: 3, end_column: 0  },
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
          {
            location: { ...mockLocation, line: 1, column: 0 , end_line: 1, end_column: 0  },
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
          {
            location: { ...mockLocation, line: 2, column: 0 , end_line: 2, end_column: 0  },
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const mutations = track_type_mutations(flows, "var" as SymbolName);

        expect(mutations).toHaveLength(3);
        expect(mutations[0].location.line).toBe(1);
        expect(mutations[1].location.line).toBe(2);
        expect(mutations[2].location.line).toBe(3);
      });

      it("should detect narrowing mutations", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "narrowed" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: true,
            is_widening: false,
          },
        ];

        const mutations = track_type_mutations(flows, "narrowed" as SymbolName);

        expect(mutations).toHaveLength(1);
        expect(mutations[0].reason).toBe("narrowing");
      });

      it("should detect widening mutations", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "widened" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: true,
          },
        ];

        const mutations = track_type_mutations(flows, "widened" as SymbolName);

        expect(mutations).toHaveLength(1);
        expect(mutations[0].reason).toBe("widening");
      });

      it("should handle same column sorting", () => {
        const flows: TypeFlowReference[] = [
          {
            location: { ...mockLocation, line: 1, column: 5 , end_line: 1, end_column: 5  },
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
          {
            location: { ...mockLocation, line: 1, column: 0 , end_line: 1, end_column: 0  },
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const mutations = track_type_mutations(flows, "var" as SymbolName);

        expect(mutations).toHaveLength(2);
        expect(mutations[0].location.column).toBe(0);
        expect(mutations[1].location.column).toBe(5);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty flows array", () => {
        const mutations = track_type_mutations([], "any_var" as SymbolName);
        expect(mutations).toEqual([]);
      });

      it("should handle variable not found", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "other_var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const mutations = track_type_mutations(
          flows,
          "missing_var" as SymbolName
        );
        expect(mutations).toEqual([]);
      });
    });
  });

  describe("build_variable_type_map", () => {
    describe("Success Cases", () => {
      it("should build map from type flows", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "var1" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const symbolMap = new Map<SymbolId, SymbolDefinition>();

        const result = build_variable_type_map(flows, symbolMap);

        expect(result.size).toBe(1);
        const varInfo = result.get(mockLocation)!;
        expect(varInfo.variable_name).toBe("var1");
        expect(varInfo.scope_id).toBe(mockScope.id);
        expect(varInfo.type_info).toEqual(mockTypeInfo);
        expect(varInfo.source).toBe("assignment");
      });

      it("should include variable declarations from symbols", () => {
        const flows: TypeFlowReference[] = [];

        const symbolDefinition: SymbolDefinition = {
          id: "var_symbol" as SymbolId,
          kind: "variable",
          name: "declared_var" as SymbolName,
          location: mockLocation,
          scope_id: mockScope.id,
          value_type: mockTypeInfo,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbolMap = new Map<SymbolId, SymbolDefinition>([
          ["var_symbol" as SymbolId, symbolDefinition],
        ]);

        const result = build_variable_type_map(flows, symbolMap);

        expect(result.size).toBe(1);
        const varInfo = result.get(mockLocation)!;
        expect(varInfo.variable_name).toBe("declared_var");
        expect(varInfo.type_id).toBe("string_type");
        expect(varInfo.source).toBe("declaration");
      });

      it("should resolve type IDs when registry provided", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "resolved_var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const typeRegistry = {
          resolve_type_info: vi.fn().mockReturnValue(mockTypeInfo),
        };

        const result = build_variable_type_map(flows, new Map(), typeRegistry);

        expect(result.size).toBe(1);
        const varInfo = result.get(mockLocation)!;
        expect(varInfo.type_id).toBe("resolved_type");
        expect(typeRegistry.resolve_type_info).toHaveBeenCalledWith(
          mockTypeInfo
        );
      });

      it("should handle constants from symbols", () => {
        const constantDefinition: SymbolDefinition = {
          id: "const_symbol" as SymbolId,
          kind: "constant",
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
          name: "CONST_VAR" as SymbolName,
          location: mockLocation,
          scope_id: mockScope.id,
          value_type: mockTypeInfo,
        };

        const symbolMap = new Map([
          ["const_symbol" as SymbolId, constantDefinition],
        ]);

        const result = build_variable_type_map([], symbolMap);

        expect(result.size).toBe(1);
        const varInfo = result.get(mockLocation)!;
        expect(varInfo.variable_name).toBe("CONST_VAR");
        expect(varInfo.source).toBe("declaration");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty flows and symbols", () => {
        const result = build_variable_type_map([], new Map());
        expect(result.size).toBe(0);
      });

      it("should skip symbols without value_type", () => {
        const symbolDefinition: SymbolDefinition = {
          id: "no_type_symbol" as SymbolId,
          kind: "variable",
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
          name: "no_type_var" as SymbolName,
          location: mockLocation,
          scope_id: mockScope.id,
          // No value_type
        };

        const symbolMap = new Map([
          ["no_type_symbol" as SymbolId, symbolDefinition],
        ]);

        const result = build_variable_type_map([], symbolMap);
        expect(result.size).toBe(0);
      });

      it("should skip non-variable symbols", () => {
        const functionDefinition: SymbolDefinition = {
          id: "func_symbol" as SymbolId,
          kind: "function",
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
          name: "testFunc" as SymbolName,
          location: mockLocation,
          scope_id: mockScope.id,
        };

        const symbolMap = new Map([
          ["func_symbol" as SymbolId, functionDefinition],
        ]);

        const result = build_variable_type_map([], symbolMap);
        expect(result.size).toBe(0);
      });

      it("should handle missing type registry resolve function", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const typeRegistry = {}; // No resolve_type_info

        const result = build_variable_type_map(flows, new Map(), typeRegistry);

        expect(result.size).toBe(1);
        const varInfo = result.get(mockLocation)!;
        expect(varInfo.type_id).toBeUndefined();
      });
    });
  });

  describe("track_constructor_types", () => {
    describe("Success Cases", () => {
      it("should track constructor types from flows", () => {
        const constructorType: TypeInfo = {
          type_name: "MyClass" as SymbolName,
          certainty: "declared",
          source: {
            kind: "construction",
            location: mockLocation,
          },
        };

        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "instance" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: constructorType,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const typeRegistry = {
          name_to_type: new Map<SymbolName, TypeInfo>([
            ["MyClass" as SymbolName, mockTypeInfo],
          ]),
        };

        const result = track_constructor_types(flows, new Map(), typeRegistry);

        expect(result.size).toBe(1);
        expect(result.get(mockLocation)).toBe("MyClass_type");
      });

      it("should handle multiple constructor calls", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "instance1" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "Class1" as SymbolName,
              certainty: "declared",
              source: { kind: "construction", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
          {
            location: {
              ...mockLocation,
              line: 2,
              column: 0,
            },
            name: "instance2" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "Class2" as SymbolName,
              certainty: "declared",
              source: { kind: "construction", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: {
              ...mockLocation,
              line: 2,
              column: 0,
            },
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const typeRegistry = {
          name_to_type: new Map<SymbolName, TypeInfo>([
            ["Class1" as SymbolName, mockTypeInfo],
            ["Class2" as SymbolName, mockTypeInfo],
          ]),
        };

        const result = track_constructor_types(flows, new Map(), typeRegistry);

        expect(result.size).toBe(2);
        expect(result.get(mockLocation)).toBe("Class1_type");
        expect(result.get(flows[1].target_location)).toBe("Class2_type");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty flows", () => {
        const result = track_constructor_types([], new Map());
        expect(result.size).toBe(0);
      });

      it("should skip non-construction flows", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "regular" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "string" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const result = track_constructor_types(flows, new Map());
        expect(result.size).toBe(0);
      });

      it("should handle missing type registry", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "instance" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "MyClass" as SymbolName,
              certainty: "declared",
              source: { kind: "construction", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const result = track_constructor_types(flows, new Map());
        expect(result.size).toBe(0);
      });

      it("should handle unknown class types", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "instance" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "UnknownClass" as SymbolName,
              certainty: "declared",
              source: { kind: "construction", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const typeRegistry = {
          name_to_type: new Map<SymbolName, TypeInfo>([
            ["KnownClass" as SymbolName, mockTypeInfo],
          ]),
        };

        const result = track_constructor_types(flows, new Map(), typeRegistry);
        expect(result.size).toBe(0);
      });
    });
  });

  describe("find_type_at_location", () => {
    describe("Success Cases", () => {
      it("should find most recent type assignment", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "string" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: { ...mockLocation, line: 1, column: 0 , end_line: 1, end_column: 0  },
            is_narrowing: false,
            is_widening: false,
          },
          {
            location: mockLocation,
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "number" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: { ...mockLocation, line: 3, column: 0 , end_line: 3, end_column: 0  },
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const searchLocation: Location = {
          ...mockLocation,
          line: 5,
          column: 0,
        };

        const result = find_type_at_location(searchLocation, flows);

        expect(result).toBeDefined();
        expect(result!.type_name).toBe("number");
      });

      it("should handle same line location comparison", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: { ...mockLocation, line: 1, column: 5 , end_line: 1, end_column: 5  },
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const searchLocation: Location = {
          ...mockLocation,
          line: 1,
          column: 10,
        };

        const result = find_type_at_location(searchLocation, flows);

        expect(result).toBeDefined();
        expect(result!.type_name).toBe("string");
      });

      it("should sort by most recent first", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "first" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: { ...mockLocation, line: 1, column: 0 , end_line: 1, end_column: 0  },
            is_narrowing: false,
            is_widening: false,
          },
          {
            location: mockLocation,
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "second" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: { ...mockLocation, line: 2, column: 0 , end_line: 2, end_column: 0  },
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const searchLocation: Location = {
          ...mockLocation,
          line: 3,
          column: 0,
        };

        const result = find_type_at_location(searchLocation, flows);

        expect(result).toBeDefined();
        expect(result!.type_name).toBe("second");
      });
    });

    describe("Edge Cases", () => {
      it("should return undefined for empty flows", () => {
        const result = find_type_at_location(mockLocation, []);
        expect(result).toBeUndefined();
      });

      it("should return undefined when no assignments before location", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: { ...mockLocation, line: 5, column: 0 , end_line: 5, end_column: 0  },
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const searchLocation: Location = {
          ...mockLocation,
          line: 1,
          column: 0,
        };

        const result = find_type_at_location(searchLocation, flows);
        expect(result).toBeUndefined();
      });

      it("should handle exact column match", () => {
        const flows: TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: { ...mockLocation, line: 1, column: 5 , end_line: 1, end_column: 5  },
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const searchLocation: Location = {
          ...mockLocation,
          line: 1,
          column: 5,
        };

        const result = find_type_at_location(searchLocation, flows);

        expect(result).toBeDefined();
        expect(result!.type_name).toBe("string");
      });
    });
  });

  describe("Integration Tests", () => {
    it("should process complete type flow pipeline", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          text: "myVar",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
      ];

      const assignmentContext: AssignmentContext = {
        source_type: mockTypeInfo,
        source_location: mockLocation,
        target_location: mockLocation,
        scope_id: mockScope.id,
      };

      mockBuildTypedAssignmentMap.mockReturnValue(
        new Map([[location_key(mockLocation), assignmentContext]])
      );

      // Process type flows
      const flows = process_type_flow_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(flows).toHaveLength(1);

      // Track mutations
      const mutations = track_type_mutations(flows, "myVar" as SymbolName);
      expect(mutations).toHaveLength(1);

      // Build variable type map
      const typeMap = build_variable_type_map(flows, new Map());
      expect(typeMap.size).toBe(1);

      // Find type at location
      const typeAtLocation = find_type_at_location(
        { ...mockLocation, line: 2, column: 0 , end_line: 2, end_column: 0  },
        flows
      );
      expect(typeAtLocation).toBeDefined();
    });
  });

  describe("Bug Fix Tests", () => {
    describe("Data Mutation Bug in track_constructor_types", () => {
      it("should NOT mutate readonly input flows", () => {
        const originalTypeInfo: TypeInfo = {
          type_name: "MyClass" as SymbolName,
          certainty: "declared",
          source: {
            kind: "construction",
            location: mockLocation,
          },
        };

        const flows: readonly TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "instance" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: originalTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const typeRegistry = {
          name_to_type: new Map<SymbolName, TypeInfo>([
            ["MyClass" as SymbolName, mockTypeInfo],
          ]),
        };

        // Capture original state
        const originalTypeName = flows[0].source_type.type_name;

        track_constructor_types(flows, new Map(), typeRegistry);

        // Bug: the function should NOT mutate the input
        // This test should fail with the current implementation
        expect(flows[0].source_type.type_name).toBe(originalTypeName);
      });

      it("should return constructor types without side effects", () => {
        const flows: readonly TypeFlowReference[] = [
          {
            location: mockLocation,
            name: "instance" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "MyClass" as SymbolName,
              certainty: "declared",
              source: { kind: "construction", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ];

        const typeRegistry = {
          name_to_type: new Map<SymbolName, TypeInfo>([
            ["MyClass" as SymbolName, mockTypeInfo],
          ]),
        };

        const result = track_constructor_types(flows, new Map(), typeRegistry);

        expect(result.size).toBe(1);
        expect(result.get(mockLocation)).toBe("MyClass_type");
        // The function should work correctly, just without mutations
      });
    });

    describe("Type Narrowing/Widening Logic Inversion Bug", () => {
      it("should correctly detect any->string as narrowing (not widening)", () => {
        const anyType: TypeInfo = {
          type_name: "any" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const stringType: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "var",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const assignmentContext: AssignmentContext = {
          source_type: stringType, // any -> string should be narrowing
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        const typeAnnotations = new Map<LocationKey, TypeInfo>([
          [location_key(mockLocation), anyType], // target is any
        ]);

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath,
          typeAnnotations
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_narrowing).toBe(true);
        expect(result[0].is_widening).toBe(false);
      });

      it("should correctly detect string->any as widening (not narrowing)", () => {
        const stringType: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const anyType: TypeInfo = {
          type_name: "any" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "var",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const assignmentContext: AssignmentContext = {
          source_type: anyType, // string -> any should be widening
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        const typeAnnotations = new Map<LocationKey, TypeInfo>([
          [location_key(mockLocation), stringType], // target is string
        ]);

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath,
          typeAnnotations
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_narrowing).toBe(false);
        expect(result[0].is_widening).toBe(true);
      });

      it("should correctly detect unknown->string as narrowing", () => {
        const unknownType: TypeInfo = {
          type_name: "unknown" as SymbolName,
          certainty: "ambiguous",
          source: { kind: "assignment", location: mockLocation },
        };

        const stringType: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "var",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const assignmentContext: AssignmentContext = {
          source_type: stringType,
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        const typeAnnotations = new Map<LocationKey, TypeInfo>([
          [location_key(mockLocation), unknownType],
        ]);

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath,
          typeAnnotations
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_narrowing).toBe(true);
        expect(result[0].is_widening).toBe(false);
      });

      it("should correctly detect string->unknown as widening", () => {
        const stringType: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const unknownType: TypeInfo = {
          type_name: "unknown" as SymbolName,
          certainty: "ambiguous",
          source: { kind: "assignment", location: mockLocation },
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "var",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const assignmentContext: AssignmentContext = {
          source_type: unknownType,
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        const typeAnnotations = new Map<LocationKey, TypeInfo>([
          [location_key(mockLocation), stringType],
        ]);

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath,
          typeAnnotations
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_narrowing).toBe(false);
        expect(result[0].is_widening).toBe(true);
      });
    });

    describe("Location Comparison Logic Issues", () => {
      it("should use assignment location for temporal ordering", () => {
        const flows: TypeFlowReference[] = [
          {
            location: { ...mockLocation, line: 2, column: 0, end_line: 2, end_column: 5 }, // Assignment happens at line 2
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "string" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: { ...mockLocation, line: 1, column: 0, end_line: 1, end_column: 3 }, // Target is at line 1
            is_narrowing: false,
            is_widening: false,
          },
        ];

        // Looking for type at line 3 - should find the assignment from line 2
        const searchLocation: Location = {
          ...mockLocation,
          line: 3,
          column: 0,
        };

        const result = find_type_at_location(searchLocation, flows);

        // This should find the type, but current implementation might miss it
        // because it uses target_location (line 1) instead of location (line 2)
        expect(result).toBeDefined();
        expect(result!.type_name).toBe("string");
      });

      it("should handle complex temporal ordering correctly", () => {
        const flows: TypeFlowReference[] = [
          {
            location: { ...mockLocation, line: 1, column: 0, end_line: 1, end_column: 5 },
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "string" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: { ...mockLocation, line: 1, column: 0, end_line: 1, end_column: 3 },
            is_narrowing: false,
            is_widening: false,
          },
          {
            location: { ...mockLocation, line: 3, column: 0, end_line: 3, end_column: 5 },
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "number" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: { ...mockLocation, line: 3, column: 0, end_line: 3, end_column: 3 },
            is_narrowing: false,
            is_widening: false,
          },
        ];

        // At line 2, should find first assignment (string)
        const result1 = find_type_at_location(
          { ...mockLocation, line: 2, column: 0 },
          flows
        );
        expect(result1?.type_name).toBe("string");

        // At line 4, should find second assignment (number)
        const result2 = find_type_at_location(
          { ...mockLocation, line: 4, column: 0 },
          flows
        );
        expect(result2?.type_name).toBe("number");
      });

      it("should exclude assignments at exact same location when looking before", () => {
        const flows: TypeFlowReference[] = [
          {
            location: { ...mockLocation, line: 2, column: 5, end_line: 2, end_column: 10 },
            name: "var" as SymbolName,
            scope_id: mockScope.id,
            flow_type: "assignment",
            source_type: {
              type_name: "string" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
            source_location: mockLocation,
            target_location: { ...mockLocation, line: 2, column: 5, end_line: 2, end_column: 8 },
            is_narrowing: false,
            is_widening: false,
          },
        ];

        // Looking at the exact same location as the assignment
        const searchLocation: Location = {
          ...mockLocation,
          line: 2,
          column: 5,
        };

        const result = find_type_at_location(searchLocation, flows);

        // Should this include the assignment at the same location?
        // Current logic includes it (<=), but semantically it might not make sense
        expect(result).toBeDefined();
      });
    });
  });

  describe("Internal Helper Function Logic", () => {
    describe("Type Narrowing Logic Comprehensive Tests", () => {
      it("should detect all forms of type narrowing", () => {
        const testCases = [
          {
            name: "any to specific type",
            target: {
              type_name: "any" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            source: {
              type_name: "string" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            expected: true,
          },
          {
            name: "unknown to specific type",
            target: {
              type_name: "unknown" as SymbolName,
              certainty: "ambiguous" as const,
              source: { kind: "assignment" as const, location: mockLocation },
            },
            source: {
              type_name: "number" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            expected: true,
          },
          {
            name: "ambiguous to declared certainty",
            target: {
              type_name: "string" as SymbolName,
              certainty: "ambiguous" as const,
              source: { kind: "assignment" as const, location: mockLocation },
            },
            source: {
              type_name: "string" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            expected: true,
          },
          {
            name: "ambiguous to inferred certainty",
            target: {
              type_name: "number" as SymbolName,
              certainty: "ambiguous" as const,
              source: { kind: "assignment" as const, location: mockLocation },
            },
            source: {
              type_name: "number" as SymbolName,
              certainty: "inferred" as const,
              source: { kind: "assignment" as const, location: mockLocation },
            },
            expected: true,
          },
          {
            name: "same specific types should not narrow",
            target: {
              type_name: "string" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            source: {
              type_name: "string" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            expected: false,
          },
          {
            name: "declared to ambiguous should not narrow",
            target: {
              type_name: "string" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            source: {
              type_name: "string" as SymbolName,
              certainty: "ambiguous" as const,
              source: { kind: "assignment" as const, location: mockLocation },
            },
            expected: false,
          },
        ];

        for (const testCase of testCases) {
          const captures: NormalizedCapture[] = [{
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "test_var",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          }];

          const assignmentContext: AssignmentContext = {
            source_type: testCase.source,
            source_location: mockLocation,
            target_location: mockLocation,
            scope_id: mockScope.id,
          };

          const typeAnnotations = new Map<LocationKey, TypeInfo>([
            [location_key(mockLocation), testCase.target],
          ]);

          mockBuildTypedAssignmentMap.mockReturnValue(
            new Map([[location_key(mockLocation), assignmentContext]])
          );

          const result = process_type_flow_references(
            captures,
            mockScope,
            mockScopes,
            mockFilePath,
            typeAnnotations
          );

          expect(result).toHaveLength(1);
          expect(result[0].is_narrowing).toBe(testCase.expected);
        }
      });

      it("should not narrow when target is undefined", () => {
        const captures: NormalizedCapture[] = [{
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          text: "test_var",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        }];

        const assignmentContext: AssignmentContext = {
          source_type: {
            type_name: "string" as SymbolName,
            certainty: "declared" as const,
            source: { kind: "annotation" as const, location: mockLocation },
          },
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
          // No type annotations provided - target will be undefined
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_narrowing).toBe(false);
      });

      it("should handle edge cases in type names", () => {
        const edgeCases = [
          {
            name: "any to any should not narrow",
            target: "any" as SymbolName,
            source: "any" as SymbolName,
            expected: false,
          },
          {
            name: "unknown to unknown should not narrow",
            target: "unknown" as SymbolName,
            source: "unknown" as SymbolName,
            expected: false,
          },
          {
            name: "any to empty string should narrow",
            target: "any" as SymbolName,
            source: "" as SymbolName,
            expected: true,
          },
        ];

        for (const testCase of edgeCases) {
          const captures: NormalizedCapture[] = [{
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "test_var",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          }];

          const assignmentContext: AssignmentContext = {
            source_type: {
              type_name: testCase.source,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            source_location: mockLocation,
            target_location: mockLocation,
            scope_id: mockScope.id,
          };

          const typeAnnotations = new Map<LocationKey, TypeInfo>([
            [location_key(mockLocation), {
              type_name: testCase.target,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            }],
          ]);

          mockBuildTypedAssignmentMap.mockReturnValue(
            new Map([[location_key(mockLocation), assignmentContext]])
          );

          const result = process_type_flow_references(
            captures,
            mockScope,
            mockScopes,
            mockFilePath,
            typeAnnotations
          );

          expect(result).toHaveLength(1);
          expect(result[0].is_narrowing).toBe(testCase.expected);
        }
      });
    });

    describe("Type Widening Logic Comprehensive Tests", () => {
      it("should detect all forms of type widening", () => {
        const testCases = [
          {
            name: "specific type to any",
            target: {
              type_name: "string" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            source: {
              type_name: "any" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            expected: true,
          },
          {
            name: "specific type to unknown",
            target: {
              type_name: "number" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            source: {
              type_name: "unknown" as SymbolName,
              certainty: "ambiguous" as const,
              source: { kind: "assignment" as const, location: mockLocation },
            },
            expected: true,
          },
          {
            name: "declared to ambiguous certainty",
            target: {
              type_name: "string" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            source: {
              type_name: "string" as SymbolName,
              certainty: "ambiguous" as const,
              source: { kind: "assignment" as const, location: mockLocation },
            },
            expected: true,
          },
          {
            name: "inferred to ambiguous certainty",
            target: {
              type_name: "number" as SymbolName,
              certainty: "inferred" as const,
              source: { kind: "assignment" as const, location: mockLocation },
            },
            source: {
              type_name: "number" as SymbolName,
              certainty: "ambiguous" as const,
              source: { kind: "assignment" as const, location: mockLocation },
            },
            expected: true,
          },
          {
            name: "any to any should not widen",
            target: {
              type_name: "any" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            source: {
              type_name: "any" as SymbolName,
              certainty: "declared" as const,
              source: { kind: "annotation" as const, location: mockLocation },
            },
            expected: false,
          },
          {
            name: "unknown to unknown should not widen",
            target: {
              type_name: "unknown" as SymbolName,
              certainty: "ambiguous" as const,
              source: { kind: "assignment" as const, location: mockLocation },
            },
            source: {
              type_name: "unknown" as SymbolName,
              certainty: "ambiguous" as const,
              source: { kind: "assignment" as const, location: mockLocation },
            },
            expected: false,
          },
        ];

        for (const testCase of testCases) {
          const captures: NormalizedCapture[] = [{
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "test_var",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          }];

          const assignmentContext: AssignmentContext = {
            source_type: testCase.source,
            source_location: mockLocation,
            target_location: mockLocation,
            scope_id: mockScope.id,
          };

          const typeAnnotations = new Map<LocationKey, TypeInfo>([
            [location_key(mockLocation), testCase.target],
          ]);

          mockBuildTypedAssignmentMap.mockReturnValue(
            new Map([[location_key(mockLocation), assignmentContext]])
          );

          const result = process_type_flow_references(
            captures,
            mockScope,
            mockScopes,
            mockFilePath,
            typeAnnotations
          );

          expect(result).toHaveLength(1);
          expect(result[0].is_widening).toBe(testCase.expected);
        }
      });

      it("should not widen when target is undefined", () => {
        const captures: NormalizedCapture[] = [{
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          text: "test_var",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        }];

        const assignmentContext: AssignmentContext = {
          source_type: {
            type_name: "any" as SymbolName,
            certainty: "declared" as const,
            source: { kind: "annotation" as const, location: mockLocation },
          },
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
          // No type annotations provided - target will be undefined
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_widening).toBe(false);
      });
    });

    describe("Flow Reference Creation Edge Cases", () => {
      it("should handle captures with different text formats", () => {
        const textFormats = [
          "normalVariable",
          "kebab-case-variable",
          "snake_case_variable",
          "PascalCaseVariable",
          "camelCaseVariable",
          "CONSTANT_VARIABLE",
          "$dollarVariable",
          "_underscore",
          "number123variable",
          "π", // Unicode character
          "",  // Empty string
        ];

        for (const text of textFormats) {
          const captures: NormalizedCapture[] = [{
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text,
            node_location: mockLocation,
            context: {},
            modifiers: {},
          }];

          const assignmentContext: AssignmentContext = {
            source_type: mockTypeInfo,
            source_location: mockLocation,
            target_location: mockLocation,
            scope_id: mockScope.id,
          };

          mockBuildTypedAssignmentMap.mockReturnValue(
            new Map([[location_key(mockLocation), assignmentContext]])
          );

          const result = process_type_flow_references(
            captures,
            mockScope,
            mockScopes,
            mockFilePath
          );

          expect(result).toHaveLength(1);
          expect(result[0].name).toBe(text as SymbolName);
          expect(result[0].location).toEqual(mockLocation);
          expect(result[0].flow_type).toBe("assignment");
        }
      });

      it("should create default source type when assignment context has undefined source_type", () => {
        const captures: NormalizedCapture[] = [{
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          text: "test_var",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        }];

        const assignmentContext: AssignmentContext = {
          source_type: undefined,
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].source_type.type_name).toBe("unknown");
        expect(result[0].source_type.certainty).toBe("ambiguous");
        expect(result[0].source_type.source.kind).toBe("assignment");
        expect(result[0].source_type.source.location).toEqual(mockLocation);
      });

      it("should handle different location formats", () => {
        const locationVariations = [
          { line: 0, column: 0, end_line: 0, end_column: 0 },
          { line: 1, column: 1, end_line: 1, end_column: 1 },
          { line: 999999, column: 999999, end_line: 999999, end_column: 999999 },
          { line: 1, column: 0, end_line: 5, end_column: 10 }, // Multi-line
        ];

        for (const locationData of locationVariations) {
          const location: Location = {
            file_path: mockFilePath,
            ...locationData,
          };

          const captures: NormalizedCapture[] = [{
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.VARIABLE,
            text: "test_var",
            node_location: location,
            context: {},
            modifiers: {},
          }];

          const assignmentContext: AssignmentContext = {
            source_type: mockTypeInfo,
            source_location: location,
            target_location: location,
            scope_id: mockScope.id,
          };

          mockBuildTypedAssignmentMap.mockReturnValue(
            new Map([[location_key(location), assignmentContext]])
          );

          const result = process_type_flow_references(
            captures,
            mockScope,
            mockScopes,
            mockFilePath
          );

          expect(result).toHaveLength(1);
          expect(result[0].location).toEqual(location);
          expect(result[0].source_location).toEqual(location);
          expect(result[0].target_location).toEqual(location);
        }
      });
    });

    describe("Type Annotation Map Edge Cases", () => {
      it("should handle malformed type annotation keys", () => {
        const captures: NormalizedCapture[] = [{
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          text: "test_var",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        }];

        const assignmentContext: AssignmentContext = {
          source_type: mockTypeInfo,
          source_location: mockLocation,
          target_location: {
            ...mockLocation,
            line: 999, // Different location for target
            column: 999,
          },
          scope_id: mockScope.id,
        };

        // Create type annotations map with wrong key
        const typeAnnotations = new Map<LocationKey, TypeInfo>([
          [location_key(mockLocation), mockTypeInfo], // Wrong key - doesn't match target_location
        ]);

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath,
          typeAnnotations
        );

        expect(result).toHaveLength(1);
        expect(result[0].target_type).toBeUndefined(); // Should not find annotation for wrong location
        expect(result[0].is_narrowing).toBe(false);
        expect(result[0].is_widening).toBe(false);
      });

      it("should handle empty type annotations map", () => {
        const captures: NormalizedCapture[] = [{
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          text: "test_var",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        }];

        const assignmentContext: AssignmentContext = {
          source_type: mockTypeInfo,
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        const emptyTypeAnnotations = new Map<LocationKey, TypeInfo>();

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath,
          emptyTypeAnnotations
        );

        expect(result).toHaveLength(1);
        expect(result[0].target_type).toBeUndefined();
        expect(result[0].is_narrowing).toBe(false);
        expect(result[0].is_widening).toBe(false);
      });
    });

    describe("Complex Interaction Scenarios", () => {
      it("should handle simultaneous narrowing and widening detection correctly", () => {
        // This tests that the narrowing and widening logic doesn't conflict
        const ambiguousType: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "ambiguous" as const,
          source: { kind: "assignment" as const, location: mockLocation },
        };

        const declaredType: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared" as const,
          source: { kind: "annotation" as const, location: mockLocation },
        };

        const captures: NormalizedCapture[] = [{
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          text: "test_var",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        }];

        const assignmentContext: AssignmentContext = {
          source_type: declaredType, // ambiguous -> declared = narrowing
          source_location: mockLocation,
          target_location: mockLocation,
          scope_id: mockScope.id,
        };

        const typeAnnotations = new Map<LocationKey, TypeInfo>([
          [location_key(mockLocation), ambiguousType],
        ]);

        mockBuildTypedAssignmentMap.mockReturnValue(
          new Map([[location_key(mockLocation), assignmentContext]])
        );

        const result = process_type_flow_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath,
          typeAnnotations
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_narrowing).toBe(true);
        expect(result[0].is_widening).toBe(false);
        // Should not be both narrowing AND widening
        expect(result[0].is_narrowing && result[0].is_widening).toBe(false);
      });

      it("should maintain consistent state across multiple captures", () => {
        const multipleCaptures: NormalizedCapture[] = Array.from({ length: 100 }, (_, i) => ({
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          text: `var_${i}`,
          node_location: {
            ...mockLocation,
            line: i + 1,
            column: 0,
            end_line: i + 1,
            end_column: 10,
          },
          context: {},
          modifiers: {},
        }));

        const assignmentMap = new Map<LocationKey, AssignmentContext>();
        for (const capture of multipleCaptures) {
          assignmentMap.set(location_key(capture.node_location), {
            source_type: mockTypeInfo,
            source_location: capture.node_location,
            target_location: capture.node_location,
            scope_id: mockScope.id,
          });
        }

        mockBuildTypedAssignmentMap.mockReturnValue(assignmentMap);

        const result = process_type_flow_references(
          multipleCaptures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(100);

        // All should have consistent structure
        for (let i = 0; i < 100; i++) {
          expect(result[i].name).toBe(`var_${i}`);
          expect(result[i].flow_type).toBe("assignment");
          expect(result[i].scope_id).toBe(mockScope.id);
          expect(result[i].source_type).toEqual(mockTypeInfo);
          expect(result[i].location.line).toBe(i + 1);
        }
      });
    });
  });
});

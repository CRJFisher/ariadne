/**
 * Comprehensive tests for references main module
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FilePath, ScopeId, LexicalScope, SymbolId, Location } from "@ariadnejs/types";
import type { NormalizedCapture } from "../capture_types";
import { SemanticCategory, SemanticEntity } from "../capture_types";
import { process_references } from "./references";
import type { ProcessedReferences } from "./reference_types";

// Mock all the individual reference processors
vi.mock("./call_references/call_references", () => ({
  process_call_references: vi.fn(),
}));

vi.mock("./type_flow_references/type_flow_references", () => ({
  extract_type_flow: vi.fn(),
}));

vi.mock("./return_references/return_references", () => ({
  process_return_references: vi.fn(),
}));

vi.mock("./member_access_references/member_access_references", () => ({
  process_member_access_references: vi.fn(),
}));

vi.mock("./type_annotation_references/type_annotation_references", () => ({
  process_type_annotation_references: vi.fn(),
}));

// Import mocked functions
import { process_call_references } from "./call_references/call_references";
import { extract_type_flow } from "./type_flow_references/type_flow_references";
import { process_return_references } from "./return_references/return_references";
import { process_member_access_references } from "./member_access_references/member_access_references";
import { process_type_annotation_references } from "./type_annotation_references/type_annotation_references";

const mockProcessCallReferences = vi.mocked(process_call_references);
const mockExtractTypeFlow = vi.mocked(extract_type_flow);
const mockProcessReturnReferences = vi.mocked(process_return_references);
const mockProcessMemberAccessReferences = vi.mocked(process_member_access_references);
const mockProcessTypeAnnotationReferences = vi.mocked(process_type_annotation_references);

describe("References Module", () => {
  const mockFilePath = "test.ts" as FilePath;
  const mockLocation: Location = {
    file_path: mockFilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
  };

  const mockRootScope: LexicalScope = {
    id: "root" as ScopeId,
    parent_id: null,
    name: null,
    type: "module",
    location: mockLocation,
    child_ids: [],
    symbols: new Map(),
  };

  const mockScopes = new Map<ScopeId, LexicalScope>([
    ["root" as ScopeId, mockRootScope],
  ]);

  const mockScopeToSymbol = new Map<ScopeId, SymbolId>([
    ["root" as ScopeId, "root_symbol" as SymbolId],
  ]);

  // Helper to create mock captures
  function createMockCapture(
    category: SemanticCategory,
    entity: SemanticEntity,
    text: string
  ): NormalizedCapture {
    return {
      category,
      entity,
      node_location: mockLocation,
      text,
      modifiers: {},
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock return values
    mockProcessCallReferences.mockReturnValue([]);
    mockExtractTypeFlow.mockReturnValue({
      constructor_calls: [],
      assignments: [],
      returns: [],
      call_assignments: [],
    });
    mockProcessReturnReferences.mockReturnValue([]);
    mockProcessMemberAccessReferences.mockReturnValue([]);
    mockProcessTypeAnnotationReferences.mockReturnValue([]);
  });

  describe("process_references", () => {
    describe("Basic Functionality", () => {
      it("should return empty results when no captures provided", () => {
        const result = process_references(
          [], // No reference captures
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toEqual({
          calls: [],
          type_flows: undefined, // No captures, so extract_type_flow not called
          returns: [],
          member_accesses: [],
          type_annotations: [],
        });
      });

      it("should return empty results when captures don't match expected entities", () => {
        const nonMatchingCaptures = [
          createMockCapture(SemanticCategory.DEFINITION, SemanticEntity.VARIABLE, "var"),
          createMockCapture(SemanticCategory.SCOPE, SemanticEntity.FUNCTION, "func"),
        ];

        const result = process_references(
          nonMatchingCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toEqual({
          calls: [],
          type_flows: {  // extract_type_flow always returns an object
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
          returns: [],
          member_accesses: [],
          type_annotations: [],
        });

        // Should not call any processors since no matching entities
        expect(mockProcessCallReferences).not.toHaveBeenCalled();
        expect(mockProcessMemberAccessReferences).not.toHaveBeenCalled();
      });

      it("should initialize result structure correctly", () => {
        const result = process_references(
          [],
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveProperty("calls");
        expect(result).toHaveProperty("type_flows");
        expect(result).toHaveProperty("returns");
        expect(result).toHaveProperty("member_accesses");
        expect(result).toHaveProperty("type_annotations");

        expect(Array.isArray(result.calls)).toBe(true);
        // type_flows is now optional LocalTypeFlow object, not an array
        expect(result.type_flows === undefined || typeof result.type_flows === 'object').toBe(true);
        expect(Array.isArray(result.returns)).toBe(true);
        expect(Array.isArray(result.member_accesses)).toBe(true);
        expect(Array.isArray(result.type_annotations)).toBe(true);
      });
    });

    describe("Call Reference Processing", () => {
      it("should process CALL entity captures", () => {
        const callCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.CALL, "func()"),
        ];

        const mockCallResults = [
          {
            location: mockLocation,
            name: "func" as any,
            scope_id: "test_scope" as ScopeId,
            call_type: "function" as const,
          },
        ];

        mockProcessCallReferences.mockReturnValue(mockCallResults);

        const result = process_references(
          callCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath,
          undefined, // assignments
          undefined, // type_captures
          undefined, // returns
          mockScopeToSymbol
        );

        expect(mockProcessCallReferences).toHaveBeenCalledWith(
          callCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath,
          mockScopeToSymbol
        );

        expect(result.calls).toEqual(mockCallResults);
      });

      it("should process SUPER entity captures", () => {
        const superCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.SUPER, "super.method()"),
        ];

        const mockCallResults = [
          {
            location: mockLocation,
            name: "method" as any,
            scope_id: "test_scope" as ScopeId,
            call_type: "super" as const,
          },
        ];

        mockProcessCallReferences.mockReturnValue(mockCallResults);

        const result = process_references(
          superCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath,
          undefined,
          undefined,
          undefined,
          mockScopeToSymbol
        );

        expect(mockProcessCallReferences).toHaveBeenCalledWith(
          superCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath,
          mockScopeToSymbol
        );

        expect(result.calls).toEqual(mockCallResults);
      });

      it("should combine CALL and SUPER captures", () => {
        const mixedCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.CALL, "func()"),
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.SUPER, "super.method()"),
        ];

        const mockCallResults = [
          {
            location: mockLocation,
            name: "func" as any,
            scope_id: "test_scope" as ScopeId,
            call_type: "function" as const,
          },
          {
            location: mockLocation,
            name: "method" as any,
            scope_id: "test_scope" as ScopeId,
            call_type: "super" as const,
          },
        ];

        mockProcessCallReferences.mockReturnValue(mockCallResults);

        const result = process_references(
          mixedCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath,
          undefined,
          undefined,
          undefined,
          mockScopeToSymbol
        );

        expect(result.calls).toEqual(mockCallResults);
      });
    });

    describe("Member Access Processing", () => {
      it("should process MEMBER_ACCESS entity captures", () => {
        const memberCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.MEMBER_ACCESS, "obj.prop"),
        ];

        const mockMemberResults = [
          {
            location: mockLocation,
            member_name: "prop" as any,
            scope_id: "test_scope" as ScopeId,
            access_type: "property" as const,
            object: {},
            is_optional_chain: false,
          },
        ];

        mockProcessMemberAccessReferences.mockReturnValue(mockMemberResults);

        const result = process_references(
          memberCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(mockProcessMemberAccessReferences).toHaveBeenCalledWith(
          memberCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(result.member_accesses).toEqual(mockMemberResults);
      });

      it("should process PROPERTY entity captures", () => {
        const propertyCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.PROPERTY, "property"),
        ];

        const mockMemberResults = [
          {
            location: mockLocation,
            member_name: "property" as any,
            scope_id: "test_scope" as ScopeId,
            access_type: "property" as const,
            object: {},
            is_optional_chain: false,
          },
        ];

        mockProcessMemberAccessReferences.mockReturnValue(mockMemberResults);

        const result = process_references(
          propertyCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(result.member_accesses).toEqual(mockMemberResults);
      });

      it("should process METHOD entity captures", () => {
        const methodCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.METHOD, "method"),
        ];

        const mockMemberResults = [
          {
            location: mockLocation,
            member_name: "method" as any,
            scope_id: "test_scope" as ScopeId,
            access_type: "method" as const,
            object: {},
            is_optional_chain: false,
          },
        ];

        mockProcessMemberAccessReferences.mockReturnValue(mockMemberResults);

        const result = process_references(
          methodCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(result.member_accesses).toEqual(mockMemberResults);
      });

      it("should combine all member access related captures", () => {
        const mixedMemberCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.MEMBER_ACCESS, "obj.prop"),
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.PROPERTY, "property"),
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.METHOD, "method"),
        ];

        const mockMemberResults = [
          {
            location: mockLocation,
            member_name: "prop" as any,
            scope_id: "test_scope" as ScopeId,
            access_type: "property" as const,
            object: {},
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "property" as any,
            scope_id: "test_scope" as ScopeId,
            access_type: "property" as const,
            object: {},
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "method" as any,
            scope_id: "test_scope" as ScopeId,
            access_type: "method" as const,
            object: {},
            is_optional_chain: false,
          },
        ];

        mockProcessMemberAccessReferences.mockReturnValue(mockMemberResults);

        const result = process_references(
          mixedMemberCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(result.member_accesses).toEqual(mockMemberResults);
      });
    });

    describe("Type Annotation Processing", () => {
      it("should process type annotations when type_captures provided", () => {
        const typeCaptures = [
          createMockCapture(SemanticCategory.TYPE, SemanticEntity.TYPE_ANNOTATION, "string"),
        ];

        const mockTypeResults = [
          {
            location: mockLocation,
            annotation_text: "string",
            scope_id: "test_scope" as ScopeId,
            annotation_kind: "variable" as const,
            annotates_location: mockLocation,
          },
        ];

        mockProcessTypeAnnotationReferences.mockReturnValue(mockTypeResults);

        const result = process_references(
          [], // No reference captures
          mockRootScope,
          mockScopes,
          mockFilePath,
          undefined, // assignments
          typeCaptures, // type_captures
          undefined, // returns
          mockScopeToSymbol
        );

        expect(mockProcessTypeAnnotationReferences).toHaveBeenCalledWith(
          typeCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(result.type_annotations).toEqual(mockTypeResults);
      });

      it("should skip type annotation processing when no type_captures provided", () => {
        const result = process_references(
          [],
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(mockProcessTypeAnnotationReferences).not.toHaveBeenCalled();
        expect(result.type_annotations).toEqual([]);
      });

      it("should skip type annotation processing when type_captures is empty", () => {
        const result = process_references(
          [],
          mockRootScope,
          mockScopes,
          mockFilePath,
          undefined,
          [], // Empty type captures
          undefined,
          mockScopeToSymbol
        );

        expect(mockProcessTypeAnnotationReferences).not.toHaveBeenCalled();
        expect(result.type_annotations).toEqual([]);
      });
    });

    describe("Type Flow Processing", () => {
      it("should process type flows when assignments provided", () => {
        const assignments = [
          createMockCapture(SemanticCategory.ASSIGNMENT, SemanticEntity.VARIABLE, "x = 5"),
        ];

        const typeCaptures = [
          createMockCapture(SemanticCategory.TYPE, SemanticEntity.TYPE_ANNOTATION, "number"),
        ];

        const mockTypeMap = new Map();
        const mockTypeFlowResults = {
          constructor_calls: [],
          assignments: [
            {
              source: { kind: "variable" as const, name: "y" as any },
              target: "x" as any,
              location: mockLocation,
              kind: "direct" as const,
            },
          ],
          returns: [],
          call_assignments: [],
        };

        mockExtractTypeFlow.mockReturnValue(mockTypeFlowResults);

        const result = process_references(
          [],
          mockRootScope,
          mockScopes,
          mockFilePath,
          assignments,
          typeCaptures,
          undefined,
          mockScopeToSymbol
        );

        expect(mockExtractTypeFlow).toHaveBeenCalledWith(
          expect.any(Array),
          mockScopes,
          mockFilePath
        );

        expect(result.type_flows).toEqual(mockTypeFlowResults);
      });

      it("should build empty type map when no type_captures provided", () => {
        const assignments = [
          createMockCapture(SemanticCategory.ASSIGNMENT, SemanticEntity.VARIABLE, "x = 5"),
        ];

        const mockTypeFlowResults = {
          constructor_calls: [],
          assignments: [
            {
              source: { kind: "variable" as const, name: "y" as any },
              target: "x" as any,
              location: mockLocation,
              kind: "direct" as const,
            },
          ],
          returns: [],
          call_assignments: [],
        };

            mockExtractTypeFlow.mockReturnValue(mockTypeFlowResults);

        const result = process_references(
          [],
          mockRootScope,
          mockScopes,
          mockFilePath,
          assignments,
          undefined, // No type captures
          undefined,
          mockScopeToSymbol
        );

        expect(mockExtractTypeFlow).toHaveBeenCalledWith(
          expect.any(Array),  // Now called with all captures
          mockScopes,
          mockFilePath
        );

        expect(result.type_flows).toEqual(mockTypeFlowResults);
      });

      it("should skip type flow processing when no assignments provided", () => {
        const result = process_references(
          [],
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        // extract_type_flow is not called when no captures at all
        expect(mockExtractTypeFlow).not.toHaveBeenCalled();
        expect(result.type_flows).toBeUndefined();
      });
    });

    describe("Return Processing", () => {
      it("should process returns when provided", () => {
        const returns = [
          createMockCapture(SemanticCategory.RETURN, SemanticEntity.VARIABLE, "return x"),
        ];

        const mockReturnResults = [
          {
            location: mockLocation,
            expression: "return x",
            scope_id: "test_scope" as ScopeId,
            function_scope_id: "func_scope" as ScopeId,
          },
        ];

        mockProcessReturnReferences.mockReturnValue(mockReturnResults);

        const result = process_references(
          [],
          mockRootScope,
          mockScopes,
          mockFilePath,
          undefined,
          undefined,
          returns,
          mockScopeToSymbol
        );

        expect(mockProcessReturnReferences).toHaveBeenCalledWith(
          returns,
          mockRootScope,
          mockScopes,
          mockFilePath,
          mockScopeToSymbol
        );

        expect(result.returns).toEqual(mockReturnResults);
      });

      it("should skip return processing when no returns provided", () => {
        const result = process_references(
          [],
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(mockProcessReturnReferences).not.toHaveBeenCalled();
        expect(result.returns).toEqual([]);
      });
    });

    describe("Processing Order", () => {
      it("should process type annotations first", () => {
        const refCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.CALL, "func()"),
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.MEMBER_ACCESS, "obj.prop"),
        ];
        const typeCaptures = [
          createMockCapture(SemanticCategory.TYPE, SemanticEntity.TYPE_ANNOTATION, "string"),
        ];
        const assignments = [
          createMockCapture(SemanticCategory.ASSIGNMENT, SemanticEntity.VARIABLE, "x = 5"),
        ];
        const returns = [
          createMockCapture(SemanticCategory.RETURN, SemanticEntity.VARIABLE, "return x"),
        ];

        // Track call order
        const callOrder: string[] = [];

        mockProcessTypeAnnotationReferences.mockImplementation(() => {
          callOrder.push("type_annotations");
          return [];
        });

        mockProcessCallReferences.mockImplementation(() => {
          callOrder.push("calls");
          return [];
        });

        mockExtractTypeFlow.mockImplementation(() => {
          callOrder.push("type_flows");
          return {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          };
        });

        mockProcessReturnReferences.mockImplementation(() => {
          callOrder.push("returns");
          return [];
        });

        mockProcessMemberAccessReferences.mockImplementation(() => {
          callOrder.push("member_accesses");
          return [];
        });

        process_references(
          refCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath,
          assignments,
          typeCaptures,
          returns,
          mockScopeToSymbol
        );

        expect(callOrder).toEqual([
          "type_annotations",
          "calls",
          "type_flows",
          "returns",
          "member_accesses",
        ]);
      });
    });

    describe("Complex Integration Scenarios", () => {
      it("should handle all reference types together", () => {
        const refCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.CALL, "func()"),
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.SUPER, "super.method()"),
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.MEMBER_ACCESS, "obj.prop"),
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.PROPERTY, "property"),
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.METHOD, "method"),
        ];

        const typeCaptures = [
          createMockCapture(SemanticCategory.TYPE, SemanticEntity.TYPE_ANNOTATION, "string"),
        ];

        const assignments = [
          createMockCapture(SemanticCategory.ASSIGNMENT, SemanticEntity.VARIABLE, "x = 5"),
        ];

        const returns = [
          createMockCapture(SemanticCategory.RETURN, SemanticEntity.VARIABLE, "return x"),
        ];

        // Setup mock results
        mockProcessTypeAnnotationReferences.mockReturnValue([
          {
            location: mockLocation,
            annotation_text: "string",
            scope_id: "test_scope" as ScopeId,
            annotation_kind: "variable" as const,
            annotates_location: mockLocation,
          },
        ]);

        mockProcessCallReferences.mockReturnValue([
          {
            location: mockLocation,
            name: "func" as any,
            scope_id: "test_scope" as ScopeId,
            call_type: "function" as const,
          },
          {
            location: mockLocation,
            name: "method" as any,
            scope_id: "test_scope" as ScopeId,
            call_type: "super" as const,
          },
        ]);

        mockProcessMemberAccessReferences.mockReturnValue([
          {
            location: mockLocation,
            member_name: "prop" as any,
            scope_id: "test_scope" as ScopeId,
            access_type: "property" as const,
            object: {},
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "property" as any,
            scope_id: "test_scope" as ScopeId,
            access_type: "property" as const,
            object: {},
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "method" as any,
            scope_id: "test_scope" as ScopeId,
            access_type: "method" as const,
            object: {},
            is_optional_chain: false,
          },
        ]);

        mockExtractTypeFlow.mockReturnValue({
          constructor_calls: [],
          assignments: [
            {
              source: { kind: "literal", value: "5", literal_type: "number" },
              target: "x" as any,
              location: mockLocation,
              kind: "direct" as const,
            },
          ],
          returns: [],
          call_assignments: [],
        });

        mockProcessReturnReferences.mockReturnValue([
          {
            location: mockLocation,
            expression: "return x",
            scope_id: "test_scope" as ScopeId,
            function_scope_id: "func_scope" as ScopeId,
          },
        ]);

        const result = process_references(
          refCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath,
          assignments,
          typeCaptures,
          returns,
          mockScopeToSymbol
        );

        expect(result.calls).toHaveLength(2);
        expect(result.member_accesses).toHaveLength(3);
        expect(result.type_annotations).toHaveLength(1);
        expect(result.type_flows).toBeDefined(); // Now a single LocalTypeFlow object
        expect(result.type_flows?.assignments).toHaveLength(1);
        expect(result.returns).toHaveLength(1);

        // Verify all processors were called with correct arguments
        expect(mockProcessTypeAnnotationReferences).toHaveBeenCalledWith(
          typeCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(mockProcessCallReferences).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ entity: SemanticEntity.CALL }),
            expect.objectContaining({ entity: SemanticEntity.SUPER }),
          ]),
          mockRootScope,
          mockScopes,
          mockFilePath,
          mockScopeToSymbol
        );

        expect(mockProcessMemberAccessReferences).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ entity: SemanticEntity.MEMBER_ACCESS }),
            expect.objectContaining({ entity: SemanticEntity.PROPERTY }),
            expect.objectContaining({ entity: SemanticEntity.METHOD }),
          ]),
          mockRootScope,
          mockScopes,
          mockFilePath
        );
      });

      it("should handle empty inputs gracefully", () => {
        const result = process_references(
          [],
          mockRootScope,
          mockScopes,
          mockFilePath,
          [], // Empty assignments
          [], // Empty type captures
          [], // Empty returns
          new Map() // Empty scope to symbol map
        );

        expect(result).toEqual({
          calls: [],
          type_flows: undefined, // Empty captures, so extract_type_flow not called
          returns: [],
          member_accesses: [],
          type_annotations: [],
        });

        // Should not call processors for empty inputs
        expect(mockProcessTypeAnnotationReferences).not.toHaveBeenCalled();
        expect(mockProcessCallReferences).not.toHaveBeenCalled();
        expect(mockProcessMemberAccessReferences).not.toHaveBeenCalled();
        expect(mockExtractTypeFlow).not.toHaveBeenCalled();
        expect(mockProcessReturnReferences).not.toHaveBeenCalled();
      });

      it("should handle processor errors gracefully", () => {
        const refCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.CALL, "func()"),
        ];

        mockProcessCallReferences.mockImplementation(() => {
          throw new Error("Processing error");
        });

        expect(() => {
          process_references(
            refCaptures,
            mockRootScope,
            mockScopes,
            mockFilePath,
            undefined,
            undefined,
            undefined,
            mockScopeToSymbol
          );
        }).toThrow("Processing error");
      });
    });

    describe("Parameter Validation", () => {
      it("should handle required parameters correctly", () => {
        // Test that required parameters are properly passed through
        const refCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.CALL, "func()"),
        ];

        process_references(
          refCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath
        );

        expect(mockProcessCallReferences).toHaveBeenCalledWith(
          refCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath,
          undefined // scope_to_symbol should be undefined when not provided
        );
      });

      it("should pass through all optional parameters when provided", () => {
        const refCaptures = [
          createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.CALL, "func()"),
        ];
        const assignments = [
          createMockCapture(SemanticCategory.ASSIGNMENT, SemanticEntity.VARIABLE, "x = 5"),
        ];
        const typeCaptures = [
          createMockCapture(SemanticCategory.TYPE, SemanticEntity.TYPE_ANNOTATION, "string"),
        ];
        const returns = [
          createMockCapture(SemanticCategory.RETURN, SemanticEntity.VARIABLE, "return x"),
        ];

        process_references(
          refCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath,
          assignments,
          typeCaptures,
          returns,
          mockScopeToSymbol
        );

        expect(mockProcessCallReferences).toHaveBeenCalledWith(
          refCaptures,
          mockRootScope,
          mockScopes,
          mockFilePath,
          mockScopeToSymbol
        );

        expect(mockExtractTypeFlow).toHaveBeenCalledWith(
          expect.any(Array),  // Now called with all captures
          mockScopes,
          mockFilePath
        );

        expect(mockProcessReturnReferences).toHaveBeenCalledWith(
          returns,
          mockRootScope,
          mockScopes,
          mockFilePath,
          mockScopeToSymbol
        );
      });
    });
  });
});
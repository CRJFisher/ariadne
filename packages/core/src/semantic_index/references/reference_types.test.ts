/**
 * Tests for reference types and interfaces
 */

import { describe, it, expect } from "vitest";
import type { FilePath, SymbolId, Location, ScopeId } from "@ariadnejs/types";
import type { ProcessedReference, ProcessedReferences } from "./reference_types";

// Import individual reference types for testing
import type { CallReference } from "./call_references/call_references";
import type { TypeFlowReference } from "./type_flow_references/type_flow_references";
import type { ReturnReference } from "./return_references/return_references";
import type { MemberAccessReference } from "./member_access_references/member_access_references";
import type { TypeAnnotationReference } from "./type_annotation_references/type_annotation_references";

describe("Reference Types", () => {
  const mockLocation: Location = {
    file_path: "test.ts" as FilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
  };

  const mockSymbolId = "test_symbol" as SymbolId;

  describe("ProcessedReference Union Type", () => {
    it("should accept CallReference objects", () => {
      const callRef: CallReference = {
        location: mockLocation,
        name: "testCall" as any,
        scope_id: "test_scope" as ScopeId,
        call_type: "function",
        // Additional call-specific properties would be included here
      };

      const processedRef: ProcessedReference = callRef;
      expect(processedRef.location).toBe(mockLocation);
      expect(processedRef.name).toBe("testCall");
    });

    it("should accept TypeFlowReference objects", () => {
      const typeFlowRef: TypeFlowReference = {
        location: mockLocation,
        name: "x" as any,
        scope_id: "test_scope" as ScopeId,
        flow_type: "assignment",
        source_type: {
          type_name: "number" as any,
          certainty: "inferred",
          source: { kind: "assignment" as const, location: mockLocation }
        },
        source_location: mockLocation,
        target_location: mockLocation,
        is_narrowing: false,
        is_widening: false,
        // Additional type flow specific properties would be included here
      };

      const processedRef: ProcessedReference = typeFlowRef;
      expect(processedRef.location).toBe(mockLocation);
      expect(processedRef.name).toBe("x");
    });

    it("should accept ReturnReference objects", () => {
      const returnRef: ReturnReference = {
        location: mockLocation,
        expression: "return value",
        scope_id: "test_scope" as ScopeId,
        function_scope_id: "func_scope" as ScopeId,
        is_conditional: false,
        is_async: false,
        is_yield: false,
        // Additional return-specific properties would be included here
      };

      const processedRef: ProcessedReference = returnRef;
      expect(processedRef.location).toBe(mockLocation);
      expect(processedRef.expression).toBe("return value");
    });

    it("should accept MemberAccessReference objects", () => {
      const memberAccessRef: MemberAccessReference = {
        location: mockLocation,
        member_name: "property" as any,
        scope_id: "test_scope" as ScopeId,
        access_type: "property",
        object: {},
        is_optional_chain: false,
        // Additional member access specific properties would be included here
      };

      const processedRef: ProcessedReference = memberAccessRef;
      expect(processedRef.location).toBe(mockLocation);
      expect(processedRef.member_name).toBe("property");
    });

    it("should accept TypeAnnotationReference objects", () => {
      const typeAnnotationRef: TypeAnnotationReference = {
        location: mockLocation,
        type_name: "string" as any,
        scope_id: "test_scope" as ScopeId,
        annotation_kind: "variable",
        declared_type: {
          type_name: "string" as any,
          certainty: "declared",
          source: { kind: "annotation" as const, location: mockLocation }
        },
        annotates_location: mockLocation,
        // Additional type annotation specific properties would be included here
      };

      const processedRef: ProcessedReference = typeAnnotationRef;
      expect(processedRef.location).toBe(mockLocation);
      expect(processedRef.type_name).toBe("string");
    });

    it("should allow discriminated union based on properties", () => {
      const callRef: CallReference = {
        location: mockLocation,
        name: "call" as any,
        scope_id: "test_scope" as ScopeId,
        call_type: "function",
      };

      const typeFlowRef: TypeFlowReference = {
        location: mockLocation,
        name: "assignment" as any,
        scope_id: "test_scope" as ScopeId,
        flow_type: "assignment",
        source_type: {
          type_name: "number" as any,
          certainty: "inferred",
          source: { kind: "assignment" as const, location: mockLocation }
        },
        source_location: mockLocation,
        target_location: mockLocation,
        is_narrowing: false,
        is_widening: false,
      };

      const returnRef: ReturnReference = {
        location: mockLocation,
        expression: "return",
        scope_id: "test_scope" as ScopeId,
        function_scope_id: "func_scope" as ScopeId,
        is_conditional: false,
        is_async: false,
        is_yield: false,
      };

      const memberAccessRef: MemberAccessReference = {
        location: mockLocation,
        member_name: "access" as any,
        scope_id: "test_scope" as ScopeId,
        access_type: "property",
        object: {},
        is_optional_chain: false,
      };

      const typeAnnotationRef: TypeAnnotationReference = {
        location: mockLocation,
        type_name: "annotation" as any,
        scope_id: "test_scope" as ScopeId,
        annotation_kind: "variable",
        declared_type: {
          type_name: "string" as any,
          certainty: "declared",
          source: { kind: "annotation" as const, location: mockLocation }
        },
        annotates_location: mockLocation,
      };

      const references: ProcessedReference[] = [callRef, typeFlowRef, returnRef, memberAccessRef, typeAnnotationRef];

      // Test each reference has the expected properties
      expect(callRef.call_type).toBe("function");
      expect(typeFlowRef.flow_type).toBe("assignment");
      expect(returnRef.expression).toBe("return");
      expect(memberAccessRef.access_type).toBe("property");
      expect(typeAnnotationRef.annotation_kind).toBe("variable");

      expect(references).toHaveLength(5);
    });
  });

  describe("ProcessedReferences Interface", () => {
    it("should create valid ProcessedReferences objects", () => {
      const processedRefs: ProcessedReferences = {
        calls: [
          {
            location: mockLocation,
            name: "testCall" as any,
            scope_id: "test_scope" as ScopeId,
            call_type: "function",
          },
        ],
        type_flows: [
          {
            location: mockLocation,
            name: "x" as any,
            scope_id: "test_scope" as ScopeId,
            flow_type: "assignment",
            source_type: {
              type_name: "number" as any,
              certainty: "inferred",
              source: { kind: "assignment" as const, location: mockLocation }
            },
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ],
        returns: [
          {
            location: mockLocation,
            expression: "return x",
            scope_id: "test_scope" as ScopeId,
            function_scope_id: "func_scope" as ScopeId,
            is_conditional: false,
            is_async: false,
            is_yield: false,
          },
        ],
        member_accesses: [
          {
            location: mockLocation,
            member_name: "prop" as any,
            scope_id: "test_scope" as ScopeId,
            access_type: "property",
            object: {},
            is_optional_chain: false,
          },
        ],
        type_annotations: [
          {
            location: mockLocation,
            type_name: "string" as any,
            scope_id: "test_scope" as ScopeId,
            annotation_kind: "variable",
            declared_type: {
              type_name: "string" as any,
              certainty: "declared",
              source: { kind: "annotation" as const, location: mockLocation }
            },
            annotates_location: mockLocation,
          },
        ],
      };

      expect(processedRefs.calls).toHaveLength(1);
      expect(processedRefs.type_flows).toHaveLength(1);
      expect(processedRefs.returns).toHaveLength(1);
      expect(processedRefs.member_accesses).toHaveLength(1);
      expect(processedRefs.type_annotations).toHaveLength(1);
    });

    it("should allow empty arrays for all reference types", () => {
      const emptyRefs: ProcessedReferences = {
        calls: [],
        type_flows: [],
        returns: [],
        member_accesses: [],
        type_annotations: [],
      };

      expect(emptyRefs.calls).toHaveLength(0);
      expect(emptyRefs.type_flows).toHaveLength(0);
      expect(emptyRefs.returns).toHaveLength(0);
      expect(emptyRefs.member_accesses).toHaveLength(0);
      expect(emptyRefs.type_annotations).toHaveLength(0);
    });

    it("should support multiple references of each type", () => {
      const multipleRefs: ProcessedReferences = {
        calls: [
          {
            location: mockLocation,
            name: "func1" as any,
            scope_id: "scope1" as ScopeId,
            call_type: "function",
          },
          {
            location: mockLocation,
            name: "func2" as any,
            scope_id: "scope2" as ScopeId,
            call_type: "function",
          },
        ],
        type_flows: [
          {
            location: mockLocation,
            name: "x" as any,
            scope_id: "scope1" as ScopeId,
            flow_type: "assignment",
            source_type: {
              type_name: "number" as any,
              certainty: "inferred",
              source: { kind: "assignment" as const, location: mockLocation }
            },
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
          {
            location: mockLocation,
            name: "y" as any,
            scope_id: "scope2" as ScopeId,
            flow_type: "assignment",
            source_type: {
              type_name: "number" as any,
              certainty: "inferred",
              source: { kind: "assignment" as const, location: mockLocation }
            },
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ],
        returns: [
          {
            location: mockLocation,
            expression: "return x",
            scope_id: "scope1" as ScopeId,
            function_scope_id: "func_scope1" as ScopeId,
            is_conditional: false,
            is_async: false,
            is_yield: false,
          },
        ],
        member_accesses: [
          {
            location: mockLocation,
            member_name: "prop1" as any,
            scope_id: "scope1" as ScopeId,
            access_type: "property",
            object: {},
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "prop2" as any,
            scope_id: "scope2" as ScopeId,
            access_type: "property",
            object: {},
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "prop" as any,
            scope_id: "scope3" as ScopeId,
            access_type: "property",
            object: {},
            is_optional_chain: false,
          },
        ],
        type_annotations: [],
      };

      expect(multipleRefs.calls).toHaveLength(2);
      expect(multipleRefs.type_flows).toHaveLength(2);
      expect(multipleRefs.returns).toHaveLength(1);
      expect(multipleRefs.member_accesses).toHaveLength(3);
      expect(multipleRefs.type_annotations).toHaveLength(0);
    });

    it("should enforce readonly constraint on arrays", () => {
      const processedRefs: ProcessedReferences = {
        calls: [],
        type_flows: [],
        returns: [],
        member_accesses: [],
        type_annotations: [],
      };

      // These should be readonly arrays, so direct mutation should be prevented at compile time
      // (This is a TypeScript compile-time check, not runtime)
      expect(Array.isArray(processedRefs.calls)).toBe(true);
      expect(Array.isArray(processedRefs.type_flows)).toBe(true);
      expect(Array.isArray(processedRefs.returns)).toBe(true);
      expect(Array.isArray(processedRefs.member_accesses)).toBe(true);
      expect(Array.isArray(processedRefs.type_annotations)).toBe(true);
    });

    it("should allow accessing array length and elements", () => {
      const processedRefs: ProcessedReferences = {
        calls: [
          {
            location: mockLocation,
            name: "test" as any,
            scope_id: "test_scope" as ScopeId,
            call_type: "function",
          },
        ],
        type_flows: [],
        returns: [],
        member_accesses: [],
        type_annotations: [],
      };

      expect(processedRefs.calls.length).toBe(1);
      expect(processedRefs.calls[0].call_type).toBe("function");
      expect(processedRefs.type_flows.length).toBe(0);
    });
  });

  describe("Type Compatibility", () => {
    it("should ensure common properties across all reference types", () => {
      const commonProperties = ["location", "scope_id"];

      const callRef: CallReference = {
        location: mockLocation,
        name: "call" as any,
        scope_id: "test_scope" as ScopeId,
        call_type: "function",
      };

      const typeFlowRef: TypeFlowReference = {
        location: mockLocation,
        name: "assignment" as any,
        scope_id: "test_scope" as ScopeId,
        flow_type: "assignment",
        source_type: {
          type_name: "number" as any,
          certainty: "inferred",
          source: { kind: "assignment" as const, location: mockLocation }
        },
        source_location: mockLocation,
        target_location: mockLocation,
        is_narrowing: false,
        is_widening: false,
      };

      const references: ProcessedReference[] = [callRef, typeFlowRef];

      for (const ref of references) {
        for (const prop of commonProperties) {
          expect(ref).toHaveProperty(prop);
          expect((ref as any)[prop]).toBeDefined();
        }
      }
    });

    it("should maintain type specificity in union", () => {
      // Test that the union type preserves specific properties
      const processedRef: ProcessedReference = {
        location: mockLocation,
        name: "specificCall" as any,
        scope_id: "test_scope" as ScopeId,
        call_type: "function",
        // CallReference-specific properties
      } as CallReference;

      // Test CallReference-specific property
      if ('call_type' in processedRef) {
        // TypeScript should know this is a CallReference
        expect(processedRef.call_type).toBeDefined();
      }
    });

    it("should work with destructuring and spread", () => {
      const processedRefs: ProcessedReferences = {
        calls: [],
        type_flows: [],
        returns: [],
        member_accesses: [],
        type_annotations: [],
      };

      // Should allow destructuring
      const { calls, type_flows, returns } = processedRefs;
      expect(calls).toBeDefined();
      expect(type_flows).toBeDefined();
      expect(returns).toBeDefined();

      // Should allow spread
      const combinedRefs = { ...processedRefs };
      expect(combinedRefs.calls).toBe(processedRefs.calls);
      expect(combinedRefs.member_accesses).toBe(processedRefs.member_accesses);
    });

    it("should support array operations on readonly arrays", () => {
      const callRef: CallReference = {
        location: mockLocation,
        name: "test" as any,
        scope_id: "test_scope" as ScopeId,
        call_type: "function",
      };

      const processedRefs: ProcessedReferences = {
        calls: [callRef],
        type_flows: [],
        returns: [],
        member_accesses: [],
        type_annotations: [],
      };

      // Should support readonly array operations
      expect(processedRefs.calls.find(c => c.call_type === "function")).toBeDefined();
      expect(processedRefs.calls.filter(c => c.name === "test")).toHaveLength(1);
      expect(processedRefs.calls.map(c => c.name)).toEqual(["test"]);
      expect(processedRefs.calls.every(c => c.call_type === "function")).toBe(true);
      expect(processedRefs.calls.some(c => c.name === "test")).toBe(true);
    });

    it("should handle empty ProcessedReferences uniformly", () => {
      const emptyRefs: ProcessedReferences = {
        calls: [],
        type_flows: [],
        returns: [],
        member_accesses: [],
        type_annotations: [],
      };

      const allArrays = [
        emptyRefs.calls,
        emptyRefs.type_flows,
        emptyRefs.returns,
        emptyRefs.member_accesses,
        emptyRefs.type_annotations,
      ];

      for (const array of allArrays) {
        expect(Array.isArray(array)).toBe(true);
        expect(array.length).toBe(0);
      }
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle mixed reference types in processing pipeline", () => {
      const mixedRefs: ProcessedReference[] = [
        {
          location: mockLocation,
          name: "func1" as any,
          scope_id: "scope1" as ScopeId,
          call_type: "function",
        } as CallReference,
        {
          location: mockLocation,
          member_name: "prop1" as any,
          scope_id: "scope1" as ScopeId,
          access_type: "property",
          object: {},
          is_optional_chain: false,
        } as MemberAccessReference,
        {
          location: mockLocation,
          type_name: "string" as any,
          scope_id: "scope1" as ScopeId,
          annotation_kind: "variable",
          declared_type: {
            type_name: "string" as any,
            certainty: "declared",
            source: { kind: "annotation" as const, location: mockLocation }
          },
          annotates_location: mockLocation,
        } as TypeAnnotationReference,
      ];

      // Group by type using type guards
      const groupedByType = {
        calls: mixedRefs.filter(r => 'call_type' in r),
        member_accesses: mixedRefs.filter(r => 'member_name' in r),
        type_annotations: mixedRefs.filter(r => 'type_name' in r && 'annotation_kind' in r),
        type_flows: mixedRefs.filter(r => 'flow_type' in r),
        returns: mixedRefs.filter(r => 'expression' in r && 'function_scope_id' in r),
      };

      expect(groupedByType.calls).toHaveLength(1);
      expect(groupedByType.member_accesses).toHaveLength(1);
      expect(groupedByType.type_annotations).toHaveLength(1);
      expect(groupedByType.type_flows).toHaveLength(0);
      expect(groupedByType.returns).toHaveLength(0);
    });

    it("should support complex ProcessedReferences structures", () => {
      const complexRefs: ProcessedReferences = {
        calls: [
          {
            location: mockLocation,
            name: "recursive_call" as any,
            scope_id: "function_scope" as ScopeId,
            call_type: "function",
            containing_function: "recursive_call" as SymbolId,
          },
        ],
        type_flows: [
          {
            location: mockLocation,
            name: "captured" as any,
            scope_id: "closure_scope" as ScopeId,
            flow_type: "assignment",
            source_type: {
              type_name: "outer_var_type" as any,
              certainty: "inferred",
              source: { kind: "assignment" as const, location: mockLocation }
            },
            source_location: mockLocation,
            target_location: mockLocation,
            is_narrowing: false,
            is_widening: false,
          },
        ],
        returns: [
          {
            location: mockLocation,
            expression: "return await promise",
            scope_id: "async_scope" as ScopeId,
            function_scope_id: "async_function" as ScopeId,
            is_conditional: false,
            is_async: true,
            is_yield: false,
          },
        ],
        member_accesses: [
          {
            location: mockLocation,
            member_name: "e" as any,
            scope_id: "deep_scope" as ScopeId,
            access_type: "property",
            object: {},
            property_chain: ["a" as any, "b" as any, "c" as any, "d" as any, "e" as any],
            is_optional_chain: false,
          },
        ],
        type_annotations: [
          {
            location: mockLocation,
            type_name: "Promise" as any,
            scope_id: "generic_scope" as ScopeId,
            annotation_kind: "variable",
            declared_type: {
              type_name: "Promise" as any,
              certainty: "declared",
              source: { kind: "annotation" as const, location: mockLocation }
            },
            annotates_location: mockLocation,
          },
        ],
      };

      // Verify complex structures maintain type safety
      expect(complexRefs.calls[0].containing_function).toBe("recursive_call");
      expect(complexRefs.type_flows[0].name).toBe("captured");
      expect(complexRefs.returns[0].expression).toContain("await");
      expect(complexRefs.member_accesses[0].property_chain).toContain("a");
      expect(complexRefs.type_annotations[0].type_name).toBe("Promise");
    });
  });
});
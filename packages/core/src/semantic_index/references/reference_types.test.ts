/**
 * Tests for reference types and interfaces
 */

import { describe, it, expect } from "vitest";
import type { FilePath, SymbolId, Location, ScopeId } from "@ariadnejs/types";
import type { ProcessedReferences } from "./reference_types";

// Import individual reference types for testing
import type { CallReference } from "./call_references/call_references";
import type { LocalTypeFlowData } from "./type_flow_references/type_flow_references";
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

  describe("ProcessedReferences Interface", () => {
    it("should properly structure all reference types", () => {
      const callRef: CallReference = {
        location: mockLocation,
        name: "testCall" as any,
        scope_id: "test_scope" as ScopeId,
        call_type: "function",
      };

      const typeFlow: LocalTypeFlowData = {
        constructor_calls: [],
        assignments: [],
        returns: [],
        call_assignments: [],
      };

      const returnRef: ReturnReference = {
        location: mockLocation,
        expression: "return value",
        scope_id: "test_scope" as ScopeId,
        function_scope_id: "func_scope" as ScopeId,
        is_conditional: false,
        is_async: false,
        is_yield: false,
      };

      const memberAccessRef: MemberAccessReference = {
        location: mockLocation,
        member_name: "member" as any,
        scope_id: "test_scope" as ScopeId,
        access_type: "property",
        object: {},
        is_optional_chain: false,
      };

      const typeAnnotationRef: TypeAnnotationReference = {
        location: mockLocation,
        annotation_text: "string",
        scope_id: "test_scope" as ScopeId,
        annotation_kind: "variable",
        annotates_location: mockLocation,
        is_optional: undefined,
        constraint_text: undefined,
      };

      const processedRefs: ProcessedReferences = {
        calls: [callRef],
        type_flows: typeFlow,
        returns: [returnRef],
        member_accesses: [memberAccessRef],
        type_annotations: [typeAnnotationRef],
      };

      expect(processedRefs.calls).toHaveLength(1);
      expect(processedRefs.type_flows).toBeDefined();
      expect(processedRefs.returns).toHaveLength(1);
      expect(processedRefs.member_accesses).toHaveLength(1);
      expect(processedRefs.type_annotations).toHaveLength(1);
    });

    it("should handle empty references", () => {
      const emptyRefs: ProcessedReferences = {
        calls: [],
        type_flows: undefined, // Optional
        returns: [],
        member_accesses: [],
        type_annotations: [],
      };

      expect(emptyRefs.calls).toHaveLength(0);
      expect(emptyRefs.type_flows).toBeUndefined();
      expect(emptyRefs.returns).toHaveLength(0);
    });
  });
});
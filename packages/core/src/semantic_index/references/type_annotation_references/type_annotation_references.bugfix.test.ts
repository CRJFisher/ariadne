/**
 * Tests for bug fixes in type annotation references
 *
 * This file specifically tests all the bugs that were identified and fixed:
 * 1. Incomplete annotation kind detection
 * 2. Wrong annotates_location logic
 * 3. Missing constraints logic
 * 4. TypeHierarchy interface inconsistency
 * 5. Missing error handling
 * 6. Flawed type alias detection
 * 7. Missing entity type mappings
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity, SemanticCategory } from "../../capture_types";
import {  
  TypeAnnotationReference,
  process_type_annotation_references,
  build_type_hierarchy,
  find_type_aliases,
  resolve_type_references,
} from "./type_annotation_references";

// Mock dependencies
vi.mock("../../scope_tree", () => ({
  find_containing_scope: vi.fn(),
}));

import { find_containing_scope } from "../../scope_tree";
import { build_type_annotation_map } from "../type_tracking/type_tracking";

const mockFindContainingScope = vi.mocked(find_containing_scope);
const mockBuildTypeAnnotationMap = vi.mocked(build_type_annotation_map);

describe("Type Annotation References - Bug Fixes", () => {
  const mockFilePath = "bugfix.ts" as FilePath;
  const mockLocation: Location = {
    file_path: mockFilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
  };

  const mockScope: LexicalScope = {
    id: "bugfix_scope" as ScopeId,
    type: "function",
    location: mockLocation,
    parent_id: null,
    child_ids: [],
    symbols: new Map(),
    name: "BugfixFunction" as SymbolName,
  };

  const mockScopes = new Map<ScopeId, LexicalScope>([[mockScope.id, mockScope]]);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindContainingScope.mockReturnValue(mockScope);
    mockBuildTypeAnnotationMap.mockReturnValue(new Map());
  });

  describe("Bug Fix 1: Incomplete Annotation Kind Detection", () => {
    it("should correctly map TYPE_PARAMETER entity to generic annotation kind", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE_PARAMETER,
          text: "T",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].annotation_kind).toBe("generic");
    });

    it("should correctly map TYPE entity to generic annotation kind", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "UserType",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].annotation_kind).toBe("generic");
    });

    it("should correctly map TYPE_ASSERTION entity to cast annotation kind", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE_ASSERTION,
          text: "string",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].annotation_kind).toBe("cast");
    });

    it("should correctly map FIELD entity to property annotation kind", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.FIELD,
          text: "number",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].annotation_kind).toBe("property");
    });

    it("should correctly map CONSTANT entity to variable annotation kind", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.CONSTANT,
          text: "string",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].annotation_kind).toBe("variable");
    });

    it("should default unknown entities to variable annotation kind", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.MODULE, // Unknown for type annotations
          text: "UnknownType",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].annotation_kind).toBe("variable");
    });
  });

  describe("Bug Fix 2: Constraints Handling", () => {
    it("should extract extends constraints from capture context", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE_PARAMETER,
          text: "T",
          node_location: mockLocation,
          context: { constraint_type: "Serializable" },
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].constraints).toBeDefined();
      expect(annotations[0].constraints).toHaveLength(1);
      expect(annotations[0].constraints![0].kind).toBe("extends");
      expect(annotations[0].constraints![0].constraint_type.type_name).toBe("Serializable");
    });

    it("should extract implements constraints from capture context", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "MyClass",
          node_location: mockLocation,
          context: { implements_interface: "Comparable" },
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].constraints).toBeDefined();
      expect(annotations[0].constraints).toHaveLength(1);
      expect(annotations[0].constraints![0].kind).toBe("implements");
      expect(annotations[0].constraints![0].constraint_type.type_name).toBe("Comparable");
    });

    it("should extract multiple implements constraints", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "MyClass",
          node_location: mockLocation,
          context: { implements_interfaces: ["Interface1", "Interface2"] },
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].constraints).toBeDefined();
      expect(annotations[0].constraints).toHaveLength(2);
      expect(annotations[0].constraints![0].constraint_type.type_name).toBe("Interface1");
      expect(annotations[0].constraints![1].constraint_type.type_name).toBe("Interface2");
    });

    it("should extract satisfies constraints from capture context", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "MyType",
          node_location: mockLocation,
          context: { constraint_type: "Record<string, unknown>" },
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].constraints).toBeDefined();
      expect(annotations[0].constraints).toHaveLength(1);
      expect(annotations[0].constraints![0].kind).toBe("satisfies");
    });

    it("should handle captures without context gracefully", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "SimpleType",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].constraints).toBeUndefined();
    });
  });

  describe("Bug Fix 3: TypeHierarchy Interface Population", () => {
    it("should populate interfaces map for interface types", () => {
      const interfaceAnnotation: TypeAnnotationReference = {
        location: mockLocation,
        type_name: "IComparable" as SymbolName, // Interface naming convention
        scope_id: mockScope.id,
        annotation_kind: "generic",
        declared_type: {
          type_name: "IComparable" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        },
        annotates_location: mockLocation,
      };

      const hierarchy = build_type_hierarchy([interfaceAnnotation]);

      expect(hierarchy.interfaces.size).toBe(1);
      expect(hierarchy.interfaces.has("IComparable" as SymbolName)).toBe(true);
    });

    it("should populate interfaces map from implements constraints", () => {
      const implementingAnnotation: TypeAnnotationReference = {
        location: mockLocation,
        type_name: "MyClass" as SymbolName,
        scope_id: mockScope.id,
        annotation_kind: "generic",
        declared_type: {
          type_name: "MyClass" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        },
        annotates_location: mockLocation,
        constraints: [{
          kind: "implements",
          constraint_type: {
            type_name: "Serializable" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        }],
      };

      const hierarchy = build_type_hierarchy([implementingAnnotation]);

      expect(hierarchy.interfaces.size).toBe(1);
      expect(hierarchy.interfaces.has("Serializable" as SymbolName)).toBe(true);
      expect(hierarchy.implementations.size).toBe(1);
      expect(hierarchy.implementations.get("Serializable" as SymbolName)?.has("MyClass" as SymbolName)).toBe(true);
    });

    it("should optimize Set creation for derived types", () => {
      const annotations: TypeAnnotationReference[] = [
        {
          location: mockLocation,
          type_name: "Child1" as SymbolName,
          scope_id: mockScope.id,
          annotation_kind: "generic",
          declared_type: {
            type_name: "Child1" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
          annotates_location: mockLocation,
          constraints: [{
            kind: "extends",
            constraint_type: {
              type_name: "Parent" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
          }],
        },
        {
          location: {
            ...mockLocation,
            line: 2,
            column: 0,
            end_line: 2,
            end_column: 10,
          },
          type_name: "Child2" as SymbolName,
          scope_id: mockScope.id,
          annotation_kind: "generic",
          declared_type: {
            type_name: "Child2" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
          annotates_location: mockLocation,
          constraints: [{
            kind: "extends",
            constraint_type: {
              type_name: "Parent" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
          }],
        },
      ];

      const hierarchy = build_type_hierarchy(annotations);

      expect(hierarchy.derived_types.size).toBe(1);
      const parentChildren = hierarchy.derived_types.get("Parent" as SymbolName);
      expect(parentChildren?.size).toBe(2);
      expect(parentChildren?.has("Child1" as SymbolName)).toBe(true);
      expect(parentChildren?.has("Child2" as SymbolName)).toBe(true);
    });
  });

  describe("Bug Fix 4: Improved Type Alias Detection", () => {
    it("should not identify primitive type annotations as aliases", () => {
      const primitiveAnnotation: TypeAnnotationReference = {
        location: mockLocation,
        type_name: "myVar" as SymbolName,
        scope_id: mockScope.id,
        annotation_kind: "variable",
        declared_type: {
          type_name: "string" as SymbolName, // Primitive type
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        },
        annotates_location: mockLocation,
      };

      const aliases = find_type_aliases([primitiveAnnotation]);

      expect(aliases).toHaveLength(0);
    });

    it("should identify meaningful type aliases", () => {
      const aliasAnnotation: TypeAnnotationReference = {
        location: mockLocation,
        type_name: "UserId" as SymbolName,
        scope_id: mockScope.id,
        annotation_kind: "variable",
        declared_type: {
          type_name: "CustomUserIdType" as SymbolName, // Non-primitive, different name
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        },
        annotates_location: mockLocation,
      };

      const aliases = find_type_aliases([aliasAnnotation]);

      expect(aliases).toHaveLength(1);
      expect(aliases[0].alias_name).toBe("UserId");
      expect(aliases[0].aliased_type.type_name).toBe("CustomUserIdType");
    });

    it("should not identify same-name types as aliases", () => {
      const sameNameAnnotation: TypeAnnotationReference = {
        location: mockLocation,
        type_name: "UserType" as SymbolName,
        scope_id: mockScope.id,
        annotation_kind: "variable",
        declared_type: {
          type_name: "UserType" as SymbolName, // Same name
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        },
        annotates_location: mockLocation,
      };

      const aliases = find_type_aliases([sameNameAnnotation]);

      expect(aliases).toHaveLength(0);
    });
  });

  describe("Bug Fix 5: Comprehensive Error Handling", () => {
    it("should throw error for invalid type_captures input", () => {
      expect(() => {
        process_type_annotation_references(
          null as any,
          mockScope,
          mockScopes,
          mockFilePath
        );
      }).toThrow("Invalid input: type_captures must be an array");
    });

    it("should throw error for invalid root_scope input", () => {
      expect(() => {
        process_type_annotation_references(
          [],
          null as any,
          mockScopes,
          mockFilePath
        );
      }).toThrow("Invalid input: root_scope must have an id");
    });

    it("should throw error for invalid scopes input", () => {
      expect(() => {
        process_type_annotation_references(
          [],
          mockScope,
          null as any,
          mockFilePath
        );
      }).toThrow("Invalid input: scopes must be a Map");
    });

    it("should throw error for missing file_path", () => {
      expect(() => {
        process_type_annotation_references(
          [],
          mockScope,
          mockScopes,
          "" as FilePath
        );
      }).toThrow("Invalid input: file_path is required");
    });

    it("should skip invalid captures gracefully", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "", // Invalid - empty text
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "ValidType",
          node_location: null as any, // Invalid - null location
          context: {},
          modifiers: {},
        },
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "GoodType",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      // Should only process the valid capture
      expect(annotations).toHaveLength(1);
      expect(annotations[0].type_name).toBe("GoodType");
    });

    it("should handle missing scope gracefully", () => {
      mockFindContainingScope.mockReturnValue(null as any);

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "OrphanType",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      // Should skip captures without scope
      expect(annotations).toHaveLength(0);
    });

    it("should validate input for build_type_hierarchy", () => {
      expect(() => {
        build_type_hierarchy(null as any);
      }).toThrow("Invalid input: annotations must be an array");
    });

    it("should validate input for find_type_aliases", () => {
      expect(() => {
        find_type_aliases(null as any);
      }).toThrow("Invalid input: annotations must be an array");
    });

    it("should validate input for resolve_type_references", () => {
      expect(() => {
        resolve_type_references(null as any, new Map());
      }).toThrow("Invalid input: annotations must be an array");

      expect(() => {
        resolve_type_references([], null as any);
      }).toThrow("Invalid input: type_definitions must be a Map");
    });

    it("should skip invalid annotations in helper functions", () => {
      const invalidAnnotations = [
        null,
        undefined,
        {} as TypeAnnotationReference,
        {
          type_name: null,
          declared_type: null,
        } as any,
      ];

      // Should not throw and return empty results
      expect(() => {
        const hierarchy = build_type_hierarchy(invalidAnnotations as any);
        expect(hierarchy.base_types.size).toBe(0);
      }).not.toThrow();

      expect(() => {
        const aliases = find_type_aliases(invalidAnnotations as any);
        expect(aliases).toHaveLength(0);
      }).not.toThrow();

      expect(() => {
        const resolutions = resolve_type_references(invalidAnnotations as any, new Map());
        expect(resolutions.size).toBe(0);
      }).not.toThrow();
    });
  });

  describe("Bug Fix 6: Target Location Context", () => {
    it("should fallback to annotation location when no specific target available", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "string",
          node_location: mockLocation,
          context: { annotation_type: "string" },
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      // Since CaptureContext doesn't define target_location, function should fallback to annotation location
      expect(annotations[0].annotates_location).toEqual(mockLocation);
    });

    it("should fallback to annotation location when no target context", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "string",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
      ];

      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].annotates_location).toEqual(mockLocation);
    });
  });
});
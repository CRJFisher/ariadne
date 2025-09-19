/**
 * Integration tests for type annotation references using synthetic test data
 * Note: These tests avoid tree-sitter queries due to current syntax issues
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity, SemanticCategory } from "../../capture_types";
import {
  process_type_annotation_references,
  build_type_hierarchy,
  find_generic_parameters,
  find_type_aliases,
  resolve_type_references,
} from "./type_annotation_references";

// Mock dependencies
vi.mock("../../scope_tree", () => ({
  find_containing_scope: vi.fn(),
}));

vi.mock("../type_tracking/type_tracking", () => ({
  build_type_annotation_map: vi.fn(),
}));

import { find_containing_scope } from "../../scope_tree";
import { build_type_annotation_map } from "../type_tracking/type_tracking";

const mockFindContainingScope = vi.mocked(find_containing_scope);
const mockBuildTypeAnnotationMap = vi.mocked(build_type_annotation_map);

describe("Type Annotation References - Integration Tests", () => {
  const mockFilePath = "integration.ts" as FilePath;
  const mockLocation: Location = {
    file_path: mockFilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
  };

  const mockScope: LexicalScope = {
    id: "integration_scope" as ScopeId,
    type: "module",
    location: mockLocation,
    parent_id: null,
    child_ids: [],
    symbols: new Map(),
    name: "IntegrationModule" as SymbolName,
  };

  const mockScopes = new Map<ScopeId, LexicalScope>([[mockScope.id, mockScope]]);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindContainingScope.mockReturnValue(mockScope);
  });

  describe("Real-World Type Scenario Integration", () => {
    it("should process complex TypeScript-like type annotations", () => {
      // Simulate complex TypeScript type scenarios
      const typeCaptures: NormalizedCapture[] = [
        // Generic class parameter
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "T",
          node_location: {
            ...mockLocation,
            line: 1,
            column: 12,
            end_line: 1,
            end_column: 13,
          },
          context: { annotation_type: "T" },
          modifiers: {},
        },
        // Interface property
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.PROPERTY,
          text: "string",
          node_location: {
            ...mockLocation,
            line: 2,
            column: 12,
            end_line: 2,
            end_column: 18,
          },
          context: { annotation_type: "string" },
          modifiers: {},
        },
        // Function parameter
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.PARAMETER,
          text: "number",
          node_location: {
            ...mockLocation,
            line: 3,
            column: 15,
            end_line: 3,
            end_column: 21,
          },
          context: { annotation_type: "number" },
          modifiers: { is_optional: false },
        },
        // Optional parameter
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.PARAMETER,
          text: "boolean",
          node_location: {
            ...mockLocation,
            line: 4,
            column: 25,
            end_line: 4,
            end_column: 32,
          },
          context: { annotation_type: "boolean" },
          modifiers: { is_optional: true },
        },
      ];

      const typeMap = new Map();
      typeMap.set(location_key(typeCaptures[0].node_location), {
        type_name: "T" as SymbolName,
        certainty: "declared" as const,
        source: { kind: "annotation" as const, location: typeCaptures[0].node_location },
      });

      mockBuildTypeAnnotationMap.mockReturnValue(typeMap);

      const annotations = process_type_annotation_references(
        typeCaptures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(4);

      // Check generic parameter
      const genericParam = annotations.find(a => a.type_name === "T");
      expect(genericParam).toBeDefined();
      expect(genericParam!.annotation_kind).toBe("generic"); // TYPE entity correctly maps to generic

      // Check property
      const propertyAnnotation = annotations.find(a => a.type_name === "string");
      expect(propertyAnnotation).toBeDefined();
      expect(propertyAnnotation!.annotation_kind).toBe("property");

      // Check parameters
      const paramAnnotations = annotations.filter(a => a.annotation_kind === "parameter");
      expect(paramAnnotations).toHaveLength(2);

      const optionalParam = paramAnnotations.find(a => a.is_optional === true);
      expect(optionalParam).toBeDefined();
      expect(optionalParam!.type_name).toBe("boolean");
    });

    it("should handle inheritance hierarchy integration", () => {
      // Simulate inheritance relationships
      const inheritanceCaptures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "BaseClass",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "DerivedClass",
          node_location: {
            ...mockLocation,
            line: 2,
            column: 0,
            end_line: 2,
            end_column: 12,
          },
          context: { extends_class: "BaseClass" },
          modifiers: {},
        },
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "Interface1",
          node_location: {
            ...mockLocation,
            line: 3,
            column: 0,
            end_line: 3,
            end_column: 10,
          },
          context: {},
          modifiers: {},
        },
      ];

      mockBuildTypeAnnotationMap.mockReturnValue(new Map());

      const annotations = process_type_annotation_references(
        inheritanceCaptures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      // Build complete analysis pipeline
      const hierarchy = build_type_hierarchy(annotations);
      const generics = find_generic_parameters(annotations);
      const aliases = find_type_aliases(annotations);
      const definitions = new Map<SymbolName, Location>([
        ["BaseClass" as SymbolName, mockLocation],
        ["DerivedClass" as SymbolName, annotations[1].location],
      ]);
      const resolutions = resolve_type_references(annotations, definitions);

      // Verify full pipeline works together
      expect(hierarchy.base_types.size).toBeGreaterThan(0);
      expect(Array.isArray(generics)).toBe(true);
      expect(Array.isArray(aliases)).toBe(true);
      expect(resolutions.size).toBeGreaterThan(0);

      // Verify at least some types were resolved
      expect(resolutions.get(mockLocation)).toBe(mockLocation);
    });

    it("should handle complex generic constraints integration", () => {
      const genericCaptures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "T",
          node_location: mockLocation,
          context: { constraint_type: "Serializable" },
          modifiers: {},
        },
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "U",
          node_location: {
            ...mockLocation,
            line: 2,
            column: 0,
            end_line: 2,
            end_column: 1,
          },
          context: { implements_interface: "Comparable<T>" },
          modifiers: {},
        },
      ];

      mockBuildTypeAnnotationMap.mockReturnValue(new Map());

      const annotations = process_type_annotation_references(
        genericCaptures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      // Simulate adding constraints (normally done by tree-sitter analysis)
      const constrainedAnnotations = annotations.map(a => ({
        ...a,
        annotation_kind: "generic" as const,
        constraints: a.type_name === "T" ? [{
          kind: "extends" as const,
          constraint_type: {
            type_name: "Serializable" as SymbolName,
            certainty: "declared" as const,
            source: { kind: "annotation" as const, location: a.location },
          }
        }] : a.type_name === "U" ? [{
          kind: "implements" as const,
          constraint_type: {
            type_name: "Comparable" as SymbolName,
            certainty: "declared" as const,
            source: { kind: "annotation" as const, location: a.location },
          }
        }] : undefined,
      }));

      const hierarchy = build_type_hierarchy(constrainedAnnotations);
      const generics = find_generic_parameters(constrainedAnnotations);

      expect(generics).toHaveLength(2);
      expect(hierarchy.derived_types.size).toBe(1); // T extends Serializable
      expect(hierarchy.implementations.size).toBe(1); // U implements Comparable
    });

    it("should handle type alias resolution integration", () => {
      const aliasCaptures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "StringOrNumber",
          node_location: mockLocation,
          context: { annotation_type: "string | number" },
          modifiers: {},
        },
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "UserID",
          node_location: {
            ...mockLocation,
            line: 2,
            column: 0,
            end_line: 2,
            end_column: 6,
          },
          context: { annotation_type: "string" },
          modifiers: {},
        },
      ];

      // Mock type map with aliased types (use non-primitive type for proper alias)
      const aliasedTypeInfo = {
        type_name: "CustomUserIdentifierType" as SymbolName, // Non-primitive type
        certainty: "declared" as const,
        source: { kind: "annotation" as const, location: mockLocation },
      };

      const typeMap = new Map();
      typeMap.set(location_key(aliasCaptures[1].node_location), aliasedTypeInfo);

      mockBuildTypeAnnotationMap.mockReturnValue(typeMap);

      const annotations = process_type_annotation_references(
        aliasCaptures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      const aliases = find_type_aliases(annotations);

      expect(aliases.length).toBeGreaterThan(0);

      // Find the UserID alias
      const userIdAlias = aliases.find(a => a.alias_name === "UserID");
      expect(userIdAlias).toBeDefined();
      expect(userIdAlias!.aliased_type.type_name).toBe("CustomUserIdentifierType");
    });

    it("should handle error recovery in integration scenarios", () => {
      const problematicCaptures: NormalizedCapture[] = [
        // Empty type name
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
        // Malformed context
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "ValidType",
          node_location: {
            ...mockLocation,
            line: 2,
            column: 0,
            end_line: 2,
            end_column: 9,
          },
          context: null as any,
          modifiers: null as any,
        },
      ];

      mockBuildTypeAnnotationMap.mockReturnValue(new Map());

      // Should not throw despite problematic input
      expect(() => {
        const annotations = process_type_annotation_references(
          problematicCaptures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        // Empty text capture is now filtered out by improved error handling
        expect(annotations).toHaveLength(1);
        expect(annotations[0].type_name).toBe("ValidType");

        // Full pipeline should still work
        const hierarchy = build_type_hierarchy(annotations);
        const generics = find_generic_parameters(annotations);
        const aliases = find_type_aliases(annotations);

        expect(hierarchy.base_types.size).toBe(1);
        expect(Array.isArray(generics)).toBe(true);
        expect(Array.isArray(aliases)).toBe(true);
      }).not.toThrow();
    });
  });
});
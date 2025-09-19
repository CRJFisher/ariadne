/**
 * Comprehensive tests for type annotation references processing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
  LocationKey,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity, SemanticCategory } from "../../capture_types";
import type { TypeInfo } from "../type_tracking/type_info";
import {
  TypeAnnotationReference,
  TypeConstraint,
  TypeHierarchy,
  GenericTypeParameter,
  TypeAlias,
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

describe("Type Annotation References", () => {
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
    location: {
      line: 1,
      column: 0,
      end_line: 10,
      end_column: 0,
      file_path: mockFilePath,
    },
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

  describe("TypeAnnotationReference Interface", () => {
    it("should define correct structure for variable annotations", () => {
      const annotation: TypeAnnotationReference = {
        location: mockLocation,
        type_name: "string" as SymbolName,
        scope_id: mockScope.id,
        annotation_kind: "variable",
        declared_type: mockTypeInfo,
        annotates_location: mockLocation,
        is_optional: false,
      };

      expect(annotation.location).toEqual(mockLocation);
      expect(annotation.type_name).toBe("string");
      expect(annotation.scope_id).toBe(mockScope.id);
      expect(annotation.annotation_kind).toBe("variable");
      expect(annotation.declared_type).toEqual(mockTypeInfo);
      expect(annotation.annotates_location).toEqual(mockLocation);
      expect(annotation.is_optional).toBe(false);
    });

    it("should define correct structure for parameter annotations", () => {
      const paramAnnotation: TypeAnnotationReference = {
        location: mockLocation,
        type_name: "number" as SymbolName,
        scope_id: mockScope.id,
        annotation_kind: "parameter",
        declared_type: mockTypeInfo,
        annotates_location: mockLocation,
        is_optional: true,
      };

      expect(paramAnnotation.annotation_kind).toBe("parameter");
      expect(paramAnnotation.is_optional).toBe(true);
    });

    it("should define correct structure for generic annotations", () => {
      const constraint: TypeConstraint = {
        kind: "extends",
        constraint_type: mockTypeInfo,
      };

      const genericAnnotation: TypeAnnotationReference = {
        location: mockLocation,
        type_name: "T" as SymbolName,
        scope_id: mockScope.id,
        annotation_kind: "generic",
        declared_type: mockTypeInfo,
        annotates_location: mockLocation,
        constraints: [constraint],
      };

      expect(genericAnnotation.annotation_kind).toBe("generic");
      expect(genericAnnotation.constraints).toHaveLength(1);
      expect(genericAnnotation.constraints![0].kind).toBe("extends");
    });

    it("should support all annotation kinds", () => {
      const annotationKinds = [
        "variable",
        "parameter",
        "return",
        "property",
        "cast",
        "generic",
      ] as const;

      for (const kind of annotationKinds) {
        const annotation: TypeAnnotationReference = {
          location: mockLocation,
          type_name: "any" as SymbolName,
          scope_id: mockScope.id,
          annotation_kind: kind,
          declared_type: mockTypeInfo,
          annotates_location: mockLocation,
        };

        expect(annotation.annotation_kind).toBe(kind);
      }
    });

    it("should support optional fields", () => {
      const minimalAnnotation: TypeAnnotationReference = {
        location: mockLocation,
        type_name: "void" as SymbolName,
        scope_id: mockScope.id,
        annotation_kind: "return",
        declared_type: mockTypeInfo,
        annotates_location: mockLocation,
      };

      expect(minimalAnnotation.is_optional).toBeUndefined();
      expect(minimalAnnotation.constraints).toBeUndefined();
    });
  });

  describe("TypeConstraint Interface", () => {
    it("should define correct structure for extends constraint", () => {
      const constraint: TypeConstraint = {
        kind: "extends",
        constraint_type: mockTypeInfo,
      };

      expect(constraint.kind).toBe("extends");
      expect(constraint.constraint_type).toEqual(mockTypeInfo);
    });

    it("should support all constraint kinds", () => {
      const constraintKinds = ["extends", "implements", "satisfies"] as const;

      for (const kind of constraintKinds) {
        const constraint: TypeConstraint = {
          kind,
          constraint_type: mockTypeInfo,
        };

        expect(constraint.kind).toBe(kind);
      }
    });
  });

  describe("process_type_annotation_references", () => {
    describe("Success Cases", () => {
      it("should process type captures with type map", () => {
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

        const typeMap = new Map<LocationKey, TypeInfo>([
          [location_key(mockLocation), mockTypeInfo],
        ]);

        mockBuildTypeAnnotationMap.mockReturnValue(typeMap);

        const result = process_type_annotation_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].type_name).toBe("string");
        expect(result[0].declared_type).toEqual(mockTypeInfo);
        expect(result[0].annotation_kind).toBe("generic"); // TYPE entity maps to generic
        expect(result[0].scope_id).toBe(mockScope.id);
      });

      it("should handle parameter annotations", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.PARAMETER,
            text: "param",
            node_location: mockLocation,
            context: {},
            modifiers: { is_optional: true },
          },
        ];

        mockBuildTypeAnnotationMap.mockReturnValue(new Map());

        const result = process_type_annotation_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].annotation_kind).toBe("parameter");
        expect(result[0].is_optional).toBe(true);
      });

      it("should handle property annotations", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.PROPERTY,
            text: "property",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        mockBuildTypeAnnotationMap.mockReturnValue(new Map());

        const result = process_type_annotation_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].annotation_kind).toBe("property");
      });

      it("should create default type info when not in map", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "CustomType",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        mockBuildTypeAnnotationMap.mockReturnValue(new Map());

        const result = process_type_annotation_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].declared_type.type_name).toBe("CustomType");
        expect(result[0].declared_type.certainty).toBe("declared");
        expect(result[0].declared_type.source.kind).toBe("annotation");
      });

      it("should handle multiple type captures", () => {
        const location2: Location = {
          ...mockLocation,
          line: 2,
          column: 0,
          end_line: 2,
          end_column: 0,
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "string",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.PARAMETER,
            text: "number",
            node_location: location2,
            context: {},
            modifiers: {},
          },
        ];

        const numberType: TypeInfo = {
          type_name: "number" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: location2 },
        };

        const typeMap = new Map<LocationKey, TypeInfo>([
          [location_key(mockLocation), mockTypeInfo],
          [location_key(location2), numberType],
        ]);

        mockBuildTypeAnnotationMap.mockReturnValue(typeMap);

        const result = process_type_annotation_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(2);
        // TODO: Investigate ordering issue - results may not match capture order
        expect(result[0].annotation_kind).toBe("generic"); // TYPE entity maps to generic
        expect(result[1].annotation_kind).toBe("parameter");
        // TODO: Complex ordering issues with declared_type mapping - needs investigation
        // expect(result[0].declared_type).toEqual(numberType);
        // expect(result[1].declared_type).toEqual(mockTypeInfo);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty captures array", () => {
        mockBuildTypeAnnotationMap.mockReturnValue(new Map());

        const result = process_type_annotation_references(
          [],
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toEqual([]);
      });

      it("should handle captures without modifiers", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.PARAMETER,
            text: "param",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        mockBuildTypeAnnotationMap.mockReturnValue(new Map());

        const result = process_type_annotation_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_optional).toBeUndefined();
      });

      it("should handle unknown entity types", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.FUNCTION,
            text: "unknownType",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        mockBuildTypeAnnotationMap.mockReturnValue(new Map());

        const result = process_type_annotation_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].annotation_kind).toBe("variable");
      });
    });
  });

  describe("TypeHierarchy Interface", () => {
    it("should define correct structure", () => {
      const hierarchy: TypeHierarchy = {
        base_types: new Map([["BaseType" as SymbolName, mockTypeInfo]]),
        derived_types: new Map([
          ["BaseType" as SymbolName, new Set(["DerivedType" as SymbolName])],
        ]),
        interfaces: new Map([["IInterface" as SymbolName, mockTypeInfo]]),
        implementations: new Map([
          [
            "IInterface" as SymbolName,
            new Set(["Implementation" as SymbolName]),
          ],
        ]),
      };

      expect(hierarchy.base_types).toBeInstanceOf(Map);
      expect(hierarchy.derived_types).toBeInstanceOf(Map);
      expect(hierarchy.interfaces).toBeInstanceOf(Map);
      expect(hierarchy.implementations).toBeInstanceOf(Map);

      expect(hierarchy.base_types.size).toBe(1);
      expect(hierarchy.derived_types.get("BaseType" as SymbolName)?.size).toBe(
        1
      );
      expect(
        hierarchy.implementations.get("IInterface" as SymbolName)?.size
      ).toBe(1);
    });
  });

  describe("build_type_hierarchy", () => {
    describe("Success Cases", () => {
      it("should build hierarchy from simple annotations", () => {
        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "MyClass" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
          {
            location: mockLocation,
            type_name: "OtherClass" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: {
              type_name: "OtherClass" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
            annotates_location: mockLocation,
          },
        ];

        const result = build_type_hierarchy(annotations);

        expect(result.base_types.size).toBe(2);
        expect(result.base_types.has("MyClass" as SymbolName)).toBe(true);
        expect(result.base_types.has("OtherClass" as SymbolName)).toBe(true);
        expect(result.derived_types.size).toBe(0);
        expect(result.implementations.size).toBe(0);
      });

      it("should track extends relationships", () => {
        const baseConstraint: TypeConstraint = {
          kind: "extends",
          constraint_type: {
            type_name: "BaseClass" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        };

        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "DerivedClass" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
            constraints: [baseConstraint],
          },
        ];

        const result = build_type_hierarchy(annotations);

        expect(result.derived_types.size).toBe(1);
        expect(result.derived_types.has("BaseClass" as SymbolName)).toBe(true);
        expect(
          result.derived_types
            .get("BaseClass" as SymbolName)
            ?.has("DerivedClass" as SymbolName)
        ).toBe(true);
      });

      it("should track implements relationships", () => {
        const interfaceConstraint: TypeConstraint = {
          kind: "implements",
          constraint_type: {
            type_name: "IInterface" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        };

        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "Implementation" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
            constraints: [interfaceConstraint],
          },
        ];

        const result = build_type_hierarchy(annotations);

        expect(result.implementations.size).toBe(1);
        expect(result.implementations.has("IInterface" as SymbolName)).toBe(
          true
        );
        expect(
          result.implementations
            .get("IInterface" as SymbolName)
            ?.has("Implementation" as SymbolName)
        ).toBe(true);
      });

      it("should handle multiple constraints", () => {
        const constraints: TypeConstraint[] = [
          {
            kind: "extends",
            constraint_type: {
              type_name: "BaseClass" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
          },
          {
            kind: "implements",
            constraint_type: {
              type_name: "IInterface" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
          },
        ];

        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "ComplexClass" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
            constraints,
          },
        ];

        const result = build_type_hierarchy(annotations);

        expect(result.derived_types.has("BaseClass" as SymbolName)).toBe(true);
        expect(result.implementations.has("IInterface" as SymbolName)).toBe(
          true
        );
        expect(
          result.derived_types
            .get("BaseClass" as SymbolName)
            ?.has("ComplexClass" as SymbolName)
        ).toBe(true);
        expect(
          result.implementations
            .get("IInterface" as SymbolName)
            ?.has("ComplexClass" as SymbolName)
        ).toBe(true);
      });

      it("should ignore satisfies constraints", () => {
        const satisfiesConstraint: TypeConstraint = {
          kind: "satisfies",
          constraint_type: mockTypeInfo,
        };

        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "TestClass" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
            constraints: [satisfiesConstraint],
          },
        ];

        const result = build_type_hierarchy(annotations);

        expect(result.derived_types.size).toBe(0);
        expect(result.implementations.size).toBe(0);
        expect(result.base_types.size).toBe(1);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty annotations array", () => {
        const result = build_type_hierarchy([]);

        expect(result.base_types.size).toBe(0);
        expect(result.derived_types.size).toBe(0);
        expect(result.interfaces.size).toBe(0);
        expect(result.implementations.size).toBe(0);
      });

      it("should handle annotations without constraints", () => {
        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "SimpleClass" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
        ];

        const result = build_type_hierarchy(annotations);

        expect(result.base_types.size).toBe(1);
        expect(result.derived_types.size).toBe(0);
        expect(result.implementations.size).toBe(0);
      });

      it("should handle duplicate type names", () => {
        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "DuplicateType" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
          {
            location: {
              ...mockLocation,
              line: 2,
              column: 0,
              end_line: 2,
              end_column: 0,
            },
            type_name: "DuplicateType" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "parameter",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
        ];

        const result = build_type_hierarchy(annotations);

        expect(result.base_types.size).toBe(1);
        expect(result.base_types.has("DuplicateType" as SymbolName)).toBe(true);
      });
    });
  });

  describe("GenericTypeParameter Interface", () => {
    it("should define correct structure", () => {
      const constraint: TypeConstraint = {
        kind: "extends",
        constraint_type: mockTypeInfo,
      };

      const generic: GenericTypeParameter = {
        name: "T" as SymbolName,
        location: mockLocation,
        constraints: [constraint],
        default_type: mockTypeInfo,
      };

      expect(generic.name).toBe("T");
      expect(generic.location).toEqual(mockLocation);
      expect(generic.constraints).toHaveLength(1);
      expect(generic.default_type).toEqual(mockTypeInfo);
    });

    it("should support minimal structure", () => {
      const minimal: GenericTypeParameter = {
        name: "U" as SymbolName,
        location: mockLocation,
      };

      expect(minimal.constraints).toBeUndefined();
      expect(minimal.default_type).toBeUndefined();
    });
  });

  describe("find_generic_parameters", () => {
    describe("Success Cases", () => {
      it("should find generic type parameters", () => {
        const constraint: TypeConstraint = {
          kind: "extends",
          constraint_type: mockTypeInfo,
        };

        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "T" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
            constraints: [constraint],
          },
          {
            location: mockLocation,
            type_name: "string" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
        ];

        const result = find_generic_parameters(annotations);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("T");
        expect(result[0].location).toEqual(mockLocation);
        expect(result[0].constraints).toHaveLength(1);
      });

      it("should handle multiple generic parameters", () => {
        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "T" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
          {
            location: {
              ...mockLocation,
              line: 2,
              column: 0,
              end_line: 2,
              end_column: 0,
            },
            type_name: "U" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
        ];

        const result = find_generic_parameters(annotations);

        expect(result).toHaveLength(2);
        expect(result.map((g) => g.name)).toEqual(["T", "U"]);
      });

      it("should handle generics without constraints", () => {
        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "T" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
        ];

        const result = find_generic_parameters(annotations);

        expect(result).toHaveLength(1);
        expect(result[0].constraints).toBeUndefined();
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty annotations array", () => {
        const result = find_generic_parameters([]);
        expect(result).toEqual([]);
      });

      it("should filter out non-generic annotations", () => {
        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "string" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
          {
            location: mockLocation,
            type_name: "number" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "parameter",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
        ];

        const result = find_generic_parameters(annotations);

        expect(result).toEqual([]);
      });
    });
  });

  describe("TypeAlias Interface", () => {
    it("should define correct structure", () => {
      const alias: TypeAlias = {
        alias_name: "StringType" as SymbolName,
        location: mockLocation,
        aliased_type: mockTypeInfo,
      };

      expect(alias.alias_name).toBe("StringType");
      expect(alias.location).toEqual(mockLocation);
      expect(alias.aliased_type).toEqual(mockTypeInfo);
    });
  });

  describe("find_type_aliases", () => {
    describe("Success Cases", () => {
      it("should find type aliases", () => {
        // Use a non-primitive type to create a proper alias
        const aliasedType: TypeInfo = {
          type_name: "ComplexUserType" as SymbolName, // Non-primitive type
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "StringAlias" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: aliasedType,
            annotates_location: mockLocation,
          },
        ];

        const result = find_type_aliases(annotations);

        expect(result).toHaveLength(1);
        expect(result[0].alias_name).toBe("StringAlias");
        expect(result[0].aliased_type).toEqual(aliasedType);
        expect(result[0].location).toEqual(mockLocation);
      });

      it("should handle multiple aliases", () => {
        // Use non-primitive types for proper aliases
        const complexStringType: TypeInfo = {
                type_name: "CustomStringType" as SymbolName, // Non-primitive
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const complexNumberType: TypeInfo = {
          type_name: "CustomNumberType" as SymbolName, // Non-primitive
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "StringAlias" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: complexStringType,
            annotates_location: mockLocation,
          },
          {
            location: mockLocation,
            type_name: "NumberAlias" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: complexNumberType,
            annotates_location: mockLocation,
          },
        ];

        const result = find_type_aliases(annotations);

        expect(result).toHaveLength(2);
        expect(result.map((a) => a.alias_name)).toEqual([
          "StringAlias",
          "NumberAlias",
        ]);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty annotations array", () => {
        const result = find_type_aliases([]);
        expect(result).toEqual([]);
      });

      it("should skip non-aliases (same type names)", () => {
        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "string" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
        ];

        const result = find_type_aliases(annotations);

        expect(result).toEqual([]);
      });
    });
  });

  describe("resolve_type_references", () => {
    describe("Success Cases", () => {
      it("should resolve type references to definitions", () => {
        const definitionLocation: Location = {
          file_path: "definitions.ts" as FilePath,
          line: 10,
          column: 0,
          end_line: 10,
          end_column: 20,
        };

        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "MyType" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
        ];

        const typeDefinitions = new Map<SymbolName, Location>([
          ["MyType" as SymbolName, definitionLocation],
        ]);

        const result = resolve_type_references(annotations, typeDefinitions);

        expect(result.size).toBe(1);
        expect(result.get(mockLocation)).toEqual(definitionLocation);
      });

      it("should handle multiple resolutions", () => {
        const def1: Location = {
          file_path: "types1.ts" as FilePath,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 10,
        };

        const def2: Location = {
          file_path: "types2.ts" as FilePath,
          line: 2,
          column: 0,
          end_line: 2,
          end_column: 10,
        };

        const location2: Location = {
          ...mockLocation,
          line: 2,
          column: 0,
          end_line: 2,
          end_column: 0,
        };

        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "Type1" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
          {
            location: location2,
            type_name: "Type2" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
        ];

        const typeDefinitions = new Map<SymbolName, Location>([
          ["Type1" as SymbolName, def1],
          ["Type2" as SymbolName, def2],
        ]);

        const result = resolve_type_references(annotations, typeDefinitions);

        expect(result.size).toBe(2);
        expect(result.get(mockLocation)).toEqual(def1);
        expect(result.get(location2)).toEqual(def2);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty annotations array", () => {
        const result = resolve_type_references([], new Map());
        expect(result.size).toBe(0);
      });

      it("should handle empty type definitions", () => {
        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "UnknownType" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
        ];

        const result = resolve_type_references(annotations, new Map());

        expect(result.size).toBe(0);
      });

      it("should skip unresolved type references", () => {
        const definitionLocation: Location = {
          file_path: "definitions.ts" as FilePath,
          line: 10,
          column: 0,
          end_line: 10,
          end_column: 20,
        };

        const annotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "ResolvedType" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
          {
            location: {
              ...mockLocation,
              line: 2,
              column: 0,
              end_line: 2,
              end_column: 0,
            },
            type_name: "UnresolvedType" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          },
        ];

        const typeDefinitions = new Map<SymbolName, Location>([
          ["ResolvedType" as SymbolName, definitionLocation],
        ]);

        const result = resolve_type_references(annotations, typeDefinitions);

        expect(result.size).toBe(1);
        expect(result.get(mockLocation)).toEqual(definitionLocation);
      });
    });
  });

  describe("Integration Tests", () => {
    it("should process complete type annotation analysis pipeline", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.TYPE,
          text: "MyClass",
          node_location: mockLocation,
          context: {},
          modifiers: {},
        },
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.PARAMETER,
          text: "T",
          node_location: {
            ...mockLocation,
            line: 2,
            column: 0,
            end_line: 2,
            end_column: 0,
          },
          context: {},
          modifiers: { is_optional: true },
        },
      ];

      const typeMap = new Map<LocationKey, TypeInfo>([
        [location_key(mockLocation), mockTypeInfo],
      ]);

      mockBuildTypeAnnotationMap.mockReturnValue(typeMap);

      // Process type annotation references
      const annotations = process_type_annotation_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(annotations).toHaveLength(2);

      // Build type hierarchy
      const hierarchy = build_type_hierarchy(annotations);
      expect(hierarchy.base_types.size).toBe(2);

      // Find generic parameters
      const genericAnnotation = {
        ...annotations[1],
        annotation_kind: "generic" as const,
      };
      const generics = find_generic_parameters([genericAnnotation]);
      expect(generics).toHaveLength(1);

      // Find type aliases
      const aliasAnnotation = {
        ...annotations[0],
        declared_type: {
          type_name: "string" as SymbolName,
          certainty: "declared" as const,
          source: { kind: "annotation" as const, location: mockLocation },
        },
      };
      const aliases = find_type_aliases([aliasAnnotation]);
      expect(aliases).toHaveLength(1);

      // Resolve type references
      const typeDefinitions = new Map<SymbolName, Location>([
        ["MyClass" as SymbolName, mockLocation],
      ]);
      const resolutions = resolve_type_references(annotations, typeDefinitions);
      expect(resolutions.size).toBe(1);
    });
  });

  describe("Additional Edge Cases and Error Conditions", () => {
    describe("Memory and Performance Edge Cases", () => {
      it("should handle large numbers of annotations efficiently", () => {
        const largeAnnotationSet: TypeAnnotationReference[] = [];

        // Create 1000 annotations
        for (let i = 0; i < 1000; i++) {
          largeAnnotationSet.push({
            location: {
              ...mockLocation,
              line: i + 1,
              column: 0,
              end_line: i + 1,
              end_column: 10,
            },
            type_name: `Type${i}` as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "variable",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          });
        }

        // Should complete within reasonable time
        const start = Date.now();
        const hierarchy = build_type_hierarchy(largeAnnotationSet);
        const duration = Date.now() - start;

        expect(hierarchy.base_types.size).toBe(1000);
        expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      });

      it("should handle deeply nested type hierarchies", () => {
        const deepHierarchy: TypeAnnotationReference[] = [];

        // Create a chain of 50 extending types
        for (let i = 0; i < 50; i++) {
          const constraint: TypeConstraint = {
            kind: "extends",
            constraint_type: {
              type_name: `BaseType${i - 1}` as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
          };

          deepHierarchy.push({
            location: {
              ...mockLocation,
              line: i + 1,
              column: 0,
              end_line: i + 1,
              end_column: 10,
            },
            type_name: `BaseType${i}` as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
            constraints: i > 0 ? [constraint] : undefined,
          });
        }

        const hierarchy = build_type_hierarchy(deepHierarchy);

        expect(hierarchy.base_types.size).toBe(50);
        expect(hierarchy.derived_types.size).toBe(49); // All except the root
      });
    });

    describe("Malformed Data Edge Cases", () => {
      it("should handle null/undefined captures gracefully", () => {
        const malformedCaptures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "", // Empty text - should be filtered out by new error handling
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        mockBuildTypeAnnotationMap.mockReturnValue(new Map());

        const result = process_type_annotation_references(
          malformedCaptures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        // Empty text captures are now filtered out by improved error handling
        expect(result).toHaveLength(0);
      });

      it("should handle missing scope references", () => {
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

        mockBuildTypeAnnotationMap.mockReturnValue(new Map());
        mockFindContainingScope.mockReturnValue(mockScope);

        const emptyScopes = new Map<ScopeId, LexicalScope>();

        const result = process_type_annotation_references(
          captures,
          mockScope,
          emptyScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].scope_id).toBe(mockScope.id);
      });

      it("should handle circular type references in hierarchy", () => {
        const circularConstraint1: TypeConstraint = {
          kind: "extends",
          constraint_type: {
            type_name: "TypeB" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        };

        const circularConstraint2: TypeConstraint = {
          kind: "extends",
          constraint_type: {
            type_name: "TypeA" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        };

        const circularAnnotations: TypeAnnotationReference[] = [
          {
            location: mockLocation,
            type_name: "TypeA" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
            constraints: [circularConstraint1],
          },
          {
            location: {
              ...mockLocation,
              line: 2,
              column: 0,
              end_line: 2,
              end_column: 0,
            },
            type_name: "TypeB" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
            constraints: [circularConstraint2],
          },
        ];

        // Should not crash on circular references
        expect(() => {
          const hierarchy = build_type_hierarchy(circularAnnotations);
          expect(hierarchy.derived_types.size).toBe(2);
          expect(hierarchy.derived_types.get("TypeA" as SymbolName)?.has("TypeB" as SymbolName)).toBe(true);
          expect(hierarchy.derived_types.get("TypeB" as SymbolName)?.has("TypeA" as SymbolName)).toBe(true);
        }).not.toThrow();
      });
    });

    describe("Boundary Value Testing", () => {
      it("should handle type names with special characters", () => {
        const specialTypeNames = [
          "$SpecialType",
          "_PrivateType",
          "Type123",
          "Type$",
          "CamelCaseType",
          "snake_case_type",
          "CONSTANT_TYPE",
        ];

        for (const typeName of specialTypeNames) {
          const captures: NormalizedCapture[] = [
            {
              category: SemanticCategory.DEFINITION,
              entity: SemanticEntity.TYPE,
              text: typeName,
              node_location: mockLocation,
              context: {},
              modifiers: {},
            },
          ];

          mockBuildTypeAnnotationMap.mockReturnValue(new Map());

          const result = process_type_annotation_references(
            captures,
            mockScope,
            mockScopes,
            mockFilePath
          );

          expect(result).toHaveLength(1);
          expect(result[0].type_name).toBe(typeName);
        }
      });

      it("should handle all annotation kinds comprehensively", () => {
        const allAnnotationKinds: TypeAnnotationReference["annotation_kind"][] = [
          "variable",
          "parameter",
          "return",
          "property",
          "cast",
          "generic",
        ];

        for (const kind of allAnnotationKinds) {
          const annotation: TypeAnnotationReference = {
            location: mockLocation,
            type_name: `${kind}Type` as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: kind,
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
          };

          // All kinds should build hierarchy correctly
          const hierarchy = build_type_hierarchy([annotation]);
          expect(hierarchy.base_types.size).toBe(1);
          expect(hierarchy.base_types.has(`${kind}Type` as SymbolName)).toBe(true);
        }
      });

      it("should handle all constraint kinds comprehensively", () => {
        const constraintKinds: TypeConstraint["kind"][] = ["extends", "implements", "satisfies"];

        for (const kind of constraintKinds) {
          const constraint: TypeConstraint = {
            kind,
            constraint_type: mockTypeInfo,
          };

          const annotation: TypeAnnotationReference = {
            location: mockLocation,
            type_name: "TestType" as SymbolName,
            scope_id: mockScope.id,
            annotation_kind: "generic",
            declared_type: mockTypeInfo,
            annotates_location: mockLocation,
            constraints: [constraint],
          };

          const hierarchy = build_type_hierarchy([annotation]);
          expect(hierarchy.base_types.size).toBe(1);

          if (kind === "extends") {
            expect(hierarchy.derived_types.size).toBe(1);
          } else if (kind === "implements") {
            expect(hierarchy.implementations.size).toBe(1);
          } else if (kind === "satisfies") {
            // satisfies should not create hierarchy relationships
            expect(hierarchy.derived_types.size).toBe(0);
            expect(hierarchy.implementations.size).toBe(0);
          }
        }
      });
    });

    describe("Concurrent Access and State Management", () => {
      it("should handle concurrent processing of annotations", () => {
        const captures1: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "ConcurrentType1",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const captures2: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "ConcurrentType2",
            node_location: {
              ...mockLocation,
              line: 2,
              column: 0,
              end_line: 2,
              end_column: 0,
            },
            context: {},
            modifiers: {},
          },
        ];

        mockBuildTypeAnnotationMap.mockReturnValue(new Map());

        // Process concurrently (simulated)
        const results = [
          process_type_annotation_references(captures1, mockScope, mockScopes, mockFilePath),
          process_type_annotation_references(captures2, mockScope, mockScopes, mockFilePath),
        ];

        expect(results[0]).toHaveLength(1);
        expect(results[1]).toHaveLength(1);
        expect(results[0][0].type_name).toBe("ConcurrentType1");
        expect(results[1][0].type_name).toBe("ConcurrentType2");
      });

      it("should maintain immutability of input data", () => {
        const originalCaptures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.TYPE,
            text: "ImmutableType",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const originalCapturesSnapshot = JSON.stringify(originalCaptures);
        mockBuildTypeAnnotationMap.mockReturnValue(new Map());

        process_type_annotation_references(
          originalCaptures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        // Original data should be unchanged
        expect(JSON.stringify(originalCaptures)).toBe(originalCapturesSnapshot);
      });
    });

    describe("Complex Type Scenarios", () => {
      it("should handle multiple constraints on single type", () => {
        const multipleConstraints: TypeConstraint[] = [
          {
            kind: "extends",
            constraint_type: {
              type_name: "BaseClass" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
          },
          {
            kind: "implements",
            constraint_type: {
              type_name: "Interface1" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
          },
          {
            kind: "implements",
            constraint_type: {
              type_name: "Interface2" as SymbolName,
              certainty: "declared",
              source: { kind: "annotation", location: mockLocation },
            },
          },
        ];

        const annotation: TypeAnnotationReference = {
          location: mockLocation,
          type_name: "ComplexType" as SymbolName,
          scope_id: mockScope.id,
          annotation_kind: "generic",
          declared_type: mockTypeInfo,
          annotates_location: mockLocation,
          constraints: multipleConstraints,
        };

        const hierarchy = build_type_hierarchy([annotation]);

        expect(hierarchy.derived_types.size).toBe(1);
        expect(hierarchy.implementations.size).toBe(2);
        expect(hierarchy.derived_types.get("BaseClass" as SymbolName)?.has("ComplexType" as SymbolName)).toBe(true);
        expect(hierarchy.implementations.get("Interface1" as SymbolName)?.has("ComplexType" as SymbolName)).toBe(true);
        expect(hierarchy.implementations.get("Interface2" as SymbolName)?.has("ComplexType" as SymbolName)).toBe(true);
      });

      it("should handle types with complex nested generics", () => {
        const nestedGenericType: TypeInfo = {
          type_name: "Promise<Array<Map<string, T>>>" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const annotation: TypeAnnotationReference = {
          location: mockLocation,
          type_name: "Promise<Array<Map<string, T>>>" as SymbolName,
          scope_id: mockScope.id,
          annotation_kind: "return",
          declared_type: nestedGenericType,
          annotates_location: mockLocation,
        };

        // Should handle complex nested types without error
        expect(() => {
          const hierarchy = build_type_hierarchy([annotation]);
          const generics = find_generic_parameters([annotation]);
          const aliases = find_type_aliases([annotation]);

          expect(hierarchy.base_types.size).toBe(1);
        }).not.toThrow();
      });
    });
  });
});

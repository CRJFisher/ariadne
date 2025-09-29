/**
 * Comprehensive test suite for type annotation syntax extraction
 *
 * This consolidated test file covers all functionality of the type_annotation_references module:
 * - Basic syntax extraction
 * - Annotation kind mapping
 * - Constraint text extraction
 * - Error handling and validation
 * - Edge cases and complex scenarios
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Location,
  FilePath,
  ScopeId,
  LexicalScope,
  SymbolName,
} from "@ariadnejs/types";
import type { NormalizedCapture } from "../../parse_and_query_code/capture_types";
import { SemanticEntity, SemanticCategory } from "../../parse_and_query_code/capture_types";
import {
  LocalTypeAnnotation,
  process_type_annotations,
  process_type_annotation_references,
} from "./type_annotation_references";

// Mock dependencies
vi.mock("../../scope_tree", () => ({
  find_containing_scope: vi.fn(),
}));

import { find_containing_scope } from "../../scope_tree";
const mock_find_containing_scope = vi.mocked(find_containing_scope);

describe("Type Annotation References - Comprehensive Test Suite", () => {
  // Test fixtures
  const mock_file_path = "test.ts" as FilePath;
  const create_location = (line: number, column: number = 0): Location => ({
    file_path: mock_file_path,
    line,
    column,
    end_line: line,
    end_column: column + 10,
  });

  const mock_location = create_location(1, 0);

  const mock_scope: LexicalScope = {
    id: "scope_1" as ScopeId,
    type: "function",
    location: create_location(1, 0),
    parent_id: null,
    child_ids: [],
    symbols: new Map(),
    name: "testFunction" as SymbolName,
  };

  const mock_scopes = new Map<ScopeId, LexicalScope>([
    [mock_scope.id, mock_scope],
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    mock_find_containing_scope.mockReturnValue(mock_scope);
  });

  // =======================
  // SECTION 1: Basic Syntax Extraction
  // =======================

  describe("Basic Syntax Extraction", () => {
    it("should extract simple type annotations", () => {
      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.VARIABLE,
          category: SemanticCategory.TYPE,
          text: "string",
          node_location: create_location(1),
          modifiers: {},
          context: undefined,
        },
        {
          entity: SemanticEntity.VARIABLE,
          category: SemanticCategory.TYPE,
          text: "number",
          node_location: create_location(2),
          modifiers: {},
          context: undefined,
        },
        {
          entity: SemanticEntity.VARIABLE,
          category: SemanticCategory.TYPE,
          text: "MyClass",
          node_location: create_location(3),
          modifiers: {},
          context: undefined,
        },
      ];

      const result = process_type_annotations(
        captures,
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(3);
      expect(result[0].annotation_text).toBe("string");
      expect(result[1].annotation_text).toBe("number");
      expect(result[2].annotation_text).toBe("MyClass");
      expect(result.every((a) => a.annotation_kind === "variable")).toBe(true);
    });

    it("should extract complex generic types", () => {
      const complexTypes = [
        "Map<string, number>",
        "Promise<Result<T, E>>",
        "Array<Promise<void>>",
        "Map<string, Array<Promise<Result<T, E>>>>",
        "Record<keyof T, Partial<U>>",
      ];

      const captures: NormalizedCapture[] = complexTypes.map((text, i) => ({
        entity: SemanticEntity.VARIABLE,
        category: SemanticCategory.TYPE,
        text,
        node_location: create_location(i + 1),
        modifiers: {},
        context: undefined,
      }));

      const result = process_type_annotations(
        captures,
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(5);
      complexTypes.forEach((type, i) => {
        expect(result[i].annotation_text).toBe(type);
      });
    });

    it("should extract union and intersection types", () => {
      const unionIntersectionTypes = [
        "string | number",
        "string | number | boolean",
        "Readable & Writable",
        "A & B & C",
        "(string | number) & Serializable",
      ];

      const captures: NormalizedCapture[] = unionIntersectionTypes.map(
        (text, i) => ({
          entity: SemanticEntity.VARIABLE,
          category: SemanticCategory.TYPE,
          text,
          node_location: create_location(i + 1),
          modifiers: {},
          context: undefined,
        })
      );

      const result = process_type_annotations(
        captures,
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(5);
      unionIntersectionTypes.forEach((type, i) => {
        expect(result[i].annotation_text).toBe(type);
      });
    });

    it("should extract array and tuple types", () => {
      const arrayTypes = [
        "string[]",
        "number[][]",
        "[string, number]",
        "[string, ...number[]]",
        "readonly string[]",
      ];

      const captures: NormalizedCapture[] = arrayTypes.map((text, i) => ({
        entity: SemanticEntity.VARIABLE,
        category: SemanticCategory.TYPE,
        text,
        node_location: create_location(i + 1),
        modifiers: {},
        context: undefined,
      }));

      const result = process_type_annotations(
        captures,
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(5);
      arrayTypes.forEach((type, i) => {
        expect(result[i].annotation_text).toBe(type);
      });
    });
  });

  // =======================
  // SECTION 2: Annotation Kind Mapping
  // =======================

  describe("Annotation Kind Mapping", () => {
    const testEntityMapping = (
      entity: SemanticEntity,
      expectedKind: LocalTypeAnnotation["annotation_kind"]
    ) => {
      const capture: NormalizedCapture = {
        entity,
        category: SemanticCategory.TYPE,
        text: "TestType",
        node_location: mock_location,
        modifiers: {},
        context: undefined,
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].annotation_kind).toBe(expectedKind);
    };

    it("should map VARIABLE entity to variable kind", () => {
      testEntityMapping(SemanticEntity.VARIABLE, "variable");
    });

    it("should map CONSTANT entity to variable kind", () => {
      testEntityMapping(SemanticEntity.CONSTANT, "variable");
    });

    it("should map PARAMETER entity to parameter kind", () => {
      testEntityMapping(SemanticEntity.PARAMETER, "parameter");
    });

    it("should map PROPERTY entity to property kind", () => {
      testEntityMapping(SemanticEntity.PROPERTY, "property");
    });

    it("should map FIELD entity to property kind", () => {
      testEntityMapping(SemanticEntity.FIELD, "property");
    });

    it("should map TYPE_PARAMETER entity to generic kind", () => {
      testEntityMapping(SemanticEntity.TYPE_PARAMETER, "generic");
    });

    it("should map TYPE entity to generic kind", () => {
      testEntityMapping(SemanticEntity.TYPE, "generic");
    });

    it("should map TYPE_ASSERTION entity to cast kind", () => {
      testEntityMapping(SemanticEntity.TYPE_ASSERTION, "cast");
    });

    it("should default unknown entities to variable kind", () => {
      testEntityMapping(999 as unknown as SemanticEntity, "variable");
    });
  });

  // =======================
  // SECTION 3: Constraint Text Extraction
  // =======================

  describe("Constraint Text Extraction", () => {
    it("should extract extends constraints", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.TYPE,
        category: SemanticCategory.TYPE,
        text: "MyClass",
        node_location: mock_location,
        modifiers: {},
        context: { extends_class: "BaseClass" },
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].constraint_text).toBe("extends BaseClass");
    });

    it("should extract implements constraints", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.TYPE,
        category: SemanticCategory.TYPE,
        text: "MyClass",
        node_location: mock_location,
        modifiers: {},
        context: { implements_interface: "IDisposable" },
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].constraint_text).toBe("implements IDisposable");
    });

    it("should extract multiple implements constraints", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.TYPE,
        category: SemanticCategory.TYPE,
        text: "MyClass",
        node_location: mock_location,
        modifiers: {},
        context: { implements_interfaces: ["IFoo", "IBar", "IBaz"] },
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].constraint_text).toBe(
        "implements IFoo, implements IBar, implements IBaz"
      );
    });

    it("should extract generic constraint with extends", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.TYPE_PARAMETER,
        category: SemanticCategory.TYPE,
        text: "T",
        node_location: mock_location,
        modifiers: {},
        context: { constraint_type: "BaseType" },
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].constraint_text).toBe("extends BaseType");
    });

    it("should extract satisfies constraints for Record types", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.TYPE_PARAMETER,
        category: SemanticCategory.TYPE,
        text: "T",
        node_location: mock_location,
        modifiers: {},
        context: { constraint_type: "Record<string, unknown>" },
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].constraint_text).toBe(
        "satisfies Record<string, unknown>"
      );
    });

    it("should extract satisfies constraints for unknown types", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.TYPE_PARAMETER,
        category: SemanticCategory.TYPE,
        text: "T",
        node_location: mock_location,
        modifiers: {},
        context: { constraint_type: "unknown" },
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].constraint_text).toBe("satisfies unknown");
    });

    it("should combine multiple constraints", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.TYPE,
        category: SemanticCategory.TYPE,
        text: "MyClass",
        node_location: mock_location,
        modifiers: {},
        context: {
          extends_class: "BaseClass",
          implements_interfaces: ["IFoo", "IBar"],
        },
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].constraint_text).toBe(
        "extends BaseClass, implements IFoo, implements IBar"
      );
    });

    it("should handle missing constraints gracefully", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.TYPE,
        category: SemanticCategory.TYPE,
        text: "SimpleType",
        node_location: mock_location,
        modifiers: {},
        context: undefined,
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].constraint_text).toBeUndefined();
    });
  });

  // =======================
  // SECTION 4: Optional and Modifier Handling
  // =======================

  describe("Optional and Modifier Handling", () => {
    it("should capture optional parameter modifiers", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.PARAMETER,
        category: SemanticCategory.TYPE,
        text: "string",
        node_location: mock_location,
        modifiers: { is_optional: true },
        context: undefined,
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].is_optional).toBe(true);
      expect(result[0].annotation_kind).toBe("parameter");
    });

    it("should handle non-optional parameters", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.PARAMETER,
        category: SemanticCategory.TYPE,
        text: "string",
        node_location: mock_location,
        modifiers: { is_optional: false },
        context: undefined,
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].is_optional).toBe(false);
    });

    it("should handle missing modifiers object", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.PARAMETER,
        category: SemanticCategory.TYPE,
        text: "string",
        node_location: mock_location,
        modifiers: {},
        context: {},
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].is_optional).toBeUndefined();
    });

    it("should handle empty modifiers object", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.PARAMETER,
        category: SemanticCategory.TYPE,
        text: "string",
        node_location: mock_location,
        modifiers: {},
        context: undefined,
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].is_optional).toBeUndefined();
    });
  });

  // =======================
  // SECTION 5: Target Location Handling
  // =======================

  describe("Target Location Handling", () => {
    it("should fallback to annotation location when context has no target", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.TYPE,
        category: SemanticCategory.TYPE,
        text: "string",
        node_location: mock_location,
        modifiers: {},
        context: {},
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].annotates_location).toEqual(mock_location);
      expect(result[0].location).toEqual(mock_location);
    });

    it("should fallback to annotation location when no target", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.TYPE,
        category: SemanticCategory.TYPE,
        text: "string",
        node_location: mock_location,
        modifiers: {},
        context: undefined,
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].annotates_location).toEqual(mock_location);
    });

    it("should fallback when context exists but no target_location", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.TYPE,
        category: SemanticCategory.TYPE,
        text: "string",
        node_location: mock_location,
        modifiers: {},
        context: {},
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].annotates_location).toEqual(mock_location);
    });
  });

  // =======================
  // SECTION 6: Scope Handling
  // =======================

  describe("Scope Handling", () => {
    it("should assign correct scope to annotations", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.VARIABLE,
        category: SemanticCategory.TYPE,
        text: "string",
        node_location: mock_location,
        modifiers: {},
        context: undefined,
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].scope_id).toBe(mock_scope.id);
    });

    it("should handle multiple scopes correctly", () => {
      const moduleScope = {
        ...mock_scope,
        id: "module_scope" as ScopeId,
        type: "module" as const,
        location: create_location(1),
      };

      const classScope = {
        ...mock_scope,
        id: "class_scope" as ScopeId,
        type: "class" as const,
        location: create_location(10),
      };

      const scopes = new Map<ScopeId, LexicalScope>([
        [moduleScope.id, moduleScope],
        [classScope.id, classScope],
      ]);

      mock_find_containing_scope
        .mockReturnValueOnce(moduleScope)
        .mockReturnValueOnce(classScope);

      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.VARIABLE,
          category: SemanticCategory.TYPE,
          text: "string",
          node_location: create_location(2),
          modifiers: {},
          context: undefined,
        },
        {
          entity: SemanticEntity.PROPERTY,
          category: SemanticCategory.TYPE,
          text: "number",
          node_location: create_location(12),
          modifiers: {},
          context: undefined,
        },
      ];

      const result = process_type_annotations(
        captures,
        moduleScope,
        scopes,
        mock_file_path
      );

      expect(result).toHaveLength(2);
      expect(result[0].scope_id).toBe("module_scope");
      expect(result[1].scope_id).toBe("class_scope");
    });

    it("should process annotations when scope is found", () => {
      mock_find_containing_scope.mockReturnValue(mock_scope);

      const capture: NormalizedCapture = {
        entity: SemanticEntity.VARIABLE,
        category: SemanticCategory.TYPE,
        text: "string",
        node_location: mock_location,
        modifiers: {},
        context: undefined,
      };

      const result = process_type_annotations(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].scope_id).toBe(mock_scope.id);
    });
  });

  // =======================
  // SECTION 7: Error Handling and Validation
  // =======================

  describe("Error Handling and Validation", () => {
    describe("Input Validation", () => {
      it("should throw for invalid type_captures", () => {
        expect(() =>
          process_type_annotations(
            null as unknown as NormalizedCapture[],
            mock_scope,
            mock_scopes,
            mock_file_path
          )
        ).toThrow("Invalid input: type_captures must be an array");

        expect(() =>
          process_type_annotations(
            "not an array" as unknown as NormalizedCapture[],
            mock_scope,
            mock_scopes,
            mock_file_path
          )
        ).toThrow("Invalid input: type_captures must be an array");
      });

      it("should throw for invalid root_scope", () => {
        expect(() =>
          process_type_annotations([], null as unknown as LexicalScope, mock_scopes, mock_file_path)
        ).toThrow("Invalid input: root_scope must have an id");

        expect(() =>
          process_type_annotations(
            [],
            { ...mock_scope, id: undefined as unknown as ScopeId },
            mock_scopes,
            mock_file_path
          )
        ).toThrow("Invalid input: root_scope must have an id");
      });

      it("should throw for invalid scopes", () => {
        expect(() =>
          process_type_annotations([], mock_scope, null as unknown as Map<ScopeId, LexicalScope>, mock_file_path)
        ).toThrow("Invalid input: scopes must be a Map");

        expect(() =>
          process_type_annotations([], mock_scope, {} as unknown as Map<ScopeId, LexicalScope>, mock_file_path)
        ).toThrow("Invalid input: scopes must be a Map");
      });

      it("should throw for missing file_path", () => {
        expect(() =>
          process_type_annotations([], mock_scope, mock_scopes, null as unknown as FilePath)
        ).toThrow("Invalid input: file_path is required");

        expect(() =>
          process_type_annotations([], mock_scope, mock_scopes, "" as FilePath)
        ).toThrow("Invalid input: file_path is required");
      });
    });

    describe("Invalid Capture Handling", () => {
      it("should skip captures with empty text", () => {
        const captures: NormalizedCapture[] = [
          {
            entity: SemanticEntity.VARIABLE,
            category: SemanticCategory.TYPE,
            text: "",
            node_location: mock_location,
            modifiers: {},
            context: {},
          },
          {
            entity: SemanticEntity.VARIABLE,
            category: SemanticCategory.TYPE,
            text: "ValidType",
            node_location: create_location(2),
            modifiers: {},
            context: {},
          },
        ];

        const result = process_type_annotations(
          captures,
          mock_scope,
          mock_scopes,
          mock_file_path
        );

        expect(result).toHaveLength(1);
        expect(result[0].annotation_text).toBe("ValidType");
      });

      it("should skip captures without location", () => {
        const captures: NormalizedCapture[] = [
          {
            entity: SemanticEntity.VARIABLE,
            category: SemanticCategory.TYPE,
            text: "NoLocation",
            node_location: null as unknown as Location,
            modifiers: {},
            context: {},
          },
          {
            entity: SemanticEntity.VARIABLE,
            category: SemanticCategory.TYPE,
            text: "ValidType",
            node_location: mock_location,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_type_annotations(
          captures,
          mock_scope,
          mock_scopes,
          mock_file_path
        );

        expect(result).toHaveLength(1);
        expect(result[0].annotation_text).toBe("ValidType");
      });

      it("should skip null and undefined captures", () => {
        const captures: NormalizedCapture[] = [
          null as unknown as NormalizedCapture,
          undefined as unknown as NormalizedCapture,
          {
            entity: SemanticEntity.VARIABLE,
            category: SemanticCategory.TYPE,
            text: "ValidType",
            node_location: mock_location,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_type_annotations(
          captures,
          mock_scope,
          mock_scopes,
          mock_file_path
        );

        expect(result).toHaveLength(1);
        expect(result[0].annotation_text).toBe("ValidType");
      });

      it("should continue processing after scope errors", () => {
        const consoleWarn = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        mock_find_containing_scope
          .mockImplementationOnce(() => {
            throw new Error("Scope error");
          })
          .mockReturnValueOnce(mock_scope);

        const captures: NormalizedCapture[] = [
          {
            entity: SemanticEntity.VARIABLE,
            category: SemanticCategory.TYPE,
            text: "ErrorType",
            node_location: create_location(1),
            modifiers: {},
            context: {},
          },
          {
            entity: SemanticEntity.VARIABLE,
            category: SemanticCategory.TYPE,
            text: "ValidType",
            node_location: create_location(2),
            modifiers: {},
            context: {},
          },
        ];

        const result = process_type_annotations(
          captures,
          mock_scope,
          mock_scopes,
          mock_file_path
        );

        expect(result).toHaveLength(1);
        expect(result[0].annotation_text).toBe("ValidType");
        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining("Failed to process type capture")
        );

        consoleWarn.mockRestore();
      });
    });
  });

  // =======================
  // SECTION 8: Complex Integration Scenarios
  // =======================

  describe("Complex Integration Scenarios", () => {
    it("should process TypeScript class with full annotations", () => {
      const captures: NormalizedCapture[] = [
        // Class with extends and implements
        {
          entity: SemanticEntity.TYPE,
          category: SemanticCategory.DEFINITION,
          text: "UserService",
          node_location: create_location(1),
          modifiers: {},
          context: {
            extends_class: "BaseService",
            implements_interfaces: ["IUserService", "IDisposable"],
          },
        },
        // Generic parameter with constraint
        {
          entity: SemanticEntity.TYPE_PARAMETER,
          category: SemanticCategory.TYPE,
          text: "T",
          node_location: create_location(1, 20),
          modifiers: {},
          context: { constraint_type: "User" },
        },
        // Property with union type
        {
          entity: SemanticEntity.PROPERTY,
          category: SemanticCategory.TYPE,
          text: "status",
          node_location: create_location(3),
          modifiers: {},
          context: undefined,
        },
        // Method parameter with complex type
        {
          entity: SemanticEntity.PARAMETER,
          category: SemanticCategory.TYPE,
          text: "Map<string, T[]>",
          node_location: create_location(5),
          modifiers: { is_optional: false },
          context: undefined,
        },
        // Optional parameter
        {
          entity: SemanticEntity.PARAMETER,
          category: SemanticCategory.TYPE,
          text: "options",
          node_location: create_location(5, 20),
          modifiers: { is_optional: true },
          context: undefined,
        },
        // Return type
        {
          entity: SemanticEntity.TYPE,
          category: SemanticCategory.TYPE,
          text: "Promise<Result<T, Error>>",
          node_location: create_location(5, 50),
          modifiers: {},
          context: undefined,
        },
        // Type cast
        {
          entity: SemanticEntity.TYPE_ASSERTION,
          category: SemanticCategory.TYPE,
          text: "User",
          node_location: create_location(7),
          modifiers: {},
          context: undefined,
        },
      ];

      const result = process_type_annotations(
        captures,
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(7);

      // Check class
      const classAnnotation = result[0];
      expect(classAnnotation.annotation_text).toBe("UserService");
      expect(classAnnotation.annotation_kind).toBe("generic");
      expect(classAnnotation.constraint_text).toBe(
        "extends BaseService, implements IUserService, implements IDisposable"
      );

      // Check generic parameter
      const genericParam = result[1];
      expect(genericParam.annotation_text).toBe("T");
      expect(genericParam.annotation_kind).toBe("generic");
      expect(genericParam.constraint_text).toBe("extends User");

      // Check property
      const property = result[2];
      expect(property.annotation_text).toBe("status");
      expect(property.annotation_kind).toBe("property");

      // Check method parameter
      const param1 = result[3];
      expect(param1.annotation_text).toBe("Map<string, T[]>");
      expect(param1.annotation_kind).toBe("parameter");
      expect(param1.is_optional).toBe(false);

      // Check optional parameter
      const param2 = result[4];
      expect(param2.annotation_text).toBe("options");
      expect(param2.annotation_kind).toBe("parameter");
      expect(param2.is_optional).toBe(true);

      // Check return type
      const returnType = result[5];
      expect(returnType.annotation_text).toBe("Promise<Result<T, Error>>");
      expect(returnType.annotation_kind).toBe("generic");

      // Check type cast
      const typeCast = result[6];
      expect(typeCast.annotation_text).toBe("User");
      expect(typeCast.annotation_kind).toBe("cast");
    });

    it("should handle mixed valid and invalid captures", () => {
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const captures: NormalizedCapture[] = [
        // Valid
        {
          entity: SemanticEntity.VARIABLE,
          category: SemanticCategory.TYPE,
          text: "Type1",
          node_location: create_location(1),
          modifiers: {},
          context: undefined,
        },
        // Invalid - empty text
        {
          entity: SemanticEntity.VARIABLE,
          category: SemanticCategory.TYPE,
          text: "",
          node_location: create_location(2),
          modifiers: {},
          context: undefined,
        },
        // Valid with constraint
        {
          entity: SemanticEntity.TYPE,
          category: SemanticCategory.TYPE,
          text: "Type2",
          node_location: create_location(3),
          modifiers: {},
          context: { extends_class: "Base" },
        },
        // Invalid - no location
        {
          entity: SemanticEntity.VARIABLE,
          category: SemanticCategory.TYPE,
          text: "Type3",
          node_location: null as unknown as Location,
          modifiers: {},
          context: undefined,
        },
        // Valid with optional
        {
          entity: SemanticEntity.PARAMETER,
          category: SemanticCategory.TYPE,
          text: "Type4",
          node_location: create_location(4),
          modifiers: { is_optional: true },
          context: undefined,
        },
        // Null capture
        null as unknown as NormalizedCapture,
        // Valid with target location
        {
          entity: SemanticEntity.TYPE,
          category: SemanticCategory.TYPE,
          text: "Type5",
          node_location: create_location(5),
          modifiers: {},
          context: {},
        },
      ];

      const result = process_type_annotations(
        captures,
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      // Should process only valid captures
      expect(result).toHaveLength(4);
      expect(result[0].annotation_text).toBe("Type1");
      expect(result[1].annotation_text).toBe("Type2");
      expect(result[1].constraint_text).toBe("extends Base");
      expect(result[2].annotation_text).toBe("Type4");
      expect(result[2].is_optional).toBe(true);
      expect(result[3].annotation_text).toBe("Type5");
      expect(result[3].annotates_location).toEqual(create_location(10));

      consoleWarn.mockRestore();
    });
  });

  // =======================
  // SECTION 9: Backwards Compatibility
  // =======================

  describe("Backwards Compatibility", () => {
    it("should export process_type_annotation_references as alias", () => {
      expect(process_type_annotation_references).toBe(process_type_annotations);
    });

    it("should work with legacy function name", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.VARIABLE,
        category: SemanticCategory.TYPE,
        text: "string",
        node_location: mock_location,
        modifiers: {},
        context: undefined,
      };

      const result = process_type_annotation_references(
        [capture],
        mock_scope,
        mock_scopes,
        mock_file_path
      );

      expect(result).toHaveLength(1);
      expect(result[0].annotation_text).toBe("string");
    });
  });

  // =======================
  // SECTION 10: Interface Validation
  // =======================

  describe("LocalTypeAnnotation Interface", () => {
    it("should correctly type annotation objects", () => {
      const annotation: LocalTypeAnnotation = {
        location: mock_location,
        annotation_text: "string[]",
        annotation_kind: "parameter",
        scope_id: "scope_1" as ScopeId,
        is_optional: true,
        constraint_text: "extends BaseType",
        annotates_location: mock_location,
      };

      expect(annotation.annotation_text).toBe("string[]");
      expect(annotation.annotation_kind).toBe("parameter");
      expect(annotation.scope_id).toBe("scope_1");
      expect(annotation.is_optional).toBe(true);
      expect(annotation.constraint_text).toBe("extends BaseType");
      expect(annotation.annotates_location).toEqual(mock_location);
    });

    it("should allow minimal annotation objects", () => {
      const annotation: LocalTypeAnnotation = {
        location: mock_location,
        annotation_text: "number",
        annotation_kind: "variable",
        scope_id: "scope_1" as ScopeId,
        annotates_location: mock_location,
        // Optional fields can be omitted
      };

      expect(annotation.is_optional).toBeUndefined();
      expect(annotation.constraint_text).toBeUndefined();
    });
  });
});

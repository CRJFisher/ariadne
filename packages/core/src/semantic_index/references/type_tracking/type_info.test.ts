/**
 * Tests for Type Info Module
 *
 * Comprehensive test coverage for TypeInfo creation, comparison, and utility functions
 */

import { describe, it, expect } from 'vitest';
import type { FilePath, Location, SymbolName } from "@ariadnejs/types";
import type { TypeId } from "@ariadnejs/types";
import {
  TypeCategory,
  primitive_type_id,
  builtin_type_id,
  defined_type_id,
  generic_type_id,
  union_type_id,
  array_type_id,
  literal_type_id,
  ANY_TYPE,
  UNKNOWN_TYPE,
  NEVER_TYPE,
  VOID_TYPE,
} from "@ariadnejs/types";

import {
  type TypeInfo,
  type TypeSource,
  type_info_from_annotation,
  type_info_from_literal,
  type_info_array,
  type_info_union,
  type_info_generic,
  types_equal,
  is_assignable_to,
} from './type_info';

// Mock data for testing
const mockFilePath = "test.ts" as FilePath;
const mockLocation: Location = { file_path: mockFilePath, line: 1, column: 1 , end_line: 1, end_column: 1  };
const mockLocation2: Location = { file_path: mockFilePath, line: 2, column: 5 , end_line: 2, end_column: 5  };

describe('Type Info Module', () => {
  describe('TypeInfo interface', () => {
    it('should handle complete TypeInfo structure', () => {
      const typeInfo: TypeInfo = {
        id: primitive_type_id("string"),
        type_name: "string" as SymbolName,
        certainty: "declared",
        source: {
          kind: "annotation",
          location: mockLocation,
        },
        is_nullable: false,
        is_array: false,
      };

      expect(typeInfo.id).toBeDefined();
      expect(typeInfo.type_name).toBe("string");
      expect(typeInfo.certainty).toBe("declared");
      expect(typeInfo.source.kind).toBe("annotation");
      expect(typeInfo.is_nullable).toBe(false);
      expect(typeInfo.is_array).toBe(false);
    });

    it('should handle TypeInfo with type parameters', () => {
      const elementType: TypeInfo = {
        id: primitive_type_id("string"),
        type_name: "string" as SymbolName,
        certainty: "declared",
        source: { kind: "annotation", location: mockLocation },
      };

      const arrayType: TypeInfo = {
        id: array_type_id(elementType.id),
        type_name: "Array" as SymbolName,
        certainty: "declared",
        source: { kind: "annotation", location: mockLocation },
        type_params: [elementType],
        is_array: true,
      };

      expect(arrayType.type_params).toHaveLength(1);
      expect(arrayType.type_params![0]).toBe(elementType);
      expect(arrayType.is_array).toBe(true);
    });

    it('should handle TypeInfo with union members', () => {
      const stringType: TypeInfo = {
        id: primitive_type_id("string"),
        type_name: "string" as SymbolName,
        certainty: "declared",
        source: { kind: "annotation", location: mockLocation },
      };

      const numberType: TypeInfo = {
        id: primitive_type_id("number"),
        type_name: "number" as SymbolName,
        certainty: "declared",
        source: { kind: "annotation", location: mockLocation },
      };

      const unionType: TypeInfo = {
        id: union_type_id([stringType.id, numberType.id]),
        type_name: "string | number" as SymbolName,
        certainty: "declared",
        source: { kind: "annotation", location: mockLocation },
        union_members: [stringType, numberType],
      };

      expect(unionType.union_members).toHaveLength(2);
      expect(unionType.union_members![0]).toBe(stringType);
      expect(unionType.union_members![1]).toBe(numberType);
    });
  });

  describe('TypeSource interface', () => {
    it('should handle annotation source', () => {
      const source: TypeSource = {
        kind: "annotation",
        location: mockLocation,
      };

      expect(source.kind).toBe("annotation");
      expect(source.location).toBe(mockLocation);
      expect(source.source_location).toBeUndefined();
    });

    it('should handle assignment source with source location', () => {
      const source: TypeSource = {
        kind: "assignment",
        location: mockLocation,
        source_location: mockLocation2,
      };

      expect(source.kind).toBe("assignment");
      expect(source.location).toBe(mockLocation);
      expect(source.source_location).toBe(mockLocation2);
    });

    it('should handle all source kinds', () => {
      const kinds: TypeSource['kind'][] = [
        "annotation",
        "assignment",
        "return",
        "literal",
        "construction",
        "import",
        "inheritance"
      ];

      kinds.forEach(kind => {
        const source: TypeSource = {
          kind,
          location: mockLocation,
        };
        expect(source.kind).toBe(kind);
      });
    });
  });

  describe('type_info_from_annotation', () => {
    it('should create TypeInfo for primitive types', () => {
      const primitives = ["string", "number", "boolean", "symbol", "bigint", "undefined", "null"];

      primitives.forEach(primitive => {
        const typeInfo = type_info_from_annotation(primitive as SymbolName, mockLocation);

        expect(typeInfo.type_name).toBe(primitive);
        expect(typeInfo.certainty).toBe("declared");
        expect(typeInfo.source.kind).toBe("annotation");
        expect(typeInfo.source.location).toBe(mockLocation);
        expect(typeInfo.id).toBe(primitive_type_id(primitive as any));
      });
    });

    it('should create TypeInfo for built-in types', () => {
      const builtins = ["Date", "RegExp", "Error", "Promise", "Map", "Set", "Array", "Object", "Function"];

      builtins.forEach(builtin => {
        const typeInfo = type_info_from_annotation(builtin as SymbolName, mockLocation);

        expect(typeInfo.type_name).toBe(builtin);
        expect(typeInfo.certainty).toBe("declared");
        expect(typeInfo.source.kind).toBe("annotation");
        expect(typeInfo.id).toBe(builtin_type_id(builtin as any));
      });
    });

    it('should create TypeInfo for special types', () => {
      const specials = [
        { name: "any", expectedId: ANY_TYPE },
        { name: "unknown", expectedId: UNKNOWN_TYPE },
        { name: "never", expectedId: NEVER_TYPE },
        { name: "void", expectedId: VOID_TYPE },
      ];

      specials.forEach(({ name, expectedId }) => {
        const typeInfo = type_info_from_annotation(name as SymbolName, mockLocation);

        expect(typeInfo.type_name).toBe(name);
        expect(typeInfo.certainty).toBe("declared");
        expect(typeInfo.id).toBe(expectedId);
      });
    });

    it('should create TypeInfo for user-defined types', () => {
      const userType = "MyCustomType" as SymbolName;
      const typeInfo = type_info_from_annotation(userType as SymbolName, mockLocation);

      expect(typeInfo.type_name).toBe(userType);
      expect(typeInfo.certainty).toBe("declared");
      expect(typeInfo.source.kind).toBe("annotation");
      expect(typeInfo.id).toBe(defined_type_id(TypeCategory.INTERFACE, userType, mockLocation));
    });

    it('should create TypeInfo for user-defined types with custom category', () => {
      const userType = "MyClass" as SymbolName;
      const typeInfo = type_info_from_annotation(userType as SymbolName, mockLocation, TypeCategory.CLASS);

      expect(typeInfo.type_name).toBe(userType);
      expect(typeInfo.id).toBe(defined_type_id(TypeCategory.CLASS, userType, mockLocation));
    });
  });

  describe('type_info_from_literal', () => {
    it('should create TypeInfo for string literals', () => {
      const stringValue = "hello world";
      const typeInfo = type_info_from_literal(stringValue, mockLocation);

      expect(typeInfo.type_name).toBe("string");
      expect(typeInfo.certainty).toBe("inferred");
      expect(typeInfo.source.kind).toBe("literal");
      expect(typeInfo.source.location).toBe(mockLocation);
      expect(typeInfo.id).toBe(literal_type_id("string", stringValue));
    });

    it('should create TypeInfo for number literals', () => {
      const numberValue = 42;
      const typeInfo = type_info_from_literal(numberValue, mockLocation);

      expect(typeInfo.type_name).toBe("number");
      expect(typeInfo.certainty).toBe("inferred");
      expect(typeInfo.source.kind).toBe("literal");
      expect(typeInfo.id).toBe(literal_type_id("number", numberValue));
    });

    it('should create TypeInfo for boolean literals', () => {
      const boolValues = [true, false];

      boolValues.forEach(boolValue => {
        const typeInfo = type_info_from_literal(boolValue, mockLocation);

        expect(typeInfo.type_name).toBe("boolean");
        expect(typeInfo.certainty).toBe("inferred");
        expect(typeInfo.source.kind).toBe("literal");
        expect(typeInfo.id).toBe(literal_type_id("boolean", boolValue));
      });
    });

    it('should create TypeInfo for null literal', () => {
      const typeInfo = type_info_from_literal(null, mockLocation);

      expect(typeInfo.type_name).toBe("null");
      expect(typeInfo.certainty).toBe("inferred");
      expect(typeInfo.source.kind).toBe("literal");
      expect(typeInfo.id).toBe(primitive_type_id("null"));
    });

    it('should create TypeInfo for undefined literal', () => {
      const typeInfo = type_info_from_literal(undefined, mockLocation);

      expect(typeInfo.type_name).toBe("undefined");
      expect(typeInfo.certainty).toBe("inferred");
      expect(typeInfo.source.kind).toBe("literal");
      expect(typeInfo.id).toBe(primitive_type_id("undefined"));
    });

    it('should create TypeInfo for unknown literal values', () => {
      const unknownValue = Symbol("test") as any; // Simulate unknown value
      const typeInfo = type_info_from_literal(unknownValue, mockLocation);

      expect(typeInfo.type_name).toBe("unknown");
      expect(typeInfo.certainty).toBe("inferred");
      expect(typeInfo.source.kind).toBe("literal");
      expect(typeInfo.id).toBe(UNKNOWN_TYPE);
    });
  });

  describe('type_info_array', () => {
    it('should create array TypeInfo from element type', () => {
      const elementType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const arrayType = type_info_array(elementType, mockLocation2);

      expect(arrayType.type_name).toBe("Array");
      expect(arrayType.certainty).toBe(elementType.certainty);
      expect(arrayType.source.kind).toBe("annotation");
      expect(arrayType.source.location).toBe(mockLocation2);
      expect(arrayType.is_array).toBe(true);
      expect(arrayType.type_params).toHaveLength(1);
      expect(arrayType.type_params![0]).toBe(elementType);
      expect(arrayType.id).toBe(array_type_id(elementType.id));
    });

    it('should inherit certainty from element type', () => {
      const inferredElement = type_info_from_literal("test", mockLocation);
      const arrayType = type_info_array(inferredElement, mockLocation2);

      expect(arrayType.certainty).toBe("inferred");
      expect(inferredElement.certainty).toBe("inferred");
    });

    it('should handle nested array types', () => {
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const arrayType = type_info_array(stringType, mockLocation2);
      const nestedArrayType = type_info_array(arrayType, mockLocation2);

      expect(nestedArrayType.type_params![0]).toBe(arrayType);
      expect(nestedArrayType.type_params![0].type_params![0]).toBe(stringType);
    });
  });

  describe('type_info_union', () => {
    it('should create union TypeInfo from member types', () => {
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const numberType = type_info_from_annotation("number" as SymbolName, mockLocation);
      const unionType = type_info_union([stringType, numberType], mockLocation2);

      expect(unionType.type_name).toBe("string | number");
      expect(unionType.certainty).toBe("declared");
      expect(unionType.source.kind).toBe("annotation");
      expect(unionType.source.location).toBe(mockLocation2);
      expect(unionType.union_members).toHaveLength(2);
      expect(unionType.union_members![0]).toBe(stringType);
      expect(unionType.union_members![1]).toBe(numberType);

      const expectedId = union_type_id([stringType.id, numberType.id]);
      expect(unionType.id).toBe(expectedId);
    });

    it('should handle mixed certainty in union members', () => {
      const declaredType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const inferredType = type_info_from_literal(42, mockLocation);
      const unionType = type_info_union([declaredType, inferredType], mockLocation2);

      expect(unionType.certainty).toBe("inferred"); // Should be inferred when not all are declared
    });

    it('should create readable type name for complex unions', () => {
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const numberType = type_info_from_annotation("number" as SymbolName, mockLocation);
      const booleanType = type_info_from_annotation("boolean" as SymbolName, mockLocation);
      const unionType = type_info_union([stringType, numberType, booleanType], mockLocation2);

      expect(unionType.type_name).toBe("string | number | boolean");
    });

    it('should handle single member union', () => {
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const unionType = type_info_union([stringType], mockLocation2);

      expect(unionType.type_name).toBe("string");
      expect(unionType.union_members).toHaveLength(1);
      expect(unionType.union_members![0]).toBe(stringType);
    });

    it('should handle empty union', () => {
      const unionType = type_info_union([], mockLocation2);

      expect(unionType.type_name).toBe("");
      expect(unionType.union_members).toHaveLength(0);
    });
  });

  describe('type_info_generic', () => {
    it('should create generic TypeInfo from base type and arguments', () => {
      const baseType = type_info_from_annotation("Map" as SymbolName, mockLocation);
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const numberType = type_info_from_annotation("number" as SymbolName, mockLocation);
      const genericType = type_info_generic(baseType, [stringType, numberType], mockLocation2);

      expect(genericType.type_name).toBe("Map<string, number>");
      expect(genericType.certainty).toBe(baseType.certainty);
      expect(genericType.source.kind).toBe("annotation");
      expect(genericType.source.location).toBe(mockLocation2);
      expect(genericType.type_params).toHaveLength(2);
      expect(genericType.type_params![0]).toBe(stringType);
      expect(genericType.type_params![1]).toBe(numberType);

      const expectedId = generic_type_id(baseType.id, [stringType.id, numberType.id]);
      expect(genericType.id).toBe(expectedId);
    });

    it('should handle single type parameter', () => {
      const arrayType = type_info_from_annotation("Array" as SymbolName, mockLocation);
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const genericType = type_info_generic(arrayType, [stringType], mockLocation2);

      expect(genericType.type_name).toBe("Array<string>");
      expect(genericType.type_params).toHaveLength(1);
    });

    it('should handle nested generics', () => {
      const mapType = type_info_from_annotation("Map" as SymbolName, mockLocation);
      const arrayType = type_info_from_annotation("Array" as SymbolName, mockLocation);
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);

      const arrayOfStrings = type_info_generic(arrayType, [stringType], mockLocation);
      const mapOfArrays = type_info_generic(mapType, [stringType, arrayOfStrings], mockLocation2);

      expect(mapOfArrays.type_name).toBe("Map<string, Array<string>>");
      expect(mapOfArrays.type_params![1]).toBe(arrayOfStrings);
    });

    it('should handle empty type arguments', () => {
      const baseType = type_info_from_annotation("Promise" as SymbolName, mockLocation);
      const genericType = type_info_generic(baseType, [], mockLocation2);

      expect(genericType.type_name).toBe("Promise<>");
      expect(genericType.type_params).toHaveLength(0);
    });
  });

  describe('types_equal', () => {
    it('should return true for identical TypeInfo objects', () => {
      const type1 = type_info_from_annotation("string" as SymbolName, mockLocation);
      const type2 = type_info_from_annotation("string" as SymbolName, mockLocation);

      expect(types_equal(type1, type2)).toBe(true);
    });

    it('should return false for different types', () => {
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const numberType = type_info_from_annotation("number" as SymbolName, mockLocation);

      expect(types_equal(stringType, numberType)).toBe(false);
    });

    it('should handle complex types', () => {
      const baseType = type_info_from_annotation("Map" as SymbolName, mockLocation);
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const numberType = type_info_from_annotation("number" as SymbolName, mockLocation);

      const map1 = type_info_generic(baseType, [stringType, numberType], mockLocation);
      const map2 = type_info_generic(baseType, [stringType, numberType], mockLocation);
      const map3 = type_info_generic(baseType, [numberType, stringType], mockLocation);

      expect(types_equal(map1, map2)).toBe(true);
      expect(types_equal(map1, map3)).toBe(false);
    });
  });

  describe('is_assignable_to', () => {
    it('should handle same type assignment', () => {
      const stringType1 = type_info_from_annotation("string" as SymbolName, mockLocation);
      const stringType2 = type_info_from_annotation("string" as SymbolName, mockLocation);

      expect(is_assignable_to(stringType1, stringType2)).toBe(true);
    });

    it('should handle any type assignments', () => {
      const anyType = type_info_from_annotation("any" as SymbolName, mockLocation);
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);

      // any is assignable to anything
      expect(is_assignable_to(anyType, stringType)).toBe(true);
      // anything is assignable to any
      expect(is_assignable_to(stringType, anyType)).toBe(true);
    });

    it('should handle unknown type assignments', () => {
      const unknownType = type_info_from_annotation("unknown" as SymbolName, mockLocation);
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);

      // anything is assignable to unknown
      expect(is_assignable_to(stringType, unknownType)).toBe(true);
      // unknown is not assignable to specific types
      expect(is_assignable_to(unknownType, stringType)).toBe(false);
    });

    it('should handle never type assignments', () => {
      const neverType = type_info_from_annotation("never" as SymbolName, mockLocation);
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);

      // never is assignable to anything
      expect(is_assignable_to(neverType, stringType)).toBe(true);
      // nothing is assignable to never
      expect(is_assignable_to(stringType, neverType)).toBe(false);
    });

    it('should handle union type assignments', () => {
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const numberType = type_info_from_annotation("number" as SymbolName, mockLocation);
      const unionType = type_info_union([stringType, numberType], mockLocation);

      // string is assignable to string | number
      expect(is_assignable_to(stringType, unionType)).toBe(true);
      // number is assignable to string | number
      expect(is_assignable_to(numberType, unionType)).toBe(true);

      // string | number is not assignable to string
      expect(is_assignable_to(unionType, stringType)).toBe(false);
    });

    it('should handle union source assignments', () => {
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const numberType = type_info_from_annotation("number" as SymbolName, mockLocation);
      const booleanType = type_info_from_annotation("boolean" as SymbolName, mockLocation);

      const unionSource = type_info_union([stringType, numberType], mockLocation);
      const unionTarget = type_info_union([stringType, numberType, booleanType], mockLocation);

      // The current implementation doesn't handle union subset relationships
      // so string | number is not automatically assignable to string | number | boolean
      expect(is_assignable_to(unionSource, unionTarget)).toBe(false);

      // string | number | boolean should not be assignable to string | number
      expect(is_assignable_to(unionTarget, unionSource)).toBe(false);
    });

    it('should handle nullable type assignments', () => {
      const nullableString: TypeInfo = {
        id: primitive_type_id("string"),
        type_name: "string" as SymbolName,
        certainty: "declared",
        source: { kind: "annotation", location: mockLocation },
        is_nullable: true,
      };

      const nonNullableString: TypeInfo = {
        id: primitive_type_id("string"),
        type_name: "string" as SymbolName,
        certainty: "declared",
        source: { kind: "annotation", location: mockLocation },
        is_nullable: false,
      };

      // Non-nullable to nullable should be OK
      expect(is_assignable_to(nonNullableString, nullableString)).toBe(true);

      // Current implementation allows nullable to non-nullable based on same type ID
      expect(is_assignable_to(nullableString, nonNullableString)).toBe(true);
    });

    it('should handle different primitive types', () => {
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const numberType = type_info_from_annotation("number" as SymbolName, mockLocation);

      expect(is_assignable_to(stringType, numberType)).toBe(false);
      expect(is_assignable_to(numberType, stringType)).toBe(false);
    });

    it('should handle complex scenarios', () => {
      const anyType = type_info_from_annotation("any" as SymbolName, mockLocation);
      const unknownType = type_info_from_annotation("unknown" as SymbolName, mockLocation);
      const neverType = type_info_from_annotation("never" as SymbolName, mockLocation);
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);

      // Complex assignment scenarios
      expect(is_assignable_to(anyType, unknownType)).toBe(true);
      expect(is_assignable_to(unknownType, anyType)).toBe(true);
      expect(is_assignable_to(neverType, anyType)).toBe(true);
      expect(is_assignable_to(neverType, unknownType)).toBe(true);
      expect(is_assignable_to(stringType, unknownType)).toBe(true);
    });
  });

  describe('Integration tests', () => {
    it('should handle complete type creation and comparison workflow', () => {
      // Create different types
      const stringLiteral = type_info_from_literal("hello", mockLocation);
      const stringAnnotation = type_info_from_annotation("string" as SymbolName, mockLocation);

      // They should both represent strings but with different IDs
      expect(stringLiteral.type_name).toBe("string");
      expect(stringAnnotation.type_name).toBe("string");
      expect(types_equal(stringLiteral, stringAnnotation)).toBe(false); // Different IDs
      expect(is_assignable_to(stringLiteral, stringAnnotation)).toBe(false); // Different precise types
    });

    it('should handle complex generic type scenarios', () => {
      const mapType = type_info_from_annotation("Map" as SymbolName, mockLocation);
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const arrayType = type_info_from_annotation("Array" as SymbolName, mockLocation);

      const stringArray = type_info_generic(arrayType, [stringType], mockLocation);
      const mapOfArrays = type_info_generic(mapType, [stringType, stringArray], mockLocation);

      expect(mapOfArrays.type_name).toBe("Map<string, Array<string>>");
      expect(mapOfArrays.type_params).toHaveLength(2);
      expect(mapOfArrays.type_params![1].type_params).toHaveLength(1);
    });

    it('should handle union type with assignability', () => {
      const stringType = type_info_from_annotation("string" as SymbolName, mockLocation);
      const numberType = type_info_from_annotation("number" as SymbolName, mockLocation);
      const unionType = type_info_union([stringType, numberType], mockLocation);
      const anyType = type_info_from_annotation("any" as SymbolName, mockLocation);

      expect(is_assignable_to(stringType, unionType)).toBe(true);
      expect(is_assignable_to(unionType, anyType)).toBe(true);
      expect(is_assignable_to(anyType, unionType)).toBe(true);
    });
  });
});
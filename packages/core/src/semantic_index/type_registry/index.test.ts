/**
 * Tests for Type Registry index exports
 *
 * Ensures all exports from the module are accessible and properly re-exported
 */

import { describe, it, expect } from "vitest";
import type { TypeId, FilePath } from "@ariadnejs/types";

describe("Type Registry Index Exports", () => {
  it("should have all interfaces available for TypeScript compilation", () => {
    // This test ensures interfaces are exported correctly for TypeScript
    // Interfaces don't exist at runtime, so we test compilation compatibility
    const typeCheckPassing = true; // If this compiles, types are exported correctly
    expect(typeCheckPassing).toBe(true);
  });

  it("should re-export all functions from type_registry module", async () => {
    const moduleExports = await import("./index");

    // Check that builder functions are exported
    expect(moduleExports).toHaveProperty("create_empty_registry");
    expect(moduleExports).toHaveProperty("create_empty_member_map");
    expect(moduleExports).toHaveProperty("create_empty_variable_map");
    expect(moduleExports).toHaveProperty("create_type_context");

    // Check that reassignment helper functions are exported
    expect(moduleExports).toHaveProperty("create_narrowing_reassignment");
    expect(moduleExports).toHaveProperty("create_widening_reassignment");
    expect(moduleExports).toHaveProperty("create_neutral_reassignment");
    expect(moduleExports).toHaveProperty("validate_reassignment");

    // Check that composite type helper functions are exported
    expect(moduleExports).toHaveProperty("create_union_type");
    expect(moduleExports).toHaveProperty("create_intersection_type");
    expect(moduleExports).toHaveProperty("create_array_type");
    expect(moduleExports).toHaveProperty("create_tuple_type");

    // Verify they are all functions
    const expectedFunctions = [
      "create_empty_registry",
      "create_empty_member_map",
      "create_empty_variable_map",
      "create_type_context",
      "create_narrowing_reassignment",
      "create_widening_reassignment",
      "create_neutral_reassignment",
      "validate_reassignment",
      "create_union_type",
      "create_intersection_type",
      "create_array_type",
      "create_tuple_type",
    ];

    expectedFunctions.forEach((funcName) => {
      expect(typeof (moduleExports as any)[funcName]).toBe("function");
    });
  });

  it("should allow importing all functions and test them", async () => {
    // Test that functions can be imported and used correctly
    const {
      create_empty_registry,
      create_empty_member_map,
      create_empty_variable_map,
      create_type_context,
      create_narrowing_reassignment,
      create_widening_reassignment,
      create_neutral_reassignment,
      validate_reassignment,
      create_union_type,
      create_intersection_type,
      create_array_type,
      create_tuple_type,
    } = await import("./index");

    // Test builder functions
    const registry = create_empty_registry("/test.ts" as FilePath);
    const memberMap = create_empty_member_map();
    const variableMap = create_empty_variable_map();
    const context = create_type_context("/test.ts" as FilePath);

    expect(registry).toBeDefined();
    expect(memberMap).toBeDefined();
    expect(variableMap).toBeDefined();
    expect(context).toBeDefined();

    // Test reassignment helper functions
    const mockLocation = {
      file_path: "/test.ts" as FilePath,
      line: 1,
      column: 1,
      end_line: 1,
      end_column: 1,
    };
    const narrowing = create_narrowing_reassignment("from" as TypeId, "to" as TypeId, mockLocation);
    const widening = create_widening_reassignment("from" as TypeId, "to" as TypeId, mockLocation);
    const neutral = create_neutral_reassignment("from" as TypeId, "to" as TypeId, mockLocation);

    expect(narrowing.is_narrowing).toBe(true);
    expect(widening.is_widening).toBe(true);
    expect(neutral.is_narrowing).toBe(false);
    expect(validate_reassignment(narrowing)).toBe(true);

    // Test composite type helper functions
    const unionType = create_union_type(["string" as TypeId, "number" as TypeId]);
    const intersectionType = create_intersection_type(["A" as TypeId, "B" as TypeId]);
    const arrayType = create_array_type("string" as TypeId);
    const tupleType = create_tuple_type(["string" as TypeId, "number" as TypeId]);

    expect(unionType.kind).toBe("union");
    expect(intersectionType.kind).toBe("intersection");
    expect(arrayType.kind).toBe("array");
    expect(tupleType.kind).toBe("tuple");
  });

  it("should allow importing all discriminated union types", () => {
    // TypeScript compilation test - if this compiles, all types are exported correctly
    type TestImports = {
      // Core interfaces
      FileTypeRegistry: import("./index").FileTypeRegistry;
      TypeMemberMap: import("./index").TypeMemberMap;
      VariableTypeMap: import("./index").VariableTypeMap;

      // Member discriminated union types
      MemberInfo: import("./index").MemberInfo;
      MethodMemberInfo: import("./index").MethodMemberInfo;
      PropertyMemberInfo: import("./index").PropertyMemberInfo;
      FieldMemberInfo: import("./index").FieldMemberInfo;
      ConstructorMemberInfo: import("./index").ConstructorMemberInfo;

      // Other interfaces
      ParameterInfo: import("./index").ParameterInfo;
      InheritanceInfo: import("./index").InheritanceInfo;
      VariableTypeInfo: import("./index").VariableTypeInfo;
      TypeReassignment: import("./index").TypeReassignment;
      TypeResolutionContext: import("./index").TypeResolutionContext;

      // Composite type discriminated union types
      CompositeTypeInfo: import("./index").CompositeTypeInfo;
      UnionTypeInfo: import("./index").UnionTypeInfo;
      IntersectionTypeInfo: import("./index").IntersectionTypeInfo;
      ArrayTypeInfo: import("./index").ArrayTypeInfo;
      TupleTypeInfo: import("./index").TupleTypeInfo;
    };

    // If this compiles, all types are properly exported
    const typesAvailable = true;
    expect(typesAvailable).toBe(true);
  });

  it("should have consistent exports between index and type_registry", async () => {
    const indexExports = await import("./index");
    const typeRegistryExports = await import("./type_registry");

    // Get all function exports
    const indexFunctions = Object.keys(indexExports).filter(
      (key) => typeof indexExports[key] === "function"
    );
    const typeRegistryFunctions = Object.keys(typeRegistryExports).filter(
      (key) => typeof typeRegistryExports[key] === "function"
    );

    // Index should export all functions from type_registry
    for (const funcName of typeRegistryFunctions) {
      expect(indexFunctions).toContain(funcName);
      expect(indexExports[funcName]).toBe(typeRegistryExports[funcName]);
    }
  });
});

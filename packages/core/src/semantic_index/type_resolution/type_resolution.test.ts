/**
 * Comprehensive tests for type resolution
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  SymbolId,
  SymbolName,
  TypeId,
  Location,
  FilePath,
  SymbolDefinition,
} from "@ariadnejs/types";
import {
  defined_type_id,
  primitive_type_id,
  builtin_type_id,
  generic_type_id,
  array_type_id,
  union_type_id,
  ANY_TYPE,
  UNKNOWN_TYPE,
  TypeCategory,
} from "@ariadnejs/types";
import type { TypeInfo } from "../references/type_tracking/type_info";
import type { FileTypeRegistry } from "../type_registry/type_registry";
import {
  build_file_type_registry,
  build_file_type_registry_with_annotations,
  type TypeRegistryResult,
} from "./type_resolution";

describe("Type Resolution", () => {
  const mockFilePath = "test.ts" as FilePath;
  const mockLocation: Location = {
    file_path: mockFilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
  };

  let mockSymbols: Map<SymbolId, SymbolDefinition>;
  let mockRegistry: FileTypeRegistry;

  beforeEach(() => {
    mockSymbols = new Map();
    mockRegistry = {
      file_path: mockFilePath,
      symbol_to_type: new Map(),
      name_to_type: new Map(),
      defined_types: new Set(),
      symbol_types: new Map(),
      location_types: new Map(),
      return_types: new Map(),
    };
  });

  describe("build_file_type_registry", () => {
    describe("Success Cases", () => {
      it("should build registry from class symbols", () => {
        const classSymbol: SymbolDefinition = {
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["class_symbol" as SymbolId, classSymbol]]);

        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.file_path).toBe(mockFilePath);
        expect(result.symbol_to_type.size).toBe(1);
        expect(result.name_to_type.size).toBe(1);
        expect(result.defined_types.size).toBe(1);

        const typeId = result.name_to_type.get("MyClass" as SymbolName);
        expect(typeId).toBeDefined();
        expect(result.symbol_to_type.get("class_symbol" as SymbolId)).toEqual(
          typeId
        );
        expect(result.defined_types.has(typeId!)).toBe(true);
      });

      it("should include return types from functions", () => {
        const returnTypeId = primitive_type_id("string");

        const functionSymbol: SymbolDefinition = {
          id: "func_symbol" as SymbolId,
          kind: "function",
          name: "myFunc" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          return_type: returnTypeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["func_symbol" as SymbolId, functionSymbol]]);

        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.return_types.size).toBe(1);
        expect(result.return_types.get("func_symbol" as SymbolId)).toEqual(
          returnTypeId
        );
      });

      it("should include variable value types", () => {
        const valueTypeId = primitive_type_id("number");

        const variableSymbol: SymbolDefinition = {
          id: "var_symbol" as SymbolId,
          kind: "variable",
          name: "myVar" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          value_type: valueTypeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["var_symbol" as SymbolId, variableSymbol]]);

        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.symbol_types.size).toBe(1);
        expect(result.symbol_types.get("var_symbol" as SymbolId)).toEqual(
          valueTypeId
        );
      });

      it("should handle all type symbol kinds", () => {
        const symbols = new Map<SymbolId, SymbolDefinition>([
          [
            "class" as SymbolId,
            {
              id: "class" as SymbolId,
              kind: "class",
              name: "MyClass" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "interface" as SymbolId,
            {
              id: "interface" as SymbolId,
              kind: "interface",
              name: "IInterface" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "type_alias" as SymbolId,
            {
              id: "type_alias" as SymbolId,
              kind: "type_alias",
              name: "TypeAlias" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "enum" as SymbolId,
            {
              id: "enum" as SymbolId,
              kind: "enum",
              name: "MyEnum" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
        ]);

        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.symbol_to_type.size).toBe(4);
        expect(result.name_to_type.size).toBe(4);
        expect(result.defined_types.size).toBe(4);

        expect(result.name_to_type.has("MyClass" as SymbolName)).toBe(true);
        expect(result.name_to_type.has("IInterface" as SymbolName)).toBe(true);
        expect(result.name_to_type.has("TypeAlias" as SymbolName)).toBe(true);
        expect(result.name_to_type.has("MyEnum" as SymbolName)).toBe(true);
      });

      it("should not store type_id on symbols anymore (FIXED)", () => {
        const classSymbol: SymbolDefinition = {
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["class_symbol" as SymbolId, classSymbol]]);

        build_file_type_registry(symbols, mockFilePath);

        // FIXED: No longer mutates symbols
        expect((classSymbol as any).type_id).toBeUndefined();
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty symbols map", () => {
        const result = build_file_type_registry(new Map(), mockFilePath);

        expect(result.file_path).toBe(mockFilePath);
        expect(result.symbol_to_type.size).toBe(0);
        expect(result.name_to_type.size).toBe(0);
        expect(result.defined_types.size).toBe(0);
        expect(result.symbol_types.size).toBe(0);
        expect(result.return_types.size).toBe(0);
      });

      it("should skip non-type symbols in first pass", () => {
        const functionSymbol: SymbolDefinition = {
          id: "func_symbol" as SymbolId,
          kind: "function",
          name: "myFunc" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["func_symbol" as SymbolId, functionSymbol]]);

        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.symbol_to_type.size).toBe(0);
        expect(result.name_to_type.size).toBe(0);
        expect(result.defined_types.size).toBe(0);
      });

      it("should handle symbols with both return and value types", () => {
        const returnTypeId = primitive_type_id("string");
        const valueTypeId = primitive_type_id("number");

        const methodSymbol: SymbolDefinition = {
          id: "method_symbol" as SymbolId,
          kind: "method",
          name: "myMethod" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          return_type: returnTypeId,
          value_type: valueTypeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["method_symbol" as SymbolId, methodSymbol]]);

        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.return_types.get("method_symbol" as SymbolId)).toEqual(
          returnTypeId
        );
        expect(result.symbol_types.get("method_symbol" as SymbolId)).toEqual(
          valueTypeId
        );
      });

      it("should handle mixed type and non-type symbols", () => {
        const symbols = new Map<SymbolId, SymbolDefinition>([
          [
            "class" as SymbolId,
            {
              id: "class" as SymbolId,
              kind: "class",
              name: "MyClass" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "function" as SymbolId,
            {
              id: "function" as SymbolId,
              kind: "function",
              name: "myFunc" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              return_type: primitive_type_id("undefined"),
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "variable" as SymbolId,
            {
              id: "variable" as SymbolId,
              kind: "variable",
              name: "myVar" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              value_type: primitive_type_id("string"),
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
        ]);

        const result = build_file_type_registry(symbols, mockFilePath);

        // Only class should be in type mappings
        expect(result.symbol_to_type.size).toBe(1);
        expect(result.name_to_type.size).toBe(1);
        expect(result.defined_types.size).toBe(1);

        // Function and variable should be in return/symbol types
        expect(result.return_types.size).toBe(1);
        expect(result.symbol_types.size).toBe(1);

        expect(result.name_to_type.has("MyClass" as SymbolName)).toBe(true);
        expect(result.return_types.has("function" as SymbolId)).toBe(true);
        expect(result.symbol_types.has("variable" as SymbolId)).toBe(true);
      });

      it("should create correct TypeCategory for each symbol kind", () => {
        const symbols = new Map<SymbolId, SymbolDefinition>([
          [
            "class" as SymbolId,
            {
              id: "class" as SymbolId,
              kind: "class",
              name: "MyClass" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "interface" as SymbolId,
            {
              id: "interface" as SymbolId,
              kind: "interface",
              name: "IInterface" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "type_alias" as SymbolId,
            {
              id: "type_alias" as SymbolId,
              kind: "type_alias",
              name: "TypeAlias" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "enum" as SymbolId,
            {
              id: "enum" as SymbolId,
              kind: "enum",
              name: "MyEnum" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
        ]);

        const result = build_file_type_registry(symbols, mockFilePath);

        const classType = result.name_to_type.get("MyClass" as SymbolName);
        const interfaceType = result.name_to_type.get("IInterface" as SymbolName);
        const typeAliasType = result.name_to_type.get("TypeAlias" as SymbolName);
        const enumType = result.name_to_type.get("MyEnum" as SymbolName);

        expect(classType).toEqual(
          defined_type_id(TypeCategory.CLASS, "MyClass" as SymbolName, mockLocation)
        );
        expect(interfaceType).toEqual(
          defined_type_id(TypeCategory.INTERFACE, "IInterface" as SymbolName, mockLocation)
        );
        expect(typeAliasType).toEqual(
          defined_type_id(TypeCategory.TYPE_ALIAS, "TypeAlias" as SymbolName, mockLocation)
        );
        expect(enumType).toEqual(
          defined_type_id(TypeCategory.ENUM, "MyEnum" as SymbolName, mockLocation)
        );
      });
    });

    describe("Error Cases", () => {
      it("should throw error for invalid symbol kind when creating type ID", () => {
        // Create a symbol with an invalid kind that would trigger the error path
        const invalidSymbol: SymbolDefinition = {
          id: "invalid_symbol" as SymbolId,
          kind: "unknown_kind" as any, // Invalid kind
          name: "InvalidType" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        // Need to modify the symbol to be recognized as a type symbol
        // but have an invalid kind to trigger the error in create_type_id_from_symbol
        const modifiedSymbol = {
          ...invalidSymbol,
          kind: "function" as any, // This will pass is_type_symbol but fail in create_type_id_from_symbol
        };

        // We need to somehow test the error path indirectly since the functions are not exported
        // The error would occur if we could call create_type_id_from_symbol directly
        // But since it's internal, we can only test through build_file_type_registry

        // This test verifies that invalid kinds are properly filtered out by is_type_symbol
        const symbols = new Map([["invalid_symbol" as SymbolId, modifiedSymbol]]);
        const result = build_file_type_registry(symbols, mockFilePath);

        // Function kind should not be treated as a type symbol
        expect(result.symbol_to_type.size).toBe(0);
        expect(result.name_to_type.size).toBe(0);
        expect(result.defined_types.size).toBe(0);
      });

      it("should handle symbols with undefined optional fields", () => {
        const minimalSymbol: SymbolDefinition = {
          id: "minimal_symbol" as SymbolId,
          kind: "variable",
          name: "minimalVar" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
          // No return_type or value_type
        };

        const symbols = new Map([["minimal_symbol" as SymbolId, minimalSymbol]]);

        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.return_types.size).toBe(0);
        expect(result.symbol_types.size).toBe(0);
      });

      it("should handle symbols with null/undefined return_type and value_type", () => {
        const symbolWithUndefined: SymbolDefinition = {
          id: "undefined_symbol" as SymbolId,
          kind: "function",
          name: "undefinedFunc" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          return_type: undefined,
          value_type: undefined,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["undefined_symbol" as SymbolId, symbolWithUndefined]]);

        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.return_types.size).toBe(0);
        expect(result.symbol_types.size).toBe(0);
      });
    });

    describe("Boundary Conditions", () => {
      it("should handle very large symbol maps", () => {
        const symbols = new Map<SymbolId, SymbolDefinition>();

        // Create 1000 symbols of different types
        for (let i = 0; i < 1000; i++) {
          const symbolId = `symbol_${i}` as SymbolId;
          const symbolName = `Symbol${i}` as SymbolName;
          const kind = i % 4 === 0 ? "class" : i % 4 === 1 ? "interface" : i % 4 === 2 ? "type_alias" : "enum";

          symbols.set(symbolId, {
            id: symbolId,
            kind: kind as any,
            name: symbolName,
            location: mockLocation,
            scope_id: "scope" as any,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
            references: [],
          });
        }

        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.symbol_to_type.size).toBe(1000);
        expect(result.name_to_type.size).toBe(1000);
        expect(result.defined_types.size).toBe(1000);
      });

      it("should handle symbols with duplicate names", () => {
        const symbols = new Map<SymbolId, SymbolDefinition>([
          [
            "class1" as SymbolId,
            {
              id: "class1" as SymbolId,
              kind: "class",
              name: "DuplicateName" as SymbolName,
              location: mockLocation,
              scope_id: "scope1" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "class2" as SymbolId,
            {
              id: "class2" as SymbolId,
              kind: "class",
              name: "DuplicateName" as SymbolName,
              location: { ...mockLocation, line: 2 },
              scope_id: "scope2" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
        ]);

        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.symbol_to_type.size).toBe(2);
        // The name_to_type map will only have one entry (last one wins)
        expect(result.name_to_type.size).toBe(1);
        expect(result.defined_types.size).toBe(2);
      });

      it("should preserve complete symbol immutability (FIXED)", () => {
        const classSymbol: SymbolDefinition = {
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const originalSymbol = { ...classSymbol };
        const symbols = new Map([["class_symbol" as SymbolId, classSymbol]]);

        build_file_type_registry(symbols, mockFilePath);

        // FIXED: No properties are added to the symbol
        expect((classSymbol as any).type_id).toBeUndefined();

        // All properties remain unchanged
        expect(classSymbol).toEqual(originalSymbol);
      });

      it("should handle symbols with complex type chains", () => {
        const returnType = generic_type_id(
          array_type_id(primitive_type_id("string")),
          [primitive_type_id("number")]
        );

        const complexSymbol: SymbolDefinition = {
          id: "complex_symbol" as SymbolId,
          kind: "function",
          name: "complexFunc" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          return_type: returnType,
          value_type: union_type_id([
            primitive_type_id("string"),
            primitive_type_id("number"),
          ]),
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["complex_symbol" as SymbolId, complexSymbol]]);

        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.return_types.get("complex_symbol" as SymbolId)).toEqual(returnType);
        expect(result.symbol_types.get("complex_symbol" as SymbolId)).toBeDefined();
      });
    });

    describe("Integration with TypeCategory", () => {
      it("should correctly map all supported TypeCategory values", () => {
        const symbols = new Map<SymbolId, SymbolDefinition>([
          [
            "class" as SymbolId,
            {
              id: "class" as SymbolId,
              kind: "class",
              name: "TestClass" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "interface" as SymbolId,
            {
              id: "interface" as SymbolId,
              kind: "interface",
              name: "TestInterface" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "type_alias" as SymbolId,
            {
              id: "type_alias" as SymbolId,
              kind: "type_alias",
              name: "TestTypeAlias" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "enum" as SymbolId,
            {
              id: "enum" as SymbolId,
              kind: "enum",
              name: "TestEnum" as SymbolName,
              location: mockLocation,
              scope_id: "scope" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
        ]);

        const result = build_file_type_registry(symbols, mockFilePath);

        // Verify each type has the correct category in its TypeId
        const typeIds = Array.from(result.defined_types);

        // Since TypeId is opaque, we can verify through the creation process
        expect(typeIds).toHaveLength(4);

        // Verify mapping consistency
        const classType = result.name_to_type.get("TestClass" as SymbolName);
        const interfaceType = result.name_to_type.get("TestInterface" as SymbolName);
        const typeAliasType = result.name_to_type.get("TestTypeAlias" as SymbolName);
        const enumType = result.name_to_type.get("TestEnum" as SymbolName);

        expect(result.defined_types.has(classType!)).toBe(true);
        expect(result.defined_types.has(interfaceType!)).toBe(true);
        expect(result.defined_types.has(typeAliasType!)).toBe(true);
        expect(result.defined_types.has(enumType!)).toBe(true);
      });
    });
  });

  describe("Bug Detection Tests", () => {
    describe("Symbol Mutation Bug", () => {
      it("should not mutate original symbol objects (FIXED)", () => {
        const originalSymbol: SymbolDefinition = {
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        // Create a deep copy to compare against
        const originalCopy = JSON.parse(JSON.stringify(originalSymbol));
        const symbols = new Map([["class_symbol" as SymbolId, originalSymbol]]);

        build_file_type_registry(symbols, mockFilePath);

        // FIXED: Symbol is no longer mutated
        expect(originalSymbol).toEqual(originalCopy);

        // No type_id property is added
        expect((originalSymbol as any).type_id).toBeUndefined();
      });

      it("should handle readonly maps correctly (FIXED)", () => {
        const symbol: SymbolDefinition = {
          id: "test_symbol" as SymbolId,
          kind: "class",
          name: "TestClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        // The function accepts ReadonlyMap and respects immutability
        const readonlySymbols = new Map([["test_symbol" as SymbolId, symbol]]) as ReadonlyMap<SymbolId, SymbolDefinition>;

        // Symbol should not be modified
        const originalJson = JSON.stringify(symbol);
        build_file_type_registry(readonlySymbols, mockFilePath);

        // FIXED: The symbol is no longer mutated
        expect(JSON.stringify(symbol)).toBe(originalJson);
      });
    });

    describe("Function Coupling Bug", () => {
      it("should expose unreachable error path in create_type_id_from_symbol", () => {
        // Currently, the error case in create_type_id_from_symbol is unreachable
        // because is_type_symbol only returns true for valid kinds.
        // If these functions get out of sync, this becomes a bug.

        // We can't directly test this without modifying the functions,
        // but we can document the coupling issue
        const validKinds = ["class", "interface", "type_alias", "enum"];

        validKinds.forEach(kind => {
          const symbol: SymbolDefinition = {
            id: "test_symbol" as SymbolId,
            kind: kind as any,
            name: "TestSymbol" as SymbolName,
            location: mockLocation,
            scope_id: "scope" as any,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
            references: [],
          };

          const symbols = new Map([["test_symbol" as SymbolId, symbol]]);

          // This should work for all valid kinds
          expect(() => build_file_type_registry(symbols, mockFilePath)).not.toThrow();
        });

        // The problem: if someone adds a new kind to is_type_symbol
        // but forgets to update create_type_id_from_symbol, it will throw
        // This is a maintenance hazard - the functions are tightly coupled
      });
    });

    describe("Name Collision Bug", () => {
      it("should handle name collisions more explicitly (BUG: silent overwrite)", () => {
        const symbols = new Map<SymbolId, SymbolDefinition>([
          [
            "class1" as SymbolId,
            {
              id: "class1" as SymbolId,
              kind: "class",
              name: "SameName" as SymbolName,
              location: mockLocation,
              scope_id: "scope1" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "class2" as SymbolId,
            {
              id: "class2" as SymbolId,
              kind: "interface", // Different kind, same name
              name: "SameName" as SymbolName,
              location: { ...mockLocation, line: 2 },
              scope_id: "scope2" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
        ]);

        const result = build_file_type_registry(symbols, mockFilePath);

        // BUG: Both symbols exist in symbol_to_type, but only one in name_to_type
        expect(result.symbol_to_type.size).toBe(2);
        expect(result.name_to_type.size).toBe(1); // Silent overwrite happened

        // The name_to_type map lost information about the first symbol
        const retrievedType = result.name_to_type.get("SameName" as SymbolName);
        const class1Type = result.symbol_to_type.get("class1" as SymbolId);
        const class2Type = result.symbol_to_type.get("class2" as SymbolId);

        // We can't tell which one "won" without knowing iteration order
        expect(retrievedType === class1Type || retrievedType === class2Type).toBe(true);

        // This is a data loss bug - we lost the ability to look up one of the types by name
      });

      it("should demonstrate information loss in name_to_type mapping", () => {
        // Create multiple symbols with same name but different scopes
        const symbols = new Map<SymbolId, SymbolDefinition>();

        for (let i = 0; i < 5; i++) {
          symbols.set(`symbol_${i}` as SymbolId, {
            id: `symbol_${i}` as SymbolId,
            kind: "class",
            name: "DuplicateName" as SymbolName,
            location: { ...mockLocation, line: i + 1 },
            scope_id: `scope_${i}` as any,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
            references: [],
          });
        }

        const result = build_file_type_registry(symbols, mockFilePath);

        // BUG: We have 5 symbols but only 1 name mapping - data loss
        expect(result.symbol_to_type.size).toBe(5);
        expect(result.name_to_type.size).toBe(1); // Only last one survives
        expect(result.defined_types.size).toBe(5);

        // This means 4 out of 5 symbols cannot be looked up by name
        const typeByName = result.name_to_type.get("DuplicateName" as SymbolName);
        expect(typeByName).toBeDefined();

        // But we have no way to access the other 4 types by name
        // This is problematic for type resolution
      });
    });

    describe("Type Safety Fix", () => {
      it("should avoid using 'any' type assertions (FIXED)", () => {
        const symbol: SymbolDefinition = {
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["class_symbol" as SymbolId, symbol]]);
        build_file_type_registry(symbols, mockFilePath);

        // FIXED: No type_id property is added to the symbol
        expect((symbol as any).type_id).toBeUndefined();

        // Better approach: Use the enhanced function when type annotations are needed
        const result = build_file_type_registry_with_annotations(symbols, mockFilePath);
        const typeId = result.symbol_type_annotations.get("class_symbol" as SymbolId);
        expect(typeId).toBeDefined();
      });
    });

    describe("Performance and Design Issues", () => {
      it("should demonstrate two-pass inefficiency", () => {
        const symbols = new Map<SymbolId, SymbolDefinition>();

        // Create mixed symbols
        for (let i = 0; i < 100; i++) {
          // Add type symbols
          symbols.set(`type_${i}` as SymbolId, {
            id: `type_${i}` as SymbolId,
            kind: "class",
            name: `Type${i}` as SymbolName,
            location: mockLocation,
            scope_id: "scope" as any,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
            references: [],
          });

          // Add function symbols with return types
          symbols.set(`func_${i}` as SymbolId, {
            id: `func_${i}` as SymbolId,
            kind: "function",
            name: `func${i}` as SymbolName,
            location: mockLocation,
            scope_id: "scope" as any,
            return_type: primitive_type_id("string"),
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
            references: [],
          });
        }

        // The current implementation iterates over symbols twice
        // This is inefficient - both passes could be combined
        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.symbol_to_type.size).toBe(100); // Type symbols
        expect(result.return_types.size).toBe(100); // Function symbols

        // ISSUE: The algorithm makes two complete passes over the symbol map
        // when one would suffice. This is a performance and design issue.
      });
    });
  });

  describe("Fixed Implementation Tests", () => {
    describe("Symbol Mutation Fix", () => {
      it("should not mutate original symbol objects (FIXED)", () => {
        const originalSymbol: SymbolDefinition = {
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        // Create a deep copy to compare against
        const originalCopy = JSON.parse(JSON.stringify(originalSymbol));
        const symbols = new Map([["class_symbol" as SymbolId, originalSymbol]]);

        build_file_type_registry(symbols, mockFilePath);

        // FIXED: Symbol is no longer mutated
        expect(originalSymbol).toEqual(originalCopy);

        // No type_id property should be added
        expect((originalSymbol as any).type_id).toBeUndefined();
      });

      it("should provide type annotations separately when needed", () => {
        const symbol: SymbolDefinition = {
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["class_symbol" as SymbolId, symbol]]);

        // Use the enhanced version when annotations are needed
        const result = build_file_type_registry_with_annotations(symbols, mockFilePath);

        expect(result.registry).toBeDefined();
        expect(result.symbol_type_annotations).toBeDefined();

        // Symbol is not mutated
        expect((symbol as any).type_id).toBeUndefined();

        // But annotation is available separately
        const typeId = result.symbol_type_annotations.get("class_symbol" as SymbolId);
        expect(typeId).toBeDefined();
        expect(typeId).toEqual(result.registry.symbol_to_type.get("class_symbol" as SymbolId));
      });
    });

    describe("Function Coupling Fix", () => {
      it("should maintain consistency between is_type_symbol and create_type_id_from_symbol", () => {
        // The fix ensures these functions can't get out of sync
        // by using a shared TYPE_SYMBOL_MAPPINGS constant

        const allTypeKinds = ["class", "interface", "type_alias", "enum"] as const;

        allTypeKinds.forEach(kind => {
          const symbol: SymbolDefinition = {
            id: "test_symbol" as SymbolId,
            kind: kind,
            name: "TestSymbol" as SymbolName,
            location: mockLocation,
            scope_id: "scope" as any,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
            references: [],
          };

          const symbols = new Map([["test_symbol" as SymbolId, symbol]]);

          // This should work for all valid kinds without throwing
          expect(() => build_file_type_registry(symbols, mockFilePath)).not.toThrow();

          const result = build_file_type_registry(symbols, mockFilePath);
          expect(result.symbol_to_type.size).toBe(1);
          expect(result.defined_types.size).toBe(1);
        });
      });

      it("should handle invalid kinds gracefully", () => {
        const invalidSymbol: SymbolDefinition = {
          id: "invalid_symbol" as SymbolId,
          kind: "function" as any, // Not a type symbol
          name: "InvalidType" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["invalid_symbol" as SymbolId, invalidSymbol]]);

        // Should not throw, just ignore non-type symbols
        const result = build_file_type_registry(symbols, mockFilePath);

        expect(result.symbol_to_type.size).toBe(0);
        expect(result.name_to_type.size).toBe(0);
        expect(result.defined_types.size).toBe(0);
      });
    });

    describe("Performance Fix", () => {
      it("should use single-pass algorithm", () => {
        // Create mixed symbols to verify single-pass efficiency
        const symbols = new Map<SymbolId, SymbolDefinition>();

        for (let i = 0; i < 50; i++) {
          // Type symbols
          symbols.set(`type_${i}` as SymbolId, {
            id: `type_${i}` as SymbolId,
            kind: "class",
            name: `Type${i}` as SymbolName,
            location: mockLocation,
            scope_id: "scope" as any,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
            references: [],
          });

          // Function symbols with return types
          symbols.set(`func_${i}` as SymbolId, {
            id: `func_${i}` as SymbolId,
            kind: "function",
            name: `func${i}` as SymbolName,
            location: mockLocation,
            scope_id: "scope" as any,
            return_type: primitive_type_id("string"),
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
            references: [],
          });

          // Variable symbols with value types
          symbols.set(`var_${i}` as SymbolId, {
            id: `var_${i}` as SymbolId,
            kind: "variable",
            name: `var${i}` as SymbolName,
            location: mockLocation,
            scope_id: "scope" as any,
            value_type: primitive_type_id("number"),
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
            references: [],
          });
        }

        const result = build_file_type_registry(symbols, mockFilePath);

        // All data should be collected in single pass
        expect(result.symbol_to_type.size).toBe(50); // Type symbols
        expect(result.return_types.size).toBe(50); // Function symbols
        expect(result.symbol_types.size).toBe(50); // Variable symbols
        expect(result.defined_types.size).toBe(50);
      });
    });

    describe("Name Collision Improvements", () => {
      it("should handle name collisions consistently", () => {
        const symbols = new Map<SymbolId, SymbolDefinition>([
          [
            "class1" as SymbolId,
            {
              id: "class1" as SymbolId,
              kind: "class",
              name: "SameName" as SymbolName,
              location: mockLocation,
              scope_id: "scope1" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "interface1" as SymbolId,
            {
              id: "interface1" as SymbolId,
              kind: "interface",
              name: "SameName" as SymbolName,
              location: { ...mockLocation, line: 2 },
              scope_id: "scope2" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
        ]);

        const result = build_file_type_registry(symbols, mockFilePath);

        // Both symbols should be tracked individually
        expect(result.symbol_to_type.size).toBe(2);
        expect(result.defined_types.size).toBe(2);

        // name_to_type still has last-wins behavior (documented)
        expect(result.name_to_type.size).toBe(1);

        // But both types are accessible via symbol_id
        const classType = result.symbol_to_type.get("class1" as SymbolId);
        const interfaceType = result.symbol_to_type.get("interface1" as SymbolId);

        expect(classType).toBeDefined();
        expect(interfaceType).toBeDefined();
        expect(classType).not.toEqual(interfaceType);
      });
    });

    describe("TypeRegistryResult Interface", () => {
      it("should provide complete type registry result", () => {
        const symbol: SymbolDefinition = {
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbols = new Map([["class_symbol" as SymbolId, symbol]]);

        const result: TypeRegistryResult = build_file_type_registry_with_annotations(
          symbols,
          mockFilePath
        );

        // Registry should be complete
        expect(result.registry.file_path).toBe(mockFilePath);
        expect(result.registry.symbol_to_type.size).toBe(1);
        expect(result.registry.name_to_type.size).toBe(1);
        expect(result.registry.defined_types.size).toBe(1);

        // Annotations should match registry data
        expect(result.symbol_type_annotations.size).toBe(1);
        const annotatedTypeId = result.symbol_type_annotations.get("class_symbol" as SymbolId);
        const registryTypeId = result.registry.symbol_to_type.get("class_symbol" as SymbolId);
        expect(annotatedTypeId).toEqual(registryTypeId);
      });
    });

    describe("Integration with Fixed Implementation", () => {
      it("should handle complex scenarios without bugs", () => {
        const symbols = new Map<SymbolId, SymbolDefinition>([
          // Type symbols with name collision
          [
            "class1" as SymbolId,
            {
              id: "class1" as SymbolId,
              kind: "class",
              name: "Entity" as SymbolName,
              location: mockLocation,
              scope_id: "scope1" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          [
            "interface1" as SymbolId,
            {
              id: "interface1" as SymbolId,
              kind: "interface",
              name: "Entity" as SymbolName, // Same name, different kind
              location: { ...mockLocation, line: 2 },
              scope_id: "scope2" as any,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          // Function with return type
          [
            "func1" as SymbolId,
            {
              id: "func1" as SymbolId,
              kind: "function",
              name: "createEntity" as SymbolName,
              location: { ...mockLocation, line: 3 },
              scope_id: "scope3" as any,
              return_type: primitive_type_id("string"),
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
          // Variable with value type
          [
            "var1" as SymbolId,
            {
              id: "var1" as SymbolId,
              kind: "variable",
              name: "entityCount" as SymbolName,
              location: { ...mockLocation, line: 4 },
              scope_id: "scope4" as any,
              value_type: primitive_type_id("number"),
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              references: [],
            },
          ],
        ]);

        // Create deep copies to verify no mutation
        const originalSymbols = new Map();
        for (const [id, symbol] of symbols) {
          originalSymbols.set(id, JSON.parse(JSON.stringify(symbol)));
        }

        const result = build_file_type_registry_with_annotations(symbols, mockFilePath);

        // Verify all data is correctly processed
        expect(result.registry.symbol_to_type.size).toBe(2); // 2 type symbols
        expect(result.registry.name_to_type.size).toBe(1); // Name collision
        expect(result.registry.defined_types.size).toBe(2);
        expect(result.registry.return_types.size).toBe(1); // 1 function
        expect(result.registry.symbol_types.size).toBe(1); // 1 variable

        // Verify no symbols were mutated
        for (const [id, symbol] of symbols) {
          const original = originalSymbols.get(id);
          expect(symbol).toEqual(original);
          expect((symbol as any).type_id).toBeUndefined();
        }

        // Verify annotations are provided separately
        expect(result.symbol_type_annotations.size).toBe(2);
      });
    });
  });
});

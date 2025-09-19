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
import type { TypeInfo } from "../references/type_tracking/type_tracking";
import type { FileTypeRegistry } from "../type_registry/type_registry";
import {
  resolve_type_info,
  build_file_type_registry,
  resolve_all_types,
  resolve_reference_types,
  create_union_type,
  infer_type_from_constructor,
  resolve_inheritance_chain,
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

  describe("resolve_type_info", () => {
    describe("Primitive Types", () => {
      it("should resolve string type", () => {
        const typeInfo: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

        expect(result).toEqual(primitive_type_id("string"));
      });

      it("should resolve all primitive types", () => {
        const primitives = [
          "string",
          "number",
          "boolean",
          "symbol",
          "bigint",
          "undefined",
          "null",
        ];

        for (const primitive of primitives) {
          const typeInfo: TypeInfo = {
            type_name: primitive as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          };

          const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

          expect(result).toEqual(primitive_type_id(primitive as any));
        }
      });
    });

    describe("Built-in Types", () => {
      it("should resolve built-in types", () => {
        const builtins = [
          "Date",
          "RegExp",
          "Error",
          "Promise",
          "Map",
          "Set",
          "Array",
          "Object",
          "Function",
        ];

        for (const builtin of builtins) {
          const typeInfo: TypeInfo = {
            type_name: builtin as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          };

          const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

          expect(result).toEqual(builtin_type_id(builtin as any));
        }
      });
    });

    describe("Special Types", () => {
      it("should resolve any type", () => {
        const typeInfo: TypeInfo = {
          type_name: "any" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

        expect(result).toEqual(ANY_TYPE);
      });

      it("should resolve unknown type", () => {
        const typeInfo: TypeInfo = {
          type_name: "unknown" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

        expect(result).toEqual(UNKNOWN_TYPE);
      });
    });

    describe("Registry Types", () => {
      it("should resolve registered types", () => {
        const customTypeId = defined_type_id(
          TypeCategory.CLASS,
          "CustomType" as SymbolName,
          mockLocation
        );
        (mockRegistry.name_to_type as Map<SymbolName, TypeId>).set(
          "CustomType" as SymbolName,
          customTypeId
        );

        const typeInfo: TypeInfo = {
          type_name: "CustomType" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

        expect(result).toEqual(customTypeId);
      });
    });

    describe("Symbol Types", () => {
      it("should resolve class symbols", () => {
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

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const typeInfo: TypeInfo = {
          type_name: "MyClass" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

        expect(result).toEqual(
          defined_type_id(
            TypeCategory.CLASS,
            "MyClass" as SymbolName,
            mockLocation
          )
        );
      });

      it("should resolve interface symbols", () => {
        const interfaceSymbol: SymbolDefinition = {
          id: "interface_symbol" as SymbolId,
          kind: "interface",
          name: "IInterface" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        mockSymbols.set("interface_symbol" as SymbolId, interfaceSymbol);

        const typeInfo: TypeInfo = {
          type_name: "IInterface" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

        expect(result).toEqual(
          defined_type_id(
            TypeCategory.INTERFACE,
            "IInterface" as SymbolName,
            mockLocation
          )
        );
      });

      it("should resolve type alias symbols", () => {
        const aliasSymbol: SymbolDefinition = {
          id: "alias_symbol" as SymbolId,
          kind: "type_alias",
          name: "StringAlias" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        mockSymbols.set("alias_symbol" as SymbolId, aliasSymbol);

        const typeInfo: TypeInfo = {
          type_name: "StringAlias" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

        expect(result).toEqual(
          defined_type_id(
            TypeCategory.TYPE_ALIAS,
            "StringAlias" as SymbolName,
            mockLocation
          )
        );
      });

      it("should resolve enum symbols", () => {
        const enumSymbol: SymbolDefinition = {
          id: "enum_symbol" as SymbolId,
          kind: "enum",
          name: "MyEnum" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        mockSymbols.set("enum_symbol" as SymbolId, enumSymbol);

        const typeInfo: TypeInfo = {
          type_name: "MyEnum" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

        expect(result).toEqual(
          defined_type_id(
            TypeCategory.ENUM,
            "MyEnum" as SymbolName,
            mockLocation
          )
        );
      });
    });

    describe("Array Types", () => {
      it("should resolve array types", () => {
        const elementType: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const arrayType: TypeInfo = {
          type_name: "Array" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
          is_array: true,
          type_args: [elementType],
        };

        const result = resolve_type_info(arrayType, mockSymbols, mockRegistry);

        expect(result).toEqual(array_type_id(primitive_type_id("string")));
      });

      it("should handle array types with unresolvable elements", () => {
        const elementType: TypeInfo = {
          type_name: "UnknownElement" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const arrayType: TypeInfo = {
          type_name: "Array" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
          is_array: true,
          type_args: [elementType],
        };

        const result = resolve_type_info(arrayType, mockSymbols, mockRegistry);

        expect(result).toBeUndefined();
      });
    });

    describe("Generic Types", () => {
      it("should resolve generic types", () => {
        const baseTypeId = defined_type_id(
          TypeCategory.CLASS,
          "Promise" as SymbolName,
          mockLocation
        );
        (mockRegistry.name_to_type as Map<SymbolName, TypeId>).set(
          "Promise" as SymbolName,
          baseTypeId
        );

        const argType: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const genericType: TypeInfo = {
          type_name: "Promise" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
          type_args: [argType],
        };

        const result = resolve_type_info(
          genericType,
          mockSymbols,
          mockRegistry
        );

        expect(result).toEqual(
          generic_type_id(baseTypeId, [primitive_type_id("string")])
        );
      });

      it("should handle partial generic resolution", () => {
        const baseTypeId = defined_type_id(
          TypeCategory.CLASS,
          "Map" as SymbolName,
          mockLocation
        );
        (mockRegistry.name_to_type as Map<SymbolName, TypeId>).set(
          "Map" as SymbolName,
          baseTypeId
        );

        const keyType: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const valueType: TypeInfo = {
          type_name: "UnknownType" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const genericType: TypeInfo = {
          type_name: "Map" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
          type_args: [keyType, valueType],
        };

        const result = resolve_type_info(
          genericType,
          mockSymbols,
          mockRegistry
        );

        expect(result).toBeUndefined();
      });
    });

    describe("Edge Cases", () => {
      it("should return existing type_id if already resolved", () => {
        const existingTypeId = primitive_type_id("string");

        const typeInfo: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
          type_id: existingTypeId,
        };

        const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

        expect(result).toEqual(existingTypeId);
      });

      it("should return undefined for unresolvable types", () => {
        const typeInfo: TypeInfo = {
          type_name: "CompletelyUnknown" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

        expect(result).toBeUndefined();
      });

      it("should skip non-type symbols", () => {
        const variableSymbol: SymbolDefinition = {
          id: "var_symbol" as SymbolId,
          kind: "variable",
          name: "myVar" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        mockSymbols.set("var_symbol" as SymbolId, variableSymbol);

        const typeInfo: TypeInfo = {
          type_name: "myVar" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const result = resolve_type_info(typeInfo, mockSymbols, mockRegistry);

        expect(result).toBeUndefined();
      });
    });
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

      it("should store type_id on symbols", () => {
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

        expect((classSymbol as any).type_id).toBeDefined();
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
    });
  });

  describe("resolve_all_types", () => {
    describe("Success Cases", () => {
      it("should resolve multiple TypeInfo objects", () => {
        const typeInfos: TypeInfo[] = [
          {
            type_name: "string" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
          {
            type_name: "number" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        ];

        const result = resolve_all_types(typeInfos, mockSymbols, mockRegistry);

        expect(result.size).toBe(2);
        expect(result.get(typeInfos[0])).toEqual(primitive_type_id("string"));
        expect(result.get(typeInfos[1])).toEqual(primitive_type_id("number"));

        // Should also update the TypeInfo objects
        expect(typeInfos[0].type_id).toEqual(primitive_type_id("string"));
        expect(typeInfos[1].type_id).toEqual(primitive_type_id("number"));
      });

      it("should handle partial resolution", () => {
        const typeInfos: TypeInfo[] = [
          {
            type_name: "string" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
          {
            type_name: "UnknownType" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        ];

        const result = resolve_all_types(typeInfos, mockSymbols, mockRegistry);

        expect(result.size).toBe(1);
        expect(result.get(typeInfos[0])).toEqual(primitive_type_id("string"));
        expect(result.has(typeInfos[1])).toBe(false);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty array", () => {
        const result = resolve_all_types([], mockSymbols, mockRegistry);

        expect(result.size).toBe(0);
      });

      it("should handle all unresolvable types", () => {
        const typeInfos: TypeInfo[] = [
          {
            type_name: "Unknown1" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
          {
            type_name: "Unknown2" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        ];

        const result = resolve_all_types(typeInfos, mockSymbols, mockRegistry);

        expect(result.size).toBe(0);
      });
    });
  });

  describe("resolve_reference_types", () => {
    describe("Success Cases", () => {
      it("should resolve types in references", () => {
        const typeInfo: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const references = [
          { type_info: typeInfo },
          { other_prop: "no type_info" },
        ];

        resolve_reference_types(references, mockSymbols, mockRegistry);

        expect(typeInfo.type_id).toEqual(primitive_type_id("string"));
      });

      it("should handle references without type_info", () => {
        const references = [
          { other_prop: "no type_info" },
          { type_info: undefined },
        ];

        expect(() => {
          resolve_reference_types(references, mockSymbols, mockRegistry);
        }).not.toThrow();
      });

      it("should handle unresolvable types gracefully", () => {
        const typeInfo: TypeInfo = {
          type_name: "UnknownType" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        };

        const references = [{ type_info: typeInfo }];

        resolve_reference_types(references, mockSymbols, mockRegistry);

        expect(typeInfo.type_id).toBeUndefined();
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty references array", () => {
        expect(() => {
          resolve_reference_types([], mockSymbols, mockRegistry);
        }).not.toThrow();
      });
    });
  });

  describe("create_union_type", () => {
    describe("Success Cases", () => {
      it("should create union from multiple types", () => {
        const types: TypeInfo[] = [
          {
            type_name: "string" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
          {
            type_name: "number" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        ];

        const result = create_union_type(types, mockSymbols, mockRegistry);

        expect(result).toEqual(
          union_type_id([
            primitive_type_id("string"),
            primitive_type_id("number"),
          ])
        );
      });

      it("should return single type for one element", () => {
        const types: TypeInfo[] = [
          {
            type_name: "string" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        ];

        const result = create_union_type(types, mockSymbols, mockRegistry);

        expect(result).toEqual(primitive_type_id("string"));
      });

      it("should return UNKNOWN_TYPE for empty array", () => {
        const result = create_union_type([], mockSymbols, mockRegistry);

        expect(result).toEqual(UNKNOWN_TYPE);
      });

      it("should filter out unresolvable types", () => {
        const types: TypeInfo[] = [
          {
            type_name: "string" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
          {
            type_name: "UnknownType" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        ];

        const result = create_union_type(types, mockSymbols, mockRegistry);

        expect(result).toEqual(primitive_type_id("string"));
      });
    });

    describe("Edge Cases", () => {
      it("should handle all unresolvable types", () => {
        const types: TypeInfo[] = [
          {
            type_name: "Unknown1" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
          {
            type_name: "Unknown2" as SymbolName,
            certainty: "declared",
            source: { kind: "annotation", location: mockLocation },
          },
        ];

        const result = create_union_type(types, mockSymbols, mockRegistry);

        expect(result).toEqual(UNKNOWN_TYPE);
      });
    });
  });

  describe("infer_type_from_constructor", () => {
    describe("Success Cases", () => {
      it("should infer type from class constructor", () => {
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

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const result = infer_type_from_constructor(
          "MyClass" as SymbolName,
          mockSymbols,
          mockRegistry
        );

        expect(result).toEqual(
          defined_type_id(
            TypeCategory.CLASS,
            "MyClass" as SymbolName,
            mockLocation
          )
        );
      });

      it("should use existing type_id from symbol", () => {
        const existingTypeId = defined_type_id(
          TypeCategory.CLASS,
          "MyClass" as SymbolName,
          mockLocation
        );

        const classSymbol: SymbolDefinition = {
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          type_id: existingTypeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const result = infer_type_from_constructor(
          "MyClass" as SymbolName,
          mockSymbols,
          mockRegistry
        );

        expect(result).toEqual(existingTypeId);
      });

      it("should check registry when symbol not found", () => {
        const registryTypeId = defined_type_id(
          TypeCategory.CLASS,
          "RegistryClass" as SymbolName,
          mockLocation
        );
        (mockRegistry.name_to_type as Map<SymbolName, TypeId>).set(
          "RegistryClass" as SymbolName,
          registryTypeId
        );

        const result = infer_type_from_constructor(
          "RegistryClass" as SymbolName,
          mockSymbols,
          mockRegistry
        );

        expect(result).toEqual(registryTypeId);
      });
    });

    describe("Edge Cases", () => {
      it("should return undefined for unknown constructor", () => {
        const result = infer_type_from_constructor(
          "UnknownClass" as SymbolName,
          mockSymbols,
          mockRegistry
        );

        expect(result).toBeUndefined();
      });

      it("should skip non-class symbols", () => {
        const interfaceSymbol: SymbolDefinition = {
          id: "interface_symbol" as SymbolId,
          kind: "interface",
          name: "MyInterface" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        mockSymbols.set("interface_symbol" as SymbolId, interfaceSymbol);

        const result = infer_type_from_constructor(
          "MyInterface" as SymbolName,
          mockSymbols,
          mockRegistry
        );

        expect(result).toBeUndefined();
      });
    });
  });

  describe("resolve_inheritance_chain", () => {
    describe("Success Cases", () => {
      it("should resolve simple inheritance chain", () => {
        const baseTypeId = defined_type_id(
          TypeCategory.CLASS,
          "BaseClass" as SymbolName,
          mockLocation
        );
        const derivedTypeId = defined_type_id(
          TypeCategory.CLASS,
          "DerivedClass" as SymbolName,
          mockLocation
        );

        const baseSymbol: SymbolDefinition = {
          id: "base_symbol" as SymbolId,
          kind: "class",
          name: "BaseClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          type_id: baseTypeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const derivedSymbol: SymbolDefinition = {
          id: "derived_symbol" as SymbolId,
          kind: "class",
          name: "DerivedClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          type_id: derivedTypeId,
          extends_class: "BaseClass" as SymbolName,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        mockSymbols.set("base_symbol" as SymbolId, baseSymbol);
        mockSymbols.set("derived_symbol" as SymbolId, derivedSymbol);
        (mockRegistry.name_to_type as Map<SymbolName, TypeId>).set(
          "BaseClass" as SymbolName,
          baseTypeId
        );

        const result = resolve_inheritance_chain(
          derivedTypeId,
          mockSymbols,
          mockRegistry
        );

        expect(result).toEqual([derivedTypeId, baseTypeId]);
      });

      it("should handle multiple inheritance levels", () => {
        const grandParentTypeId = defined_type_id(
          TypeCategory.CLASS,
          "GrandParent" as SymbolName,
          mockLocation
        );
        const parentTypeId = defined_type_id(
          TypeCategory.CLASS,
          "Parent" as SymbolName,
          mockLocation
        );
        const childTypeId = defined_type_id(
          TypeCategory.CLASS,
          "Child" as SymbolName,
          mockLocation
        );

        const grandParentSymbol: SymbolDefinition = {
          id: "grandparent_symbol" as SymbolId,
          kind: "class",
          name: "GrandParent" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          type_id: grandParentTypeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const parentSymbol: SymbolDefinition = {
          id: "parent_symbol" as SymbolId,
          kind: "class",
          name: "Parent" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          type_id: parentTypeId,
          extends_class: "GrandParent" as SymbolName,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const childSymbol: SymbolDefinition = {
          id: "child_symbol" as SymbolId,
          kind: "class",
          name: "Child" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          type_id: childTypeId,
          extends_class: "Parent" as SymbolName,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        mockSymbols.set("grandparent_symbol" as SymbolId, grandParentSymbol);
        mockSymbols.set("parent_symbol" as SymbolId, parentSymbol);
        mockSymbols.set("child_symbol" as SymbolId, childSymbol);
        (mockRegistry.name_to_type as Map<SymbolName, TypeId>).set(
          "GrandParent" as SymbolName,
          grandParentTypeId
        );
        (mockRegistry.name_to_type as Map<SymbolName, TypeId>).set(
          "Parent" as SymbolName,
          parentTypeId
        );

        const result = resolve_inheritance_chain(
          childTypeId,
          mockSymbols,
          mockRegistry
        );

        expect(result).toEqual([childTypeId, parentTypeId, grandParentTypeId]);
      });

      it("should handle circular inheritance", () => {
        const type1Id = defined_type_id(
          TypeCategory.CLASS,
          "Class1" as SymbolName,
          mockLocation
        );
        const type2Id = defined_type_id(
          TypeCategory.CLASS,
          "Class2" as SymbolName,
          mockLocation
        );

        const symbol1: SymbolDefinition = {
          id: "symbol1" as SymbolId,
          kind: "class",
          name: "Class1" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          type_id: type1Id,
          extends_class: "Class2" as SymbolName,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        const symbol2: SymbolDefinition = {
          id: "symbol2" as SymbolId,
          kind: "class",
          name: "Class2" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          type_id: type2Id,
          extends_class: "Class1" as SymbolName,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        mockSymbols.set("symbol1" as SymbolId, symbol1);
        mockSymbols.set("symbol2" as SymbolId, symbol2);
        (mockRegistry.name_to_type as Map<SymbolName, TypeId>).set(
          "Class1" as SymbolName,
          type1Id
        );
        (mockRegistry.name_to_type as Map<SymbolName, TypeId>).set(
          "Class2" as SymbolName,
          type2Id
        );

        const result = resolve_inheritance_chain(
          type1Id,
          mockSymbols,
          mockRegistry
        );

        expect(result).toEqual([type1Id, type2Id]);
      });
    });

    describe("Edge Cases", () => {
      it("should handle type with no inheritance", () => {
        const typeId = defined_type_id(
          TypeCategory.CLASS,
          "StandaloneClass" as SymbolName,
          mockLocation
        );

        const symbol: SymbolDefinition = {
          id: "symbol" as SymbolId,
          kind: "class",
          name: "StandaloneClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          type_id: typeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        mockSymbols.set("symbol" as SymbolId, symbol);

        const result = resolve_inheritance_chain(
          typeId,
          mockSymbols,
          mockRegistry
        );

        expect(result).toEqual([typeId]);
      });

      it("should handle unknown parent types", () => {
        const typeId = defined_type_id(
          TypeCategory.CLASS,
          "DerivedClass" as SymbolName,
          mockLocation
        );

        const symbol: SymbolDefinition = {
          id: "symbol" as SymbolId,
          kind: "class",
          name: "DerivedClass" as SymbolName,
          location: mockLocation,
          scope_id: "scope" as any,
          type_id: typeId,
          extends_class: "UnknownParent" as SymbolName,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        };

        mockSymbols.set("symbol" as SymbolId, symbol);

        const result = resolve_inheritance_chain(
          typeId,
          mockSymbols,
          mockRegistry
        );

        expect(result).toEqual([typeId]);
      });

      it("should handle type not found in symbols", () => {
        const unknownTypeId = defined_type_id(
          TypeCategory.CLASS,
          "UnknownClass" as SymbolName,
          mockLocation
        );

        const result = resolve_inheritance_chain(
          unknownTypeId,
          mockSymbols,
          mockRegistry
        );

        expect(result).toEqual([unknownTypeId]);
      });
    });
  });

  describe("Integration Tests", () => {
    it("should resolve complex type scenarios", () => {
      // Setup complex type hierarchy
      const baseClassSymbol: SymbolDefinition = {
        id: "base_class" as SymbolId,
        kind: "class",
        name: "BaseClass" as SymbolName,
        location: mockLocation,
        scope_id: "scope" as any,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
        references: [],
      };

      const derivedClassSymbol: SymbolDefinition = {
        id: "derived_class" as SymbolId,
        kind: "class",
        name: "DerivedClass" as SymbolName,
        location: mockLocation,
        scope_id: "scope" as any,
        extends_class: "BaseClass" as SymbolName,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
        references: [],
      };

      const interfaceSymbol: SymbolDefinition = {
        id: "interface" as SymbolId,
        kind: "interface",
        name: "IInterface" as SymbolName,
        location: mockLocation,
        scope_id: "scope" as any,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
        references: [],
      };

      const symbols = new Map<SymbolId, SymbolDefinition>([
        ["base_class" as SymbolId, baseClassSymbol],
        ["derived_class" as SymbolId, derivedClassSymbol],
        ["interface" as SymbolId, interfaceSymbol],
      ]);

      // Build registry
      const registry = build_file_type_registry(symbols, mockFilePath);

      // Test type resolution
      const typeInfos: TypeInfo[] = [
        {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        },
        {
          type_name: "BaseClass" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        },
        {
          type_name: "IInterface" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
        },
      ];

      const resolved = resolve_all_types(typeInfos, symbols, registry);

      expect(resolved.size).toBe(3);
      expect(resolved.get(typeInfos[0])).toEqual(primitive_type_id("string"));
      expect(resolved.get(typeInfos[1])).toBeDefined();
      expect(resolved.get(typeInfos[2])).toBeDefined();

      // Test inheritance chain
      const derivedTypeId = registry.name_to_type.get(
        "DerivedClass" as SymbolName
      )!;
      const inheritanceChain = resolve_inheritance_chain(
        derivedTypeId,
        symbols,
        registry
      );

      expect(inheritanceChain).toHaveLength(2);

      // Test union creation
      const unionType = create_union_type(
        [typeInfos[0], typeInfos[1]],
        symbols,
        registry
      );
      expect(unionType).toBeDefined();
    });
  });
});

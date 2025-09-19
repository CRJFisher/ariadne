/**
 * Comprehensive tests for type members collection and organization
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  SymbolId,
  SymbolName,
  TypeId,
  Location,
  SymbolDefinition,
  ScopeId,
  LexicalScope,
  FilePath,
} from "@ariadnejs/types";
import type {
  TypeMemberMap,
  MemberInfo,
  InheritanceInfo,
  ParameterInfo,
} from "../type_registry/type_registry";
import {
  collect_type_members,
  find_type_methods,
  resolve_method_on_type,
} from "./type_members";

// Mock the unimplemented function
vi.mock("./type_members", async () => {
  const actual = await vi.importActual("./type_members");
  return {
    ...actual,
    create_type_id_from_symbol: vi.fn((symbol: SymbolDefinition) => {
      return `${symbol.kind}_${symbol.name}_type` as TypeId;
    }),
  };
});

describe("Type Members", () => {
  const mockFilePath = "test.ts" as FilePath;
  const mockLocation: Location = {
    file_path: mockFilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
  };

  let mockSymbols: Map<SymbolId, SymbolDefinition>;
  let mockScopes: Map<ScopeId, LexicalScope>;

  // Helper function to create properly typed SymbolDefinition objects
  const createSymbolDefinition = (
    partial: Partial<SymbolDefinition>
  ): SymbolDefinition =>
    ({
      is_hoisted: false,
      is_exported: false,
      is_imported: false,
      references: [],
      ...partial,
    } as SymbolDefinition);

  beforeEach(() => {
    mockSymbols = new Map();
    mockScopes = new Map();
    vi.clearAllMocks();
  });

  describe("collect_type_members", () => {
    describe("Success Cases", () => {
      it("should collect members from class symbols", () => {
        const classSymbol: SymbolDefinition = createSymbolDefinition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          type_id: "class_MyClass_type" as TypeId,
        });

        const methodSymbol: SymbolDefinition = createSymbolDefinition({
          id: "method_symbol" as SymbolId,
          kind: "method",
          name: "myMethod" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
          member_of: "class_MyClass_type" as TypeId,
          return_type: "string_type" as TypeId,
        });

        const propertySymbol: SymbolDefinition = createSymbolDefinition({
          id: "property_symbol" as SymbolId,
          kind: "variable",
          name: "myProperty" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          member_of: "class_MyClass_type" as TypeId,
          value_type: "number_type" as TypeId,
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);
        mockSymbols.set("method_symbol" as SymbolId, methodSymbol);
        mockSymbols.set("property_symbol" as SymbolId, propertySymbol);

        const result = collect_type_members(mockSymbols, mockScopes);

        expect(result.instance_members.size).toBe(1);
        expect(result.static_members.size).toBe(1);
        expect(result.constructors.size).toBe(0);
        expect(result.inheritance.size).toBe(1);

        const classMembers = result.instance_members.get(
          "class_MyClass_type" as TypeId
        );
        expect(classMembers?.size).toBe(2);
        expect(classMembers?.has("myMethod" as SymbolName)).toBe(true);
        expect(classMembers?.has("myProperty" as SymbolName)).toBe(true);

        const methodInfo = classMembers?.get("myMethod" as SymbolName);
        expect(methodInfo?.member_type).toBe("method");
        expect(methodInfo?.return_type).toBe("string_type");

        const propertyInfo = classMembers?.get("myProperty" as SymbolName);
        expect(propertyInfo?.member_type).toBe("field");
        expect(propertyInfo?.value_type).toBe("number_type");
      });

      it("should collect static members separately", () => {
        const classSymbol: SymbolDefinition = createSymbolDefinition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          type_id: "class_MyClass_type" as TypeId,
        });

        const staticMethodSymbol: SymbolDefinition = createSymbolDefinition({
          id: "static_method_symbol" as SymbolId,
          kind: "method",
          name: "staticMethod" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
          member_of: "class_MyClass_type" as TypeId,
          is_static: true,
          return_type: "void_type" as TypeId,
        });

        const staticPropertySymbol: SymbolDefinition = createSymbolDefinition({
          id: "static_property_symbol" as SymbolId,
          kind: "constant",
          name: "STATIC_CONSTANT" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          member_of: "class_MyClass_type" as TypeId,
          is_static: true,
          value_type: "string_type" as TypeId,
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);
        mockSymbols.set("static_method_symbol" as SymbolId, staticMethodSymbol);
        mockSymbols.set(
          "static_property_symbol" as SymbolId,
          staticPropertySymbol
        );

        const result = collect_type_members(mockSymbols, mockScopes);

        const staticMembers = result.static_members.get(
          "class_MyClass_type" as TypeId
        );
        expect(staticMembers?.size).toBe(2);
        expect(staticMembers?.has("staticMethod" as SymbolName)).toBe(true);
        expect(staticMembers?.has("STATIC_CONSTANT" as SymbolName)).toBe(true);

        const staticMethodInfo = staticMembers?.get(
          "staticMethod" as SymbolName
        );
        expect(staticMethodInfo?.member_type).toBe("method");
        expect(staticMethodInfo?.is_static).toBe(true);

        const staticPropertyInfo = staticMembers?.get(
          "STATIC_CONSTANT" as SymbolName
        );
        expect(staticPropertyInfo?.member_type).toBe("property");
        expect(staticPropertyInfo?.is_static).toBe(true);
      });

      it("should collect constructor information", () => {
        const classSymbol: SymbolDefinition = createSymbolDefinition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          type_id: "class_MyClass_type" as TypeId,
        });

        const constructorSymbol: SymbolDefinition = createSymbolDefinition({
          id: "constructor_symbol" as SymbolId,
          kind: "constructor",
          name: "constructor" as SymbolName,
          location: mockLocation,
          scope_id: "constructor_scope" as ScopeId,
          member_of: "class_MyClass_type" as TypeId,
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);
        mockSymbols.set("constructor_symbol" as SymbolId, constructorSymbol);

        const result = collect_type_members(mockSymbols, mockScopes);

        expect(result.constructors.size).toBe(1);
        const constructorInfo = result.constructors.get(
          "class_MyClass_type" as TypeId
        );
        expect(constructorInfo?.member_type).toBe("constructor");
        expect(constructorInfo?.symbol_id).toBe("constructor_symbol");
      });

      it("should collect method parameters", () => {
        const classSymbol: SymbolDefinition = createSymbolDefinition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          type_id: "class_MyClass_type" as TypeId,
        });

        const methodSymbol: SymbolDefinition = createSymbolDefinition({
          id: "method_symbol" as SymbolId,
          kind: "method",
          name: "methodWithParams" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
          member_of: "class_MyClass_type" as TypeId,
        });

        const param1Symbol: SymbolDefinition = createSymbolDefinition({
          id: "param1_symbol" as SymbolId,
          kind: "parameter",
          name: "param1" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
          value_type: "string_type" as TypeId,
        });

        const param2Symbol: SymbolDefinition = createSymbolDefinition({
          id: "param2_symbol" as SymbolId,
          kind: "parameter",
          name: "param2" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
          value_type: "number_type" as TypeId,
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);
        mockSymbols.set("method_symbol" as SymbolId, methodSymbol);
        mockSymbols.set("param1_symbol" as SymbolId, param1Symbol);
        mockSymbols.set("param2_symbol" as SymbolId, param2Symbol);

        const result = collect_type_members(mockSymbols, mockScopes);

        const classMembers = result.instance_members.get(
          "class_MyClass_type" as TypeId
        );
        const methodInfo = classMembers?.get("methodWithParams" as SymbolName);

        expect(methodInfo?.parameters).toHaveLength(2);
        expect(methodInfo?.parameters![0].name).toBe("param1");
        expect(methodInfo?.parameters![0].type).toBe("string_type");
        expect(methodInfo?.parameters![1].name).toBe("param2");
        expect(methodInfo?.parameters![1].type).toBe("number_type");
      });

      it("should handle inheritance relationships", () => {
        const baseClassSymbol: SymbolDefinition = createSymbolDefinition({
          id: "base_class_symbol" as SymbolId,
          kind: "class",
          name: "BaseClass" as SymbolName,
          location: mockLocation,
          scope_id: "base_class_scope" as ScopeId,
          type_id: "class_BaseClass_type" as TypeId,
        });

        const derivedClassSymbol: SymbolDefinition = createSymbolDefinition({
          id: "derived_class_symbol" as SymbolId,
          kind: "class",
          name: "DerivedClass" as SymbolName,
          location: mockLocation,
          scope_id: "derived_class_scope" as ScopeId,
          type_id: "class_DerivedClass_type" as TypeId,
          extends_class: "BaseClass" as SymbolName,
        });

        const baseMethodSymbol: SymbolDefinition = createSymbolDefinition({
          id: "base_method_symbol" as SymbolId,
          kind: "method",
          name: "baseMethod" as SymbolName,
          location: mockLocation,
          scope_id: "base_method_scope" as ScopeId,
          member_of: "class_BaseClass_type" as TypeId,
        });

        const derivedMethodSymbol: SymbolDefinition = createSymbolDefinition({
          id: "derived_method_symbol" as SymbolId,
          kind: "method",
          name: "derivedMethod" as SymbolName,
          location: mockLocation,
          scope_id: "derived_method_scope" as ScopeId,
          member_of: "class_DerivedClass_type" as TypeId,
        });

        mockSymbols.set("base_class_symbol" as SymbolId, baseClassSymbol);
        mockSymbols.set("derived_class_symbol" as SymbolId, derivedClassSymbol);
        mockSymbols.set("base_method_symbol" as SymbolId, baseMethodSymbol);
        mockSymbols.set(
          "derived_method_symbol" as SymbolId,
          derivedMethodSymbol
        );

        const result = collect_type_members(mockSymbols, mockScopes);

        const baseInheritance = result.inheritance.get(
          "class_BaseClass_type" as TypeId
        );
        const derivedInheritance = result.inheritance.get(
          "class_DerivedClass_type" as TypeId
        );

        expect(baseInheritance?.extends_type).toBeUndefined();
        expect(derivedInheritance?.extends_type).toBe("class_BaseClass_type");

        expect(derivedInheritance?.all_ancestors).toContain(
          "class_BaseClass_type" as TypeId
        );

        // Check that derived class inherits base methods
        expect(
          derivedInheritance?.all_members.has("baseMethod" as SymbolName)
        ).toBe(true);
        expect(
          derivedInheritance?.all_members.has("derivedMethod" as SymbolName)
        ).toBe(true);
      });

      it("should handle interface implementation", () => {
        const interfaceSymbol: SymbolDefinition = createSymbolDefinition({
          id: "interface_symbol" as SymbolId,
          kind: "interface",
          name: "IInterface" as SymbolName,
          location: mockLocation,
          scope_id: "interface_scope" as ScopeId,
          type_id: "interface_IInterface_type" as TypeId,
        });

        const classSymbol: SymbolDefinition = createSymbolDefinition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          type_id: "class_MyClass_type" as TypeId,
          implements_interfaces: ["IInterface" as SymbolName],
        });

        mockSymbols.set("interface_symbol" as SymbolId, interfaceSymbol);
        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const result = collect_type_members(mockSymbols, mockScopes);

        const classInheritance = result.inheritance.get(
          "class_MyClass_type" as TypeId
        );
        expect(classInheritance?.implements_types).toContain(
          "interface_IInterface_type" as TypeId
        );
        expect(classInheritance?.all_ancestors).toContain(
          "interface_IInterface_type" as TypeId
        );
      });

      it("should collect members from scope relationships", () => {
        const classSymbol: SymbolDefinition = createSymbolDefinition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          type_id: "class_MyClass_type" as TypeId,
        });

        const methodSymbol: SymbolDefinition = createSymbolDefinition({
          id: "method_symbol" as SymbolId,
          kind: "method",
          name: "scopeMethod" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
        });

        const classScope: LexicalScope = {
          id: "class_scope" as ScopeId,
          parent_id: null,
          name: null,
          type: "class",
          location: mockLocation,
          child_ids: [],
          symbols: new Map([
            ["MyClass" as SymbolName, classSymbol],
            ["scopeMethod" as SymbolName, methodSymbol],
          ]),
        };

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);
        mockSymbols.set("method_symbol" as SymbolId, methodSymbol);
        mockScopes.set("class_scope" as ScopeId, classScope);

        const result = collect_type_members(mockSymbols, mockScopes);

        const classMembers = result.instance_members.get(
          "class_MyClass_type" as TypeId
        );
        expect(classMembers?.has("scopeMethod" as SymbolName)).toBe(true);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty symbols map", () => {
        const result = collect_type_members(new Map(), mockScopes);

        expect(result.instance_members.size).toBe(0);
        expect(result.static_members.size).toBe(0);
        expect(result.constructors.size).toBe(0);
        expect(result.inheritance.size).toBe(0);
      });

      it("should handle classes without type_id", () => {
        const classSymbol: SymbolDefinition = createSymbolDefinition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          // No type_id - should be created automatically
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const result = collect_type_members(mockSymbols, mockScopes);

        expect(result.instance_members.size).toBe(1);
        expect(result.inheritance.size).toBe(1);
      });

      it("should handle circular inheritance", () => {
        const class1Symbol: SymbolDefinition = createSymbolDefinition({
          id: "class1_symbol" as SymbolId,
          kind: "class",
          name: "Class1" as SymbolName,
          location: mockLocation,
          scope_id: "class1_scope" as ScopeId,
          type_id: "class_Class1_type" as TypeId,
          extends_class: "Class2" as SymbolName,
        });

        const class2Symbol: SymbolDefinition = createSymbolDefinition({
          id: "class2_symbol" as SymbolId,
          kind: "class",
          name: "Class2" as SymbolName,
          location: mockLocation,
          scope_id: "class2_scope" as ScopeId,
          type_id: "class_Class2_type" as TypeId,
          extends_class: "Class1" as SymbolName,
        });

        mockSymbols.set("class1_symbol" as SymbolId, class1Symbol);
        mockSymbols.set("class2_symbol" as SymbolId, class2Symbol);

        expect(() => {
          collect_type_members(mockSymbols, mockScopes);
        }).not.toThrow();
      });

      it("should handle members without valid member_of", () => {
        const orphanMethodSymbol: SymbolDefinition = createSymbolDefinition({
          id: "orphan_method_symbol" as SymbolId,
          kind: "method",
          name: "orphanMethod" as SymbolName,
          location: mockLocation,
          scope_id: "orphan_scope" as ScopeId,
          member_of: "non_existent_type" as TypeId,
        });

        mockSymbols.set("orphan_method_symbol" as SymbolId, orphanMethodSymbol);

        const result = collect_type_members(mockSymbols, mockScopes);

        expect(result.instance_members.size).toBe(0);
        expect(result.static_members.size).toBe(0);
      });

      it("should handle unknown parent classes", () => {
        const classSymbol: SymbolDefinition = createSymbolDefinition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          type_id: "class_MyClass_type" as TypeId,
          extends_class: "UnknownParent" as SymbolName,
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const result = collect_type_members(mockSymbols, mockScopes);

        const inheritance = result.inheritance.get(
          "class_MyClass_type" as TypeId
        );
        expect(inheritance?.extends_type).toBeUndefined();
        expect(inheritance?.all_ancestors).toEqual([]);
      });

      it("should handle unknown implemented interfaces", () => {
        const classSymbol: SymbolDefinition = createSymbolDefinition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          type_id: "class_MyClass_type" as TypeId,
          implements_interfaces: ["UnknownInterface" as SymbolName],
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const result = collect_type_members(mockSymbols, mockScopes);

        const inheritance = result.inheritance.get(
          "class_MyClass_type" as TypeId
        );
        expect(inheritance?.implements_types).toEqual([]);
      });
    });
  });

  describe("find_type_methods", () => {
    let mockMembers: TypeMemberMap;

    beforeEach(() => {
      const instanceMembers = new Map<TypeId, Map<SymbolName, MemberInfo>>();
      const staticMembers = new Map<TypeId, Map<SymbolName, MemberInfo>>();
      const constructors = new Map<TypeId, MemberInfo>();
      const inheritance = new Map<TypeId, InheritanceInfo>();

      const methodInfo: MemberInfo = {
        symbol_id: "method_symbol" as SymbolId,
        name: "instanceMethod" as SymbolName,
        member_type: "method",
        is_static: false,
        is_private: false,
        is_readonly: false,
        location: mockLocation,
      };

      const staticMethodInfo: MemberInfo = {
        symbol_id: "static_method_symbol" as SymbolId,
        name: "staticMethod" as SymbolName,
        member_type: "method",
        is_static: true,
        is_private: false,
        is_readonly: false,
        location: mockLocation,
      };

      const propertyInfo: MemberInfo = {
        symbol_id: "property_symbol" as SymbolId,
        name: "property" as SymbolName,
        member_type: "property",
        is_static: false,
        is_private: false,
        is_readonly: false,
        location: mockLocation,
      };

      const inheritedMethodInfo: MemberInfo = {
        symbol_id: "inherited_method_symbol" as SymbolId,
        name: "inheritedMethod" as SymbolName,
        member_type: "method",
        is_static: false,
        is_private: false,
        is_readonly: false,
        location: mockLocation,
      };

      const typeId = "test_type" as TypeId;

      instanceMembers.set(
        typeId,
        new Map([
          ["instanceMethod" as SymbolName, methodInfo],
          ["property" as SymbolName, propertyInfo],
        ])
      );

      staticMembers.set(
        typeId,
        new Map([["staticMethod" as SymbolName, staticMethodInfo]])
      );

      inheritance.set(typeId, {
        extends_type: undefined,
        implements_types: [],
        all_ancestors: [],
        all_members: new Map([
          ["instanceMethod" as SymbolName, methodInfo],
          ["inheritedMethod" as SymbolName, inheritedMethodInfo],
          ["property" as SymbolName, propertyInfo],
        ]),
      });

      mockMembers = {
        instance_members: instanceMembers,
        static_members: staticMembers,
        constructors,
        inheritance,
      };
    });

    describe("Success Cases", () => {
      it("should find instance methods only by default", () => {
        const result = find_type_methods("test_type" as TypeId, mockMembers);

        expect(result.size).toBe(2);
        expect(result.has("instanceMethod" as SymbolName)).toBe(true);
        expect(result.has("inheritedMethod" as SymbolName)).toBe(true);
        expect(result.has("staticMethod" as SymbolName)).toBe(false);
      });

      it("should include static methods when requested", () => {
        const result = find_type_methods(
          "test_type" as TypeId,
          mockMembers,
          true
        );

        expect(result.size).toBe(3);
        expect(result.has("instanceMethod" as SymbolName)).toBe(true);
        expect(result.has("inheritedMethod" as SymbolName)).toBe(true);
        expect(result.has("staticMethod" as SymbolName)).toBe(true);
      });

      it("should filter out non-method members", () => {
        const result = find_type_methods("test_type" as TypeId, mockMembers);

        expect(result.has("property" as SymbolName)).toBe(false);
      });

      it("should handle types without methods", () => {
        const result = find_type_methods(
          "non_existent_type" as TypeId,
          mockMembers
        );

        expect(result.size).toBe(0);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty member maps", () => {
        const emptyMembers: TypeMemberMap = {
          instance_members: new Map(),
          static_members: new Map(),
          constructors: new Map(),
          inheritance: new Map(),
        };

        const result = find_type_methods("test_type" as TypeId, emptyMembers);

        expect(result.size).toBe(0);
      });

      it("should handle types without inheritance info", () => {
        const membersWithoutInheritance: TypeMemberMap = {
          ...mockMembers,
          inheritance: new Map(),
        };

        const result = find_type_methods(
          "test_type" as TypeId,
          membersWithoutInheritance
        );

        expect(result.size).toBe(1);
        expect(result.has("instanceMethod" as SymbolName)).toBe(true);
        expect(result.has("inheritedMethod" as SymbolName)).toBe(false);
      });
    });
  });

  describe("resolve_method_on_type", () => {
    let mockMembers: TypeMemberMap;

    beforeEach(() => {
      const instanceMembers = new Map<TypeId, Map<SymbolName, MemberInfo>>();
      const staticMembers = new Map<TypeId, Map<SymbolName, MemberInfo>>();
      const constructors = new Map<TypeId, MemberInfo>();
      const inheritance = new Map<TypeId, InheritanceInfo>();

      const instanceMethodInfo: MemberInfo = {
        symbol_id: "instance_method_symbol" as SymbolId,
        name: "instanceMethod" as SymbolName,
        member_type: "method",
        is_static: false,
        is_private: false,
        is_readonly: false,
        location: mockLocation,
      };

      const staticMethodInfo: MemberInfo = {
        symbol_id: "static_method_symbol" as SymbolId,
        name: "staticMethod" as SymbolName,
        member_type: "method",
        is_static: true,
        is_private: false,
        is_readonly: false,
        location: mockLocation,
      };

      const inheritedMethodInfo: MemberInfo = {
        symbol_id: "inherited_method_symbol" as SymbolId,
        name: "inheritedMethod" as SymbolName,
        member_type: "method",
        is_static: false,
        is_private: false,
        is_readonly: false,
        location: mockLocation,
      };

      const propertyInfo: MemberInfo = {
        symbol_id: "property_symbol" as SymbolId,
        name: "notAMethod" as SymbolName,
        member_type: "property",
        is_static: false,
        is_private: false,
        is_readonly: false,
        location: mockLocation,
      };

      const typeId = "test_type" as TypeId;

      instanceMembers.set(
        typeId,
        new Map([
          ["instanceMethod" as SymbolName, instanceMethodInfo],
          ["notAMethod" as SymbolName, propertyInfo],
        ])
      );

      staticMembers.set(
        typeId,
        new Map([["staticMethod" as SymbolName, staticMethodInfo]])
      );

      inheritance.set(typeId, {
        extends_type: undefined,
        implements_types: [],
        all_ancestors: [],
        all_members: new Map([
          ["inheritedMethod" as SymbolName, inheritedMethodInfo],
        ]),
      });

      mockMembers = {
        instance_members: instanceMembers,
        static_members: staticMembers,
        constructors,
        inheritance,
      };
    });

    describe("Success Cases", () => {
      it("should resolve instance methods", () => {
        const result = resolve_method_on_type(
          "test_type" as TypeId,
          "instanceMethod" as SymbolName,
          mockMembers
        );

        expect(result).toBeDefined();
        expect(result!.symbol_id).toBe("instance_method_symbol");
        expect(result!.member_type).toBe("method");
      });

      it("should resolve static methods when requested", () => {
        const result = resolve_method_on_type(
          "test_type" as TypeId,
          "staticMethod" as SymbolName,
          mockMembers,
          true
        );

        expect(result).toBeDefined();
        expect(result!.symbol_id).toBe("static_method_symbol");
        expect(result!.member_type).toBe("method");
      });

      it("should resolve inherited methods", () => {
        const result = resolve_method_on_type(
          "test_type" as TypeId,
          "inheritedMethod" as SymbolName,
          mockMembers
        );

        expect(result).toBeDefined();
        expect(result!.symbol_id).toBe("inherited_method_symbol");
        expect(result!.member_type).toBe("method");
      });

      it("should prioritize own methods over inherited", () => {
        // Add the same method name to both instance and inherited
        const instanceMembers = mockMembers.instance_members.get(
          "test_type" as TypeId
        )! as Map<SymbolName, MemberInfo>;
        const overriddenMethod: MemberInfo = {
          symbol_id: "overridden_method_symbol" as SymbolId,
          name: "inheritedMethod" as SymbolName,
          member_type: "method",
          is_static: false,
          is_private: false,
          is_readonly: false,
          location: mockLocation,
        };
        instanceMembers.set("inheritedMethod" as SymbolName, overriddenMethod);

        const result = resolve_method_on_type(
          "test_type" as TypeId,
          "inheritedMethod" as SymbolName,
          mockMembers
        );

        expect(result).toBeDefined();
        expect(result!.symbol_id).toBe("overridden_method_symbol");
      });
    });

    describe("Edge Cases", () => {
      it("should return undefined for non-existent methods", () => {
        const result = resolve_method_on_type(
          "test_type" as TypeId,
          "nonExistentMethod" as SymbolName,
          mockMembers
        );

        expect(result).toBeUndefined();
      });

      it("should return undefined for non-method members", () => {
        const result = resolve_method_on_type(
          "test_type" as TypeId,
          "notAMethod" as SymbolName,
          mockMembers
        );

        expect(result).toBeUndefined();
      });

      it("should return undefined for non-existent types", () => {
        const result = resolve_method_on_type(
          "non_existent_type" as TypeId,
          "anyMethod" as SymbolName,
          mockMembers
        );

        expect(result).toBeUndefined();
      });

      it("should not find static methods when looking for instance methods", () => {
        const result = resolve_method_on_type(
          "test_type" as TypeId,
          "staticMethod" as SymbolName,
          mockMembers,
          false
        );

        expect(result).toBeUndefined();
      });

      it("should not find instance methods when looking for static methods", () => {
        const result = resolve_method_on_type(
          "test_type" as TypeId,
          "instanceMethod" as SymbolName,
          mockMembers,
          true
        );

        expect(result).toBeUndefined();
      });

      it("should handle types without inheritance info", () => {
        const membersWithoutInheritance: TypeMemberMap = {
          ...mockMembers,
          inheritance: new Map(),
        };

        const result = resolve_method_on_type(
          "test_type" as TypeId,
          "inheritedMethod" as SymbolName,
          membersWithoutInheritance
        );

        expect(result).toBeUndefined();
      });
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete type member collection and resolution", () => {
      // Setup a complex class hierarchy
      const baseClassSymbol: SymbolDefinition = createSymbolDefinition({
        id: "base_class_symbol" as SymbolId,
        kind: "class",
        name: "BaseClass" as SymbolName,
        location: mockLocation,
        scope_id: "base_class_scope" as ScopeId,
        type_id: "class_BaseClass_type" as TypeId,
      });

      const derivedClassSymbol: SymbolDefinition = createSymbolDefinition({
        id: "derived_class_symbol" as SymbolId,
        kind: "class",
        name: "DerivedClass" as SymbolName,
        location: mockLocation,
        scope_id: "derived_class_scope" as ScopeId,
        type_id: "class_DerivedClass_type" as TypeId,
        extends_class: "BaseClass" as SymbolName,
      });

      const baseMethodSymbol: SymbolDefinition = createSymbolDefinition({
        id: "base_method_symbol" as SymbolId,
        kind: "method",
        name: "baseMethod" as SymbolName,
        location: mockLocation,
        scope_id: "base_method_scope" as ScopeId,
        member_of: "class_BaseClass_type" as TypeId,
      });

      const derivedMethodSymbol: SymbolDefinition = createSymbolDefinition({
        id: "derived_method_symbol" as SymbolId,
        kind: "method",
        name: "derivedMethod" as SymbolName,
        location: mockLocation,
        scope_id: "derived_method_scope" as ScopeId,
        member_of: "class_DerivedClass_type" as TypeId,
      });

      const overriddenMethodSymbol: SymbolDefinition = createSymbolDefinition({
        id: "overridden_method_symbol" as SymbolId,
        kind: "method",
        name: "baseMethod" as SymbolName,
        location: mockLocation,
        scope_id: "overridden_method_scope" as ScopeId,
        member_of: "class_DerivedClass_type" as TypeId,
      });

      mockSymbols.set("base_class_symbol" as SymbolId, baseClassSymbol);
      mockSymbols.set("derived_class_symbol" as SymbolId, derivedClassSymbol);
      mockSymbols.set("base_method_symbol" as SymbolId, baseMethodSymbol);
      mockSymbols.set("derived_method_symbol" as SymbolId, derivedMethodSymbol);
      mockSymbols.set(
        "overridden_method_symbol" as SymbolId,
        overriddenMethodSymbol
      );

      // Collect members
      const members = collect_type_members(mockSymbols, mockScopes);

      // Test inheritance resolution
      const derivedInheritance = members.inheritance.get(
        "class_DerivedClass_type" as TypeId
      );
      expect(derivedInheritance?.extends_type).toBe("class_BaseClass_type");

      // Test method finding
      const derivedMethods = find_type_methods(
        "class_DerivedClass_type" as TypeId,
        members
      );
      expect(derivedMethods.size).toBe(2);
      expect(derivedMethods.has("baseMethod" as SymbolName)).toBe(true);
      expect(derivedMethods.has("derivedMethod" as SymbolName)).toBe(true);

      // Test method resolution (should prioritize overridden method)
      const resolvedBaseMethod = resolve_method_on_type(
        "class_DerivedClass_type" as TypeId,
        "baseMethod" as SymbolName,
        members
      );
      expect(resolvedBaseMethod?.symbol_id).toBe("overridden_method_symbol");

      // Test method resolution for derived-only method
      const resolvedDerivedMethod = resolve_method_on_type(
        "class_DerivedClass_type" as TypeId,
        "derivedMethod" as SymbolName,
        members
      );
      expect(resolvedDerivedMethod?.symbol_id).toBe("derived_method_symbol");
    });
  });
});

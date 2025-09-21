/**
 * Comprehensive tests for type members extraction (local only)
 */

import { describe, it, expect, beforeEach } from "vitest";
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
import {
  extract_type_members,
  find_direct_type_methods,
  find_direct_member,
  type LocalTypeInfo,
  type LocalMemberInfo,
} from "./type_members";

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
  const create_symbol_definition = (
    partial: Partial<SymbolDefinition>
  ): SymbolDefinition =>
    ({
      is_hoisted: false,
      is_exported: false,
      is_imported: false,
      ...partial,
    } as SymbolDefinition);

  beforeEach(() => {
    mockSymbols = new Map();
    mockScopes = new Map();
  });

  describe("extract_type_members", () => {
    describe("Success Cases", () => {
      it("should extract direct members from class symbols", () => {
        const methodSymbol: SymbolDefinition = create_symbol_definition({
          id: "method_symbol" as SymbolId,
          kind: "method",
          name: "myMethod" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
          return_type_hint: "string" as SymbolName,
        });

        const propertySymbol: SymbolDefinition = create_symbol_definition({
          id: "property_symbol" as SymbolId,
          kind: "variable",
          name: "myProperty" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
        });

        const classSymbol: SymbolDefinition = create_symbol_definition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          members: ["method_symbol" as SymbolId, "property_symbol" as SymbolId],
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);
        mockSymbols.set("method_symbol" as SymbolId, methodSymbol);
        mockSymbols.set("property_symbol" as SymbolId, propertySymbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        expect(result.length).toBe(1);
        const classInfo = result[0];
        expect(classInfo.type_name).toBe("MyClass");
        expect(classInfo.kind).toBe("class");
        expect(classInfo.direct_members.size).toBe(2);

        const methodInfo = classInfo.direct_members.get("myMethod" as SymbolName);
        expect(methodInfo?.kind).toBe("method");
        expect(methodInfo?.type_annotation).toBe("string");

        const propertyInfo = classInfo.direct_members.get("myProperty" as SymbolName);
        expect(propertyInfo?.kind).toBe("field");  // Non-static variable members become fields
        expect(propertyInfo?.type_annotation).toBeUndefined();  // No type annotation available
      });

      it("should mark static members with is_static flag", () => {
        const staticMethodSymbol: SymbolDefinition = create_symbol_definition({
          id: "static_method_symbol" as SymbolId,
          kind: "method",
          name: "staticMethod" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
          is_static: true,
          return_type_hint: "void" as SymbolName,
        });

        const staticPropertySymbol: SymbolDefinition = create_symbol_definition({
          id: "static_property_symbol" as SymbolId,
          kind: "constant",
          name: "STATIC_CONSTANT" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          is_static: true,
        });

        const classSymbol: SymbolDefinition = create_symbol_definition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          static_members: ["static_method_symbol" as SymbolId, "static_property_symbol" as SymbolId],
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);
        mockSymbols.set("static_method_symbol" as SymbolId, staticMethodSymbol);
        mockSymbols.set(
          "static_property_symbol" as SymbolId,
          staticPropertySymbol
        );

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        const classInfo = result[0];
        const staticMethod = classInfo.direct_members.get("staticMethod" as SymbolName);
        expect(staticMethod?.is_static).toBe(true);
        expect(staticMethod?.kind).toBe("method");

        const staticProperty = classInfo.direct_members.get("STATIC_CONSTANT" as SymbolName);
        expect(staticProperty?.is_static).toBe(true);
        expect(staticProperty?.kind).toBe("property");
      });

      it("should extract constructor as a direct member", () => {
        const constructorSymbol: SymbolDefinition = create_symbol_definition({
          id: "constructor_symbol" as SymbolId,
          kind: "constructor",
          name: "constructor" as SymbolName,
          location: mockLocation,
          scope_id: "constructor_scope" as ScopeId,
        });

        const classSymbol: SymbolDefinition = create_symbol_definition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          members: ["constructor_symbol" as SymbolId],
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);
        mockSymbols.set("constructor_symbol" as SymbolId, constructorSymbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        const classInfo = result[0];
        const constructorInfo = classInfo.direct_members.get("constructor" as SymbolName);
        expect(constructorInfo?.kind).toBe("constructor");
      });

      it("should extract method parameters", () => {
        const classSymbol: SymbolDefinition = create_symbol_definition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          members: ["method_symbol" as SymbolId],
        });

        const methodSymbol: SymbolDefinition = create_symbol_definition({
          id: "method_symbol" as SymbolId,
          kind: "method",
          name: "methodWithParams" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
        });

        const param1Symbol: SymbolDefinition = create_symbol_definition({
          id: "param1_symbol" as SymbolId,
          kind: "parameter",
          name: "param1" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
        });

        const param2Symbol: SymbolDefinition = create_symbol_definition({
          id: "param2_symbol" as SymbolId,
          kind: "parameter",
          name: "param2" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);
        mockSymbols.set("method_symbol" as SymbolId, methodSymbol);
        mockSymbols.set("param1_symbol" as SymbolId, param1Symbol);
        mockSymbols.set("param2_symbol" as SymbolId, param2Symbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        const classInfo = result[0];
        const methodInfo = classInfo.direct_members.get("methodWithParams" as SymbolName);

        expect(methodInfo?.parameters).toHaveLength(2);
        expect(methodInfo?.parameters![0].name).toBe("param1");
        expect(methodInfo?.parameters![0].type_annotation).toBeUndefined();
        expect(methodInfo?.parameters![1].name).toBe("param2");
        expect(methodInfo?.parameters![1].type_annotation).toBeUndefined();
      });

      it("should capture extends clauses as unresolved names", () => {
        const baseClassSymbol: SymbolDefinition = create_symbol_definition({
          id: "base_class_symbol" as SymbolId,
          kind: "class",
          name: "BaseClass" as SymbolName,
          location: mockLocation,
          scope_id: "base_class_scope" as ScopeId,
          members: ["base_method_symbol" as SymbolId],
        });

        const derivedClassSymbol: SymbolDefinition = create_symbol_definition({
          id: "derived_class_symbol" as SymbolId,
          kind: "class",
          name: "DerivedClass" as SymbolName,
          location: mockLocation,
          scope_id: "derived_class_scope" as ScopeId,
          extends_class: "BaseClass" as SymbolName,
          members: ["derived_method_symbol" as SymbolId],
        });

        const baseMethodSymbol: SymbolDefinition = create_symbol_definition({
          id: "base_method_symbol" as SymbolId,
          kind: "method",
          name: "baseMethod" as SymbolName,
          location: mockLocation,
          scope_id: "base_method_scope" as ScopeId,
        });

        const derivedMethodSymbol: SymbolDefinition = create_symbol_definition({
          id: "derived_method_symbol" as SymbolId,
          kind: "method",
          name: "derivedMethod" as SymbolName,
          location: mockLocation,
          scope_id: "derived_method_scope" as ScopeId,
        });

        mockSymbols.set("base_class_symbol" as SymbolId, baseClassSymbol);
        mockSymbols.set("derived_class_symbol" as SymbolId, derivedClassSymbol);
        mockSymbols.set("base_method_symbol" as SymbolId, baseMethodSymbol);
        mockSymbols.set(
          "derived_method_symbol" as SymbolId,
          derivedMethodSymbol
        );

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        // Find the base and derived classes
        const baseClass = result.find(t => t.type_name === "BaseClass");
        const derivedClass = result.find(t => t.type_name === "DerivedClass");

        // Base class should have no extends clause
        expect(baseClass?.extends_clause).toBeUndefined();
        // Derived class should have BaseClass as unresolved extends clause
        expect(derivedClass?.extends_clause).toEqual(["BaseClass"]);

        // Each class should only have its direct members
        expect(baseClass?.direct_members.has("baseMethod" as SymbolName)).toBe(true);
        expect(baseClass?.direct_members.has("derivedMethod" as SymbolName)).toBe(false);

        expect(derivedClass?.direct_members.has("derivedMethod" as SymbolName)).toBe(true);
        expect(derivedClass?.direct_members.has("baseMethod" as SymbolName)).toBe(false);
      });

      it("should handle interface implementation", () => {
        const interfaceSymbol: SymbolDefinition = create_symbol_definition({
          id: "interface_symbol" as SymbolId,
          kind: "interface",
          name: "IInterface" as SymbolName,
          location: mockLocation,
          scope_id: "interface_scope" as ScopeId,
        });

        const classSymbol: SymbolDefinition = create_symbol_definition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          implements_interfaces: ["IInterface" as SymbolName],
        });

        mockSymbols.set("interface_symbol" as SymbolId, interfaceSymbol);
        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        const classInfo = result.find(t => t.type_name === "MyClass");
        const interfaceInfo = result.find(t => t.type_name === "IInterface");

        // Class should have IInterface as unresolved implements clause
        expect(classInfo?.implements_clause).toEqual(["IInterface"]);
        // Interface should have no implements clause
        expect(interfaceInfo?.implements_clause).toBeUndefined();
      });

      it("should collect members from scope relationships", () => {
        const classSymbol: SymbolDefinition = create_symbol_definition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
        });

        const methodSymbol: SymbolDefinition = create_symbol_definition({
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

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        const classInfo = result[0];
        expect(classInfo.direct_members.has("scopeMethod" as SymbolName)).toBe(true);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty symbols map", () => {
        const result = extract_type_members(new Map(), mockScopes, mockFilePath);

        expect(result.length).toBe(0);
      });

      it("should handle classes without type_id", () => {
        const classSymbol: SymbolDefinition = create_symbol_definition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        expect(result.length).toBe(1);
        expect(result[0].type_name).toBe("MyClass");
      });

      it("should capture circular extends clauses without resolution", () => {
        const class1Symbol: SymbolDefinition = create_symbol_definition({
          id: "class1_symbol" as SymbolId,
          kind: "class",
          name: "Class1" as SymbolName,
          location: mockLocation,
          scope_id: "class1_scope" as ScopeId,
          extends_class: "Class2" as SymbolName,
        });

        const class2Symbol: SymbolDefinition = create_symbol_definition({
          id: "class2_symbol" as SymbolId,
          kind: "class",
          name: "Class2" as SymbolName,
          location: mockLocation,
          scope_id: "class2_scope" as ScopeId,
          extends_class: "Class1" as SymbolName,
        });

        mockSymbols.set("class1_symbol" as SymbolId, class1Symbol);
        mockSymbols.set("class2_symbol" as SymbolId, class2Symbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        const class1 = result.find(t => t.type_name === "Class1");
        const class2 = result.find(t => t.type_name === "Class2");

        expect(class1?.extends_clause).toEqual(["Class2"]);
        expect(class2?.extends_clause).toEqual(["Class1"]);
      });

      it("should skip members without matching type", () => {
        const orphanMethodSymbol: SymbolDefinition = create_symbol_definition({
          id: "orphan_method_symbol" as SymbolId,
          kind: "method",
          name: "orphanMethod" as SymbolName,
          location: mockLocation,
          scope_id: "orphan_scope" as ScopeId,
        });

        mockSymbols.set("orphan_method_symbol" as SymbolId, orphanMethodSymbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        expect(result.length).toBe(0);
      });

      it("should capture unknown parent classes as unresolved names", () => {
        const classSymbol: SymbolDefinition = create_symbol_definition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          extends_class: "UnknownParent" as SymbolName,
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        const classInfo = result[0];
        expect(classInfo.extends_clause).toEqual(["UnknownParent"]);
      });

      it("should capture unknown interfaces as unresolved names", () => {
        const classSymbol: SymbolDefinition = create_symbol_definition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          implements_interfaces: ["UnknownInterface" as SymbolName],
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        const classInfo = result[0];
        expect(classInfo.implements_clause).toEqual(["UnknownInterface"]);
      });

      it("should extract interface types with members", () => {
        const interfaceSymbol: SymbolDefinition = create_symbol_definition({
          id: "interface_symbol" as SymbolId,
          kind: "interface",
          name: "IMyInterface" as SymbolName,
          location: mockLocation,
          scope_id: "interface_scope" as ScopeId,
          members: ["method_sig_symbol" as SymbolId, "prop_sig_symbol" as SymbolId],
        });

        const methodSignatureSymbol: SymbolDefinition = create_symbol_definition({
          id: "method_sig_symbol" as SymbolId,
          kind: "method",
          name: "doSomething" as SymbolName,
          location: mockLocation,
          scope_id: "interface_scope" as ScopeId,
        });

        const propertySignatureSymbol: SymbolDefinition = create_symbol_definition({
          id: "prop_sig_symbol" as SymbolId,
          kind: "variable",
          name: "value" as SymbolName,
          location: mockLocation,
          scope_id: "interface_scope" as ScopeId,
        });

        mockSymbols.set("interface_symbol" as SymbolId, interfaceSymbol);
        mockSymbols.set("method_sig_symbol" as SymbolId, methodSignatureSymbol);
        mockSymbols.set("prop_sig_symbol" as SymbolId, propertySignatureSymbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        expect(result.length).toBe(1);
        const interfaceInfo = result[0];
        expect(interfaceInfo.type_name).toBe("IMyInterface");
        expect(interfaceInfo.kind).toBe("interface");
        expect(interfaceInfo.direct_members.size).toBe(2);
        expect(interfaceInfo.direct_members.has("doSomething" as SymbolName)).toBe(true);
        expect(interfaceInfo.direct_members.has("value" as SymbolName)).toBe(true);
      });

      it("should extract multiple types from same file", () => {
        const class1Symbol: SymbolDefinition = create_symbol_definition({
          id: "class1_symbol" as SymbolId,
          kind: "class",
          name: "FirstClass" as SymbolName,
          location: mockLocation,
          scope_id: "class1_scope" as ScopeId,
        });

        const class2Symbol: SymbolDefinition = create_symbol_definition({
          id: "class2_symbol" as SymbolId,
          kind: "class",
          name: "SecondClass" as SymbolName,
          location: mockLocation,
          scope_id: "class2_scope" as ScopeId,
        });

        const interfaceSymbol: SymbolDefinition = create_symbol_definition({
          id: "interface_symbol" as SymbolId,
          kind: "interface",
          name: "IInterface" as SymbolName,
          location: mockLocation,
          scope_id: "interface_scope" as ScopeId,
        });

        mockSymbols.set("class1_symbol" as SymbolId, class1Symbol);
        mockSymbols.set("class2_symbol" as SymbolId, class2Symbol);
        mockSymbols.set("interface_symbol" as SymbolId, interfaceSymbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        expect(result.length).toBe(3);
        const typeNames = result.map(t => t.type_name);
        expect(typeNames).toContain("FirstClass");
        expect(typeNames).toContain("SecondClass");
        expect(typeNames).toContain("IInterface");
      });

      it("should handle optional and rest parameters", () => {
        const classSymbol: SymbolDefinition = create_symbol_definition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "MyClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          members: ["method_symbol" as SymbolId],
        });

        const methodSymbol: SymbolDefinition = create_symbol_definition({
          id: "method_symbol" as SymbolId,
          kind: "method",
          name: "flexibleMethod" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
        });

        const requiredParam: SymbolDefinition = create_symbol_definition({
          id: "param1" as SymbolId,
          kind: "parameter",
          name: "required" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
        });

        const optionalParam: SymbolDefinition = create_symbol_definition({
          id: "param2" as SymbolId,
          kind: "parameter",
          name: "optional" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
        });

        const restParam: SymbolDefinition = create_symbol_definition({
          id: "param3" as SymbolId,
          kind: "parameter",
          name: "rest" as SymbolName,
          location: mockLocation,
          scope_id: "method_scope" as ScopeId,
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);
        mockSymbols.set("method_symbol" as SymbolId, methodSymbol);
        mockSymbols.set("param1" as SymbolId, requiredParam);
        mockSymbols.set("param2" as SymbolId, optionalParam);
        mockSymbols.set("param3" as SymbolId, restParam);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        const classInfo = result[0];
        const methodInfo = classInfo.direct_members.get("flexibleMethod" as SymbolName);
        expect(methodInfo?.parameters).toHaveLength(3);

        // Note: Current implementation doesn't capture optional/rest flags
        // This is a known limitation that should be documented or fixed
        expect(methodInfo?.parameters?.[0].name).toBe("required");
        expect(methodInfo?.parameters?.[1].name).toBe("optional");
        expect(methodInfo?.parameters?.[2].name).toBe("rest");
      });

      it("should handle class with both extends and implements", () => {
        const classSymbol: SymbolDefinition = create_symbol_definition({
          id: "class_symbol" as SymbolId,
          kind: "class",
          name: "ComplexClass" as SymbolName,
          location: mockLocation,
          scope_id: "class_scope" as ScopeId,
          extends_class: "BaseClass" as SymbolName,
          implements_interfaces: ["IFoo" as SymbolName, "IBar" as SymbolName],
        });

        mockSymbols.set("class_symbol" as SymbolId, classSymbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        const classInfo = result[0];
        expect(classInfo.extends_clause).toEqual(["BaseClass"]);
        expect(classInfo.implements_clause).toEqual(["IFoo", "IBar"]);
      });

      it("should handle types without any members", () => {
        const emptyClassSymbol: SymbolDefinition = create_symbol_definition({
          id: "empty_class" as SymbolId,
          kind: "class",
          name: "EmptyClass" as SymbolName,
          location: mockLocation,
          scope_id: "empty_scope" as ScopeId,
        });

        const emptyInterfaceSymbol: SymbolDefinition = create_symbol_definition({
          id: "empty_interface" as SymbolId,
          kind: "interface",
          name: "EmptyInterface" as SymbolName,
          location: mockLocation,
          scope_id: "empty_interface_scope" as ScopeId,
        });

        mockSymbols.set("empty_class" as SymbolId, emptyClassSymbol);
        mockSymbols.set("empty_interface" as SymbolId, emptyInterfaceSymbol);

        const result = extract_type_members(mockSymbols, mockScopes, mockFilePath);

        expect(result.length).toBe(2);
        const emptyClass = result.find(t => t.type_name === "EmptyClass");
        const emptyInterface = result.find(t => t.type_name === "EmptyInterface");

        expect(emptyClass?.direct_members.size).toBe(0);
        expect(emptyInterface?.direct_members.size).toBe(0);
      });
    });
  });

  describe("find_direct_type_methods", () => {
    let mockTypeInfo: LocalTypeInfo;

    beforeEach(() => {
      const methodInfo: LocalMemberInfo = {
        name: "instanceMethod" as SymbolName,
        kind: "method",
        location: mockLocation,
        is_static: false,
      };

      const staticMethodInfo: LocalMemberInfo = {
        name: "staticMethod" as SymbolName,
        kind: "method",
        location: mockLocation,
        is_static: true,
      };

      const propertyInfo: LocalMemberInfo = {
        name: "property" as SymbolName,
        kind: "property",
        location: mockLocation,
      };

      mockTypeInfo = {
        type_name: "TestClass" as SymbolName,
        kind: "class",
        location: mockLocation,
        direct_members: new Map([
          ["instanceMethod" as SymbolName, methodInfo],
          ["staticMethod" as SymbolName, staticMethodInfo],
          ["property" as SymbolName, propertyInfo],
        ]),
      };
    });

    describe("Success Cases", () => {
      it("should find instance methods only by default", () => {
        const result = find_direct_type_methods(mockTypeInfo);

        expect(result.size).toBe(1);
        expect(result.has("instanceMethod" as SymbolName)).toBe(true);
        expect(result.has("staticMethod" as SymbolName)).toBe(false);
      });

      it("should include static methods when requested", () => {
        const result = find_direct_type_methods(mockTypeInfo, true);

        expect(result.size).toBe(2);
        expect(result.has("instanceMethod" as SymbolName)).toBe(true);
        expect(result.has("staticMethod" as SymbolName)).toBe(true);
      });

      it("should filter out non-method members", () => {
        const result = find_direct_type_methods(mockTypeInfo);

        expect(result.has("property" as SymbolName)).toBe(false);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty member maps", () => {
        const emptyTypeInfo: LocalTypeInfo = {
          type_name: "EmptyClass" as SymbolName,
          kind: "class",
          location: mockLocation,
          direct_members: new Map(),
        };

        const result = find_direct_type_methods(emptyTypeInfo);

        expect(result.size).toBe(0);
      });

      it("should handle type with only properties and fields", () => {
        const typeInfo: LocalTypeInfo = {
          type_name: "DataClass" as SymbolName,
          kind: "class",
          location: mockLocation,
          direct_members: new Map([
            ["prop1" as SymbolName, {
              name: "prop1" as SymbolName,
              kind: "property",
              location: mockLocation,
            }],
            ["field1" as SymbolName, {
              name: "field1" as SymbolName,
              kind: "field",
              location: mockLocation,
            }],
          ]),
        };

        const result = find_direct_type_methods(typeInfo, true);
        expect(result.size).toBe(0);
      });

      it("should distinguish constructors from methods", () => {
        const typeInfo: LocalTypeInfo = {
          type_name: "ClassWithConstructor" as SymbolName,
          kind: "class",
          location: mockLocation,
          direct_members: new Map([
            ["constructor" as SymbolName, {
              name: "constructor" as SymbolName,
              kind: "constructor",
              location: mockLocation,
            }],
            ["method1" as SymbolName, {
              name: "method1" as SymbolName,
              kind: "method",
              location: mockLocation,
            }],
          ]),
        };

        const result = find_direct_type_methods(typeInfo);
        expect(result.size).toBe(1);
        expect(result.has("method1" as SymbolName)).toBe(true);
        expect(result.has("constructor" as SymbolName)).toBe(false);
      });
    });
  });

  describe("find_direct_member", () => {
    let mockTypeInfo: LocalTypeInfo;

    beforeEach(() => {
      const instanceMethodInfo: LocalMemberInfo = {
        name: "instanceMethod" as SymbolName,
        kind: "method",
        location: mockLocation,
        is_static: false,
      };

      const staticMethodInfo: LocalMemberInfo = {
        name: "staticMethod" as SymbolName,
        kind: "method",
        location: mockLocation,
        is_static: true,
      };

      const propertyInfo: LocalMemberInfo = {
        name: "notAMethod" as SymbolName,
        kind: "property",
        location: mockLocation,
      };

      mockTypeInfo = {
        type_name: "TestClass" as SymbolName,
        kind: "class",
        location: mockLocation,
        direct_members: new Map([
          ["instanceMethod" as SymbolName, instanceMethodInfo],
          ["staticMethod" as SymbolName, staticMethodInfo],
          ["notAMethod" as SymbolName, propertyInfo],
        ]),
      };
    });

    describe("Success Cases", () => {
      it("should find instance methods", () => {
        const result = find_direct_member(
          mockTypeInfo,
          "instanceMethod" as SymbolName
        );

        expect(result).toBeDefined();
        expect(result!.name).toBe("instanceMethod");
        expect(result!.kind).toBe("method");
      });

      it("should find static methods", () => {
        const result = find_direct_member(
          mockTypeInfo,
          "staticMethod" as SymbolName
        );

        expect(result).toBeDefined();
        expect(result!.name).toBe("staticMethod");
        expect(result!.kind).toBe("method");
        expect(result!.is_static).toBe(true);
      });

      it("should find property members", () => {
        const result = find_direct_member(
          mockTypeInfo,
          "notAMethod" as SymbolName
        );

        expect(result).toBeDefined();
        expect(result!.name).toBe("notAMethod");
        expect(result!.kind).toBe("property");
      });
    });

    describe("Edge Cases", () => {
      it("should return undefined for non-existent members", () => {
        const result = find_direct_member(
          mockTypeInfo,
          "nonExistentMember" as SymbolName
        );

        expect(result).toBeUndefined();
      });

      it("should handle empty member maps", () => {
        const emptyTypeInfo: LocalTypeInfo = {
          type_name: "EmptyClass" as SymbolName,
          kind: "class",
          location: mockLocation,
          direct_members: new Map(),
        };

        const result = find_direct_member(
          emptyTypeInfo,
          "anyMember" as SymbolName
        );

        expect(result).toBeUndefined();
      });

      it("should find constructors", () => {
        const constructorInfo: LocalMemberInfo = {
          name: "constructor" as SymbolName,
          kind: "constructor",
          location: mockLocation,
          parameters: [
            { name: "param1" as SymbolName, type_annotation: "string" },
          ],
        };

        const typeInfo: LocalTypeInfo = {
          type_name: "TestClass" as SymbolName,
          kind: "class",
          location: mockLocation,
          direct_members: new Map([
            ["constructor" as SymbolName, constructorInfo],
          ]),
        };

        const result = find_direct_member(typeInfo, "constructor" as SymbolName);

        expect(result).toBeDefined();
        expect(result?.kind).toBe("constructor");
        expect(result?.parameters).toHaveLength(1);
      });

      it("should find fields vs properties correctly", () => {
        const fieldInfo: LocalMemberInfo = {
          name: "field" as SymbolName,
          kind: "field",
          location: mockLocation,
        };

        const propertyInfo: LocalMemberInfo = {
          name: "property" as SymbolName,
          kind: "property",
          location: mockLocation,
          is_static: true,
        };

        const typeInfo: LocalTypeInfo = {
          type_name: "TestClass" as SymbolName,
          kind: "class",
          location: mockLocation,
          direct_members: new Map([
            ["field" as SymbolName, fieldInfo],
            ["property" as SymbolName, propertyInfo],
          ]),
        };

        const fieldResult = find_direct_member(typeInfo, "field" as SymbolName);
        const propertyResult = find_direct_member(typeInfo, "property" as SymbolName);

        expect(fieldResult?.kind).toBe("field");
        expect(propertyResult?.kind).toBe("property");
        expect(propertyResult?.is_static).toBe(true);
      });
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete type member extraction", () => {
      // Setup a complex class hierarchy
      const baseClassSymbol: SymbolDefinition = create_symbol_definition({
        id: "base_class_symbol" as SymbolId,
        kind: "class",
        name: "BaseClass" as SymbolName,
        location: mockLocation,
        scope_id: "base_class_scope" as ScopeId,
        members: ["base_method_symbol" as SymbolId],
      });

      const derivedClassSymbol: SymbolDefinition = create_symbol_definition({
        id: "derived_class_symbol" as SymbolId,
        kind: "class",
        name: "DerivedClass" as SymbolName,
        location: mockLocation,
        scope_id: "derived_class_scope" as ScopeId,
        extends_class: "BaseClass" as SymbolName,
        members: ["derived_method_symbol" as SymbolId, "overridden_method_symbol" as SymbolId],
      });

      const baseMethodSymbol: SymbolDefinition = create_symbol_definition({
        id: "base_method_symbol" as SymbolId,
        kind: "method",
        name: "baseMethod" as SymbolName,
        location: mockLocation,
        scope_id: "base_method_scope" as ScopeId,
      });

      const derivedMethodSymbol: SymbolDefinition = create_symbol_definition({
        id: "derived_method_symbol" as SymbolId,
        kind: "method",
        name: "derivedMethod" as SymbolName,
        location: mockLocation,
        scope_id: "derived_method_scope" as ScopeId,
      });

      const overriddenMethodSymbol: SymbolDefinition = create_symbol_definition({
        id: "overridden_method_symbol" as SymbolId,
        kind: "method",
        name: "baseMethod" as SymbolName,
        location: mockLocation,
        scope_id: "overridden_method_scope" as ScopeId,
      });

      mockSymbols.set("base_class_symbol" as SymbolId, baseClassSymbol);
      mockSymbols.set("derived_class_symbol" as SymbolId, derivedClassSymbol);
      mockSymbols.set("base_method_symbol" as SymbolId, baseMethodSymbol);
      mockSymbols.set("derived_method_symbol" as SymbolId, derivedMethodSymbol);
      mockSymbols.set(
        "overridden_method_symbol" as SymbolId,
        overriddenMethodSymbol
      );

      // Extract type members
      const types = extract_type_members(mockSymbols, mockScopes, mockFilePath);

      // Find base and derived classes
      const baseClass = types.find(t => t.type_name === "BaseClass");
      const derivedClass = types.find(t => t.type_name === "DerivedClass");

      // Test extends clause capture
      expect(baseClass?.extends_clause).toBeUndefined();
      expect(derivedClass?.extends_clause).toEqual(["BaseClass"]);

      // Test direct member extraction
      expect(baseClass?.direct_members.size).toBe(1);
      expect(baseClass?.direct_members.has("baseMethod" as SymbolName)).toBe(true);

      expect(derivedClass?.direct_members.size).toBe(2);
      expect(derivedClass?.direct_members.has("baseMethod" as SymbolName)).toBe(true);
      expect(derivedClass?.direct_members.has("derivedMethod" as SymbolName)).toBe(true);

      // Test method finding
      const derivedMethods = find_direct_type_methods(derivedClass!);
      expect(derivedMethods.size).toBe(2);
      expect(derivedMethods.has("baseMethod" as SymbolName)).toBe(true);
      expect(derivedMethods.has("derivedMethod" as SymbolName)).toBe(true);

      // Test member finding
      const overriddenMethod = find_direct_member(derivedClass!, "baseMethod" as SymbolName);
      expect(overriddenMethod?.name).toBe("baseMethod");
      const derivedMethod = find_direct_member(derivedClass!, "derivedMethod" as SymbolName);
      expect(derivedMethod?.name).toBe("derivedMethod");
    });
  });
});

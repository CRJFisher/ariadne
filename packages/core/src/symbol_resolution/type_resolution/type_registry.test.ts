import { describe, it, expect, beforeEach } from "vitest";
import {
  build_type_registry,
  build_global_type_registry,
} from "./type_registry";
import type {
  LocalTypeDefinition,
  GlobalTypeRegistry,
  ResolvedTypeDefinition,
  LocalMemberInfo,
} from "./types";
import type {
  FilePath,
  TypeId,
  SymbolName,
  Location,
  SymbolId,
} from "@ariadnejs/types";
import { defined_type_id, TypeCategory } from "@ariadnejs/types";

describe("Type Registry", () => {
  // Test data setup
  const createLocation = (
    file: string,
    line: number = 0,
    column: number = 0,
    end_line: number = 0,
    end_column: number = 100
  ): Location => ({
    file_path: file as FilePath,
    line,
    column,
    end_line,
    end_column,
  });

  const createLocalTypeDef = (
    name: string,
    kind: "class" | "interface" | "type" | "enum",
    file: string,
    extends_names?: SymbolName[],
    implements_names?: SymbolName[],
    line: number = 1,
    column: number = 0
  ): LocalTypeDefinition => ({
    name: name as SymbolName,
    kind,
    location: createLocation(file, line, column, line, column + 100),
    file_path: file as FilePath,
    direct_members: new Map(),
    extends_names,
    implements_names,
  });

  describe("build_type_registry", () => {
    it("should handle empty type definitions", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const registry = build_type_registry(type_definitions);

      expect(registry).toBeDefined();
      expect(registry.types).toBeInstanceOf(Map);
      expect(registry.type_names).toBeInstanceOf(Map);
      expect(registry.types.size).toBe(0);
    });

    it("should process single file with one type", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const file_path = "test.ts" as FilePath;

      type_definitions.set(file_path, [
        createLocalTypeDef("TestClass", "class", "test.ts"),
      ]);

      const registry = build_type_registry(type_definitions);

      expect(registry.types.size).toBe(1);
      expect(registry.type_names.size).toBe(1);
      expect(registry.type_names.get(file_path)?.size).toBe(1);
      expect(registry.type_names.get(file_path)?.has("TestClass" as SymbolName)).toBe(true);
    });

    it("should process multiple types in single file", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const file_path = "test.ts" as FilePath;

      type_definitions.set(file_path, [
        createLocalTypeDef("TestClass", "class", "test.ts"),
        createLocalTypeDef("TestInterface", "interface", "test.ts"),
        createLocalTypeDef("TestEnum", "enum", "test.ts"),
      ]);

      const registry = build_type_registry(type_definitions);

      expect(registry.types.size).toBe(3);
      expect(registry.type_names.get(file_path)?.size).toBe(3);
    });

    it("should process types across multiple files", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();

      type_definitions.set("file1.ts" as FilePath, [
        createLocalTypeDef("ClassA", "class", "file1.ts"),
        createLocalTypeDef("InterfaceA", "interface", "file1.ts"),
      ]);

      type_definitions.set("file2.ts" as FilePath, [
        createLocalTypeDef("ClassB", "class", "file2.ts"),
        createLocalTypeDef("TypeB", "type", "file2.ts"),
      ]);

      const registry = build_type_registry(type_definitions);

      expect(registry.types.size).toBe(4);
      expect(registry.type_names.size).toBe(2);
      expect(registry.type_names.get("file1.ts" as FilePath)?.size).toBe(2);
      expect(registry.type_names.get("file2.ts" as FilePath)?.size).toBe(2);
    });

    it("should create correct TypeIds for different type kinds", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const file_path = "test.ts" as FilePath;

      const classDef = createLocalTypeDef("MyClass", "class", "test.ts");
      const interfaceDef = createLocalTypeDef("MyInterface", "interface", "test.ts");
      const typeDef = createLocalTypeDef("MyType", "type", "test.ts");
      const enumDef = createLocalTypeDef("MyEnum", "enum", "test.ts");

      type_definitions.set(file_path, [classDef, interfaceDef, typeDef, enumDef]);

      const registry = build_type_registry(type_definitions);

      // Verify TypeIds are created with correct categories
      const classTypeId = defined_type_id(
        TypeCategory.CLASS,
        "MyClass" as SymbolName,
        classDef.location
      );
      const interfaceTypeId = defined_type_id(
        TypeCategory.INTERFACE,
        "MyInterface" as SymbolName,
        interfaceDef.location
      );
      const typeAliasId = defined_type_id(
        TypeCategory.TYPE_ALIAS,
        "MyType" as SymbolName,
        typeDef.location
      );
      const enumTypeId = defined_type_id(
        TypeCategory.ENUM,
        "MyEnum" as SymbolName,
        enumDef.location
      );

      expect(registry.types.has(classTypeId)).toBe(true);
      expect(registry.types.has(interfaceTypeId)).toBe(true);
      expect(registry.types.has(typeAliasId)).toBe(true);
      expect(registry.types.has(enumTypeId)).toBe(true);
    });
  });

  describe("build_global_type_registry", () => {
    it("should handle empty imports", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

      type_definitions.set("test.ts" as FilePath, [
        createLocalTypeDef("TestClass", "class", "test.ts"),
      ]);

      const registry = build_global_type_registry(type_definitions, imports);

      expect(registry.types.size).toBe(1);
      expect(registry.type_names.size).toBe(1);
    });

    it("should resolve inheritance within same file", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
      const file_path = "test.ts" as FilePath;

      type_definitions.set(file_path, [
        createLocalTypeDef("BaseClass", "class", "test.ts"),
        createLocalTypeDef(
          "DerivedClass",
          "class",
          "test.ts",
          ["BaseClass" as SymbolName]
        ),
      ]);

      const registry = build_global_type_registry(type_definitions, imports);

      expect(registry.types.size).toBe(2);

      // Get the TypeIds
      const baseId = registry.type_names.get(file_path)?.get("BaseClass" as SymbolName);
      const derivedId = registry.type_names.get(file_path)?.get("DerivedClass" as SymbolName);

      expect(baseId).toBeDefined();
      expect(derivedId).toBeDefined();

      const derivedType = registry.types.get(derivedId!);
      expect(derivedType?.base_types).toContain(baseId);
    });

    it("should handle interface implementation", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
      const file_path = "test.ts" as FilePath;

      type_definitions.set(file_path, [
        createLocalTypeDef("ITestable", "interface", "test.ts"),
        createLocalTypeDef(
          "TestClass",
          "class",
          "test.ts",
          undefined,
          ["ITestable" as SymbolName]
        ),
      ]);

      const registry = build_global_type_registry(type_definitions, imports);

      const interfaceId = registry.type_names.get(file_path)?.get("ITestable" as SymbolName);
      const classId = registry.type_names.get(file_path)?.get("TestClass" as SymbolName);

      expect(interfaceId).toBeDefined();
      expect(classId).toBeDefined();

      const classType = registry.types.get(classId!);
      expect(classType?.base_types).toContain(interfaceId);
    });

    it("should handle members in type definitions", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
      const file_path = "test.ts" as FilePath;

      const classDef = createLocalTypeDef("TestClass", "class", "test.ts");

      // Add members to the class
      const methodMember: LocalMemberInfo = {
        name: "testMethod" as SymbolName,
        kind: "method",
        location: createLocation("test.ts", 10, 20, 10, 40),
        is_static: false,
        is_optional: false,
      };

      const propertyMember: LocalMemberInfo = {
        name: "testProperty" as SymbolName,
        kind: "property",
        location: createLocation("test.ts", 30, 40, 30, 60),
        is_static: false,
        is_optional: true,
      };

      classDef.direct_members.set("testMethod" as SymbolName, methodMember);
      classDef.direct_members.set("testProperty" as SymbolName, propertyMember);

      type_definitions.set(file_path, [classDef]);

      const registry = build_global_type_registry(type_definitions, imports);

      const classId = registry.type_names.get(file_path)?.get("TestClass" as SymbolName);
      const classType = registry.types.get(classId!);

      expect(classType?.all_members.size).toBe(2);
      expect(classType?.all_members.has("testMethod" as SymbolName)).toBe(true);
      expect(classType?.all_members.has("testProperty" as SymbolName)).toBe(true);

      const methodInfo = classType?.all_members.get("testMethod" as SymbolName);
      expect(methodInfo?.kind).toBe("method");
      expect(methodInfo?.is_static).toBe(false);
    });

    it("should handle inherited members", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
      const file_path = "test.ts" as FilePath;

      const baseDef = createLocalTypeDef("BaseClass", "class", "test.ts");
      const derivedDef = createLocalTypeDef(
        "DerivedClass",
        "class",
        "test.ts",
        ["BaseClass" as SymbolName]
      );

      // Add member to base class
      const baseMember: LocalMemberInfo = {
        name: "baseMethod" as SymbolName,
        kind: "method",
        location: createLocation("test.ts", 10, 20, 10, 40),
        is_static: false,
        is_optional: false,
      };
      baseDef.direct_members.set("baseMethod" as SymbolName, baseMember);

      // Add member to derived class
      const derivedMember: LocalMemberInfo = {
        name: "derivedMethod" as SymbolName,
        kind: "method",
        location: createLocation("test.ts", 30, 40, 30, 60),
        is_static: false,
        is_optional: false,
      };
      derivedDef.direct_members.set("derivedMethod" as SymbolName, derivedMember);

      type_definitions.set(file_path, [baseDef, derivedDef]);

      const registry = build_global_type_registry(type_definitions, imports);

      const baseId = registry.type_names.get(file_path)?.get("BaseClass" as SymbolName);
      const derivedId = registry.type_names.get(file_path)?.get("DerivedClass" as SymbolName);

      const baseType = registry.types.get(baseId!);
      const derivedType = registry.types.get(derivedId!);

      // Base should have only its own members
      expect(baseType?.all_members.size).toBe(1);
      expect(baseType?.all_members.has("baseMethod" as SymbolName)).toBe(true);

      // Derived should have both its own and inherited members
      expect(derivedType?.all_members.size).toBe(2);
      expect(derivedType?.all_members.has("baseMethod" as SymbolName)).toBe(true);
      expect(derivedType?.all_members.has("derivedMethod" as SymbolName)).toBe(true);

      // Check inherited member is marked as such
      const inheritedMember = derivedType?.all_members.get("baseMethod" as SymbolName);
      expect(inheritedMember?.inherited_from).toBe(baseId);
    });

    it("should handle multiple inheritance levels", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
      const file_path = "test.ts" as FilePath;

      type_definitions.set(file_path, [
        createLocalTypeDef("GrandParent", "class", "test.ts"),
        createLocalTypeDef("Parent", "class", "test.ts", ["GrandParent" as SymbolName]),
        createLocalTypeDef("Child", "class", "test.ts", ["Parent" as SymbolName]),
      ]);

      const registry = build_global_type_registry(type_definitions, imports);

      const grandParentId = registry.type_names.get(file_path)?.get("GrandParent" as SymbolName);
      const parentId = registry.type_names.get(file_path)?.get("Parent" as SymbolName);
      const childId = registry.type_names.get(file_path)?.get("Child" as SymbolName);

      const childType = registry.types.get(childId!);

      // Child should have Parent as direct base
      expect(childType?.base_types).toContain(parentId);

      // Parent should have GrandParent as direct base
      const parentType = registry.types.get(parentId!);
      expect(parentType?.base_types).toContain(grandParentId);
    });

    it("should handle multiple interface implementation", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
      const file_path = "test.ts" as FilePath;

      type_definitions.set(file_path, [
        createLocalTypeDef("ISerializable", "interface", "test.ts"),
        createLocalTypeDef("IComparable", "interface", "test.ts"),
        createLocalTypeDef("IClonable", "interface", "test.ts"),
        createLocalTypeDef(
          "TestClass",
          "class",
          "test.ts",
          undefined,
          ["ISerializable", "IComparable", "IClonable"] as SymbolName[]
        ),
      ]);

      const registry = build_global_type_registry(type_definitions, imports);

      const classId = registry.type_names.get(file_path)?.get("TestClass" as SymbolName);
      const classType = registry.types.get(classId!);

      expect(classType?.base_types.length).toBe(3);

      const serializable = registry.type_names.get(file_path)?.get("ISerializable" as SymbolName);
      const comparable = registry.type_names.get(file_path)?.get("IComparable" as SymbolName);
      const clonable = registry.type_names.get(file_path)?.get("IClonable" as SymbolName);

      expect(classType?.base_types).toContain(serializable);
      expect(classType?.base_types).toContain(comparable);
      expect(classType?.base_types).toContain(clonable);
    });

    it("should handle circular dependencies gracefully", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
      const file_path = "test.ts" as FilePath;

      // Note: In real code this would be invalid, but we should handle it gracefully
      type_definitions.set(file_path, [
        createLocalTypeDef("ClassA", "class", "test.ts", ["ClassB" as SymbolName]),
        createLocalTypeDef("ClassB", "class", "test.ts", ["ClassA" as SymbolName]),
      ]);

      const registry = build_global_type_registry(type_definitions, imports);

      expect(registry.types.size).toBe(2);

      const classA = registry.type_names.get(file_path)?.get("ClassA" as SymbolName);
      const classB = registry.type_names.get(file_path)?.get("ClassB" as SymbolName);

      const typeA = registry.types.get(classA!);
      const typeB = registry.types.get(classB!);

      // Both should reference each other
      expect(typeA?.base_types).toContain(classB);
      expect(typeB?.base_types).toContain(classA);
    });

    it("should handle missing base types gracefully", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
      const file_path = "test.ts" as FilePath;

      // Reference non-existent base class
      type_definitions.set(file_path, [
        createLocalTypeDef(
          "DerivedClass",
          "class",
          "test.ts",
          ["NonExistentBase" as SymbolName]
        ),
      ]);

      const registry = build_global_type_registry(type_definitions, imports);

      expect(registry.types.size).toBe(1);

      const derivedId = registry.type_names.get(file_path)?.get("DerivedClass" as SymbolName);
      const derivedType = registry.types.get(derivedId!);

      // Should have empty base_types since base doesn't exist
      expect(derivedType?.base_types.length).toBe(0);
    });

    it("should handle types with same name in different files", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

      type_definitions.set("file1.ts" as FilePath, [
        createLocalTypeDef("TestClass", "class", "file1.ts"),
      ]);

      type_definitions.set("file2.ts" as FilePath, [
        createLocalTypeDef("TestClass", "class", "file2.ts"),
      ]);

      const registry = build_global_type_registry(type_definitions, imports);

      expect(registry.types.size).toBe(2);
      expect(registry.type_names.size).toBe(2);

      // Each file should have its own TestClass
      expect(registry.type_names.get("file1.ts" as FilePath)?.has("TestClass" as SymbolName)).toBe(true);
      expect(registry.type_names.get("file2.ts" as FilePath)?.has("TestClass" as SymbolName)).toBe(true);

      // The TypeIds should be different
      const class1Id = registry.type_names.get("file1.ts" as FilePath)?.get("TestClass" as SymbolName);
      const class2Id = registry.type_names.get("file2.ts" as FilePath)?.get("TestClass" as SymbolName);

      expect(class1Id).not.toBe(class2Id);
    });
  });

  describe("Edge Cases", () => {
    it("should handle large number of types", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

      const types: LocalTypeDefinition[] = [];
      for (let i = 0; i < 1000; i++) {
        types.push(createLocalTypeDef(`Type${i}`, "class", "large.ts"));
      }

      type_definitions.set("large.ts" as FilePath, types);

      const registry = build_global_type_registry(type_definitions, imports);

      expect(registry.types.size).toBe(1000);
      expect(registry.type_names.get("large.ts" as FilePath)?.size).toBe(1000);
    });

    it("should handle deeply nested inheritance", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
      const file_path = "test.ts" as FilePath;

      const types: LocalTypeDefinition[] = [];

      // Create a chain of 10 levels of inheritance
      types.push(createLocalTypeDef("Level0", "class", "test.ts"));
      for (let i = 1; i < 10; i++) {
        types.push(createLocalTypeDef(
          `Level${i}`,
          "class",
          "test.ts",
          [`Level${i-1}` as SymbolName]
        ));
      }

      type_definitions.set(file_path, types);

      const registry = build_global_type_registry(type_definitions, imports);

      expect(registry.types.size).toBe(10);

      // Check that Level9 has Level8 as base
      const level9Id = registry.type_names.get(file_path)?.get("Level9" as SymbolName);
      const level8Id = registry.type_names.get(file_path)?.get("Level8" as SymbolName);
      const level9Type = registry.types.get(level9Id!);

      expect(level9Type?.base_types).toContain(level8Id);
    });

    it("should handle empty members map", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
      const file_path = "test.ts" as FilePath;

      const classDef = createLocalTypeDef("EmptyClass", "class", "test.ts");
      // Explicitly empty members
      classDef.direct_members.clear();

      type_definitions.set(file_path, [classDef]);

      const registry = build_global_type_registry(type_definitions, imports);

      const classId = registry.type_names.get(file_path)?.get("EmptyClass" as SymbolName);
      const classType = registry.types.get(classId!);

      expect(classType?.all_members.size).toBe(0);
    });

    it("should preserve all type metadata", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
      const file_path = "test.ts" as FilePath;

      const location = createLocation("test.ts", 42, 10, 42, 84);
      const classDef: LocalTypeDefinition = {
        name: "DetailedClass" as SymbolName,
        kind: "class",
        location,
        file_path,
        direct_members: new Map(),
        extends_names: ["BaseClass" as SymbolName],
        implements_names: ["IInterface" as SymbolName],
      };

      type_definitions.set(file_path, [classDef]);

      const registry = build_global_type_registry(type_definitions, imports);

      const classId = registry.type_names.get(file_path)?.get("DetailedClass" as SymbolName);
      const classType = registry.types.get(classId!);

      expect(classType).toBeDefined();
      expect(classType?.name).toBe("DetailedClass");
      expect(classType?.kind).toBe("class");
      expect(classType?.file_path).toBe(file_path);
      expect(classType?.definition_location).toEqual(location);
    });
  });
});
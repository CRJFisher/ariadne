/**
 * Tests for type member resolution functionality
 */

import { describe, it, expect } from "vitest";
import type { TypeId, SymbolName, FilePath, Location } from "@ariadnejs/types";
import { resolve_type_members } from "./resolve_members";
import type { LocalTypeDefinition, LocalMemberInfo } from "./types";

// Test utilities
function create_location(line: number, column: number): Location {
  return {
    file_path: "test.ts" as FilePath,
    start_line: line,
    start_column: column,
    end_line: line,
    end_column: column + 10,
  };
}

function create_local_member_info(
  name: SymbolName,
  kind: "method" | "property" | "getter" | "setter" | "field"
): LocalMemberInfo {
  return {
    name,
    kind,
    location: create_location(1, 1),
    is_static: false,
    is_optional: false,
  };
}

function create_local_type_definition(
  name: SymbolName,
  kind: "class" | "interface" | "type" | "enum",
  file_path: FilePath,
  members?: Map<SymbolName, LocalMemberInfo>
): LocalTypeDefinition {
  return {
    name,
    kind,
    location: create_location(1, 1),
    file_path,
    direct_members: members || new Map(),
  };
}

describe("resolve_type_members", () => {
  describe("Direct members only", () => {
    it("should resolve direct members correctly", () => {
      const type_id = "TypeId:MyClass" as TypeId;
      const members = new Map<SymbolName, LocalMemberInfo>([
        [
          "method1" as SymbolName,
          create_local_member_info("method1" as SymbolName, "method"),
        ],
        [
          "property1" as SymbolName,
          create_local_member_info("property1" as SymbolName, "property"),
        ],
        [
          "field1" as SymbolName,
          create_local_member_info("field1" as SymbolName, "field"),
        ],
      ]);

      const local_definition = create_local_type_definition(
        "MyClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        members
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>();

      const result = resolve_type_members(
        type_id,
        local_definition,
        type_hierarchy
      );

      expect(result.type_id).toBe(type_id);
      expect(result.name).toBe("MyClass");
      expect(result.kind).toBe("class");
      expect(result.all_members.size).toBe(3);

      // Check that all direct members are present
      expect(result.all_members.has("method1" as SymbolName)).toBe(true);
      expect(result.all_members.has("property1" as SymbolName)).toBe(true);
      expect(result.all_members.has("field1" as SymbolName)).toBe(true);

      // Check member properties
      const method1 = result.all_members.get("method1" as SymbolName);
      expect(method1).toBeDefined();
      expect(method1!.kind).toBe("method");
      expect(method1!.symbol_id).toContain("method1");
      expect(method1!.inherited_from).toBeUndefined(); // Direct member
    });

    it("should handle empty member list", () => {
      const type_id = "TypeId:EmptyClass" as TypeId;
      const local_definition = create_local_type_definition(
        "EmptyClass" as SymbolName,
        "class",
        "test.ts" as FilePath
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>();

      const result = resolve_type_members(
        type_id,
        local_definition,
        type_hierarchy
      );

      expect(result.all_members.size).toBe(0);
      expect(result.inherited_members?.size || 0).toBe(0);
    });
  });

  describe("Inheritance resolution", () => {
    it("should inherit members from parent class", () => {
      const base_type_id = "TypeId:BaseClass" as TypeId;
      const derived_type_id = "TypeId:DerivedClass" as TypeId;

      // Base class with methods
      const base_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "baseMethod" as SymbolName,
          create_local_member_info("baseMethod" as SymbolName, "method"),
        ],
        [
          "baseProperty" as SymbolName,
          create_local_member_info("baseProperty" as SymbolName, "property"),
        ],
      ]);

      const base_definition = create_local_type_definition(
        "BaseClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        base_members
      );

      // Derived class with its own method
      const derived_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "derivedMethod" as SymbolName,
          create_local_member_info("derivedMethod" as SymbolName, "method"),
        ],
      ]);

      const derived_definition = create_local_type_definition(
        "DerivedClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        derived_members
      );

      // Hierarchy: DerivedClass extends BaseClass
      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [derived_type_id, [base_type_id]],
      ]);

      // All definitions for inheritance lookup
      const all_definitions = new Map<TypeId, LocalTypeDefinition>([
        [base_type_id, base_definition],
        [derived_type_id, derived_definition],
      ]);

      const result = resolve_type_members(
        derived_type_id,
        derived_definition,
        type_hierarchy,
        all_definitions
      );

      expect(result.all_members.size).toBe(3); // 1 direct + 2 inherited

      // Check direct member
      expect(result.all_members.has("derivedMethod" as SymbolName)).toBe(true);
      const derived_method = result.all_members.get(
        "derivedMethod" as SymbolName
      );
      expect(derived_method!.inherited_from).toBeUndefined();

      // Check inherited members
      expect(result.all_members.has("baseMethod" as SymbolName)).toBe(true);
      expect(result.all_members.has("baseProperty" as SymbolName)).toBe(true);

      const base_method = result.all_members.get("baseMethod" as SymbolName);
      expect(base_method!.inherited_from).toBe(base_type_id);

      // Check inherited_members map
      expect(result.inherited_members?.size || 0).toBe(2);
      expect(result.inherited_members?.has("baseMethod" as SymbolName)).toBe(
        true
      );
      expect(result.inherited_members?.has("baseProperty" as SymbolName)).toBe(
        true
      );
    });

    it("should handle method overriding correctly", () => {
      const base_type_id = "TypeId:BaseClass" as TypeId;
      const derived_type_id = "TypeId:DerivedClass" as TypeId;

      // Base class with method
      const base_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "method" as SymbolName,
          create_local_member_info("method" as SymbolName, "method"),
        ],
        [
          "baseOnly" as SymbolName,
          create_local_member_info("baseOnly" as SymbolName, "method"),
        ],
      ]);

      const base_definition = create_local_type_definition(
        "BaseClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        base_members
      );

      // Derived class overrides method
      const derived_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "method" as SymbolName,
          create_local_member_info("method" as SymbolName, "method"),
        ], // Override
      ]);

      const derived_definition = create_local_type_definition(
        "DerivedClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        derived_members
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [derived_type_id, [base_type_id]],
      ]);

      const all_definitions = new Map<TypeId, LocalTypeDefinition>([
        [base_type_id, base_definition],
        [derived_type_id, derived_definition],
      ]);

      const result = resolve_type_members(
        derived_type_id,
        derived_definition,
        type_hierarchy,
        all_definitions
      );

      expect(result.all_members.size).toBe(2); // Override + inherited

      // Check that overridden method comes from derived class
      const method = result.all_members.get("method" as SymbolName);
      expect(method!.inherited_from).toBeUndefined(); // Not inherited, it's overridden

      // Check that non-overridden method is inherited
      const base_only = result.all_members.get("baseOnly" as SymbolName);
      expect(base_only!.inherited_from).toBe(base_type_id);

      // Inherited members should not include the overridden method
      expect(result.inherited_members?.has("method" as SymbolName)).toBe(false);
      expect(result.inherited_members?.has("baseOnly" as SymbolName)).toBe(
        true
      );
    });

    it("should handle multi-level inheritance", () => {
      const grand_parent_id = "TypeId:GrandParent" as TypeId;
      const parent_id = "TypeId:Parent" as TypeId;
      const child_id = "TypeId:Child" as TypeId;

      const grand_parent_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "grandMethod" as SymbolName,
          create_local_member_info("grandMethod" as SymbolName, "method"),
        ],
      ]);

      const parent_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "parentMethod" as SymbolName,
          create_local_member_info("parentMethod" as SymbolName, "method"),
        ],
      ]);

      const child_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "childMethod" as SymbolName,
          create_local_member_info("childMethod" as SymbolName, "method"),
        ],
      ]);

      const grand_parent_def = create_local_type_definition(
        "GrandParent" as SymbolName,
        "class",
        "test.ts" as FilePath,
        grand_parent_members
      );
      const parent_def = create_local_type_definition(
        "Parent" as SymbolName,
        "class",
        "test.ts" as FilePath,
        parent_members
      );
      const child_def = create_local_type_definition(
        "Child" as SymbolName,
        "class",
        "test.ts" as FilePath,
        child_members
      );

      // Hierarchy: Child -> Parent -> GrandParent
      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [parent_id, [grand_parent_id]],
        [child_id, [parent_id]],
      ]);

      const all_definitions = new Map<TypeId, LocalTypeDefinition>([
        [grand_parent_id, grand_parent_def],
        [parent_id, parent_def],
        [child_id, child_def],
      ]);

      const result = resolve_type_members(
        child_id,
        child_def,
        type_hierarchy,
        all_definitions
      );

      expect(result.all_members.size).toBe(3); // All three methods

      expect(result.all_members.has("childMethod" as SymbolName)).toBe(true);
      expect(result.all_members.has("parentMethod" as SymbolName)).toBe(true);
      expect(result.all_members.has("grandMethod" as SymbolName)).toBe(true);

      // Check inheritance sources
      expect(
        result.all_members.get("childMethod" as SymbolName)!.inherited_from
      ).toBeUndefined();
      expect(
        result.all_members.get("parentMethod" as SymbolName)!.inherited_from
      ).toBe(parent_id);
      expect(
        result.all_members.get("grandMethod" as SymbolName)!.inherited_from
      ).toBe(grand_parent_id);
    });
  });

  describe("Hierarchy relationships", () => {
    it("should correctly identify parent and child types", () => {
      const base_type_id = "TypeId:BaseClass" as TypeId;
      const derived_type_id = "TypeId:DerivedClass" as TypeId;

      const derived_definition = create_local_type_definition(
        "DerivedClass" as SymbolName,
        "class",
        "test.ts" as FilePath
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [derived_type_id, [base_type_id]],
      ]);

      const result = resolve_type_members(
        derived_type_id,
        derived_definition,
        type_hierarchy
      );

      expect(result.parent_types).toEqual([base_type_id]);
      expect(result.base_types).toEqual([base_type_id]);
    });

    it("should compute child types correctly", () => {
      const base_type_id = "TypeId:BaseClass" as TypeId;
      const derived1_type_id = "TypeId:Derived1" as TypeId;
      const derived2_type_id = "TypeId:Derived2" as TypeId;

      const base_definition = create_local_type_definition(
        "BaseClass" as SymbolName,
        "class",
        "test.ts" as FilePath
      );

      // Both derived classes extend base
      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [derived1_type_id, [base_type_id]],
        [derived2_type_id, [base_type_id]],
      ]);

      const result = resolve_type_members(
        base_type_id,
        base_definition,
        type_hierarchy
      );

      expect(result.child_types).toBeDefined();
      expect(result.child_types?.length || 0).toBe(2);
      expect(result.child_types).toContain(derived1_type_id);
      expect(result.child_types).toContain(derived2_type_id);
    });
  });

  describe("Edge cases", () => {
    it("should handle circular inheritance gracefully", () => {
      const type_a_id = "TypeId:TypeA" as TypeId;
      const type_b_id = "TypeId:TypeB" as TypeId;

      const type_a_def = create_local_type_definition(
        "TypeA" as SymbolName,
        "class",
        "test.ts" as FilePath
      );
      const type_b_def = create_local_type_definition(
        "TypeB" as SymbolName,
        "class",
        "test.ts" as FilePath
      );

      // Circular: A -> B -> A
      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [type_a_id, [type_b_id]],
        [type_b_id, [type_a_id]],
      ]);

      const all_definitions = new Map<TypeId, LocalTypeDefinition>([
        [type_a_id, type_a_def],
        [type_b_id, type_b_def],
      ]);

      // Should not throw
      expect(() => {
        const result = resolve_type_members(
          type_a_id,
          type_a_def,
          type_hierarchy,
          all_definitions
        );
      }).not.toThrow();
    });

    it("should handle missing parent definitions gracefully", () => {
      const child_type_id = "TypeId:Child" as TypeId;
      const missing_parent_id = "TypeId:MissingParent" as TypeId;

      const child_definition = create_local_type_definition(
        "Child" as SymbolName,
        "class",
        "test.ts" as FilePath
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [child_type_id, [missing_parent_id]],
      ]);

      // all_definitions doesn't contain the parent
      const all_definitions = new Map<TypeId, LocalTypeDefinition>([
        [child_type_id, child_definition],
      ]);

      const result = resolve_type_members(
        child_type_id,
        child_definition,
        type_hierarchy,
        all_definitions
      );

      // Should complete without error, but no inherited members
      expect(result.all_members.size).toBe(0);
      expect(result.inherited_members?.size || 0).toBe(0);
    });

    it("should handle interfaces correctly", () => {
      const interface_id = "TypeId:IMyInterface" as TypeId;

      const interface_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "interfaceMethod" as SymbolName,
          create_local_member_info("interfaceMethod" as SymbolName, "method"),
        ],
      ]);

      const interface_definition = create_local_type_definition(
        "IMyInterface" as SymbolName,
        "interface",
        "test.ts" as FilePath,
        interface_members
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>();

      const result = resolve_type_members(
        interface_id,
        interface_definition,
        type_hierarchy
      );

      expect(result.kind).toBe("interface");
      expect(result.all_members.size).toBe(1);
      expect(result.all_members.has("interfaceMethod" as SymbolName)).toBe(
        true
      );
    });
  });

  describe("Member properties and modifiers", () => {
    it("should handle static vs instance members", () => {
      const type_id = "TypeId:MyClass" as TypeId;
      const members = new Map<SymbolName, LocalMemberInfo>([
        [
          "staticMethod" as SymbolName,
          {
            name: "staticMethod" as SymbolName,
            kind: "method",
            location: create_location(1, 1),
            is_static: true,
            is_optional: false,
          },
        ],
        [
          "instanceMethod" as SymbolName,
          {
            name: "instanceMethod" as SymbolName,
            kind: "method",
            location: create_location(2, 1),
            is_static: false,
            is_optional: false,
          },
        ],
      ]);

      const local_definition = create_local_type_definition(
        "MyClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        members
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>();

      const result = resolve_type_members(
        type_id,
        local_definition,
        type_hierarchy
      );

      // Both members should be present
      expect(result.all_members.size).toBe(2);

      const static_method = result.all_members.get(
        "staticMethod" as SymbolName
      );
      const instance_method = result.all_members.get(
        "instanceMethod" as SymbolName
      );

      expect(static_method!.is_static).toBe(true);
      expect(instance_method!.is_static).toBe(false);
    });

    it("should handle optional members", () => {
      const type_id = "TypeId:MyInterface" as TypeId;
      const members = new Map<SymbolName, LocalMemberInfo>([
        [
          "requiredProperty" as SymbolName,
          {
            name: "requiredProperty" as SymbolName,
            kind: "property",
            location: create_location(1, 1),
            is_static: false,
            is_optional: false,
          },
        ],
        [
          "optionalProperty" as SymbolName,
          {
            name: "optionalProperty" as SymbolName,
            kind: "property",
            location: create_location(2, 1),
            is_static: false,
            is_optional: true,
          },
        ],
      ]);

      const local_definition = create_local_type_definition(
        "MyInterface" as SymbolName,
        "interface",
        "test.ts" as FilePath,
        members
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>();

      const result = resolve_type_members(
        type_id,
        local_definition,
        type_hierarchy
      );

      const required_prop = result.all_members.get(
        "requiredProperty" as SymbolName
      );
      const optional_prop = result.all_members.get(
        "optionalProperty" as SymbolName
      );

      expect(required_prop!.is_optional).toBe(false);
      expect(optional_prop!.is_optional).toBe(true);
    });

    it("should handle different member kinds", () => {
      const type_id = "TypeId:ComplexClass" as TypeId;
      const members = new Map<SymbolName, LocalMemberInfo>([
        [
          "method" as SymbolName,
          create_local_member_info("method" as SymbolName, "method"),
        ],
        [
          "property" as SymbolName,
          create_local_member_info("property" as SymbolName, "property"),
        ],
        [
          "field" as SymbolName,
          create_local_member_info("field" as SymbolName, "field"),
        ],
        [
          "getter" as SymbolName,
          create_local_member_info("getter" as SymbolName, "getter"),
        ],
        [
          "setter" as SymbolName,
          create_local_member_info("setter" as SymbolName, "setter"),
        ],
      ]);

      const local_definition = create_local_type_definition(
        "ComplexClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        members
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>();

      const result = resolve_type_members(
        type_id,
        local_definition,
        type_hierarchy
      );

      expect(result.all_members.size).toBe(5);

      // Verify each member has correct kind
      expect(result.all_members.get("method" as SymbolName)!.kind).toBe(
        "method"
      );
      expect(result.all_members.get("property" as SymbolName)!.kind).toBe(
        "property"
      );
      expect(result.all_members.get("field" as SymbolName)!.kind).toBe("field");
      expect(result.all_members.get("getter" as SymbolName)!.kind).toBe(
        "getter"
      );
      expect(result.all_members.get("setter" as SymbolName)!.kind).toBe(
        "setter"
      );
    });
  });

  describe("Complex inheritance scenarios", () => {
    it("should handle diamond inheritance member resolution", () => {
      const base_id = "TypeId:IBase" as TypeId;
      const left_id = "TypeId:ILeft" as TypeId;
      const right_id = "TypeId:IRight" as TypeId;
      const diamond_id = "TypeId:Diamond" as TypeId;

      // Base interface with common method
      const base_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "baseMethod" as SymbolName,
          create_local_member_info("baseMethod" as SymbolName, "method"),
        ],
      ]);

      // Left interface with its own method
      const left_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "leftMethod" as SymbolName,
          create_local_member_info("leftMethod" as SymbolName, "method"),
        ],
      ]);

      // Right interface with its own method
      const right_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "rightMethod" as SymbolName,
          create_local_member_info("rightMethod" as SymbolName, "method"),
        ],
      ]);

      // Diamond class with its own method
      const diamond_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "diamondMethod" as SymbolName,
          create_local_member_info("diamondMethod" as SymbolName, "method"),
        ],
      ]);

      const base_def = create_local_type_definition(
        "IBase" as SymbolName,
        "interface",
        "test.ts" as FilePath,
        base_members
      );
      const left_def = create_local_type_definition(
        "ILeft" as SymbolName,
        "interface",
        "test.ts" as FilePath,
        left_members
      );
      const right_def = create_local_type_definition(
        "IRight" as SymbolName,
        "interface",
        "test.ts" as FilePath,
        right_members
      );
      const diamond_def = create_local_type_definition(
        "Diamond" as SymbolName,
        "class",
        "test.ts" as FilePath,
        diamond_members
      );

      // Hierarchy: Diamond implements ILeft, IRight; ILeft extends IBase; IRight extends IBase
      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [left_id, [base_id]],
        [right_id, [base_id]],
        [diamond_id, [left_id, right_id]],
      ]);

      const all_definitions = new Map<TypeId, LocalTypeDefinition>([
        [base_id, base_def],
        [left_id, left_def],
        [right_id, right_def],
        [diamond_id, diamond_def],
      ]);

      const result = resolve_type_members(
        diamond_id,
        diamond_def,
        type_hierarchy,
        all_definitions
      );

      // Should have all methods: diamond + left + right + base (only once)
      expect(result.all_members.size).toBe(4);
      expect(result.all_members.has("diamondMethod" as SymbolName)).toBe(true);
      expect(result.all_members.has("leftMethod" as SymbolName)).toBe(true);
      expect(result.all_members.has("rightMethod" as SymbolName)).toBe(true);
      expect(result.all_members.has("baseMethod" as SymbolName)).toBe(true);

      // Base method should only appear once (no duplicates from diamond inheritance)
      const base_method = result.all_members.get("baseMethod" as SymbolName);
      expect(base_method!.inherited_from).toBe(base_id);
    });

    it("should handle interface method implementation", () => {
      const interface_id = "TypeId:IDrawable" as TypeId;
      const class_id = "TypeId:Shape" as TypeId;

      // Interface with abstract methods
      const interface_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "draw" as SymbolName,
          create_local_member_info("draw" as SymbolName, "method"),
        ],
        [
          "area" as SymbolName,
          create_local_member_info("area" as SymbolName, "method"),
        ],
      ]);

      // Class implementing the interface
      const class_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "draw" as SymbolName,
          create_local_member_info("draw" as SymbolName, "method"),
        ], // Implementation
        [
          "area" as SymbolName,
          create_local_member_info("area" as SymbolName, "method"),
        ], // Implementation
        [
          "name" as SymbolName,
          create_local_member_info("name" as SymbolName, "property"),
        ], // Additional member
      ]);

      const interface_def = create_local_type_definition(
        "IDrawable" as SymbolName,
        "interface",
        "test.ts" as FilePath,
        interface_members
      );
      const class_def = create_local_type_definition(
        "Shape" as SymbolName,
        "class",
        "test.ts" as FilePath,
        class_members
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [class_id, [interface_id]], // Class implements interface
      ]);

      const all_definitions = new Map<TypeId, LocalTypeDefinition>([
        [interface_id, interface_def],
        [class_id, class_def],
      ]);

      const result = resolve_type_members(
        class_id,
        class_def,
        type_hierarchy,
        all_definitions
      );

      // Should have class methods (which override interface methods) + additional property
      expect(result.all_members.size).toBe(3);

      // Interface methods should be overridden by class implementations
      const draw_method = result.all_members.get("draw" as SymbolName);
      const area_method = result.all_members.get("area" as SymbolName);
      const name_property = result.all_members.get("name" as SymbolName);

      expect(draw_method!.inherited_from).toBeUndefined(); // Not inherited, it's implemented
      expect(area_method!.inherited_from).toBeUndefined(); // Not inherited, it's implemented
      expect(name_property!.inherited_from).toBeUndefined(); // Direct member
    });

    it("should handle static member inheritance correctly", () => {
      const base_id = "TypeId:BaseClass" as TypeId;
      const derived_id = "TypeId:DerivedClass" as TypeId;

      // Base class with static and instance members
      const base_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "staticMethod" as SymbolName,
          {
            name: "staticMethod" as SymbolName,
            kind: "method",
            location: create_location(1, 1),
            is_static: true,
            is_optional: false,
          },
        ],
        [
          "instanceMethod" as SymbolName,
          {
            name: "instanceMethod" as SymbolName,
            kind: "method",
            location: create_location(2, 1),
            is_static: false,
            is_optional: false,
          },
        ],
      ]);

      // Derived class with its own static method
      const derived_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "derivedStatic" as SymbolName,
          {
            name: "derivedStatic" as SymbolName,
            kind: "method",
            location: create_location(1, 1),
            is_static: true,
            is_optional: false,
          },
        ],
      ]);

      const base_def = create_local_type_definition(
        "BaseClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        base_members
      );
      const derived_def = create_local_type_definition(
        "DerivedClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        derived_members
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [derived_id, [base_id]],
      ]);

      const all_definitions = new Map<TypeId, LocalTypeDefinition>([
        [base_id, base_def],
        [derived_id, derived_def],
      ]);

      const result = resolve_type_members(
        derived_id,
        derived_def,
        type_hierarchy,
        all_definitions
      );

      // Should inherit both static and instance members
      expect(result.all_members.size).toBe(3);

      const derived_static = result.all_members.get(
        "derivedStatic" as SymbolName
      );
      const inherited_static = result.all_members.get(
        "staticMethod" as SymbolName
      );
      const inherited_instance = result.all_members.get(
        "instanceMethod" as SymbolName
      );

      expect(derived_static!.is_static).toBe(true);
      expect(derived_static!.inherited_from).toBeUndefined();

      expect(inherited_static!.is_static).toBe(true);
      expect(inherited_static!.inherited_from).toBe(base_id);

      expect(inherited_instance!.is_static).toBe(false);
      expect(inherited_instance!.inherited_from).toBe(base_id);
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle malformed member information", () => {
      const type_id = "TypeId:MalformedClass" as TypeId;

      // Create a member with minimal information
      const members = new Map<SymbolName, LocalMemberInfo>([
        [
          "validMember" as SymbolName,
          create_local_member_info("validMember" as SymbolName, "method"),
        ],
      ]);

      const local_definition = create_local_type_definition(
        "MalformedClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        members
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>();

      const result = resolve_type_members(
        type_id,
        local_definition,
        type_hierarchy
      );

      // Should handle gracefully
      expect(result.all_members.size).toBe(1);
      expect(result.all_members.has("validMember" as SymbolName)).toBe(true);
    });

    it("should handle types with no hierarchy but invalid definitions", () => {
      const type_id = "TypeId:OrphanType" as TypeId;

      const local_definition = create_local_type_definition(
        "OrphanType" as SymbolName,
        "class",
        "test.ts" as FilePath
      );

      // Hierarchy references non-existent parent
      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [type_id, ["NonExistent" as TypeId]],
      ]);

      // all_definitions doesn't contain the referenced parent
      const all_definitions = new Map<TypeId, LocalTypeDefinition>([
        [type_id, local_definition],
      ]);

      const result = resolve_type_members(
        type_id,
        local_definition,
        type_hierarchy,
        all_definitions
      );

      // Should complete without error
      expect(result.all_members.size).toBe(0);
      expect(result.parent_types?.length || 0).toBe(1); // Should still report the hierarchy
    });

    it("should handle member name conflicts during inheritance", () => {
      const base_id = "TypeId:BaseClass" as TypeId;
      const mixin_id = "TypeId:MixinClass" as TypeId;
      const derived_id = "TypeId:DerivedClass" as TypeId;

      // Base class with method
      const base_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "conflictMethod" as SymbolName,
          create_local_member_info("conflictMethod" as SymbolName, "method"),
        ],
        [
          "baseOnly" as SymbolName,
          create_local_member_info("baseOnly" as SymbolName, "method"),
        ],
      ]);

      // Mixin class with same method name
      const mixin_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "conflictMethod" as SymbolName,
          create_local_member_info("conflictMethod" as SymbolName, "method"),
        ],
        [
          "mixinOnly" as SymbolName,
          create_local_member_info("mixinOnly" as SymbolName, "method"),
        ],
      ]);

      // Derived class that extends both (multiple inheritance simulation)
      const derived_members = new Map<SymbolName, LocalMemberInfo>([
        [
          "derivedOnly" as SymbolName,
          create_local_member_info("derivedOnly" as SymbolName, "method"),
        ],
      ]);

      const base_def = create_local_type_definition(
        "BaseClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        base_members
      );
      const mixin_def = create_local_type_definition(
        "MixinClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        mixin_members
      );
      const derived_def = create_local_type_definition(
        "DerivedClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        derived_members
      );

      // Derived inherits from both base and mixin
      const type_hierarchy = new Map<TypeId, TypeId[]>([
        [derived_id, [base_id, mixin_id]],
      ]);

      const all_definitions = new Map<TypeId, LocalTypeDefinition>([
        [base_id, base_def],
        [mixin_id, mixin_def],
        [derived_id, derived_def],
      ]);

      const result = resolve_type_members(
        derived_id,
        derived_def,
        type_hierarchy,
        all_definitions
      );

      // Should have all unique methods, with first-encountered taking precedence for conflicts
      expect(result.all_members.size).toBe(4); // derivedOnly + conflictMethod + baseOnly + mixinOnly

      const conflict_method = result.all_members.get(
        "conflictMethod" as SymbolName
      );

      // The implementation should define which parent takes precedence
      expect(conflict_method).toBeDefined();
      expect(conflict_method!.inherited_from).toBeDefined();
    });
  });

  describe("Performance with large member sets", () => {
    it("should handle classes with many members efficiently", () => {
      const type_id = "TypeId:LargeClass" as TypeId;
      const member_count = 1000;
      const members = new Map<SymbolName, LocalMemberInfo>();

      // Create many members
      for (let i = 0; i < member_count; i++) {
        const name = `member${i}` as SymbolName;
        members.set(name, create_local_member_info(name, "method"));
      }

      const local_definition = create_local_type_definition(
        "LargeClass" as SymbolName,
        "class",
        "test.ts" as FilePath,
        members
      );

      const type_hierarchy = new Map<TypeId, TypeId[]>();

      const start_time = performance.now();
      const result = resolve_type_members(
        type_id,
        local_definition,
        type_hierarchy
      );
      const end_time = performance.now();

      // Should complete quickly even with many members
      expect(end_time - start_time).toBeLessThan(50);
      expect(result.all_members.size).toBe(member_count);
    });

    it("should handle deep inheritance with many members efficiently", () => {
      const chain_depth = 20;
      const members_per_class = 50;
      const type_defs = new Map<TypeId, LocalTypeDefinition>();
      const hierarchy = new Map<TypeId, TypeId[]>();

      // Create inheritance chain where each class adds members
      for (let i = 0; i < chain_depth; i++) {
        const type_id = `TypeId:Class${i}` as TypeId;
        const members = new Map<SymbolName, LocalMemberInfo>();

        // Add unique members for this class
        for (let j = 0; j < members_per_class; j++) {
          const name = `class${i}_member${j}` as SymbolName;
          members.set(name, create_local_member_info(name, "method"));
        }

        const def = create_local_type_definition(
          `Class${i}` as SymbolName,
          "class",
          "test.ts" as FilePath,
          members
        );

        type_defs.set(type_id, def);

        // Set up inheritance chain
        if (i > 0) {
          const parent_id = `TypeId:Class${i - 1}` as TypeId;
          hierarchy.set(type_id, [parent_id]);
        }
      }

      // Test the last class in the chain (should have all inherited members)
      const last_type_id = `TypeId:Class${chain_depth - 1}` as TypeId;
      const last_def = type_defs.get(last_type_id)!;

      const start_time = performance.now();
      const result = resolve_type_members(
        last_type_id,
        last_def,
        hierarchy,
        type_defs
      );
      const end_time = performance.now();

      // Should complete in reasonable time
      expect(end_time - start_time).toBeLessThan(100);

      // Should have members from all classes in the chain
      const expected_member_count = chain_depth * members_per_class;
      expect(result.all_members.size).toBe(expected_member_count);
    });
  });
});

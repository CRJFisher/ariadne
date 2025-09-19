import { describe, it, expect } from "vitest";
import {
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
  type FileTypeRegistry,
  type TypeMemberMap,
  type VariableTypeMap,
  type TypeResolutionContext,
  type TypeReassignment,
  type UnionTypeInfo,
  type IntersectionTypeInfo,
  type ArrayTypeInfo,
  type TupleTypeInfo,
  type MemberInfo,
  type MethodMemberInfo,
  type PropertyMemberInfo,
  type FieldMemberInfo,
  type ConstructorMemberInfo,
  type ParameterInfo,
  type InheritanceInfo,
  type VariableTypeInfo,
} from "./type_registry_interfaces";
import type {
  FilePath,
  TypeId,
  SymbolId,
  SymbolName,
  Location,
  ScopeId,
} from "@ariadnejs/types";
import { TypeInfo } from "../../semantic_index/references/type_tracking/type_info";

describe("Type Registry Interfaces", () => {
  const mockFilePath = "test.ts" as FilePath;
  const mockLocation: Location = {
    file_path: mockFilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
  };
  const mockTypeId = "TypeId:TestType" as TypeId;
  const mockSymbolId = "SymbolId:testSymbol" as SymbolId;
  const mockSymbolName = "testSymbol" as SymbolName;
  const mockScopeId = "ScopeId:test" as ScopeId;

  describe("Registry Creation Functions", () => {
    describe("create_empty_registry", () => {
      it("should create an empty FileTypeRegistry", () => {
        const registry = create_empty_registry(mockFilePath);

        expect(registry).toBeDefined();
        expect(registry.file_path).toBe(mockFilePath);
        expect(registry.symbol_to_type).toBeInstanceOf(Map);
        expect(registry.symbol_to_type.size).toBe(0);
        expect(registry.name_to_type).toBeInstanceOf(Map);
        expect(registry.name_to_type.size).toBe(0);
        expect(registry.defined_types).toBeInstanceOf(Set);
        expect(registry.defined_types.size).toBe(0);
        expect(registry.symbol_types).toBeInstanceOf(Map);
        expect(registry.symbol_types.size).toBe(0);
        expect(registry.location_types).toBeInstanceOf(Map);
        expect(registry.location_types.size).toBe(0);
        expect(registry.return_types).toBeInstanceOf(Map);
        expect(registry.return_types.size).toBe(0);
      });

      it("should create registries with different file paths", () => {
        const registry1 = create_empty_registry("file1.ts" as FilePath);
        const registry2 = create_empty_registry("file2.ts" as FilePath);

        expect(registry1.file_path).toBe("file1.ts");
        expect(registry2.file_path).toBe("file2.ts");
        expect(registry1).not.toBe(registry2);
      });
    });

    describe("create_empty_member_map", () => {
      it("should create an empty TypeMemberMap", () => {
        const memberMap = create_empty_member_map();

        expect(memberMap).toBeDefined();
        expect(memberMap.instance_members).toBeInstanceOf(Map);
        expect(memberMap.instance_members.size).toBe(0);
        expect(memberMap.static_members).toBeInstanceOf(Map);
        expect(memberMap.static_members.size).toBe(0);
        expect(memberMap.constructors).toBeInstanceOf(Map);
        expect(memberMap.constructors.size).toBe(0);
        expect(memberMap.inheritance).toBeInstanceOf(Map);
        expect(memberMap.inheritance.size).toBe(0);
      });

      it("should create independent instances", () => {
        const map1 = create_empty_member_map();
        const map2 = create_empty_member_map();

        expect(map1).not.toBe(map2);
        expect(map1.instance_members).not.toBe(map2.instance_members);
      });
    });

    describe("create_empty_variable_map", () => {
      it("should create an empty VariableTypeMap", () => {
        const varMap = create_empty_variable_map();

        expect(varMap).toBeDefined();
        expect(varMap.variable_type_info).toBeInstanceOf(Map);
        expect(varMap.variable_type_info.size).toBe(0);
        expect(varMap.variable_types).toBeInstanceOf(Map);
        expect(varMap.variable_types.size).toBe(0);
        expect(varMap.reassignments).toBeInstanceOf(Map);
        expect(varMap.reassignments.size).toBe(0);
        expect(varMap.scope_variables).toBeInstanceOf(Map);
        expect(varMap.scope_variables.size).toBe(0);
      });

      it("should create independent instances", () => {
        const map1 = create_empty_variable_map();
        const map2 = create_empty_variable_map();

        expect(map1).not.toBe(map2);
        expect(map1.variable_types).not.toBe(map2.variable_types);
      });
    });

    describe("create_type_context", () => {
      it("should create a complete TypeResolutionContext", () => {
        const context = create_type_context(mockFilePath);

        expect(context).toBeDefined();
        expect(context.registry).toBeDefined();
        expect(context.registry.file_path).toBe(mockFilePath);
        expect(context.members).toBeDefined();
        expect(context.variables).toBeDefined();
        expect(context.generics).toBeInstanceOf(Map);
        expect(context.generics.size).toBe(0);
        expect(context.aliases).toBeInstanceOf(Map);
        expect(context.aliases.size).toBe(0);
        expect(context.composite_types).toBeInstanceOf(Map);
        expect(context.composite_types.size).toBe(0);
      });

      it("should create all sub-structures", () => {
        const context = create_type_context(mockFilePath);

        // Check registry structure
        expect(context.registry.symbol_to_type).toBeInstanceOf(Map);
        expect(context.registry.name_to_type).toBeInstanceOf(Map);
        expect(context.registry.defined_types).toBeInstanceOf(Set);

        // Check members structure
        expect(context.members.instance_members).toBeInstanceOf(Map);
        expect(context.members.static_members).toBeInstanceOf(Map);
        expect(context.members.constructors).toBeInstanceOf(Map);

        // Check variables structure
        expect(context.variables.variable_types).toBeInstanceOf(Map);
        expect(context.variables.reassignments).toBeInstanceOf(Map);
        expect(context.variables.scope_variables).toBeInstanceOf(Map);
      });
    });
  });

  describe("Type Reassignment Functions", () => {
    const fromType = "TypeId:FromType" as TypeId;
    const toType = "TypeId:ToType" as TypeId;

    describe("create_narrowing_reassignment", () => {
      it("should create a narrowing type reassignment", () => {
        const reassignment = create_narrowing_reassignment(fromType, toType, mockLocation);

        expect(reassignment).toBeDefined();
        expect(reassignment.from_type).toBe(fromType);
        expect(reassignment.to_type).toBe(toType);
        expect(reassignment.location).toBe(mockLocation);
        expect(reassignment.is_narrowing).toBe(true);
        expect(reassignment.is_widening).toBe(false);
      });

      it("should validate as correct reassignment", () => {
        const reassignment = create_narrowing_reassignment(fromType, toType, mockLocation);
        expect(validate_reassignment(reassignment)).toBe(true);
      });
    });

    describe("create_widening_reassignment", () => {
      it("should create a widening type reassignment", () => {
        const reassignment = create_widening_reassignment(fromType, toType, mockLocation);

        expect(reassignment).toBeDefined();
        expect(reassignment.from_type).toBe(fromType);
        expect(reassignment.to_type).toBe(toType);
        expect(reassignment.location).toBe(mockLocation);
        expect(reassignment.is_narrowing).toBe(false);
        expect(reassignment.is_widening).toBe(true);
      });

      it("should validate as correct reassignment", () => {
        const reassignment = create_widening_reassignment(fromType, toType, mockLocation);
        expect(validate_reassignment(reassignment)).toBe(true);
      });
    });

    describe("create_neutral_reassignment", () => {
      it("should create a neutral type reassignment", () => {
        const reassignment = create_neutral_reassignment(fromType, toType, mockLocation);

        expect(reassignment).toBeDefined();
        expect(reassignment.from_type).toBe(fromType);
        expect(reassignment.to_type).toBe(toType);
        expect(reassignment.location).toBe(mockLocation);
        expect(reassignment.is_narrowing).toBe(false);
        expect(reassignment.is_widening).toBe(false);
      });

      it("should validate as correct reassignment", () => {
        const reassignment = create_neutral_reassignment(fromType, toType, mockLocation);
        expect(validate_reassignment(reassignment)).toBe(true);
      });
    });

    describe("validate_reassignment", () => {
      it("should validate correct reassignments", () => {
        const narrowing = create_narrowing_reassignment(fromType, toType, mockLocation);
        const widening = create_widening_reassignment(fromType, toType, mockLocation);
        const neutral = create_neutral_reassignment(fromType, toType, mockLocation);

        expect(validate_reassignment(narrowing)).toBe(true);
        expect(validate_reassignment(widening)).toBe(true);
        expect(validate_reassignment(neutral)).toBe(true);
      });

      it("should reject invalid reassignments", () => {
        const invalid: TypeReassignment = {
          from_type: fromType,
          to_type: toType,
          location: mockLocation,
          is_narrowing: true,
          is_widening: true, // Both can't be true
        };

        expect(validate_reassignment(invalid)).toBe(false);
      });

      it("should handle edge cases", () => {
        const allFalse: TypeReassignment = {
          from_type: fromType,
          to_type: toType,
          location: mockLocation,
          is_narrowing: false,
          is_widening: false,
        };

        expect(validate_reassignment(allFalse)).toBe(true);
      });
    });
  });

  describe("Composite Type Creation Functions", () => {
    const type1 = "TypeId:Type1" as TypeId;
    const type2 = "TypeId:Type2" as TypeId;
    const type3 = "TypeId:Type3" as TypeId;

    describe("create_union_type", () => {
      it("should create a union type with multiple members", () => {
        const union = create_union_type([type1, type2, type3]);

        expect(union).toBeDefined();
        expect(union.kind).toBe("union");
        expect(union.members).toEqual([type1, type2, type3]);
        expect(union.members.length).toBe(3);
      });

      it("should handle empty union", () => {
        const union = create_union_type([]);

        expect(union.kind).toBe("union");
        expect(union.members).toEqual([]);
        expect(union.members.length).toBe(0);
      });

      it("should handle single type union", () => {
        const union = create_union_type([type1]);

        expect(union.kind).toBe("union");
        expect(union.members).toEqual([type1]);
        expect(union.members.length).toBe(1);
      });

      it("should preserve order of members", () => {
        const union = create_union_type([type3, type1, type2]);

        expect(union.members[0]).toBe(type3);
        expect(union.members[1]).toBe(type1);
        expect(union.members[2]).toBe(type2);
      });
    });

    describe("create_intersection_type", () => {
      it("should create an intersection type with multiple members", () => {
        const intersection = create_intersection_type([type1, type2, type3]);

        expect(intersection).toBeDefined();
        expect(intersection.kind).toBe("intersection");
        expect(intersection.members).toEqual([type1, type2, type3]);
        expect(intersection.members.length).toBe(3);
      });

      it("should handle empty intersection", () => {
        const intersection = create_intersection_type([]);

        expect(intersection.kind).toBe("intersection");
        expect(intersection.members).toEqual([]);
        expect(intersection.members.length).toBe(0);
      });

      it("should handle single type intersection", () => {
        const intersection = create_intersection_type([type1]);

        expect(intersection.kind).toBe("intersection");
        expect(intersection.members).toEqual([type1]);
        expect(intersection.members.length).toBe(1);
      });

      it("should preserve order of members", () => {
        const intersection = create_intersection_type([type3, type1, type2]);

        expect(intersection.members[0]).toBe(type3);
        expect(intersection.members[1]).toBe(type1);
        expect(intersection.members[2]).toBe(type2);
      });
    });

    describe("create_array_type", () => {
      it("should create an array type with element type", () => {
        const array = create_array_type(type1);

        expect(array).toBeDefined();
        expect(array.kind).toBe("array");
        expect(array.element_type).toBe(type1);
      });

      it("should handle different element types", () => {
        const array1 = create_array_type(type1);
        const array2 = create_array_type(type2);

        expect(array1.element_type).toBe(type1);
        expect(array2.element_type).toBe(type2);
        expect(array1).not.toBe(array2);
      });
    });

    describe("create_tuple_type", () => {
      it("should create a tuple type with multiple element types", () => {
        const tuple = create_tuple_type([type1, type2, type3]);

        expect(tuple).toBeDefined();
        expect(tuple.kind).toBe("tuple");
        expect(tuple.elements).toEqual([type1, type2, type3]);
        expect(tuple.elements.length).toBe(3);
      });

      it("should handle empty tuple", () => {
        const tuple = create_tuple_type([]);

        expect(tuple.kind).toBe("tuple");
        expect(tuple.elements).toEqual([]);
        expect(tuple.elements.length).toBe(0);
      });

      it("should handle single element tuple", () => {
        const tuple = create_tuple_type([type1]);

        expect(tuple.kind).toBe("tuple");
        expect(tuple.elements).toEqual([type1]);
        expect(tuple.elements.length).toBe(1);
      });

      it("should preserve order of elements", () => {
        const tuple = create_tuple_type([type3, type1, type2]);

        expect(tuple.elements[0]).toBe(type3);
        expect(tuple.elements[1]).toBe(type1);
        expect(tuple.elements[2]).toBe(type2);
      });

      it("should handle heterogeneous types", () => {
        const stringType = "TypeId:String" as TypeId;
        const numberType = "TypeId:Number" as TypeId;
        const booleanType = "TypeId:Boolean" as TypeId;

        const tuple = create_tuple_type([stringType, numberType, booleanType]);

        expect(tuple.elements).toEqual([stringType, numberType, booleanType]);
      });
    });
  });

  describe("Interface Structures", () => {
    describe("MemberInfo types", () => {
      it("should represent MethodMemberInfo correctly", () => {
        const methodInfo: MethodMemberInfo = {
          member_type: "method",
          symbol_id: mockSymbolId,
          name: mockSymbolName,
          is_static: false,
          is_private: false,
          is_readonly: false,
          location: mockLocation,
          return_type: mockTypeId,
          parameters: [],
        };

        expect(methodInfo.member_type).toBe("method");
        expect(methodInfo.return_type).toBe(mockTypeId);
        expect(methodInfo.parameters).toEqual([]);
      });

      it("should represent PropertyMemberInfo correctly", () => {
        const propertyInfo: PropertyMemberInfo = {
          member_type: "property",
          symbol_id: mockSymbolId,
          name: mockSymbolName,
          is_static: false,
          is_private: true,
          is_readonly: true,
          location: mockLocation,
          value_type: mockTypeId,
        };

        expect(propertyInfo.member_type).toBe("property");
        expect(propertyInfo.value_type).toBe(mockTypeId);
        expect(propertyInfo.is_private).toBe(true);
        expect(propertyInfo.is_readonly).toBe(true);
      });

      it("should represent FieldMemberInfo correctly", () => {
        const fieldInfo: FieldMemberInfo = {
          member_type: "field",
          symbol_id: mockSymbolId,
          name: mockSymbolName,
          is_static: true,
          is_private: false,
          is_readonly: false,
          location: mockLocation,
          value_type: mockTypeId,
        };

        expect(fieldInfo.member_type).toBe("field");
        expect(fieldInfo.value_type).toBe(mockTypeId);
        expect(fieldInfo.is_static).toBe(true);
      });

      it("should represent ConstructorMemberInfo correctly", () => {
        const constructorInfo: ConstructorMemberInfo = {
          member_type: "constructor",
          symbol_id: mockSymbolId,
          name: "constructor" as SymbolName,
          is_static: false,
          is_private: false,
          is_readonly: false,
          location: mockLocation,
          parameters: [
            {
              name: "param1" as SymbolName,
              type: mockTypeId,
              is_optional: false,
              is_rest: false,
              default_value: undefined,
            },
          ],
        };

        expect(constructorInfo.member_type).toBe("constructor");
        expect(constructorInfo.parameters).toBeDefined();
        expect(constructorInfo.parameters?.length).toBe(1);
      });
    });

    describe("ParameterInfo", () => {
      it("should represent required parameter", () => {
        const param: ParameterInfo = {
          name: "requiredParam" as SymbolName,
          type: mockTypeId,
          is_optional: false,
          is_rest: false,
          default_value: undefined,
        };

        expect(param.is_optional).toBe(false);
        expect(param.is_rest).toBe(false);
        expect(param.default_value).toBeUndefined();
      });

      it("should represent optional parameter", () => {
        const param: ParameterInfo = {
          name: "optionalParam" as SymbolName,
          type: mockTypeId,
          is_optional: true,
          is_rest: false,
          default_value: undefined,
        };

        expect(param.is_optional).toBe(true);
      });

      it("should represent rest parameter", () => {
        const param: ParameterInfo = {
          name: "restParam" as SymbolName,
          type: mockTypeId,
          is_optional: false,
          is_rest: true,
          default_value: undefined,
        };

        expect(param.is_rest).toBe(true);
      });

      it("should represent parameter with default value", () => {
        const param: ParameterInfo = {
          name: "defaultParam" as SymbolName,
          type: mockTypeId,
          is_optional: true,
          is_rest: false,
          default_value: "42",
        };

        expect(param.default_value).toBe("42");
        expect(param.is_optional).toBe(true);
      });
    });

    describe("InheritanceInfo", () => {
      it("should represent class inheritance", () => {
        const inheritance: InheritanceInfo = {
          extends_type: "TypeId:BaseClass" as TypeId,
          implements_types: [],
          all_ancestors: ["TypeId:BaseClass" as TypeId],
          all_members: new Map(),
        };

        expect(inheritance.extends_type).toBe("TypeId:BaseClass");
        expect(inheritance.implements_types).toEqual([]);
        expect(inheritance.all_ancestors).toContain("TypeId:BaseClass");
      });

      it("should represent interface implementation", () => {
        const inheritance: InheritanceInfo = {
          extends_type: undefined,
          implements_types: [
            "TypeId:Interface1" as TypeId,
            "TypeId:Interface2" as TypeId,
          ],
          all_ancestors: [
            "TypeId:Interface1" as TypeId,
            "TypeId:Interface2" as TypeId,
          ],
          all_members: new Map(),
        };

        expect(inheritance.extends_type).toBeUndefined();
        expect(inheritance.implements_types.length).toBe(2);
        expect(inheritance.all_ancestors.length).toBe(2);
      });

      it("should represent combined inheritance", () => {
        const memberMap = new Map<SymbolName, MemberInfo>();
        const methodMember: MethodMemberInfo = {
          member_type: "method",
          symbol_id: mockSymbolId,
          name: "inheritedMethod" as SymbolName,
          is_static: false,
          is_private: false,
          is_readonly: false,
          location: mockLocation,
          return_type: mockTypeId,
          parameters: [],
        };
        memberMap.set("inheritedMethod" as SymbolName, methodMember);

        const inheritance: InheritanceInfo = {
          extends_type: "TypeId:BaseClass" as TypeId,
          implements_types: ["TypeId:Interface1" as TypeId],
          all_ancestors: [
            "TypeId:BaseClass" as TypeId,
            "TypeId:Interface1" as TypeId,
          ],
          all_members: memberMap,
        };

        expect(inheritance.extends_type).toBe("TypeId:BaseClass");
        expect(inheritance.implements_types).toContain("TypeId:Interface1");
        expect(inheritance.all_ancestors.length).toBe(2);
        expect(inheritance.all_members.size).toBe(1);
        expect(inheritance.all_members.get("inheritedMethod" as SymbolName)).toBe(methodMember);
      });
    });

    describe("VariableTypeInfo", () => {
      it("should represent variable with declaration source", () => {
        const typeInfo: TypeInfo = {
          category: "identifier",
          name: "string" as SymbolName,
        };

        const varInfo: VariableTypeInfo = {
          variable_name: "myVar" as SymbolName,
          scope_id: mockScopeId,
          type_info: typeInfo,
          type_id: mockTypeId,
          location: mockLocation,
          source: "declaration",
        };

        expect(varInfo.source).toBe("declaration");
        expect(varInfo.type_id).toBe(mockTypeId);
        expect(varInfo.type_info).toBe(typeInfo);
      });

      it("should represent variable with assignment source", () => {
        const typeInfo: TypeInfo = {
          category: "literal",
          value: "42",
          literal_type: "number",
        };

        const varInfo: VariableTypeInfo = {
          variable_name: "assignedVar" as SymbolName,
          scope_id: mockScopeId,
          type_info: typeInfo,
          type_id: undefined,
          location: mockLocation,
          source: "assignment",
        };

        expect(varInfo.source).toBe("assignment");
        expect(varInfo.type_id).toBeUndefined();
      });

      it("should represent variable with inference source", () => {
        const typeInfo: TypeInfo = {
          category: "union",
          types: [],
        };

        const varInfo: VariableTypeInfo = {
          variable_name: "inferredVar" as SymbolName,
          scope_id: mockScopeId,
          type_info: typeInfo,
          type_id: mockTypeId,
          location: mockLocation,
          source: "inference",
        };

        expect(varInfo.source).toBe("inference");
      });
    });
  });

  describe("Complex Registry Scenarios", () => {
    it("should create a fully populated type context", () => {
      const context = create_type_context(mockFilePath);

      // Add some data to verify the structures work correctly
      context.registry.symbol_to_type.set(mockSymbolId, mockTypeId);
      context.registry.name_to_type.set(mockSymbolName, mockTypeId);
      context.registry.defined_types.add(mockTypeId);

      expect(context.registry.symbol_to_type.get(mockSymbolId)).toBe(mockTypeId);
      expect(context.registry.name_to_type.get(mockSymbolName)).toBe(mockTypeId);
      expect(context.registry.defined_types.has(mockTypeId)).toBe(true);

      // Add member data
      const memberMap = new Map<SymbolName, MemberInfo>();
      const methodMember: MethodMemberInfo = {
        member_type: "method",
        symbol_id: mockSymbolId,
        name: mockSymbolName,
        is_static: false,
        is_private: false,
        is_readonly: false,
        location: mockLocation,
        return_type: mockTypeId,
        parameters: [],
      };
      memberMap.set(mockSymbolName, methodMember);
      context.members.instance_members.set(mockTypeId, memberMap);

      expect(context.members.instance_members.get(mockTypeId)).toBe(memberMap);

      // Add variable data
      context.variables.variable_types.set(mockLocation, mockTypeId);
      const reassignment = create_narrowing_reassignment(
        mockTypeId,
        "TypeId:Narrowed" as TypeId,
        mockLocation
      );
      context.variables.reassignments.set(mockLocation, reassignment);

      expect(context.variables.variable_types.get(mockLocation)).toBe(mockTypeId);
      expect(context.variables.reassignments.get(mockLocation)).toBe(reassignment);

      // Add composite types
      const unionType = create_union_type([mockTypeId, "TypeId:Other" as TypeId]);
      context.composite_types.set("TypeId:Union" as TypeId, unionType);

      expect(context.composite_types.get("TypeId:Union" as TypeId)).toBe(unionType);
    });

    it("should handle readonly properties correctly", () => {
      const registry = create_empty_registry(mockFilePath);

      // The maps and sets should be readonly but still allow operations
      registry.symbol_to_type.set(mockSymbolId, mockTypeId);
      registry.defined_types.add(mockTypeId);

      expect(registry.symbol_to_type.get(mockSymbolId)).toBe(mockTypeId);
      expect(registry.defined_types.has(mockTypeId)).toBe(true);
    });
  });
});
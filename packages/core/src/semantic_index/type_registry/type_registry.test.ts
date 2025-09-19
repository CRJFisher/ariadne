/**
 * Tests for Type Registry
 *
 * Comprehensive test coverage for type registry interfaces and builder functions
 */

import { describe, it, expect } from 'vitest';
import type {
  SymbolId,
  SymbolName,
  TypeId,
  Location,
  FilePath,
  ScopeId,
} from "@ariadnejs/types";
import {
  create_empty_registry,
  create_empty_member_map,
  create_empty_variable_map,
  create_type_context,
  type FileTypeRegistry,
  type MemberInfo,
  type ParameterInfo,
  type TypeMemberMap,
  type InheritanceInfo,
  type VariableTypeMap,
  type VariableTypeInfo,
  type TypeReassignment,
  type TypeResolutionContext,
  type CompositeTypeInfo,
} from './type_registry';

// Mock data for testing
const mockFilePath = "/test/file.ts" as FilePath;
const mockLocation: Location = { line: 1, column: 1 };
const mockSymbolId = "test_symbol" as SymbolId;
const mockSymbolName = "TestSymbol" as SymbolName;
const mockTypeId = "test_type_id" as TypeId;
const mockScopeId = "test_scope" as ScopeId;

describe('Type Registry', () => {
  describe('FileTypeRegistry', () => {
    it('should create empty registry with correct structure', () => {
      const registry = create_empty_registry(mockFilePath);

      expect(registry.file_path).toBe(mockFilePath);
      expect(registry.symbol_to_type).toBeInstanceOf(Map);
      expect(registry.name_to_type).toBeInstanceOf(Map);
      expect(registry.defined_types).toBeInstanceOf(Set);
      expect(registry.symbol_types).toBeInstanceOf(Map);
      expect(registry.location_types).toBeInstanceOf(Map);
      expect(registry.return_types).toBeInstanceOf(Map);

      // All collections should be empty
      expect(registry.symbol_to_type.size).toBe(0);
      expect(registry.name_to_type.size).toBe(0);
      expect(registry.defined_types.size).toBe(0);
      expect(registry.symbol_types.size).toBe(0);
      expect(registry.location_types.size).toBe(0);
      expect(registry.return_types.size).toBe(0);
    });

    it('should handle readonly maps correctly', () => {
      const registry = create_empty_registry(mockFilePath);

      // Test that maps are properly initialized
      expect(registry.symbol_to_type).toBeInstanceOf(Map);
      expect(registry.name_to_type).toBeInstanceOf(Map);
      expect(registry.defined_types).toBeInstanceOf(Set);

      // TypeScript readonly is compile-time only, so test structure instead
      expect(Object.keys(registry)).toContain('symbol_to_type');
      expect(Object.keys(registry)).toContain('file_path');
    });

    it('should maintain correct file_path', () => {
      const registry = create_empty_registry(mockFilePath);

      expect(registry.file_path).toBe(mockFilePath);
      expect(typeof registry.file_path).toBe('string');
    });
  });

  describe('TypeMemberMap', () => {
    it('should create empty member map with correct structure', () => {
      const memberMap = create_empty_member_map();

      expect(memberMap.instance_members).toBeInstanceOf(Map);
      expect(memberMap.static_members).toBeInstanceOf(Map);
      expect(memberMap.constructors).toBeInstanceOf(Map);
      expect(memberMap.inheritance).toBeInstanceOf(Map);

      // All maps should be empty
      expect(memberMap.instance_members.size).toBe(0);
      expect(memberMap.static_members.size).toBe(0);
      expect(memberMap.constructors.size).toBe(0);
      expect(memberMap.inheritance.size).toBe(0);
    });

    it('should handle nested readonly maps', () => {
      const memberMap = create_empty_member_map();

      // Test that nested maps are properly structured
      expect(memberMap.instance_members).toBeInstanceOf(Map);
      expect(memberMap.static_members).toBeInstanceOf(Map);
      expect(memberMap.constructors).toBeInstanceOf(Map);
      expect(memberMap.inheritance).toBeInstanceOf(Map);

      // TypeScript readonly is compile-time only, so test structure instead
      expect(Object.keys(memberMap)).toContain('instance_members');
      expect(Object.keys(memberMap)).toContain('static_members');
    });
  });

  describe('MemberInfo', () => {
    it('should handle method member info structure', () => {
      const methodMember: MemberInfo = {
        symbol_id: mockSymbolId,
        name: "testMethod" as SymbolName,
        member_type: "method",
        return_type: mockTypeId,
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
          }
        ]
      };

      expect(methodMember.member_type).toBe("method");
      expect(methodMember.return_type).toBe(mockTypeId);
      expect(methodMember.parameters).toHaveLength(1);
      expect(methodMember.parameters![0].name).toBe("param1");
    });

    it('should handle property member info structure', () => {
      const propertyMember: MemberInfo = {
        symbol_id: mockSymbolId,
        name: "testProperty" as SymbolName,
        member_type: "property",
        value_type: mockTypeId,
        is_static: true,
        is_private: true,
        is_readonly: true,
        location: mockLocation,
      };

      expect(propertyMember.member_type).toBe("property");
      expect(propertyMember.value_type).toBe(mockTypeId);
      expect(propertyMember.is_static).toBe(true);
      expect(propertyMember.is_private).toBe(true);
      expect(propertyMember.is_readonly).toBe(true);
    });

    it('should handle constructor member info structure', () => {
      const constructorMember: MemberInfo = {
        symbol_id: mockSymbolId,
        name: "constructor" as SymbolName,
        member_type: "constructor",
        is_static: false,
        is_private: false,
        is_readonly: false,
        location: mockLocation,
        parameters: [
          {
            name: "param1" as SymbolName,
            type: mockTypeId,
            is_optional: true,
            is_rest: false,
            default_value: "defaultValue"
          }
        ]
      };

      expect(constructorMember.member_type).toBe("constructor");
      expect(constructorMember.parameters![0].is_optional).toBe(true);
      expect(constructorMember.parameters![0].default_value).toBe("defaultValue");
    });

    it('should handle field member info structure', () => {
      const fieldMember: MemberInfo = {
        symbol_id: mockSymbolId,
        name: "testField" as SymbolName,
        member_type: "field",
        value_type: mockTypeId,
        is_static: false,
        is_private: false,
        is_readonly: false,
        location: mockLocation,
      };

      expect(fieldMember.member_type).toBe("field");
      expect(fieldMember.value_type).toBe(mockTypeId);
    });
  });

  describe('ParameterInfo', () => {
    it('should handle regular parameter', () => {
      const param: ParameterInfo = {
        name: "regularParam" as SymbolName,
        type: mockTypeId,
        is_optional: false,
        is_rest: false,
      };

      expect(param.is_optional).toBe(false);
      expect(param.is_rest).toBe(false);
      expect(param.default_value).toBeUndefined();
    });

    it('should handle optional parameter with default value', () => {
      const param: ParameterInfo = {
        name: "optionalParam" as SymbolName,
        type: mockTypeId,
        is_optional: true,
        is_rest: false,
        default_value: "42",
      };

      expect(param.is_optional).toBe(true);
      expect(param.default_value).toBe("42");
    });

    it('should handle rest parameter', () => {
      const param: ParameterInfo = {
        name: "restParam" as SymbolName,
        type: mockTypeId,
        is_optional: false,
        is_rest: true,
      };

      expect(param.is_rest).toBe(true);
    });
  });

  describe('InheritanceInfo', () => {
    it('should handle inheritance with extends and implements', () => {
      const parentType = "parent_type" as TypeId;
      const interface1 = "interface1_type" as TypeId;
      const interface2 = "interface2_type" as TypeId;
      const ancestor1 = "ancestor1_type" as TypeId;

      const inheritanceInfo: InheritanceInfo = {
        extends_type: parentType,
        implements_types: [interface1, interface2],
        all_ancestors: [parentType, interface1, interface2, ancestor1],
        all_members: new Map([
          ["method1" as SymbolName, {
            symbol_id: mockSymbolId,
            name: "method1" as SymbolName,
            member_type: "method",
            is_static: false,
            is_private: false,
            is_readonly: false,
            location: mockLocation,
          }]
        ])
      };

      expect(inheritanceInfo.extends_type).toBe(parentType);
      expect(inheritanceInfo.implements_types).toHaveLength(2);
      expect(inheritanceInfo.implements_types).toContain(interface1);
      expect(inheritanceInfo.implements_types).toContain(interface2);
      expect(inheritanceInfo.all_ancestors).toHaveLength(4);
      expect(inheritanceInfo.all_members.size).toBe(1);
    });

    it('should handle inheritance without extends', () => {
      const interface1 = "interface1_type" as TypeId;

      const inheritanceInfo: InheritanceInfo = {
        implements_types: [interface1],
        all_ancestors: [interface1],
        all_members: new Map()
      };

      expect(inheritanceInfo.extends_type).toBeUndefined();
      expect(inheritanceInfo.implements_types).toHaveLength(1);
      expect(inheritanceInfo.all_ancestors).toHaveLength(1);
    });
  });

  describe('VariableTypeMap', () => {
    it('should create empty variable map with correct structure', () => {
      const variableMap = create_empty_variable_map();

      expect(variableMap.variable_type_info).toBeInstanceOf(Map);
      expect(variableMap.variable_types).toBeInstanceOf(Map);
      expect(variableMap.reassignments).toBeInstanceOf(Map);
      expect(variableMap.scope_variables).toBeInstanceOf(Map);

      // All maps should be empty
      expect(variableMap.variable_type_info.size).toBe(0);
      expect(variableMap.variable_types.size).toBe(0);
      expect(variableMap.reassignments.size).toBe(0);
      expect(variableMap.scope_variables.size).toBe(0);
    });
  });

  describe('VariableTypeInfo', () => {
    it('should handle declaration source variable type info', () => {
      const variableInfo: VariableTypeInfo = {
        variable_name: "testVar" as SymbolName,
        scope_id: mockScopeId,
        type_info: {
          id: mockTypeId,
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: {
            kind: "annotation",
            location: mockLocation,
          }
        },
        type_id: mockTypeId,
        location: mockLocation,
        source: "declaration"
      };

      expect(variableInfo.source).toBe("declaration");
      expect(variableInfo.type_info.certainty).toBe("declared");
      expect(variableInfo.type_id).toBe(mockTypeId);
    });

    it('should handle assignment source variable type info', () => {
      const variableInfo: VariableTypeInfo = {
        variable_name: "testVar" as SymbolName,
        scope_id: mockScopeId,
        type_info: {
          id: mockTypeId,
          type_name: "number" as SymbolName,
          certainty: "inferred",
          source: {
            kind: "assignment",
            location: mockLocation,
          }
        },
        location: mockLocation,
        source: "assignment"
      };

      expect(variableInfo.source).toBe("assignment");
      expect(variableInfo.type_info.certainty).toBe("inferred");
      expect(variableInfo.type_id).toBeUndefined();
    });

    it('should handle inference source variable type info', () => {
      const variableInfo: VariableTypeInfo = {
        variable_name: "testVar" as SymbolName,
        scope_id: mockScopeId,
        type_info: {
          id: mockTypeId,
          type_name: "unknown" as SymbolName,
          certainty: "ambiguous",
          source: {
            kind: "literal",
            location: mockLocation,
          }
        },
        location: mockLocation,
        source: "inference"
      };

      expect(variableInfo.source).toBe("inference");
      expect(variableInfo.type_info.certainty).toBe("ambiguous");
    });
  });

  describe('TypeReassignment', () => {
    it('should handle type narrowing reassignment', () => {
      const fromType = "union_type" as TypeId;
      const toType = "string_type" as TypeId;

      const reassignment: TypeReassignment = {
        from_type: fromType,
        to_type: toType,
        location: mockLocation,
        is_narrowing: true,
        is_widening: false,
      };

      expect(reassignment.from_type).toBe(fromType);
      expect(reassignment.to_type).toBe(toType);
      expect(reassignment.is_narrowing).toBe(true);
      expect(reassignment.is_widening).toBe(false);
    });

    it('should handle type widening reassignment', () => {
      const fromType = "string_type" as TypeId;
      const toType = "union_type" as TypeId;

      const reassignment: TypeReassignment = {
        from_type: fromType,
        to_type: toType,
        location: mockLocation,
        is_narrowing: false,
        is_widening: true,
      };

      expect(reassignment.is_narrowing).toBe(false);
      expect(reassignment.is_widening).toBe(true);
    });

    it('should handle neutral reassignment', () => {
      const fromType = "string_type" as TypeId;
      const toType = "string_type" as TypeId;

      const reassignment: TypeReassignment = {
        from_type: fromType,
        to_type: toType,
        location: mockLocation,
        is_narrowing: false,
        is_widening: false,
      };

      expect(reassignment.is_narrowing).toBe(false);
      expect(reassignment.is_widening).toBe(false);
    });
  });

  describe('TypeResolutionContext', () => {
    it('should create complete type context with all components', () => {
      const context = create_type_context(mockFilePath);

      expect(context.registry).toBeDefined();
      expect(context.members).toBeDefined();
      expect(context.variables).toBeDefined();
      expect(context.generics).toBeInstanceOf(Map);
      expect(context.aliases).toBeInstanceOf(Map);
      expect(context.composite_types).toBeInstanceOf(Map);

      // Check that registry has correct file path
      expect(context.registry.file_path).toBe(mockFilePath);

      // All maps should be empty initially
      expect(context.generics.size).toBe(0);
      expect(context.aliases.size).toBe(0);
      expect(context.composite_types.size).toBe(0);
    });

    it('should have properly structured sub-components', () => {
      const context = create_type_context(mockFilePath);

      // Registry should be properly structured
      expect(context.registry.symbol_to_type).toBeInstanceOf(Map);
      expect(context.registry.name_to_type).toBeInstanceOf(Map);

      // Members should be properly structured
      expect(context.members.instance_members).toBeInstanceOf(Map);
      expect(context.members.static_members).toBeInstanceOf(Map);

      // Variables should be properly structured
      expect(context.variables.variable_type_info).toBeInstanceOf(Map);
      expect(context.variables.variable_types).toBeInstanceOf(Map);
    });
  });

  describe('CompositeTypeInfo', () => {
    it('should handle union type info', () => {
      const type1 = "string_type" as TypeId;
      const type2 = "number_type" as TypeId;

      const compositeType: CompositeTypeInfo = {
        kind: "union",
        members: [type1, type2],
      };

      expect(compositeType.kind).toBe("union");
      expect(compositeType.members).toHaveLength(2);
      expect(compositeType.members).toContain(type1);
      expect(compositeType.members).toContain(type2);
    });

    it('should handle intersection type info', () => {
      const type1 = "interface1_type" as TypeId;
      const type2 = "interface2_type" as TypeId;

      const compositeType: CompositeTypeInfo = {
        kind: "intersection",
        members: [type1, type2],
      };

      expect(compositeType.kind).toBe("intersection");
      expect(compositeType.members).toHaveLength(2);
    });

    it('should handle array type info', () => {
      const elementType = "string_type" as TypeId;

      const compositeType: CompositeTypeInfo = {
        kind: "array",
        members: [],
        element_type: elementType,
      };

      expect(compositeType.kind).toBe("array");
      expect(compositeType.element_type).toBe(elementType);
    });

    it('should handle tuple type info', () => {
      const type1 = "string_type" as TypeId;
      const type2 = "number_type" as TypeId;
      const type3 = "boolean_type" as TypeId;

      const compositeType: CompositeTypeInfo = {
        kind: "tuple",
        members: [type1, type2, type3],
        elements: [type1, type2, type3],
      };

      expect(compositeType.kind).toBe("tuple");
      expect(compositeType.elements).toHaveLength(3);
      expect(compositeType.elements![0]).toBe(type1);
      expect(compositeType.elements![1]).toBe(type2);
      expect(compositeType.elements![2]).toBe(type3);
    });
  });

  describe('Integration tests', () => {
    it('should create a complete type resolution context that can be populated', () => {
      const context = create_type_context(mockFilePath);

      // Should be able to add registry entries
      const registry = context.registry as any;
      registry.symbol_to_type.set(mockSymbolId, mockTypeId);
      registry.name_to_type.set(mockSymbolName, mockTypeId);
      registry.defined_types.add(mockTypeId);

      expect(registry.symbol_to_type.get(mockSymbolId)).toBe(mockTypeId);
      expect(registry.name_to_type.get(mockSymbolName)).toBe(mockTypeId);
      expect(registry.defined_types.has(mockTypeId)).toBe(true);
    });

    it('should handle complex member hierarchy', () => {
      const context = create_type_context(mockFilePath);

      const memberInfo: MemberInfo = {
        symbol_id: mockSymbolId,
        name: "complexMethod" as SymbolName,
        member_type: "method",
        return_type: mockTypeId,
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
          },
          {
            name: "param2" as SymbolName,
            type: "number_type" as TypeId,
            is_optional: true,
            is_rest: false,
            default_value: "0",
          }
        ]
      };

      // Should be able to add to members
      const members = context.members as any;
      const memberMap = new Map([[mockSymbolName, memberInfo]]);
      members.instance_members.set(mockTypeId, memberMap);

      const retrievedMap = members.instance_members.get(mockTypeId);
      expect(retrievedMap).toBeDefined();
      expect(retrievedMap!.get(mockSymbolName)).toBe(memberInfo);
    });

    it('should handle variable type tracking flow', () => {
      const context = create_type_context(mockFilePath);

      const variableInfo: VariableTypeInfo = {
        variable_name: "trackedVar" as SymbolName,
        scope_id: mockScopeId,
        type_info: {
          id: mockTypeId,
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: {
            kind: "annotation",
            location: mockLocation,
          }
        },
        type_id: mockTypeId,
        location: mockLocation,
        source: "declaration"
      };

      // Should be able to track variables
      const variables = context.variables as any;
      variables.variable_type_info.set(mockLocation, variableInfo);
      variables.variable_types.set(mockLocation, mockTypeId);

      expect(variables.variable_type_info.get(mockLocation)).toBe(variableInfo);
      expect(variables.variable_types.get(mockLocation)).toBe(mockTypeId);
    });
  });
});
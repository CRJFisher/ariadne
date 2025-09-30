/**
 * Comprehensive tests for member access references processing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import type { TypeInfo } from "../type_tracking/type_info";
import type { NormalizedCapture } from "../../query_code_tree/capture_types";
import {
  SemanticEntity,
  SemanticCategory,
} from "../../query_code_tree/capture_types";
import {
  MemberAccessReference,
  ObjectMemberAccesses,
  PropertyChain,
  process_member_access_references,
  group_by_object,
  find_property_chains,
} from "./member_access_references";
import { create_mock_node } from "../../test_utils";

// Mock dependencies
vi.mock("../../../utils/node_utils", () => ({
  node_to_location: vi.fn((node, file_path) => ({
    file_path,
        start_line: node.start_line || 1,
    column: node.start_column || 0,
    end_line: node.end_line || 1,
    end_column: node.end_column || 10,
  })),
}));

vi.mock("../../scope_tree", () => ({
  find_containing_scope: vi.fn(),
}));

import { find_containing_scope } from "../../scope_tree";
import { node_to_location } from "../../node_utils";

const mockNodeToLocation = vi.mocked(node_to_location);
const mockFindContainingScope = vi.mocked(find_containing_scope);

describe("Member Access References", () => {
  const mockFilePath = "test.ts" as FilePath;
  const mockLocation: Location = {
    file_path: mockFilePath,
    start_line: 1,
    start_column: 0,
    end_line: 1,
    end_column: 10,
  };

  const mockScope: LexicalScope = {
    id: "scope_1" as ScopeId,
    type: "function",
    location: {
      file_path: mockFilePath,
      start_line: 1,
      start_column: 0,
      end_line: 1,
      end_column: 10,
    },
    child_ids: [],
    symbols: new Map(),
    parent_id: null,
    name: "testFunction" as SymbolName,
  };

  const mockScopes = new Map<ScopeId, LexicalScope>([
    [mockScope.id, mockScope],
  ]);

  const mockTypeInfo: TypeInfo = {
    type_name: "MyClass" as SymbolName,
    certainty: "declared",
    source: {
      kind: "annotation",
      location: mockLocation,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindContainingScope.mockReturnValue(mockScope);
    mockNodeToLocation.mockReturnValue(mockLocation);
  });

  describe("MemberAccessReference Interface", () => {
    it("should define correct structure for property access", () => {
      const memberAccess: MemberAccessReference = {
        location: mockLocation,
        member_name: "propertyName" as SymbolName,
        scope_id: mockScope.id,
        access_type: "property",
        object: {
          location: mockLocation,
          // type: mockTypeInfo, // Type resolution happens in Phase 3
        },
        property_chain: [
          "obj" as SymbolName,
          "nested" as SymbolName,
          "prop" as SymbolName,
        ],
        is_optional_chain: false,
        computed_key: mockLocation,
      };

      expect(memberAccess.location).toEqual(mockLocation);
      expect(memberAccess.member_name).toBe("propertyName");
      expect(memberAccess.access_type).toBe("property");
      expect(memberAccess.object.location).toEqual(mockLocation);
      // Type resolution happens in symbol_resolution Phase 3
      expect(memberAccess.property_chain).toHaveLength(3);
      expect(memberAccess.is_optional_chain).toBe(false);
      expect(memberAccess.computed_key).toEqual(mockLocation);
    });

    it("should define correct structure for method access", () => {
      const methodAccess: MemberAccessReference = {
        location: mockLocation,
        member_name: "methodName" as SymbolName,
        scope_id: mockScope.id,
        access_type: "method",
        object: {
          location: mockLocation,
          // type: mockTypeInfo, // Type resolution happens in Phase 3
        },
        is_optional_chain: false,
      };

      expect(methodAccess.access_type).toBe("method");
      expect(methodAccess.member_name).toBe("methodName");
    });

    it("should define correct structure for index access", () => {
      const indexAccess: MemberAccessReference = {
        location: mockLocation,
        member_name: "0" as SymbolName,
        scope_id: mockScope.id,
        access_type: "index",
        object: {
          location: mockLocation,
          // type: mockTypeInfo, // Type resolution happens in Phase 3
        },
        is_optional_chain: false,
      };

      expect(indexAccess.access_type).toBe("index");
    });

    it("should support optional chaining", () => {
      const optionalAccess: MemberAccessReference = {
        location: mockLocation,
        member_name: "prop" as SymbolName,
        scope_id: mockScope.id,
        access_type: "property",
        object: {},
        is_optional_chain: true,
      };

      expect(optionalAccess.is_optional_chain).toBe(true);
    });

    it("should support minimal object info", () => {
      const minimalAccess: MemberAccessReference = {
        location: mockLocation,
        member_name: "prop" as SymbolName,
        scope_id: mockScope.id,
        access_type: "property",
        object: {},
        is_optional_chain: false,
      };

      expect(minimalAccess.object.location).toBeUndefined();
      // Type resolution happens in symbol_resolution Phase 3
    });

    it("should support static method detection fields", () => {
      const staticAccess: MemberAccessReference = {
        location: mockLocation,
        member_name: "staticMethod" as SymbolName,
        scope_id: mockScope.id,
        access_type: "method",
        object: {},
        is_optional_chain: false,
        is_static: true,
      };

      expect(staticAccess.is_static).toBe(true);
    });

    it("should support instance method detection fields", () => {
      const instanceAccess: MemberAccessReference = {
        location: mockLocation,
        member_name: "instanceMethod" as SymbolName,
        scope_id: mockScope.id,
        access_type: "method",
        object: {},
        is_optional_chain: false,
        is_static: false,
      };

      expect(instanceAccess.is_static).toBe(false);
    });
  });

  describe("process_member_access_references", () => {
    describe("Success Cases", () => {
      it("should process member access captures", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "propertyName",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].member_name).toBe("propertyName");
        expect(result[0].access_type).toBe("property");
        expect(result[0].location).toEqual(mockLocation);
        expect(result[0].scope_id).toBe(mockScope.id);
      });

      it("should process property captures", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.PROPERTY,
            text: "prop",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].access_type).toBe("property");
      });

      it("should process method captures", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.METHOD,
            text: "methodName",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].access_type).toBe("method");
        expect(result[0].member_name).toBe("methodName");
      });

      it("should include receiver object location", () => {
        const mockReceiver = create_mock_node("identifier", "obj", 1, 0, 1, 5);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "prop",
            node_location: mockLocation,
            modifiers: {},
            context: {
              receiver_node: mockReceiver,
            },
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].object.location).toEqual(mockLocation);
        expect(mockNodeToLocation).toHaveBeenCalledWith(
          mockReceiver,
          mockFilePath
        );
      });

      it("should include property chain", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "finalProp",
            node_location: mockLocation,
            modifiers: {},
            context: {
              property_chain: ["obj", "nested", "finalProp"],
            },
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].property_chain).toEqual([
          "obj",
          "nested",
          "finalProp",
        ]);
      });

      it("should detect static method calls from context", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.METHOD,
            text: "staticMethod",
            node_location: mockLocation,
            modifiers: {},
            context: {
              is_static: true,
            },
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].member_name).toBe("staticMethod");
        expect(result[0].access_type).toBe("method");
        expect(result[0].is_static).toBe(true);
      });

      it("should detect instance method calls from context", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.METHOD,
            text: "instanceMethod",
            node_location: mockLocation,
            modifiers: {},
            context: {
              is_static: false,
            },
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].member_name).toBe("instanceMethod");
        expect(result[0].access_type).toBe("method");
        expect(result[0].is_static).toBe(false);
      });

      it("should detect static access from Python decorators", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.METHOD,
            text: "staticmethod_python",
            node_location: mockLocation,
            modifiers: {},
            context: {
              decorator_name: "staticmethod",
            },
          },
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.METHOD,
            text: "classmethod_python",
            node_location: mockLocation,
            modifiers: {},
            context: {
              decorator_name: "classmethod",
            },
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(2);
        expect(result[0].is_static).toBe(true);
        expect(result[1].is_static).toBe(true);
      });

      it("should detect Rust associated functions", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.METHOD,
            text: "associated_func",
            node_location: mockLocation,
            modifiers: {},
            context: {
              is_static: true,
            },
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_static).toBe(true);
      });

      it("should handle multiple access types", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.PROPERTY,
            text: "prop",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.METHOD,
            text: "method",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "access",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(3);
        expect(result[0].access_type).toBe("property");
        expect(result[1].access_type).toBe("method");
        expect(result[2].access_type).toBe("property");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty captures array", () => {
        const result = process_member_access_references(
          [],
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toEqual([]);
      });

      it("should filter out non-member access entities", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.FUNCTION,
            text: "definedFunction",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "accessedProperty",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].member_name).toBe("accessedProperty");
      });

      it("should handle captures without context", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "simpleAccess",
            node_location: mockLocation,
            modifiers: {},
            context: undefined,
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].object.location).toBeUndefined();
        expect(result[0].property_chain).toBeUndefined();
      });

      it("should handle captures without receiver node", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "orphanAccess",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].object.location).toBeUndefined();
      });
    });
  });

  describe("ObjectMemberAccesses Interface", () => {
    it("should define correct structure", () => {
      const objectAccesses: ObjectMemberAccesses = {
        object_location: mockLocation,
        accesses: [],
        accessed_members: new Set([
          "prop1" as SymbolName,
          "prop2" as SymbolName,
        ]),
      };

      expect(objectAccesses.object_location).toEqual(mockLocation);
      // Type resolution happens in symbol_resolution Phase 3
      expect(Array.isArray(objectAccesses.accesses)).toBe(true);
      expect(objectAccesses.accessed_members).toBeInstanceOf(Set);
      expect(objectAccesses.accessed_members.size).toBe(2);
    });
  });

  describe("group_by_object", () => {
    describe("Success Cases", () => {
      it("should group accesses by object location", () => {
        const objectLocation1: Location = {
          file_path: mockFilePath,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 5,
        };

        const objectLocation2: Location = {
          file_path: mockFilePath,
          start_line: 2,
          start_column: 0,
          end_line: 2,
          end_column: 5,
        };

        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: objectLocation1 /* type: mockTypeInfo */ },
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "prop2" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: objectLocation1 /* type: mockTypeInfo */ },
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "method1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "method",
            object: { location: objectLocation2 },
            is_optional_chain: false,
          },
        ];

        const result = group_by_object(accesses);

        expect(result).toHaveLength(2);

        const group1 = result.find(
          (g) => g.object_location === objectLocation1
        )!;
        const group2 = result.find(
          (g) => g.object_location === objectLocation2
        )!;

        expect(group1.accesses).toHaveLength(2);
        expect(group1.accessed_members.size).toBe(2);
        expect(group1.accessed_members.has("prop1" as SymbolName)).toBe(true);
        expect(group1.accessed_members.has("prop2" as SymbolName)).toBe(true);
        // Type resolution happens in symbol_resolution Phase 3

        expect(group2.accesses).toHaveLength(1);
        expect(group2.accessed_members.size).toBe(1);
        expect(group2.accessed_members.has("method1" as SymbolName)).toBe(true);
      });

      it("should handle single object with multiple accesses", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: mockLocation },
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "method1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "method",
            object: { location: mockLocation },
            is_optional_chain: false,
          },
        ];

        const result = group_by_object(accesses);

        expect(result).toHaveLength(1);
        expect(result[0].accesses).toHaveLength(2);
        expect(result[0].accessed_members.size).toBe(2);
      });

      it("should handle duplicate member names", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: mockLocation },
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "prop" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: mockLocation },
            is_optional_chain: false,
          },
        ];

        const result = group_by_object(accesses);

        expect(result).toHaveLength(1);
        expect(result[0].accesses).toHaveLength(2);
        expect(result[0].accessed_members.size).toBe(1);
        expect(result[0].accessed_members.has("prop" as SymbolName)).toBe(true);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty accesses array", () => {
        const result = group_by_object([]);
        expect(result).toEqual([]);
      });

      it("should skip accesses without object location", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "orphanProp" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: {},
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "validProp" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: mockLocation },
            is_optional_chain: false,
          },
        ];

        const result = group_by_object(accesses);

        expect(result).toHaveLength(1);
        expect(result[0].accessed_members.has("validProp" as SymbolName)).toBe(
          true
        );
        expect(result[0].accessed_members.has("orphanProp" as SymbolName)).toBe(
          false
        );
      });

      it("should create unique keys for different locations", () => {
        const location1: Location = {
          file_path: mockFilePath,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 5,
        };

        const location2: Location = {
          file_path: mockFilePath,
          start_line: 1,
          start_column: 5,
          end_line: 1,
          end_column: 10,
        };

        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: location1 },
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "prop2" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: location2 },
            is_optional_chain: false,
          },
        ];

        const result = group_by_object(accesses);

        expect(result).toHaveLength(2);
      });
    });
  });

  // Type resolution tests removed - resolution happens in symbol_resolution Phase 3
  /* Commented out - needs update for new type tracking architecture
  describe("find_method_calls_on_type", () => {
    describe("Success Cases", () => {
      it("should find method calls on specific type", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "method1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "method",
            object: { // type mockTypeInfo },
            is_optional_chain: false
          },
          {
            location: mockLocation,
            member_name: "prop1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { // type mockTypeInfo },
            is_optional_chain: false
          },
          {
            location: mockLocation,
            member_name: "method2" as SymbolName,
            scope_id: mockScope.id,
            access_type: "method",
            object: {
              type: {
                type_name: "OtherClass" as SymbolName,
                certainty: "declared",
                source: { kind: "annotation", location: mockLocation },
              },
            },
            is_optional_chain: false,
          },
        ];

        const result = find_method_calls_on_type(
          accesses,
          "MyClass" as SymbolName
        );

        expect(result).toHaveLength(1);
        expect(result[0].member_name).toBe("method1");
        expect(result[0].access_type).toBe("method");
      });

      it("should handle multiple method calls on same type", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "method1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "method",
            object: { // type mockTypeInfo },
            is_optional_chain: false
          },
          {
            location: mockLocation,
            member_name: "method2" as SymbolName,
            scope_id: mockScope.id,
            access_type: "method",
            object: { // type mockTypeInfo },
            is_optional_chain: false
          },
        ];

        const result = find_method_calls_on_type(
          accesses,
          "MyClass" as SymbolName
        );

        expect(result).toHaveLength(2);
        expect(result.map((r) => r.member_name)).toEqual([
          "method1",
          "method2",
        ]);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty accesses array", () => {
        const result = find_method_calls_on_type([], "AnyType" as SymbolName);
        expect(result).toEqual([]);
      });

      it("should handle no matching type", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "method1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "method",
            object: { // type mockTypeInfo },
            is_optional_chain: false
          },
        ];

        const result = find_method_calls_on_type(
          accesses,
          "UnknownType" as SymbolName
        );

        expect(result).toEqual([]);
      });

      it("should handle accesses without object type", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "method1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "method",
            object: {},
            is_optional_chain: false,
          },
        ];

        const result = find_method_calls_on_type(
          accesses,
          "MyClass" as SymbolName
        );

        expect(result).toEqual([]);
      });

      it("should filter out non-method accesses", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { // type mockTypeInfo },
            is_optional_chain: false
          },
          {
            location: mockLocation,
            member_name: "index1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "index",
            object: { // type mockTypeInfo },
            is_optional_chain: false
          },
        ];

        const result = find_method_calls_on_type(
          accesses,
          "MyClass" as SymbolName
        );

        expect(result).toEqual([]);
      });
    });
  });
  */

  describe("PropertyChain Interface", () => {
    it("should define correct structure", () => {
      const propertyChain: PropertyChain = {
        start_location: mockLocation,
        chain: [
          "obj" as SymbolName,
          "nested" as SymbolName,
          "prop" as SymbolName,
        ],
        final_access_type: "property",
      };

      expect(propertyChain.start_location).toEqual(mockLocation);
      expect(propertyChain.chain).toHaveLength(3);
      expect(propertyChain.final_access_type).toBe("property");
    });

    it("should support different access types", () => {
      const accessTypes = ["property", "method", "index"] as const;

      for (const accessType of accessTypes) {
        const chain: PropertyChain = {
          start_location: mockLocation,
          chain: ["obj" as SymbolName, "prop" as SymbolName],
          final_access_type: accessType,
        };

        expect(chain.final_access_type).toBe(accessType);
      }
    });
  });

  describe("find_property_chains", () => {
    describe("Success Cases", () => {
      it("should find property chains with multiple elements", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "finalProp" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: {},
            property_chain: [
              "obj" as SymbolName,
              "nested" as SymbolName,
              "finalProp" as SymbolName,
            ],
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "simpleProp" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: {},
            property_chain: ["obj" as SymbolName],
            is_optional_chain: false,
          },
        ];

        const result = find_property_chains(accesses);

        expect(result).toHaveLength(1);
        expect(result[0].chain).toEqual(["obj", "nested", "finalProp"]);
        expect(result[0].final_access_type).toBe("property");
        expect(result[0].start_location).toEqual(mockLocation);
      });

      it("should handle method chains", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "chainedMethod" as SymbolName,
            scope_id: mockScope.id,
            access_type: "method",
            object: {},
            property_chain: [
              "obj" as SymbolName,
              "service" as SymbolName,
              "chainedMethod" as SymbolName,
            ],
            is_optional_chain: false,
          },
        ];

        const result = find_property_chains(accesses);

        expect(result).toHaveLength(1);
        expect(result[0].final_access_type).toBe("method");
      });

      it("should handle multiple chains", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: {},
            property_chain: [
              "obj" as SymbolName,
              "nested" as SymbolName,
              "prop1" as SymbolName,
            ],
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "prop2" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: {},
            property_chain: [
              "other" as SymbolName,
              "deep" as SymbolName,
              "prop2" as SymbolName,
            ],
            is_optional_chain: false,
          },
        ];

        const result = find_property_chains(accesses);

        expect(result).toHaveLength(2);
        expect(result[0].chain[2]).toBe("prop1");
        expect(result[1].chain[2]).toBe("prop2");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty accesses array", () => {
        const result = find_property_chains([]);
        expect(result).toEqual([]);
      });

      it("should skip accesses without property chains", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "simpleProp" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: {},
            is_optional_chain: false,
          },
        ];

        const result = find_property_chains(accesses);

        expect(result).toEqual([]);
      });

      it("should skip short property chains", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: {},
            property_chain: ["obj" as SymbolName],
            is_optional_chain: false,
          },
        ];

        const result = find_property_chains(accesses);

        expect(result).toEqual([]);
      });

      it("should handle empty property chains", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: {},
            property_chain: [],
            is_optional_chain: false,
          },
        ];

        const result = find_property_chains(accesses);

        expect(result).toEqual([]);
      });
    });
  });

  // Null dereference detection removed - requires type resolution
  /*
  describe("PotentialNullDereference Interface", () => {
    it("should define correct structure", () => {
      const mockAccess: MemberAccessReference = {
        location: mockLocation,
        member_name: "prop" as SymbolName,
        scope_id: mockScope.id,
        access_type: "property",
        object: {},
        is_optional_chain: false,
      };

      const nullDeref: PotentialNullDereference = {
        location: mockLocation,
        member_access: mockAccess,
        reason: "nullable_type",
      };

      expect(nullDeref.location).toEqual(mockLocation);
      expect(nullDeref.member_access).toBe(mockAccess);
      expect(nullDeref.reason).toBe("nullable_type");
    });

    it("should support all reason types", () => {
      const reasons = [
        "nullable_type",
        "no_null_check",
        "after_null_assignment",
      ] as const;

      for (const reason of reasons) {
        const nullDeref: PotentialNullDereference = {
          location: mockLocation,
          member_access: {} as MemberAccessReference,
          reason,
        };

        expect(nullDeref.reason).toBe(reason);
      }
    });
  });

  describe("find_potential_null_dereferences", () => {
    describe("Success Cases", () => {
      it("should find nullable type dereferences", () => {
        const nullableTypeInfo: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
          is_nullable: true,
        };

        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { type: nullableTypeInfo },
            is_optional_chain: false,
          },
        ];

        const result = find_potential_null_dereferences(accesses);

        expect(result).toHaveLength(1);
        expect(result[0].reason).toBe("nullable_type");
        expect(result[0].location).toEqual(mockLocation);
        expect(result[0].member_access).toBe(accesses[0]);
      });

      it("should handle multiple nullable accesses", () => {
        const nullableTypeInfo: TypeInfo = {
          type_name: "object" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
          is_nullable: true,
        };

        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { type: nullableTypeInfo },
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "method1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "method",
            object: { type: nullableTypeInfo },
            is_optional_chain: false,
          },
        ];

        const result = find_potential_null_dereferences(accesses);

        expect(result).toHaveLength(2);
        expect(result.every((r) => r.reason === "nullable_type")).toBe(true);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty accesses array", () => {
        const result = find_potential_null_dereferences([]);
        expect(result).toEqual([]);
      });

      it("should skip optional chaining", () => {
        const nullableTypeInfo: TypeInfo = {
          type_name: "object" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
          is_nullable: true,
        };

        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "safeProp" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { type: nullableTypeInfo },
            is_optional_chain: true,
          },
        ];

        const result = find_potential_null_dereferences(accesses);

        expect(result).toEqual([]);
      });

      it("should skip non-nullable types", () => {
        const nonNullableTypeInfo: TypeInfo = {
          type_name: "string" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
          is_nullable: false,
        };

        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "safeProp" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { type: nonNullableTypeInfo },
            is_optional_chain: false,
          },
        ];

        const result = find_potential_null_dereferences(accesses);

        expect(result).toEqual([]);
      });

      it("should skip accesses without type info", () => {
        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "unknownProp" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: {},
            is_optional_chain: false,
          },
        ];

        const result = find_potential_null_dereferences(accesses);

        expect(result).toEqual([]);
      });

      it("should handle undefined nullable flag", () => {
        const typeWithoutFlag: TypeInfo = {
          type_name: "object" as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location: mockLocation },
          // is_nullable is undefined
        };

        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { type: typeWithoutFlag },
            is_optional_chain: false,
          },
        ];

        const result = find_potential_null_dereferences(accesses);

        expect(result).toEqual([]);
      });
    });
  });
  */

  describe("Integration Tests", () => {
    it("should process complete member access analysis pipeline", () => {
      const mockReceiver = create_mock_node("identifier", "obj", 1, 0, 1, 3);

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.MEMBER_ACCESS,
          text: "myProperty",
          node_location: mockLocation,
          modifiers: {},
          context: {
            receiver_node: mockReceiver,
            property_chain: ["obj", "nested", "myProperty"],
          },
        },
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.METHOD,
          text: "myMethod",
          node_location: {
            ...mockLocation,
        start_line: 2,
        start_column: 0,
          },
          modifiers: {},
          context: {
            receiver_node: mockReceiver,
          },
        },
      ];

      // Process member access references
      const accesses = process_member_access_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(accesses).toHaveLength(2);

      // Group by object
      const grouped = group_by_object(accesses);
      expect(grouped).toHaveLength(1);
      expect(grouped[0].accessed_members.size).toBe(2);

      // Find property chains
      const chains = find_property_chains(accesses);
      expect(chains).toHaveLength(1);
      expect(chains[0].chain).toEqual(["obj", "nested", "myProperty"]);

      // Type resolution tests removed - resolution happens in symbol_resolution Phase 3
    });
  });

  describe("Bug Fixes and Improvements", () => {
    describe("Access Type Detection Bug Fix", () => {
      it("should correctly detect method access for MEMBER_ACCESS entities with call context", () => {
        const mockReceiver = create_mock_node("identifier", "obj", 1, 0, 1, 3);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "methodCall",
            node_location: mockLocation,
            modifiers: {},
            context: {
              receiver_node: mockReceiver,
            },
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].access_type).toBe("method");
        expect(result[0].member_name).toBe("methodCall");
      });

      it("should correctly detect index access for MEMBER_ACCESS entities with bracket notation", () => {
        const mockReceiver = create_mock_node("identifier", "obj", 1, 0, 1, 3);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "0",
            node_location: mockLocation,
            modifiers: {},
            context: {
              receiver_node: mockReceiver,
            },
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].access_type).toBe("index");
        expect(result[0].member_name).toBe("0");
      });

      it("should default MEMBER_ACCESS entities to property when no context clues", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "prop",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].access_type).toBe("property");
      });

      it("should correctly handle METHOD entities", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.METHOD,
            text: "directMethod",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].access_type).toBe("method");
      });

      it("should correctly handle PROPERTY entities", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.PROPERTY,
            text: "directProperty",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].access_type).toBe("property");
      });
    });

    describe("Grouping Key Bug Fix", () => {
      it("should include file_path in grouping key to avoid collisions", () => {
        const file1Location: Location = {
          file_path: "file1.ts" as FilePath,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 5,
        };

        const file2Location: Location = {
          file_path: "file2.ts" as FilePath,
          start_line: 1, // Same line and column as file1
          start_column: 0,
          end_line: 1,
          end_column: 5,
        };

        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: file1Location },
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "prop2" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: file2Location },
            is_optional_chain: false,
          },
        ];

        const result = group_by_object(accesses);

        // Should create separate groups for different files even at same line/column
        expect(result).toHaveLength(2);

        const group1 = result.find(
          (g) => g.object_location.file_path === "file1.ts"
        )!;
        const group2 = result.find(
          (g) => g.object_location.file_path === "file2.ts"
        )!;

        expect(group1).toBeDefined();
        expect(group2).toBeDefined();
        expect(group1.accesses).toHaveLength(1);
        expect(group2.accesses).toHaveLength(1);
        expect(group1.accessed_members.has("prop1" as SymbolName)).toBe(true);
        expect(group2.accessed_members.has("prop2" as SymbolName)).toBe(true);
      });

      it("should still group accesses from same file and location correctly", () => {
        const sameLocation: Location = {
          file_path: mockFilePath,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 5,
        };

        const accesses: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "prop1" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: sameLocation },
            is_optional_chain: false,
          },
          {
            location: mockLocation,
            member_name: "prop2" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: sameLocation },
            is_optional_chain: false,
          },
        ];

        const result = group_by_object(accesses);

        // Should group together accesses from same file and location
        expect(result).toHaveLength(1);
        expect(result[0].accesses).toHaveLength(2);
        expect(result[0].accessed_members.size).toBe(2);
      });
    });

    describe("Type Safety and Validation", () => {
      it("should validate function inputs and throw on invalid parameters", () => {
        expect(() => {
          process_member_access_references(
            null as unknown as NormalizedCapture[],
            mockScope,
            mockScopes,
            mockFilePath
          );
        }).toThrow("captures must be an array");

        expect(() => {
          process_member_access_references(
            [],
            null as unknown as LexicalScope,
            mockScopes,
            mockFilePath
          );
        }).toThrow("root_scope is required");

        expect(() => {
          process_member_access_references(
            [],
            mockScope,
            null as unknown as Map<ScopeId, LexicalScope>,
            mockFilePath
          );
        }).toThrow("scopes must be a Map");

        expect(() => {
          process_member_access_references(
            [],
            mockScope,
            mockScopes,
            "" as FilePath
          );
        }).toThrow("file_path is required");
      });

      it("should validate inputs for utility functions", () => {
        expect(() => {
          group_by_object(null as unknown as MemberAccessReference[]);
        }).toThrow("accesses must be an array");

        // Type resolution tests removed - resolution happens in symbol_resolution Phase 3
        /*
        expect(() => {
          find_method_calls_on_type(null , "TestType" as SymbolName);
        }).toThrow("accesses must be an array");

        expect(() => {
          find_method_calls_on_type([], "" as SymbolName);
        }).toThrow("type_name is required");
        */

        expect(() => {
          find_property_chains(null as unknown as MemberAccessReference[]);
        }).toThrow("accesses must be an array");

        // Null dereference detection removed - requires type resolution
        /*
        expect(() => {
          find_potential_null_dereferences(null );
        }).toThrow("accesses must be an array");
        */
      });

      it("should handle property chain validation and convert types to strings", () => {
        const mockReceiver = create_mock_node("identifier", "obj", 1, 0, 1, 3);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "finalProp",
            node_location: mockLocation,
            modifiers: {},
            context: {
              property_chain: ["obj", "123", "null", "finalProp"], // Mixed types converted to strings
            },
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].property_chain).toEqual([
          "obj",
          "123",
          "null",
          "finalProp",
        ]);
      });
    });

    describe("Optional Chaining Detection", () => {
      it("should detect optional chaining from context", () => {
        const mockReceiver = create_mock_node("identifier", "obj", 1, 0, 1, 3);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "optionalProp",
            node_location: mockLocation,
            modifiers: {},
            context: {
              receiver_node: mockReceiver,
            },
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].is_optional_chain).toBe(true);
      });

      it("should detect optional chaining with alternative context flags", () => {
        const mockReceiver = create_mock_node("identifier", "obj", 1, 0, 1, 3);

        const testCases = [
          { receiver_node: mockReceiver },
          { receiver_node: mockReceiver },
        ];

        for (const context of testCases) {
          const captures: NormalizedCapture[] = [
            {
              category: SemanticCategory.REFERENCE,
              entity: SemanticEntity.MEMBER_ACCESS,
              text: "optionalProp",
              node_location: mockLocation,
              modifiers: {},
              context,
            },
          ];

          const result = process_member_access_references(
            captures,
            mockScope,
            mockScopes,
            mockFilePath
          );

          expect(result[0].is_optional_chain).toBe(true);
        }
      });
    });

    describe("Computed Key Detection", () => {
      it("should detect computed key location from context", () => {
        const mockReceiver = create_mock_node("identifier", "obj", 1, 0, 1, 3);

        const mockComputedKeyNode = create_mock_node(
          "string",
          "key",
          2,
          5,
          2,
          10
        );

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "computedProp",
            node_location: mockLocation,
            modifiers: {},
            context: {
              receiver_node: mockReceiver,
              computed_key_node: mockComputedKeyNode,
              is_computed: true,
              bracket_notation: true,
            },
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].computed_key).toBeDefined();
        expect(result[0].computed_key?.start_line).toBe(1); // mocked by mockNodeToLocation
        expect(mockNodeToLocation).toHaveBeenCalledWith(
          mockComputedKeyNode,
          mockFilePath
        );
      });

      it("should handle missing computed key node", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "normalProp",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_member_access_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].computed_key).toBeUndefined();
      });
    });

    describe("Error Handling and Robustness", () => {
      it("should handle malformed captures gracefully", () => {
        const malformedCaptures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "validProp",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
          null as unknown as NormalizedCapture, // Malformed capture
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.MEMBER_ACCESS,
            text: "anotherValidProp",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_member_access_references(
          malformedCaptures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        // Should process valid captures and skip malformed ones
        expect(result).toHaveLength(2);
        expect(result[0].member_name).toBe("validProp");
        expect(result[1].member_name).toBe("anotherValidProp");
      });

      it("should handle null/undefined accesses in utility functions", () => {
        const accessesWithNulls: MemberAccessReference[] = [
          {
            location: mockLocation,
            member_name: "validProp" as SymbolName,
            scope_id: mockScope.id,
            access_type: "property",
            object: { location: mockLocation },
            is_optional_chain: false,
          },
          null as unknown as MemberAccessReference,
          {
            location: mockLocation,
            member_name: "anotherValidProp" as SymbolName,
            scope_id: mockScope.id,
            access_type: "method",
            object: { location: mockLocation },
            is_optional_chain: false,
          },
        ];

        // Should handle nulls gracefully
        expect(() => {
          const grouped = group_by_object(accessesWithNulls);
          const chains = find_property_chains(accessesWithNulls);
          // Type resolution and null checking moved to symbol_resolution Phase 3

          expect(grouped).toBeDefined();
          expect(chains).toBeDefined();
        }).not.toThrow();
      });
    });

    it("should demonstrate all bug fixes working together", () => {
      const mockReceiver = create_mock_node("identifier", "obj", 1, 0, 1, 3);

      const captures: NormalizedCapture[] = [
        // Method call via MEMBER_ACCESS entity (bug fix: access type detection)
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.MEMBER_ACCESS,
          text: "methodCall",
          node_location: mockLocation,
          modifiers: {},
          context: {
            receiver_node: mockReceiver,
            is_generic_call: false,
            property_chain: ["obj", "service", "methodCall"],
          },
        },
        // Index access (bug fix: access type detection)
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.MEMBER_ACCESS,
          text: "0",
          node_location: {
            ...mockLocation,
        start_line: 2,
          },
          modifiers: {},
          context: {
            receiver_node: mockReceiver,
          },
        },
      ];

      // Process with enhanced logic
      const accesses = process_member_access_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(accesses).toHaveLength(2);

      // Verify access type detection fixes
      expect(accesses[0].access_type).toBe("method");
      expect(accesses[0].is_optional_chain).toBe(true);
      expect(accesses[0].property_chain).toEqual([
        "obj",
        "service",
        "methodCall",
      ]);

      expect(accesses[1].access_type).toBe("index");
      expect(accesses[1].computed_key).toBeDefined();

      // Test improved grouping (bug fix: include file_path)
      const grouped = group_by_object(accesses);
      expect(grouped).toHaveLength(1); // Same file, same object location

      // Add objects from different files to test grouping fix
      const differentFileAccess: MemberAccessReference = {
        ...accesses[0],
        object: {
          location: {
            ...mockLocation,
            file_path: "different.ts" as FilePath,
          },
        },
      };

      const groupedWithDifferentFiles = group_by_object([
        ...accesses,
        differentFileAccess,
      ]);
      expect(groupedWithDifferentFiles).toHaveLength(2); // Different files = different groups
    });
  });
});

/**
 * Tests for static vs instance method resolution
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { MemberAccessReference } from "../../index_single_file/references/member_access_references/member_access_references";
import type { MethodLookupContext } from "./method_types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type {
  FilePath,
  Location,
  SymbolId,
  SymbolName,
  ScopeId,
  SymbolDefinition,
} from "@ariadnejs/types";
import {
  determine_if_static_call,
  get_method_kind,
  find_symbol_at_location,
} from "./static_resolution";

describe("static_resolution", () => {
  let mockContext: MethodLookupContext;
  let mockIndex: SemanticIndex;
  let mutableSymbols: Map<SymbolId, SymbolDefinition>;

  beforeEach(() => {
    mutableSymbols = new Map<SymbolId, SymbolDefinition>();

    mockIndex = {
      symbols: mutableSymbols as ReadonlyMap<SymbolId, SymbolDefinition>,
      references: {
        member_accesses: [],
        calls: [],
        returns: [],
        type_annotations: [],
        type_flow: [],
      },
      imports: [],
      exports: [],
      scope_tree: {},
      file_path: "/test.ts" as FilePath,
      language: "typescript",
      root_scope_id: "root" as ScopeId,
      scopes: new Map(),
      file_symbols_by_name: new Map(),
      constructor_definitions: [],
      type_annotations: [],
      type_flows: [],
      type_members: [],
      local_types: [],
      local_type_annotations: [],
      local_type_tracking: {
        annotations: [],
        declarations: [],
        assignments: [],
      },
      local_type_flow: {
        constructor_calls: [],
        assignments: [],
        returns: [],
        call_assignments: [],
      },
    } as SemanticIndex;

    mockContext = {
      type_resolution: {
        reference_types: new Map(),
        symbol_types: new Map(),
        type_members: new Map(),
        constructors: new Map(),
        inheritance_hierarchy: new Map(),
        interface_implementations: new Map(),
      },
      imports: new Map([["test.ts" as FilePath, new Map()]]),
      current_file: "/test.ts" as FilePath,
      current_index: mockIndex,
      indices: new Map(),
    };
  });

  describe("determine_if_static_call", () => {
    it("should return true when is_static flag is true", () => {
      const memberAccess: MemberAccessReference = {
        location: {} as Location,
        member_name: "staticMethod" as SymbolName,
        scope_id: "scope1" as ScopeId,
        access_type: "method",
        object: {},
        is_optional_chain: false,
        is_static: true,
      };

      const result = determine_if_static_call(memberAccess, mockContext);
      expect(result).toBe(true);
    });

    it("should return false when is_static flag is false", () => {
      const memberAccess: MemberAccessReference = {
        location: {} as Location,
        member_name: "instanceMethod" as SymbolName,
        scope_id: "scope1" as ScopeId,
        access_type: "method",
        object: {},
        is_optional_chain: false,
        is_static: false,
      };

      const result = determine_if_static_call(memberAccess, mockContext);
      expect(result).toBe(false);
    });

    it("should check object location for class/type/interface", () => {
      const classLocation: Location = {
        file_path: "test.ts" as FilePath,
        line: 10,
        column: 5,
        end_line: 10,
        end_column: 12,
      };

      const classSymbol: SymbolDefinition = {
        id: "MyClass" as SymbolId,
        name: "MyClass" as SymbolName,
        kind: "class",
        location: classLocation,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      };

      mutableSymbols.set("MyClass" as SymbolId, classSymbol);

      const memberAccess: MemberAccessReference = {
        location: {} as Location,
        member_name: "staticMethod" as SymbolName,
        scope_id: "scope1" as ScopeId,
        access_type: "method",
        object: { location: classLocation },
        is_optional_chain: false,
      };

      const result = determine_if_static_call(memberAccess, mockContext);
      expect(result).toBe(true);
    });

    it("should return true for type_alias symbol", () => {
      const typeLocation: Location = {
        file_path: "test.ts" as FilePath,
        line: 20,
        column: 5,
        end_line: 20,
        end_column: 11,
      };

      const typeSymbol: SymbolDefinition = {
        id: "MyType" as SymbolId,
        name: "MyType" as SymbolName,
        kind: "type_alias",
        location: typeLocation,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      };

      mutableSymbols.set("MyType" as SymbolId, typeSymbol);

      const memberAccess: MemberAccessReference = {
        location: {} as Location,
        member_name: "method" as SymbolName,
        scope_id: "scope1" as ScopeId,
        access_type: "method",
        object: { location: typeLocation },
        is_optional_chain: false,
      };

      const result = determine_if_static_call(memberAccess, mockContext);
      expect(result).toBe(true);
    });

    it("should return true for interface symbol", () => {
      const interfaceLocation: Location = {
        file_path: "test.ts" as FilePath,
        line: 30,
        column: 5,
        end_line: 30,
        end_column: 16,
      };

      const interfaceSymbol: SymbolDefinition = {
        id: "MyInterface" as SymbolId,
        name: "MyInterface" as SymbolName,
        kind: "interface",
        location: interfaceLocation,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      };

      mutableSymbols.set("MyInterface" as SymbolId, interfaceSymbol);

      const memberAccess: MemberAccessReference = {
        location: {} as Location,
        member_name: "method" as SymbolName,
        scope_id: "scope1" as ScopeId,
        access_type: "method",
        object: { location: interfaceLocation },
        is_optional_chain: false,
      };

      const result = determine_if_static_call(memberAccess, mockContext);
      expect(result).toBe(true);
    });

    it("should return false for instance variable symbol", () => {
      const varSymbol: SymbolDefinition = {
        id: "myInstance" as SymbolId,
        name: "myInstance" as SymbolName,
        kind: "variable",
        location: {} as Location,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      };

      mutableSymbols.set("myInstance" as SymbolId, varSymbol);

      const memberAccess: MemberAccessReference = {
        location: {} as Location,
        member_name: "instanceMethod" as SymbolName,
        scope_id: "scope1" as ScopeId,
        access_type: "method",
        object: {},
        is_optional_chain: false,
      };

      const result = determine_if_static_call(memberAccess, mockContext);
      expect(result).toBe(false);
    });
  });

  describe("get_method_kind", () => {
    it("should return constructor for constructor symbols", () => {
      const constructorSymbol: SymbolDefinition = {
        id: "constructor" as SymbolId,
        name: "constructor" as SymbolName,
        kind: "constructor",
        location: {} as Location,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      };

      mutableSymbols.set("constructor" as SymbolId, constructorSymbol);

      const result = get_method_kind("constructor" as SymbolId, mockContext);
      expect(result).toBe("constructor");
    });

    it("should return static for methods with static modifier", () => {
      const staticMethod: SymbolDefinition = {
        id: "staticMethod" as SymbolId,
        name: "staticMethod" as SymbolName,
        kind: "method",
        location: {} as Location,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
        is_static: true,
      };

      mutableSymbols.set("staticMethod" as SymbolId, staticMethod);

      const result = get_method_kind("staticMethod" as SymbolId, mockContext);
      expect(result).toBe("static");
    });

    it("should return instance for regular methods", () => {
      const instanceMethod: SymbolDefinition = {
        id: "instanceMethod" as SymbolId,
        name: "instanceMethod" as SymbolName,
        kind: "method",
        location: {} as Location,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      };

      mutableSymbols.set("instanceMethod" as SymbolId, instanceMethod);

      const result = get_method_kind("instanceMethod" as SymbolId, mockContext);
      expect(result).toBe("instance");
    });
  });

  describe("find_symbol_at_location", () => {
    it("should find symbol at matching location", () => {
      const location: Location = {
        file_path: "/test.ts" as FilePath,
        line: 10,
        column: 5,
        end_line: 10,
        end_column: 15,
      };

      const symbol: SymbolDefinition = {
        id: "mySymbol" as SymbolId,
        name: "mySymbol" as SymbolName,
        kind: "variable",
        location: location,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      };

      mutableSymbols.set("mySymbol" as SymbolId, symbol);

      const searchLocation: Location = {
        file_path: "/test.ts" as FilePath,
        line: 10,
        column: 8,
        end_line: 10,
        end_column: 12,
      };

      const result = find_symbol_at_location(searchLocation, mockContext);
      expect(result).toBe("mySymbol");
    });

    it("should return null for non-matching location", () => {
      const location: Location = {
        file_path: "/test.ts" as FilePath,
        line: 10,
        column: 5,
        end_line: 10,
        end_column: 15,
      };

      const symbol: SymbolDefinition = {
        id: "mySymbol" as SymbolId,
        name: "mySymbol" as SymbolName,
        kind: "variable",
        location: location,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      };

      mutableSymbols.set("mySymbol" as SymbolId, symbol);

      const searchLocation: Location = {
        file_path: "/test.ts" as FilePath,
        line: 20,
        column: 5,
        end_line: 20,
        end_column: 10,
      };

      const result = find_symbol_at_location(searchLocation, mockContext);
      expect(result).toBeNull();
    });

    it("should return null for undefined location", () => {
      const result = find_symbol_at_location(undefined, mockContext);
      expect(result).toBeNull();
    });
  });

  describe("Language-specific static detection", () => {
    describe("TypeScript/JavaScript", () => {
      it("should detect static method calls on capitalized identifiers", () => {
        const memberAccess: MemberAccessReference = {
          location: {} as Location,
          member_name: "create" as SymbolName,
          scope_id: "scope1" as ScopeId,
          access_type: "method",
          object: {},
          is_optional_chain: false,
          is_static: true, // Set by query pattern for capitalized identifiers
        };

        const result = determine_if_static_call(memberAccess, mockContext);
        expect(result).toBe(true);
      });

      it("should detect instance method calls on lowercase identifiers", () => {
        const memberAccess: MemberAccessReference = {
          location: {} as Location,
          member_name: "toString" as SymbolName,
          scope_id: "scope1" as ScopeId,
          access_type: "method",
          object: {},
          is_optional_chain: false,
          is_static: false, // Set by query pattern for lowercase identifiers
        };

        const result = determine_if_static_call(memberAccess, mockContext);
        expect(result).toBe(false);
      });
    });

    describe("Python", () => {
      it("should detect @staticmethod decorated methods", () => {
        const staticMethod: SymbolDefinition = {
          id: "static_method" as SymbolId,
          name: "static_method" as SymbolName,
          kind: "method",
          location: {} as Location,
          scope_id: "scope1" as ScopeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          is_static: true, // Set by Python decorator detection
        };

        mutableSymbols.set("static_method" as SymbolId, staticMethod);

        const memberAccess: MemberAccessReference = {
          location: {} as Location,
          member_name: "static_method" as SymbolName,
          scope_id: "scope1" as ScopeId,
          access_type: "method",
          object: {},
          is_optional_chain: false,
          is_static: true, // Set by context decorator detection
        };

        const result = determine_if_static_call(memberAccess, mockContext);
        expect(result).toBe(true);
      });

      it("should detect @classmethod decorated methods", () => {
        const classMethod: SymbolDefinition = {
          id: "class_method" as SymbolId,
          name: "class_method" as SymbolName,
          kind: "method",
          location: {} as Location,
          scope_id: "scope1" as ScopeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          is_static: true, // Class methods are treated as static
        };

        mutableSymbols.set("class_method" as SymbolId, classMethod);

        const memberAccess: MemberAccessReference = {
          location: {} as Location,
          member_name: "class_method" as SymbolName,
          scope_id: "scope1" as ScopeId,
          access_type: "method",
          object: {},
          is_optional_chain: false,
          is_static: true, // Set by context decorator detection
        };

        const result = determine_if_static_call(memberAccess, mockContext);
        expect(result).toBe(true);
      });
    });

    describe("Rust", () => {
      it("should detect associated functions (::)", () => {
        const memberAccess: MemberAccessReference = {
          location: {} as Location,
          member_name: "new" as SymbolName,
          scope_id: "scope1" as ScopeId,
          access_type: "method",
          object: {},
          is_optional_chain: false,
          is_static: true, // Set by Rust :: operator detection
        };

        const result = determine_if_static_call(memberAccess, mockContext);
        expect(result).toBe(true);
      });

      it("should detect instance methods (.)", () => {
        const memberAccess: MemberAccessReference = {
          location: {} as Location,
          member_name: "len" as SymbolName,
          scope_id: "scope1" as ScopeId,
          access_type: "method",
          object: {},
          is_optional_chain: false,
          is_static: false, // Set by Rust . operator detection
        };

        const result = determine_if_static_call(memberAccess, mockContext);
        expect(result).toBe(false);
      });
    });
  });

  describe("Same-named static and instance methods", () => {
    it("should distinguish between static and instance methods with same name", () => {
      const classLocation: Location = {
        file_path: "test.ts" as FilePath,
        line: 50,
        column: 5,
        end_line: 50,
        end_column: 12,
      };

      const classSymbol: SymbolDefinition = {
        id: "MyClass" as SymbolId,
        name: "MyClass" as SymbolName,
        kind: "class",
        location: classLocation,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
        members: ["instance_format" as SymbolId],
        static_members: ["static_format" as SymbolId],
      };

      const instanceMethod: SymbolDefinition = {
        id: "instance_format" as SymbolId,
        name: "format" as SymbolName,
        kind: "method",
        location: {} as Location,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      };

      const staticMethod: SymbolDefinition = {
        id: "static_format" as SymbolId,
        name: "format" as SymbolName,
        kind: "method",
        location: {} as Location,
        scope_id: "scope1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
        is_static: true,
      };

      mutableSymbols.set("MyClass" as SymbolId, classSymbol);
      mutableSymbols.set("instance_format" as SymbolId, instanceMethod);
      mutableSymbols.set("static_format" as SymbolId, staticMethod);

      // Static call
      const staticAccess: MemberAccessReference = {
        location: {} as Location,
        member_name: "format" as SymbolName,
        scope_id: "scope1" as ScopeId,
        access_type: "method",
        object: { location: classLocation },
        is_optional_chain: false,
      };

      expect(determine_if_static_call(staticAccess, mockContext)).toBe(true);

      // Instance call
      const instanceAccess: MemberAccessReference = {
        location: {} as Location,
        member_name: "format" as SymbolName,
        scope_id: "scope1" as ScopeId,
        access_type: "method",
        object: {},
        is_optional_chain: false,
        is_static: false,
      };

      expect(determine_if_static_call(instanceAccess, mockContext)).toBe(false);
    });
  });
});

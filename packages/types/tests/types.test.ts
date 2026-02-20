import { describe, it, expect } from "vitest";
import {
  create_namespace_name,
  LocalMemberInfo,
  LocalParameterInfo,
  is_reexport,
  Definition,
  FilePath,
  SymbolName,
  SymbolId,
  ScopeId,
} from "../src";

describe("@ariadnejs/types", () => {
  it("should export all required types", () => {
    // This test just ensures that TypeScript can import all the types
    // The actual type checking happens at compile time
    expect(true).toBe(true);
  });

  describe("Import/Export Factory Functions", () => {
    describe("create_namespace_name", () => {
      it("should create NamespaceName from string", () => {
        const namespace = create_namespace_name("MyNamespace");
        expect(namespace).toBe("MyNamespace");
        expect(typeof namespace).toBe("string");

        // Should work with special names
        const star_import = create_namespace_name("STAR_IMPORT");
        expect(star_import).toBe("STAR_IMPORT");
      });

      it("should handle empty strings", () => {
        const empty = create_namespace_name("");
        expect(empty).toBe("");
      });

      it("should handle special characters", () => {
        const special = create_namespace_name("namespace-with-dashes");
        expect(special).toBe("namespace-with-dashes");

        const with_dots = create_namespace_name("namespace.with.dots");
        expect(with_dots).toBe("namespace.with.dots");
      });
    });
  });

  describe("Unified LocalMemberInfo Interface", () => {
    it("should support all member kinds including constructor", () => {
      const method_member: LocalMemberInfo = {
        name: "testMethod" as SymbolName,
        kind: "method",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 10,
        },
        symbol_id: "test_symbol" as SymbolId,
        is_static: false,
        type_annotation: "string",
      };

      const constructor_member: LocalMemberInfo = {
        name: "constructor" as SymbolName,
        kind: "constructor",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 2,
          start_column: 0,
          end_line: 2,
          end_column: 15,
        },
        parameters: [
          {
            name: "param1" as SymbolName,
            type_annotation: "string",
            is_optional: false,
          },
        ],
      };

      const property_member: LocalMemberInfo = {
        name: "property" as SymbolName,
        kind: "property",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 3,
          start_column: 0,
          end_line: 3,
          end_column: 10,
        },
        is_static: true,
      };

      const field_member: LocalMemberInfo = {
        name: "field" as SymbolName,
        kind: "field",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 4,
          start_column: 0,
          end_line: 4,
          end_column: 8,
        },
      };

      const getter_member: LocalMemberInfo = {
        name: "getter" as SymbolName,
        kind: "getter",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 5,
          start_column: 0,
          end_line: 5,
          end_column: 10,
        },
      };

      const setter_member: LocalMemberInfo = {
        name: "setter" as SymbolName,
        kind: "setter",
        location: {
          file_path: "test.ts" as FilePath,
          start_line: 6,
          start_column: 0,
          end_line: 6,
          end_column: 10,
        },
      };

      // Verify all kinds are accepted
      expect(method_member.kind).toBe("method");
      expect(constructor_member.kind).toBe("constructor");
      expect(property_member.kind).toBe("property");
      expect(field_member.kind).toBe("field");
      expect(getter_member.kind).toBe("getter");
      expect(setter_member.kind).toBe("setter");

      // Verify optional fields work
      expect(method_member.symbol_id).toBe("test_symbol" as SymbolId);
      expect(method_member.is_static).toBe(false);
      expect(method_member.type_annotation).toBe("string");
      expect(constructor_member.parameters).toHaveLength(1);
      expect(property_member.is_static).toBe(true);
    });
  });

  describe("LocalParameterInfo Interface", () => {
    it("should support all parameter features", () => {
      const basic_param: LocalParameterInfo = {
        name: "basicParam" as SymbolName  ,
        type_annotation: "string",
      };

      const optional_param: LocalParameterInfo = {
        name: "optionalParam" as SymbolName,
        type_annotation: "number",
        is_optional: true,
      };

      const rest_param: LocalParameterInfo = {
        name: "restParam" as SymbolName,
        type_annotation: "string[]",
        is_rest: true,
      };

      const default_param: LocalParameterInfo = {
        name: "defaultParam" as SymbolName,
        type_annotation: "boolean",
        is_optional: true,
        default_value: "true",
      };

      expect(basic_param.name).toBe("basicParam");
      expect(optional_param.is_optional).toBe(true);
      expect(rest_param.is_rest).toBe(true);
      expect(default_param.default_value).toBe("true");
    });
  });

  describe("Export Helper Functions", () => {
    const create_mock_definition = (overrides: Partial<Definition>): Definition => ({
      kind: "function",
      symbol_id: "function:test:test.ts:1:0" as SymbolId,
      name: "testFunc" as SymbolName,
      defining_scope_id: "module:test.ts:1:1:10:1" as ScopeId,
      location: {
        file_path: "test.ts" as FilePath,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 10,
      },
      ...overrides,
    });


    describe("is_reexport", () => {
      it("should return true for re-exports", () => {
        const def = create_mock_definition({
          export: { is_reexport: true },
        });
        expect(is_reexport(def)).toBe(true);
      });

      it("should return false for non-reexports", () => {
        const def = create_mock_definition({
          export: { is_reexport: false },
        });
        expect(is_reexport(def)).toBe(false);
      });

      it("should return false when export metadata is missing", () => {
        const def = create_mock_definition({});
        expect(is_reexport(def)).toBe(false);
      });
    });

  });
});

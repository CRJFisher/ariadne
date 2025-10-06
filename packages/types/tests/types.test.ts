import { describe, it, expect } from "vitest";
import {
  create_namespace_name,
  LocalMemberInfo,
  LocalParameterInfo,
  is_exported_definition,
  has_export_alias,
  is_default_export,
  is_reexport,
  get_export_name,
  Definition,
  ExportMetadata,
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
        const starImport = create_namespace_name("STAR_IMPORT");
        expect(starImport).toBe("STAR_IMPORT");
      });

      it("should handle empty strings", () => {
        const empty = create_namespace_name("");
        expect(empty).toBe("");
      });

      it("should handle special characters", () => {
        const special = create_namespace_name("namespace-with-dashes");
        expect(special).toBe("namespace-with-dashes");

        const withDots = create_namespace_name("namespace.with.dots");
        expect(withDots).toBe("namespace.with.dots");
      });
    });
  });

  describe("Unified LocalMemberInfo Interface", () => {
    it("should support all member kinds including constructor", () => {
      const methodMember: LocalMemberInfo = {
        name: "testMethod",
        kind: "method",
        location: {
          file_path: "test.ts",
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 10,
        },
        symbol_id: "test_symbol",
        is_static: false,
        type_annotation: "string",
      };

      const constructorMember: LocalMemberInfo = {
        name: "constructor",
        kind: "constructor",
        location: {
          file_path: "test.ts",
          start_line: 2,
          start_column: 0,
          end_line: 2,
          end_column: 15,
        },
        parameters: [
          {
            name: "param1",
            type_annotation: "string",
            is_optional: false,
          },
        ],
      };

      const propertyMember: LocalMemberInfo = {
        name: "property",
        kind: "property",
        location: {
          file_path: "test.ts",
          start_line: 3,
          start_column: 0,
          end_line: 3,
          end_column: 10,
        },
        is_static: true,
      };

      const fieldMember: LocalMemberInfo = {
        name: "field",
        kind: "field",
        location: {
          file_path: "test.ts",
          start_line: 4,
          start_column: 0,
          end_line: 4,
          end_column: 8,
        },
      };

      const getterMember: LocalMemberInfo = {
        name: "getter",
        kind: "getter",
        location: {
          file_path: "test.ts",
          start_line: 5,
          start_column: 0,
          end_line: 5,
          end_column: 10,
        },
      };

      const setterMember: LocalMemberInfo = {
        name: "setter",
        kind: "setter",
        location: {
          file_path: "test.ts",
          start_line: 6,
          start_column: 0,
          end_line: 6,
          end_column: 10,
        },
      };

      // Verify all kinds are accepted
      expect(methodMember.kind).toBe("method");
      expect(constructorMember.kind).toBe("constructor");
      expect(propertyMember.kind).toBe("property");
      expect(fieldMember.kind).toBe("field");
      expect(getterMember.kind).toBe("getter");
      expect(setterMember.kind).toBe("setter");

      // Verify optional fields work
      expect(methodMember.symbol_id).toBe("test_symbol");
      expect(methodMember.is_static).toBe(false);
      expect(methodMember.type_annotation).toBe("string");
      expect(constructorMember.parameters).toHaveLength(1);
      expect(propertyMember.is_static).toBe(true);
    });
  });

  describe("LocalParameterInfo Interface", () => {
    it("should support all parameter features", () => {
      const basicParam: LocalParameterInfo = {
        name: "basicParam",
        type_annotation: "string",
      };

      const optionalParam: LocalParameterInfo = {
        name: "optionalParam",
        type_annotation: "number",
        is_optional: true,
      };

      const restParam: LocalParameterInfo = {
        name: "restParam",
        type_annotation: "string[]",
        is_rest: true,
      };

      const defaultParam: LocalParameterInfo = {
        name: "defaultParam",
        type_annotation: "boolean",
        is_optional: true,
        default_value: "true",
      };

      expect(basicParam.name).toBe("basicParam");
      expect(optionalParam.is_optional).toBe(true);
      expect(restParam.is_rest).toBe(true);
      expect(defaultParam.default_value).toBe("true");
    });
  });

  describe("Export Helper Functions", () => {
    const create_mock_definition = (overrides: Partial<Definition>): Definition => ({
      kind: "function",
      symbol_id: "function:test:test.ts:1:0" as any,
      name: "testFunc" as any,
      defining_scope_id: "module:test.ts:1:1:10:1" as any,
      location: {
        file_path: "test.ts",
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 10,
      },
      availability: {
        scope: "file-private",
      },
      is_exported: false,
      ...overrides,
    });

    describe("is_exported_definition", () => {
      it("should return true for exported definitions", () => {
        const def = create_mock_definition({ is_exported: true });
        expect(is_exported_definition(def)).toBe(true);
      });

      it("should return false for non-exported definitions", () => {
        const def = create_mock_definition({ is_exported: false });
        expect(is_exported_definition(def)).toBe(false);
      });
    });

    describe("has_export_alias", () => {
      it("should return true when export has an alias", () => {
        const def = create_mock_definition({
          is_exported: true,
          export: { export_name: "aliasName" as any },
        });
        expect(has_export_alias(def)).toBe(true);
      });

      it("should return false when export has no alias", () => {
        const def = create_mock_definition({
          is_exported: true,
          export: {},
        });
        expect(has_export_alias(def)).toBe(false);
      });

      it("should return false when not exported", () => {
        const def = create_mock_definition({ is_exported: false });
        expect(has_export_alias(def)).toBe(false);
      });
    });

    describe("is_default_export", () => {
      it("should return true for default exports", () => {
        const def = create_mock_definition({
          is_exported: true,
          export: { is_default: true },
        });
        expect(is_default_export(def)).toBe(true);
      });

      it("should return false for non-default exports", () => {
        const def = create_mock_definition({
          is_exported: true,
          export: { is_default: false },
        });
        expect(is_default_export(def)).toBe(false);
      });

      it("should return false when export metadata is missing", () => {
        const def = create_mock_definition({ is_exported: true });
        expect(is_default_export(def)).toBe(false);
      });
    });

    describe("is_reexport", () => {
      it("should return true for re-exports", () => {
        const def = create_mock_definition({
          is_exported: true,
          export: { is_reexport: true },
        });
        expect(is_reexport(def)).toBe(true);
      });

      it("should return false for non-reexports", () => {
        const def = create_mock_definition({
          is_exported: true,
          export: { is_reexport: false },
        });
        expect(is_reexport(def)).toBe(false);
      });

      it("should return false when export metadata is missing", () => {
        const def = create_mock_definition({ is_exported: true });
        expect(is_reexport(def)).toBe(false);
      });
    });

    describe("get_export_name", () => {
      it("should return alias when export has one", () => {
        const def = create_mock_definition({
          name: "originalName" as any,
          is_exported: true,
          export: { export_name: "aliasName" as any },
        });
        expect(get_export_name(def)).toBe("aliasName");
      });

      it("should return original name when no alias", () => {
        const def = create_mock_definition({
          name: "originalName" as any,
          is_exported: true,
          export: {},
        });
        expect(get_export_name(def)).toBe("originalName");
      });

      it("should return original name when not exported", () => {
        const def = create_mock_definition({
          name: "originalName" as any,
          is_exported: false,
        });
        expect(get_export_name(def)).toBe("originalName");
      });
    });
  });
});

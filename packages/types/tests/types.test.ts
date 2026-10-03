import { describe, it, expect } from "vitest";
import {
  create_namespace_name,
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

/**
 * Tests for SemanticIndex serialization/deserialization
 */

import { describe, it, expect } from "vitest";
import type { FilePath, Language, ScopeId, SymbolId } from "@ariadnejs/types";
import type { SemanticIndex } from "../../src/index_single_file/index_single_file";
import {
  index_single_file_to_json,
  json_to_index_single_file,
  index_single_file_to_json_string,
  json_string_to_index_single_file,
  type SemanticIndexJSON,
} from "./index_single_file_json";

describe("SemanticIndex Serialization", () => {
  describe("Round-trip serialization", () => {
    it("should serialize and deserialize minimal index without loss", () => {
      const minimal_index: SemanticIndex = {
        file_path: "test.ts" as FilePath,
        language: "typescript" as Language,
        root_scope_id: "scope:test.ts:module" as ScopeId,
        scopes: new Map([
          [
            "scope:test.ts:module" as ScopeId,
            {
              id: "scope:test.ts:module" as ScopeId,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: "test.ts" as FilePath,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 0,
              },
              child_ids: [],
            },
          ],
        ]),
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        interfaces: new Map(),
        enums: new Map(),
        namespaces: new Map(),
        types: new Map(),
        imported_symbols: new Map(),
        references: [],
      };

      const json = index_single_file_to_json(minimal_index);
      const deserialized = json_to_index_single_file(json);

      expect(deserialized.file_path).toBe(minimal_index.file_path);
      expect(deserialized.language).toBe(minimal_index.language);
      expect(deserialized.root_scope_id).toBe(minimal_index.root_scope_id);
      expect(deserialized.scopes.size).toBe(1);
      expect(deserialized.functions.size).toBe(0);
      expect(deserialized.classes.size).toBe(0);
      expect(deserialized.references.length).toBe(0);
    });

    it("should serialize and deserialize index with function without loss", () => {
      const index_with_function: SemanticIndex = {
        file_path: "test.ts" as FilePath,
        language: "typescript" as Language,
        root_scope_id: "scope:test.ts:module" as ScopeId,
        scopes: new Map([
          [
            "scope:test.ts:module" as ScopeId,
            {
              id: "scope:test.ts:module" as ScopeId,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: "test.ts" as FilePath,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 1,
              },
              child_ids: ["scope:test.ts:function:foo" as ScopeId],
            },
          ],
          [
            "scope:test.ts:function:foo" as ScopeId,
            {
              id: "scope:test.ts:function:foo" as ScopeId,
              type: "function",
              parent_id: "scope:test.ts:module" as ScopeId,
              name: "foo",
              location: {
                file_path: "test.ts" as FilePath,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 1,
              },
              child_ids: [],
            },
          ],
        ]),
        functions: new Map([
          [
            "function:test.ts:foo:1:0" as SymbolId,
            {
              kind: "function",
              symbol_id: "function:test.ts:foo:1:0" as SymbolId,
              name: "foo",
              scope_id: "scope:test.ts:module" as ScopeId,
              defining_scope_id: "scope:test.ts:module" as ScopeId,
              body_scope_id: "scope:test.ts:function:foo" as ScopeId,
              location: {
                file_path: "test.ts" as FilePath,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 1,
              },
              parameters: [],
              is_exported: false,
              signature: {
                parameters: [],
              },
            },
          ],
        ]),
        classes: new Map(),
        variables: new Map(),
        interfaces: new Map(),
        enums: new Map(),
        namespaces: new Map(),
        types: new Map(),
        imported_symbols: new Map(),
        references: [],
      };

      const json = index_single_file_to_json(index_with_function);
      const deserialized = json_to_index_single_file(json);

      expect(deserialized.functions.size).toBe(1);
      expect(deserialized.scopes.size).toBe(2);

      const func = deserialized.functions.get(
        "function:test.ts:foo:1:0" as SymbolId
      );
      expect(func).toBeDefined();
      expect(func?.name).toBe("foo");
      expect(func?.kind).toBe("function");
      expect(func?.is_exported).toBe(false);
    });

    it("should handle string serialization round-trip", () => {
      const minimal_index: SemanticIndex = {
        file_path: "test.ts" as FilePath,
        language: "typescript" as Language,
        root_scope_id: "scope:test.ts:module" as ScopeId,
        scopes: new Map([
          [
            "scope:test.ts:module" as ScopeId,
            {
              id: "scope:test.ts:module" as ScopeId,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: "test.ts" as FilePath,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 0,
              },
              child_ids: [],
            },
          ],
        ]),
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        interfaces: new Map(),
        enums: new Map(),
        namespaces: new Map(),
        types: new Map(),
        imported_symbols: new Map(),
        references: [],
      };

      const json_string = index_single_file_to_json_string(minimal_index);
      expect(typeof json_string).toBe("string");
      expect(json_string.includes("\"file_path\"")).toBe(true);

      const deserialized = json_string_to_index_single_file(json_string);
      expect(deserialized.file_path).toBe(minimal_index.file_path);
      expect(deserialized.language).toBe(minimal_index.language);
    });
  });

  describe("Empty collections", () => {
    it("should serialize empty maps as empty objects", () => {
      const minimal_index: SemanticIndex = {
        file_path: "test.ts" as FilePath,
        language: "typescript" as Language,
        root_scope_id: "scope:test.ts:module" as ScopeId,
        scopes: new Map([
          [
            "scope:test.ts:module" as ScopeId,
            {
              id: "scope:test.ts:module" as ScopeId,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: "test.ts" as FilePath,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 0,
              },
              child_ids: [],
            },
          ],
        ]),
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        interfaces: new Map(),
        enums: new Map(),
        namespaces: new Map(),
        types: new Map(),
        imported_symbols: new Map(),
        references: [],
      };

      const json = index_single_file_to_json(minimal_index);

      expect(json.functions).toEqual({});
      expect(json.classes).toEqual({});
      expect(json.variables).toEqual({});
      expect(json.interfaces).toEqual({});
      expect(json.enums).toEqual({});
      expect(json.namespaces).toEqual({});
      expect(json.types).toEqual({});
      expect(json.imported_symbols).toEqual({});
      expect(json.references).toEqual([]);
    });

    it("should deserialize empty objects as empty maps", () => {
      const json: SemanticIndexJSON = {
        file_path: "test.ts",
        language: "typescript",
        root_scope_id: "scope:test.ts:module",
        scopes: {
          "scope:test.ts:module": {
            id: "scope:test.ts:module" as ScopeId,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: "test.ts" as FilePath,
              start_line: 1,
              start_column: 0,
              end_line: 1,
              end_column: 0,
            },
            child_ids: [],
          },
        },
        functions: {},
        classes: {},
        variables: {},
        interfaces: {},
        enums: {},
        namespaces: {},
        types: {},
        imported_symbols: {},
        references: [],
      };

      const deserialized = json_to_index_single_file(json);

      expect(deserialized.functions.size).toBe(0);
      expect(deserialized.classes.size).toBe(0);
      expect(deserialized.variables.size).toBe(0);
      expect(deserialized.interfaces.size).toBe(0);
      expect(deserialized.enums.size).toBe(0);
      expect(deserialized.namespaces.size).toBe(0);
      expect(deserialized.types.size).toBe(0);
      expect(deserialized.imported_symbols.size).toBe(0);
      expect(deserialized.references.length).toBe(0);
    });
  });

  describe("JSON format validation", () => {
    it("should produce pretty-printed JSON with 2-space indentation", () => {
      const minimal_index: SemanticIndex = {
        file_path: "test.ts" as FilePath,
        language: "typescript" as Language,
        root_scope_id: "scope:test.ts:module" as ScopeId,
        scopes: new Map([
          [
            "scope:test.ts:module" as ScopeId,
            {
              id: "scope:test.ts:module" as ScopeId,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: "test.ts" as FilePath,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 0,
              },
              child_ids: [],
            },
          ],
        ]),
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        interfaces: new Map(),
        enums: new Map(),
        namespaces: new Map(),
        types: new Map(),
        imported_symbols: new Map(),
        references: [],
      };

      const json_string = index_single_file_to_json_string(minimal_index);

      // Check for 2-space indentation
      expect(json_string).toContain("  \"file_path\"");
      expect(json_string).toContain("  \"language\"");

      // Check it's valid JSON
      expect(() => JSON.parse(json_string)).not.toThrow();
    });

    it("should include all required fields in JSON", () => {
      const minimal_index: SemanticIndex = {
        file_path: "test.ts" as FilePath,
        language: "typescript" as Language,
        root_scope_id: "scope:test.ts:module" as ScopeId,
        scopes: new Map(),
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        interfaces: new Map(),
        enums: new Map(),
        namespaces: new Map(),
        types: new Map(),
        imported_symbols: new Map(),
        references: [],
      };

      const json = index_single_file_to_json(minimal_index);

      // Verify all 13 required fields are present
      expect(json).toHaveProperty("file_path");
      expect(json).toHaveProperty("language");
      expect(json).toHaveProperty("root_scope_id");
      expect(json).toHaveProperty("scopes");
      expect(json).toHaveProperty("functions");
      expect(json).toHaveProperty("classes");
      expect(json).toHaveProperty("variables");
      expect(json).toHaveProperty("interfaces");
      expect(json).toHaveProperty("enums");
      expect(json).toHaveProperty("namespaces");
      expect(json).toHaveProperty("types");
      expect(json).toHaveProperty("imported_symbols");
      expect(json).toHaveProperty("references");
    });
  });
});

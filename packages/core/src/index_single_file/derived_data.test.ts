/**
 * Tests for DerivedData extraction from SemanticIndex
 *
 * Verifies that build_derived_data() correctly extracts and indexes:
 * - scope_to_definitions
 * - exported_symbols
 * - type_bindings
 * - type_members
 * - type_alias_metadata
 */

import { describe, it, expect } from "vitest";
import { build_derived_data } from "./derived_data";
import type { SemanticIndex } from "./semantic_index";
import type {
  FilePath,
  SymbolId,
  ScopeId,
  SymbolName,
  FunctionDefinition,
  ClassDefinition,
  VariableDefinition,
  InterfaceDefinition,
  MethodDefinition,
  PropertyDefinition,
  Location,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";

// Helper to create minimal SemanticIndex for testing
function create_test_semantic_index(
  file_path: FilePath,
  overrides: Partial<SemanticIndex> = {}
): SemanticIndex {
  const root_scope_id = `scope:${file_path}:module` as ScopeId;

  return {
    file_path,
    language: "typescript",
    root_scope_id,
    scopes: new Map([
      [
        root_scope_id,
        {
          id: root_scope_id,
          type: "module",
          parent_id: null,
          name: null,
          location: {
            file_path,
            start_line: 1,
            start_column: 0,
            end_line: 100,
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
    ...overrides,
  };
}

describe("build_derived_data", () => {
  const file_path = "/test/file.ts" as FilePath;
  const root_scope = `scope:${file_path}:module` as ScopeId;

  describe("scope_to_definitions", () => {
    it("should index functions by scope", () => {
      const func_id = "fn:test:foo:1:0" as SymbolId;
      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        signature: { parameters: [] },
        is_exported: false,
      };

      const index = create_test_semantic_index(file_path, {
        functions: new Map([[func_id, func]]),
      });

      const derived = build_derived_data(index);

      expect(derived.scope_to_definitions.has(root_scope)).toBe(true);
      const scope_defs = derived.scope_to_definitions.get(root_scope);
      expect(scope_defs?.has("function")).toBe(true);

      const functions = scope_defs?.get("function");
      expect(functions).toHaveLength(1);
      expect(functions?.[0].symbol_id).toBe(func_id);
    });

    it("should index classes by scope", () => {
      const class_id = "class:test:Foo:1:0" as SymbolId;
      const cls: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        methods: [],
        properties: [],
        extends: [],
        decorators: [],
        constructor: [],
        is_exported: false,
      };

      const index = create_test_semantic_index(file_path, {
        classes: new Map([[class_id, cls]]),
      });

      const derived = build_derived_data(index);

      const scope_defs = derived.scope_to_definitions.get(root_scope);
      expect(scope_defs?.has("class")).toBe(true);

      const classes = scope_defs?.get("class");
      expect(classes).toHaveLength(1);
      expect(classes?.[0].symbol_id).toBe(class_id);
    });

    it("should index variables by scope", () => {
      const var_id = "var:test:x:1:6" as SymbolId;
      const variable: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "x" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path,
          start_line: 1,
          start_column: 6,
          end_line: 1,
          end_column: 7,
        },
        is_exported: false,
      };

      const index = create_test_semantic_index(file_path, {
        variables: new Map([[var_id, variable]]),
      });

      const derived = build_derived_data(index);

      const scope_defs = derived.scope_to_definitions.get(root_scope);
      expect(scope_defs?.has("variable")).toBe(true);

      const variables = scope_defs?.get("variable");
      expect(variables).toHaveLength(1);
      expect(variables?.[0].symbol_id).toBe(var_id);
    });

    it("should group multiple definitions by kind", () => {
      const func1_id = "fn:test:foo:1:0" as SymbolId;
      const func2_id = "fn:test:bar:5:0" as SymbolId;

      const func1: FunctionDefinition = {
        kind: "function",
        symbol_id: func1_id,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: { file_path, start_line: 1, start_column: 0, end_line: 3, end_column: 1 },
        signature: { parameters: [] },
        is_exported: false,
      };

      const func2: FunctionDefinition = {
        kind: "function",
        symbol_id: func2_id,
        name: "bar" as SymbolName,
        defining_scope_id: root_scope,
        location: { file_path, start_line: 5, start_column: 0, end_line: 7, end_column: 1 },
        signature: { parameters: [] },
        is_exported: false,
      };

      const index = create_test_semantic_index(file_path, {
        functions: new Map([
          [func1_id, func1],
          [func2_id, func2],
        ]),
      });

      const derived = build_derived_data(index);

      const functions = derived.scope_to_definitions.get(root_scope)?.get("function");
      expect(functions).toHaveLength(2);
      expect(functions?.map(f => f.symbol_id)).toEqual([func1_id, func2_id]);
    });
  });

  describe("exported_symbols", () => {
    it("should index exported functions by name", () => {
      const func_id = "fn:test:foo:1:0" as SymbolId;
      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: { file_path, start_line: 1, start_column: 0, end_line: 3, end_column: 1 },
        signature: { parameters: [] },
        is_exported: true,
      };

      const index = create_test_semantic_index(file_path, {
        functions: new Map([[func_id, func]]),
      });

      const derived = build_derived_data(index);

      expect(derived.exported_symbols.has("foo" as SymbolName)).toBe(true);
      expect(derived.exported_symbols.get("foo" as SymbolName)?.symbol_id).toBe(func_id);
    });

    it("should index exported classes by name", () => {
      const class_id = "class:test:Foo:1:0" as SymbolId;
      const cls: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Foo" as SymbolName,
        defining_scope_id: root_scope,
        location: { file_path, start_line: 1, start_column: 0, end_line: 5, end_column: 1 },
        methods: [],
        properties: [],
        extends: [],
        decorators: [],
        constructor: [],
        is_exported: true,
      };

      const index = create_test_semantic_index(file_path, {
        classes: new Map([[class_id, cls]]),
      });

      const derived = build_derived_data(index);

      expect(derived.exported_symbols.has("Foo" as SymbolName)).toBe(true);
      expect(derived.exported_symbols.get("Foo" as SymbolName)?.symbol_id).toBe(class_id);
    });

    it("should NOT index non-exported symbols", () => {
      const func_id = "fn:test:foo:1:0" as SymbolId;
      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: { file_path, start_line: 1, start_column: 0, end_line: 3, end_column: 1 },
        signature: { parameters: [] },
        is_exported: false, // NOT exported
      };

      const index = create_test_semantic_index(file_path, {
        functions: new Map([[func_id, func]]),
      });

      const derived = build_derived_data(index);

      expect(derived.exported_symbols.has("foo" as SymbolName)).toBe(false);
    });

    it("should use export alias when present", () => {
      const func_id = "fn:test:internalFoo:1:0" as SymbolId;
      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "internalFoo" as SymbolName,
        defining_scope_id: root_scope,
        location: { file_path, start_line: 1, start_column: 0, end_line: 3, end_column: 1 },
        signature: { parameters: [] },
        is_exported: true,
        export: {
          export_name: "foo" as SymbolName,
          is_default: false,
          is_reexport: false,
        },
      };

      const index = create_test_semantic_index(file_path, {
        functions: new Map([[func_id, func]]),
      });

      const derived = build_derived_data(index);

      // Should be indexed by export alias, not internal name
      expect(derived.exported_symbols.has("foo" as SymbolName)).toBe(true);
      expect(derived.exported_symbols.has("internalFoo" as SymbolName)).toBe(false);
      expect(derived.exported_symbols.get("foo" as SymbolName)?.symbol_id).toBe(func_id);
    });
  });

  describe("type_bindings", () => {
    it("should extract type bindings from variable annotations", () => {
      const var_id = "var:test:x:1:6" as SymbolId;
      const var_location: Location = {
        file_path,
        start_line: 1,
        start_column: 6,
        end_line: 1,
        end_column: 7,
      };

      const variable: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "x" as SymbolName,
        defining_scope_id: root_scope,
        location: var_location,
        type: "string" as SymbolName, // Use 'type' field, not 'type_annotation'
        is_exported: false,
      };

      const index = create_test_semantic_index(file_path, {
        variables: new Map([[var_id, variable]]),
      });

      const derived = build_derived_data(index);

      const loc_key = location_key(var_location);
      expect(derived.type_bindings.has(loc_key)).toBe(true);
      expect(derived.type_bindings.get(loc_key)).toBe("string" as SymbolName);
    });
  });

  describe("type_members", () => {
    it("should extract methods from classes", () => {
      const class_id = "class:test:Foo:1:0" as SymbolId;
      const method_id = "method:test:Foo:bar:3:2" as SymbolId;

      const method: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "bar" as SymbolName,
        defining_scope_id: class_id as unknown as ScopeId,
        location: { file_path, start_line: 3, start_column: 2, end_line: 5, end_column: 3 },
        parameters: [],
        parent_class: class_id,
        is_exported: false,
      };

      const cls: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Foo" as SymbolName,
        defining_scope_id: root_scope,
        location: { file_path, start_line: 1, start_column: 0, end_line: 6, end_column: 1 },
        methods: [method],
        properties: [],
        extends: [],
        decorators: [],
        constructor: [],
        is_exported: false,
      };

      const index = create_test_semantic_index(file_path, {
        classes: new Map([[class_id, cls]]),
      });

      const derived = build_derived_data(index);

      expect(derived.type_members.has(class_id)).toBe(true);
      const members = derived.type_members.get(class_id);
      expect(members?.methods.has("bar" as SymbolName)).toBe(true);
      expect(members?.methods.get("bar" as SymbolName)).toBe(method_id);
    });

    it("should extract properties from classes", () => {
      const class_id = "class:test:Foo:1:0" as SymbolId;
      const prop_id = "property:test:Foo:value:3:2" as SymbolId;

      const property: PropertyDefinition = {
        kind: "property",
        symbol_id: prop_id,
        name: "value" as SymbolName,
        defining_scope_id: class_id as unknown as ScopeId,
        location: { file_path, start_line: 3, start_column: 2, end_line: 3, end_column: 20 },
        type: "number" as SymbolName,
        initial_value: "0",
        decorators: [],
        is_exported: false,
      };

      const cls: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Foo" as SymbolName,
        defining_scope_id: root_scope,
        location: { file_path, start_line: 1, start_column: 0, end_line: 4, end_column: 1 },
        methods: [],
        properties: [property],
        extends: [],
        decorators: [],
        constructor: [],
        is_exported: false,
      };

      const index = create_test_semantic_index(file_path, {
        classes: new Map([[class_id, cls]]),
      });

      const derived = build_derived_data(index);

      expect(derived.type_members.has(class_id)).toBe(true);
      const members = derived.type_members.get(class_id);
      expect(members?.properties.has("value" as SymbolName)).toBe(true);
      expect(members?.properties.get("value" as SymbolName)).toBe(prop_id);
    });
  });

  describe("type_alias_metadata", () => {
    it("should extract type expression from type aliases", () => {
      const type_id = "type:test:Foo:1:5" as SymbolId;
      const type_alias = {
        kind: "type_alias" as const,
        symbol_id: type_id,
        name: "Foo" as SymbolName,
        defining_scope_id: root_scope,
        location: { file_path, start_line: 1, start_column: 5, end_line: 1, end_column: 25 },
        type_expression: "{ x: number }",
        is_exported: false,
      };

      const index = create_test_semantic_index(file_path, {
        types: new Map([[type_id, type_alias]]),
      });

      const derived = build_derived_data(index);

      expect(derived.type_alias_metadata.has(type_id)).toBe(true);
      expect(derived.type_alias_metadata.get(type_id)).toBe("{ x: number }");
    });
  });

  describe("integration", () => {
    it("should extract all derived data fields correctly", () => {
      const func_id = "fn:test:foo:1:0" as SymbolId;
      const class_id = "class:test:Bar:5:0" as SymbolId;
      const method_id = "method:test:Bar:baz:7:2" as SymbolId;

      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: { file_path, start_line: 1, start_column: 0, end_line: 3, end_column: 1 },
        signature: { parameters: [] },
        is_exported: true,
      };

      const method: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "baz" as SymbolName,
        defining_scope_id: class_id as unknown as ScopeId,
        location: { file_path, start_line: 7, start_column: 2, end_line: 9, end_column: 3 },
        parameters: [],
        parent_class: class_id,
        is_exported: false,
      };

      const cls: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Bar" as SymbolName,
        defining_scope_id: root_scope,
        location: { file_path, start_line: 5, start_column: 0, end_line: 10, end_column: 1 },
        methods: [method],
        properties: [],
        extends: [],
        decorators: [],
        constructor: [],
        is_exported: true,
      };

      const index = create_test_semantic_index(file_path, {
        functions: new Map([[func_id, func]]),
        classes: new Map([[class_id, cls]]),
      });

      const derived = build_derived_data(index);

      // Verify file_path is preserved
      expect(derived.file_path).toBe(file_path);

      // Verify scope_to_definitions
      expect(derived.scope_to_definitions.has(root_scope)).toBe(true);
      expect(derived.scope_to_definitions.get(root_scope)?.get("function")).toHaveLength(1);
      expect(derived.scope_to_definitions.get(root_scope)?.get("class")).toHaveLength(1);

      // Verify exported_symbols
      expect(derived.exported_symbols.size).toBe(2);
      expect(derived.exported_symbols.has("foo" as SymbolName)).toBe(true);
      expect(derived.exported_symbols.has("Bar" as SymbolName)).toBe(true);

      // Verify type_members
      expect(derived.type_members.has(class_id)).toBe(true);
      expect(derived.type_members.get(class_id)?.methods.size).toBe(1);
    });
  });
});

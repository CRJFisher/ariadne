import { describe, it, expect, beforeEach } from "vitest";
import { DefinitionRegistry } from "./definition_registry";
import { function_symbol, variable_symbol, class_symbol } from "@ariadnejs/types";
import type {
  FunctionDefinition,
  VariableDefinition,
  ClassDefinition,
  ImportDefinition,
  FilePath,
  ScopeId,
  SymbolName,
  SymbolId,
} from "@ariadnejs/types";

describe("DefinitionRegistry", () => {
  let registry: DefinitionRegistry;

  beforeEach(() => {
    registry = new DefinitionRegistry();
  });

  describe("update_file", () => {
    it("should add definitions from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });
      const var_id = variable_symbol("x", file1, { line: 2, column: 0 });

      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      const variable: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "x" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 0,
          end_line: 2,
          end_column: 1,
        },
        is_exported: false,
      };

      registry.update_file(file1, [func, variable]);

      expect(registry.get(func_id)).toEqual(func);
      expect(registry.get(var_id)).toEqual(variable);
      expect(registry.size()).toBe(2);
    });

    it("should replace definitions when file is updated", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const func_id_v1 = function_symbol("foo", file1, { line: 1, column: 0 });
      const func_id_v2 = function_symbol("bar", file1, { line: 1, column: 0 });

      const func_v1: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id_v1,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      // First version
      registry.update_file(file1, [func_v1]);

      expect(registry.size()).toBe(1);
      expect(registry.get(func_id_v1)).toBeDefined();

      const func_v2: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id_v2,
        name: "bar" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      // Second version (replace)
      registry.update_file(file1, [func_v2]);

      expect(registry.size()).toBe(1);
      expect(registry.get(func_id_v1)).toBeUndefined(); // Old removed
      expect(registry.get(func_id_v2)).toBeDefined(); // New added
    });

    it("should handle multiple files independently", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const scope1 = `scope:${file1}:module` as ScopeId;
      const scope2 = `scope:${file2}:module` as ScopeId;

      const func1 = function_symbol("foo", file1, { line: 1, column: 0 });
      const func2 = function_symbol("bar", file2, { line: 1, column: 0 });

      const func1_def: FunctionDefinition = {
        kind: "function",
        symbol_id: func1,
        name: "foo" as SymbolName,
        defining_scope_id: scope1,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      const func2_def: FunctionDefinition = {
        kind: "function",
        symbol_id: func2,
        name: "bar" as SymbolName,
        defining_scope_id: scope2,
        location: {
          file_path: file2,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      registry.update_file(file1, [func1_def]);
      registry.update_file(file2, [func2_def]);

      expect(registry.size()).toBe(2);
      expect(registry.get(func1)).toBeDefined();
      expect(registry.get(func2)).toBeDefined();
    });
  });

  describe("get", () => {
    it("should return undefined for unknown symbols", () => {
      const unknown = function_symbol("unknown", "test.ts", {
        line: 1,
        column: 0,
      });
      expect(registry.get(unknown)).toBeUndefined();
    });
  });

  describe("get_file_definitions", () => {
    it("should return all definitions from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });
      const var_id = variable_symbol("x", file1, { line: 2, column: 0 });

      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      const variable: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "x" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 0,
          end_line: 2,
          end_column: 1,
        },
        is_exported: false,
      };

      registry.update_file(file1, [func, variable]);

      // get_callable_definitions returns only callable definitions (functions, methods, constructors)
      // Variables are not callable
      const file_defs = registry.get_callable_definitions();
      expect(file_defs).toHaveLength(1);
      expect(file_defs).toContainEqual(func);
    });

    it("should return empty array when no definitions exist", () => {
      expect(registry.get_callable_definitions()).toEqual([]);
    });
  });

  describe("remove_file", () => {
    it("should remove all definitions from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });

      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      registry.update_file(file1, [func]);

      expect(registry.size()).toBe(1);

      registry.remove_file(file1);

      expect(registry.size()).toBe(0);
      expect(registry.get(func_id)).toBeUndefined();
      expect(registry.get_callable_definitions()).toEqual([]);
    });

    it("should not affect other files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const scope1 = `scope:${file1}:module` as ScopeId;
      const scope2 = `scope:${file2}:module` as ScopeId;
      const func1 = function_symbol("foo", file1, { line: 1, column: 0 });
      const func2 = function_symbol("bar", file2, { line: 1, column: 0 });

      const func1_def: FunctionDefinition = {
        kind: "function",
        symbol_id: func1,
        name: "foo" as SymbolName,
        defining_scope_id: scope1,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      const func2_def: FunctionDefinition = {
        kind: "function",
        symbol_id: func2,
        name: "bar" as SymbolName,
        defining_scope_id: scope2,
        location: {
          file_path: file2,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      registry.update_file(file1, [func1_def]);
      registry.update_file(file2, [func2_def]);

      registry.remove_file(file1);

      expect(registry.size()).toBe(1);
      expect(registry.get(func1)).toBeUndefined();
      expect(registry.get(func2)).toBeDefined();
    });

    it("should handle removing non-existent file gracefully", () => {
      const unknown_file = "unknown.ts" as FilePath;
      expect(() => registry.remove_file(unknown_file)).not.toThrow();
    });
  });

  describe("has", () => {
    it("should return true for defined symbols", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });

      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      registry.update_file(file1, [func]);

      expect(registry.has(func_id)).toBe(true);
    });

    it("should return false for undefined symbols", () => {
      const unknown = function_symbol("unknown", "test.ts", {
        line: 1,
        column: 0,
      });
      expect(registry.has(unknown)).toBe(false);
    });
  });

  describe("get_all_files", () => {
    it("should return all files with definitions", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const scope1 = `scope:${file1}:module` as ScopeId;
      const scope2 = `scope:${file2}:module` as ScopeId;

      const func1: FunctionDefinition = {
        kind: "function",
        symbol_id: function_symbol("foo", file1, { line: 1, column: 0 }),
        name: "foo" as SymbolName,
        defining_scope_id: scope1,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      const func2: FunctionDefinition = {
        kind: "function",
        symbol_id: function_symbol("bar", file2, { line: 1, column: 0 }),
        name: "bar" as SymbolName,
        defining_scope_id: scope2,
        location: {
          file_path: file2,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      registry.update_file(file1, [func1]);
      registry.update_file(file2, [func2]);

      const files = registry.get_all_files();
      expect(files).toHaveLength(2);
      expect(files).toContain(file1);
      expect(files).toContain(file2);
    });
  });

  describe("clear", () => {
    it("should remove all definitions", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;

      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: function_symbol("foo", file1, { line: 1, column: 0 }),
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      registry.update_file(file1, [func]);

      expect(registry.size()).toBe(1);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.get_all_files()).toEqual([]);
    });
  });

  describe("get_scope_definitions_by_kind", () => {
    it("should return definitions filtered by kind", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const func_scope = `scope:${file1}:function:foo:1:0` as ScopeId;

      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });
      const var_id = variable_symbol("x", file1, { line: 2, column: 2 });

      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      const variable: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "x" as SymbolName,
        defining_scope_id: func_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 2,
          end_column: 3,
        },
        is_exported: false,
      };

      registry.update_file(file1, [func, variable]);

      // Get only functions in root scope
      const functions = registry.get_scope_definitions_by_kind(root_scope, file1, "function");
      expect(functions).toHaveLength(1);
      expect(functions[0]).toEqual(func);

      // Get only variables in function scope
      const variables = registry.get_scope_definitions_by_kind(func_scope, file1, "variable");
      expect(variables).toHaveLength(1);
      expect(variables[0]).toEqual(variable);

      // No variables in root scope
      const no_vars = registry.get_scope_definitions_by_kind(root_scope, file1, "variable");
      expect(no_vars).toHaveLength(0);
    });

    it("should return all definitions when kind is not specified", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;

      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });
      const var_id = variable_symbol("x", file1, { line: 2, column: 0 });
      const class_id = class_symbol("MyClass", file1, { line: 3, column: 0 });

      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 10,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      const variable: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "x" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 0,
          end_line: 2,
          end_column: 1,
        },
        is_exported: false,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 3,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        methods: [],
        properties: [],
      };

      registry.update_file(file1, [func, variable, class_def]);

      // Get all definitions without kind filter
      const all_defs = registry.get_scope_definitions_by_kind(root_scope, file1);
      expect(all_defs).toHaveLength(3);
      expect(all_defs).toContainEqual(func);
      expect(all_defs).toContainEqual(variable);
      expect(all_defs).toContainEqual(class_def);
    });

    it("should return empty array for unknown scope", () => {
      const file1 = "file1.ts" as FilePath;
      const unknown_scope = `scope:${file1}:unknown` as ScopeId;

      const defs = registry.get_scope_definitions_by_kind(unknown_scope, file1, "function");
      expect(defs).toEqual([]);
    });

    it("should return empty array for unknown file", () => {
      const unknown_file = "unknown.ts" as FilePath;
      const scope = `scope:${unknown_file}:module` as ScopeId;

      const defs = registry.get_scope_definitions_by_kind(scope, unknown_file, "function");
      expect(defs).toEqual([]);
    });

    it("should exclude re-exports from scope definitions", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;

      const import_id = `import:${file1}:helper:1:0` as SymbolId;

      const reexport: ImportDefinition = {
        kind: "import",
        symbol_id: import_id,
        name: "helper" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 30,
        },
        import_path: "./utils",
        import_kind: "named",
        export: {
          is_exported: true,
          is_default: false,
          is_reexport: true,
        },
      };

      registry.update_file(file1, [reexport]);

      // Re-exports should be excluded from scope definitions
      const imports = registry.get_scope_definitions_by_kind(root_scope, file1, "import");
      expect(imports).toHaveLength(0);
    });

    it("should include regular imports in scope definitions", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;

      const import_id = `import:${file1}:helper:1:0` as SymbolId;

      const regular_import: ImportDefinition = {
        kind: "import",
        symbol_id: import_id,
        name: "helper" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 30,
        },
        import_path: "./utils",
        import_kind: "named",
      };

      registry.update_file(file1, [regular_import]);

      // Regular imports should be included
      const imports = registry.get_scope_definitions_by_kind(root_scope, file1, "import");
      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual(regular_import);
    });

    it("should rebuild cache when file is updated", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;

      const func_v1: FunctionDefinition = {
        kind: "function",
        symbol_id: function_symbol("foo", file1, { line: 1, column: 0 }),
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      registry.update_file(file1, [func_v1]);

      // Query to build cache
      const defs_v1 = registry.get_scope_definitions_by_kind(root_scope, file1, "function");
      expect(defs_v1).toHaveLength(1);
      expect(defs_v1[0].name).toBe("foo");

      // Update file with different definition
      const func_v2: FunctionDefinition = {
        kind: "function",
        symbol_id: function_symbol("bar", file1, { line: 1, column: 0 }),
        name: "bar" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      registry.update_file(file1, [func_v2]);

      // Cache should be rebuilt with new data
      const defs_v2 = registry.get_scope_definitions_by_kind(root_scope, file1, "function");
      expect(defs_v2).toHaveLength(1);
      expect(defs_v2[0].name).toBe("bar");
    });

    it("should clear cache when file is removed", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;

      const func: FunctionDefinition = {
        kind: "function",
        symbol_id: function_symbol("foo", file1, { line: 1, column: 0 }),
        name: "foo" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
      };

      registry.update_file(file1, [func]);

      // Query to build cache
      const defs_before = registry.get_scope_definitions_by_kind(root_scope, file1, "function");
      expect(defs_before).toHaveLength(1);

      // Remove file
      registry.remove_file(file1);

      // Should return empty array
      const defs_after = registry.get_scope_definitions_by_kind(root_scope, file1, "function");
      expect(defs_after).toHaveLength(0);
    });
  });
});

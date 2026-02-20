import { describe, it, expect, beforeEach } from "vitest";
import { DefinitionRegistry } from "./definition";
import {
  function_symbol,
  variable_symbol,
  class_symbol,
  method_symbol,
  property_symbol,
} from "@ariadnejs/types";
import type {
  FunctionDefinition,
  VariableDefinition,
  ClassDefinition,
  ImportDefinition,
  MethodDefinition,
  PropertyDefinition,
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
      const func_id = function_symbol("foo" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const var_id = variable_symbol("x" as SymbolName, {
        file_path: file1,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 1,
      });
      const func_body_scope = `scope:${file1}:function:foo:1:0` as ScopeId;

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
        body_scope_id: func_body_scope,
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
      const func_id_v1 = function_symbol("foo" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const func_id_v2 = function_symbol("bar" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const func_body_scope_v1 = `scope:${file1}:function:foo:1:0` as ScopeId;
      const func_body_scope_v2 = `scope:${file1}:function:bar:1:0` as ScopeId;

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
        body_scope_id: func_body_scope_v1,
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
        body_scope_id: func_body_scope_v2,
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

      const func1 = function_symbol("foo" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const func2 = function_symbol("bar" as SymbolName, {
        file_path: file2,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const func1_body_scope = `scope:${file1}:function:foo:1:0` as ScopeId;
      const func2_body_scope = `scope:${file2}:function:bar:1:0` as ScopeId;

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
        body_scope_id: func1_body_scope,
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
        body_scope_id: func2_body_scope,
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
      const unknown = function_symbol("unknown" as SymbolName, {
        file_path: "test.ts" as FilePath,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 0,
      });
      expect(registry.get(unknown)).toBeUndefined();
    });
  });

  describe("get_file_definitions", () => {
    it("should return all definitions from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const func_id = function_symbol("foo" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const var_id = variable_symbol("x" as SymbolName, {
        file_path: file1,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 1,
      });
      const func_body_scope = `scope:${file1}:function:foo:1:0` as ScopeId;

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
        body_scope_id: func_body_scope,
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
      const func_id = function_symbol("foo" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const func_body_scope = `scope:${file1}:function:foo:1:0` as ScopeId;

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
        body_scope_id: func_body_scope,
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
      const func1 = function_symbol("foo" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const func2 = function_symbol("bar" as SymbolName, {
        file_path: file2,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const func1_body_scope = `scope:${file1}:function:foo:1:0` as ScopeId;
      const func2_body_scope = `scope:${file2}:function:bar:1:0` as ScopeId;

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
        body_scope_id: func1_body_scope,
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
        body_scope_id: func2_body_scope,
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

  describe("First-class properties and methods", () => {
    it("should register class properties in by_symbol index", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const class_body_scope = `scope:${file1}:class:MyClass:1:0` as ScopeId;

      const class_id = class_symbol("MyClass", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });
      const prop_id = property_symbol("count", {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 2,
        end_column: 7,
      });

      const property: PropertyDefinition = {
        kind: "property",
        symbol_id: prop_id,
        name: "count" as SymbolName,
        defining_scope_id: class_body_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 2,
          end_column: 7,
        },
        type: "number" as SymbolName,
        decorators: [],
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        methods: [],
        properties: [property],
        extends: [],
        decorators: [],
      };

      registry.update_file(file1, [class_def]);

      // Property should be accessible via by_symbol
      const retrieved_property = registry.get(prop_id);
      expect(retrieved_property).toBeDefined();
      expect(retrieved_property).toEqual(property);
      expect(retrieved_property?.kind).toBe("property");
      expect(retrieved_property?.name).toBe("count");
    });

    it("should register class methods in by_symbol index", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const class_body_scope = `scope:${file1}:class:MyClass:1:0` as ScopeId;
      const method_body_scope =
        `scope:${file1}:method:increment:2:2` as ScopeId;

      const class_id = class_symbol("MyClass", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });
      const method_id = method_symbol("increment", {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 4,
        end_column: 3,
      });

      const method: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "increment" as SymbolName,
        defining_scope_id: class_body_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 4,
          end_column: 3,
        },
        parameters: [],
        return_type: "void" as SymbolName,
        body_scope_id: method_body_scope,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        methods: [method],
        properties: [],
        extends: [],
        decorators: [],
      };

      registry.update_file(file1, [class_def]);

      // Method should be accessible via by_symbol
      const retrieved_method = registry.get(method_id);
      expect(retrieved_method).toBeDefined();
      expect(retrieved_method).toEqual(method);
      expect(retrieved_method?.kind).toBe("method");
      expect(retrieved_method?.name).toBe("increment");
    });

    it("should support get_symbol_scope for properties via O(1) lookup", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const class_body_scope = `scope:${file1}:class:MyClass:1:0` as ScopeId;

      const class_id = class_symbol("MyClass", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });
      const prop_id = property_symbol("value", {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 2,
        end_column: 7,
      });

      const property: PropertyDefinition = {
        kind: "property",
        symbol_id: prop_id,
        name: "value" as SymbolName,
        defining_scope_id: class_body_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 2,
          end_column: 7,
        },
        decorators: [],
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        methods: [],
        properties: [property],
        extends: [],
        decorators: [],
      };

      registry.update_file(file1, [class_def]);

      // get_symbol_scope should work with O(1) lookup (no string parsing)
      const scope = registry.get_symbol_scope(prop_id);
      expect(scope).toBe(class_body_scope);
    });

    it("should support get_symbol_scope for methods via O(1) lookup", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const class_body_scope = `scope:${file1}:class:MyClass:1:0` as ScopeId;
      const method_body_scope = `scope:${file1}:method:getValue:2:2` as ScopeId;

      const class_id = class_symbol("MyClass", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });
      const method_id = method_symbol("getValue", {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 4,
        end_column: 3,
      });

      const method: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "getValue" as SymbolName,
        defining_scope_id: class_body_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 4,
          end_column: 3,
        },
        parameters: [],
        body_scope_id: method_body_scope,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        methods: [method],
        properties: [],
        extends: [],
        decorators: [],
      };

      registry.update_file(file1, [class_def]);

      // get_symbol_scope should work with O(1) lookup (no string parsing)
      const scope = registry.get_symbol_scope(method_id);
      expect(scope).toBe(class_body_scope);
    });

    it("should handle class with multiple properties and methods", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const class_body_scope = `scope:${file1}:class:Counter:1:0` as ScopeId;
      const method_body_scope =
        `scope:${file1}:method:increment:3:2` as ScopeId;

      const class_id = class_symbol("Counter", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 6,
        end_column: 1,
      });
      const prop1_id = property_symbol("count", {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 2,
        end_column: 7,
      });
      const prop2_id = property_symbol("step", {
        file_path: file1,
        start_line: 2,
        start_column: 12,
        end_line: 2,
        end_column: 16,
      });
      const method_id = method_symbol("increment", {
        file_path: file1,
        start_line: 3,
        start_column: 2,
        end_line: 5,
        end_column: 3,
      });

      const prop1: PropertyDefinition = {
        kind: "property",
        symbol_id: prop1_id,
        name: "count" as SymbolName,
        defining_scope_id: class_body_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 2,
          end_column: 7,
        },
        type: "number" as SymbolName,
        decorators: [],
      };

      const prop2: PropertyDefinition = {
        kind: "property",
        symbol_id: prop2_id,
        name: "step" as SymbolName,
        defining_scope_id: class_body_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 12,
          end_line: 2,
          end_column: 16,
        },
        type: "number" as SymbolName,
        decorators: [],
      };

      const method: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "increment" as SymbolName,
        defining_scope_id: class_body_scope,
        location: {
          file_path: file1,
          start_line: 3,
          start_column: 2,
          end_line: 5,
          end_column: 3,
        },
        parameters: [],
        body_scope_id: method_body_scope,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Counter" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 6,
          end_column: 1,
        },
        is_exported: true,
        methods: [method],
        properties: [prop1, prop2],
        extends: [],
        decorators: [],
      };

      registry.update_file(file1, [class_def]);

      // All members should be accessible
      expect(registry.get(class_id)).toBeDefined();
      expect(registry.get(prop1_id)).toEqual(prop1);
      expect(registry.get(prop2_id)).toEqual(prop2);
      expect(registry.get(method_id)).toEqual(method);

      // All should have correct scopes
      expect(registry.get_symbol_scope(class_id)).toBe(root_scope);
      expect(registry.get_symbol_scope(prop1_id)).toBe(class_body_scope);
      expect(registry.get_symbol_scope(prop2_id)).toBe(class_body_scope);
      expect(registry.get_symbol_scope(method_id)).toBe(class_body_scope);
    });

    it("should clean up properties and methods when class is updated", () => {
      const file1 = "file1.ts" as FilePath;
      const root_scope = `scope:${file1}:module` as ScopeId;
      const class_body_scope = `scope:${file1}:class:MyClass:1:0` as ScopeId;
      const method_body_scope =
        `scope:${file1}:method:oldMethod:2:2` as ScopeId;

      const class_id = class_symbol("MyClass", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 4,
        end_column: 1,
      });
      const old_method_id = method_symbol("oldMethod", {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 2,
        end_column: 11,
      });
      const old_prop_id = property_symbol("oldProp", {
        file_path: file1,
        start_line: 3,
        start_column: 2,
        end_line: 3,
        end_column: 9,
      });

      const old_method: MethodDefinition = {
        kind: "method",
        symbol_id: old_method_id,
        name: "oldMethod" as SymbolName,
        defining_scope_id: class_body_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 2,
          end_column: 11,
        },
        parameters: [],
        body_scope_id: method_body_scope,
      };

      const old_prop: PropertyDefinition = {
        kind: "property",
        symbol_id: old_prop_id,
        name: "oldProp" as SymbolName,
        defining_scope_id: class_body_scope,
        location: {
          file_path: file1,
          start_line: 3,
          start_column: 2,
          end_line: 3,
          end_column: 9,
        },
        decorators: [],
      };

      const class_v1: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 4,
          end_column: 1,
        },
        is_exported: true,
        methods: [old_method],
        properties: [old_prop],
        extends: [],
        decorators: [],
      };

      registry.update_file(file1, [class_v1]);

      // Verify old members are registered
      expect(registry.get(old_method_id)).toBeDefined();
      expect(registry.get(old_prop_id)).toBeDefined();

      // Update with new members
      const new_method_id = method_symbol("newMethod", {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 2,
        end_column: 11,
      });
      const new_prop_id = property_symbol("newProp", {
        file_path: file1,
        start_line: 3,
        start_column: 2,
        end_line: 3,
        end_column: 9,
      });

      const new_method: MethodDefinition = {
        kind: "method",
        symbol_id: new_method_id,
        name: "newMethod" as SymbolName,
        defining_scope_id: class_body_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 2,
          end_column: 11,
        },
        parameters: [],
        body_scope_id: method_body_scope,
      };

      const new_prop: PropertyDefinition = {
        kind: "property",
        symbol_id: new_prop_id,
        name: "newProp" as SymbolName,
        defining_scope_id: class_body_scope,
        location: {
          file_path: file1,
          start_line: 3,
          start_column: 2,
          end_line: 3,
          end_column: 9,
        },
        decorators: [],
      };

      const class_v2: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 4,
          end_column: 1,
        },
        is_exported: true,
        methods: [new_method],
        properties: [new_prop],
        extends: [],
        decorators: [],
      };

      registry.update_file(file1, [class_v2]);

      // Old members should be gone
      expect(registry.get(old_method_id)).toBeUndefined();
      expect(registry.get(old_prop_id)).toBeUndefined();

      // New members should be present
      expect(registry.get(new_method_id)).toEqual(new_method);
      expect(registry.get(new_prop_id)).toEqual(new_prop);
    });
  });

  describe("resolve_cross_file_type_inheritance", () => {
    it("should return parent files when registering new subtypes", () => {
      // Setup: Parent class in file A, child class in file B that extends parent
      const file_a = "parent.ts" as FilePath;
      const file_b = "child.ts" as FilePath;
      const root_scope_a = `scope:${file_a}:module` as ScopeId;
      const root_scope_b = `scope:${file_b}:module` as ScopeId;

      const parent_class_id = class_symbol("ParentClass", {
        file_path: file_a,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      const child_class_id = class_symbol("ChildClass", {
        file_path: file_b,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      const parent_class: ClassDefinition = {
        kind: "class",
        symbol_id: parent_class_id,
        name: "ParentClass" as SymbolName,
        defining_scope_id: root_scope_a,
        location: {
          file_path: file_a,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        methods: [],
        properties: [],
        extends: [],
        decorators: [],
      };

      const child_class: ClassDefinition = {
        kind: "class",
        symbol_id: child_class_id,
        name: "ChildClass" as SymbolName,
        defining_scope_id: root_scope_b,
        location: {
          file_path: file_b,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        methods: [],
        properties: [],
        extends: ["ParentClass" as SymbolName],
        decorators: [],
      };

      // Register both files
      registry.update_file(file_a, [parent_class]);
      registry.update_file(file_b, [child_class]);

      // Mock resolution function that can resolve ParentClass
      const mock_resolutions = {
        resolve: (_scope_id: ScopeId, name: SymbolName): SymbolId | null => {
          if (name === "ParentClass") {
            return parent_class_id;
          }
          return null;
        },
      };

      // Call resolve_cross_file_type_inheritance for file B
      const affected_files = registry.resolve_cross_file_type_inheritance(
        file_b,
        mock_resolutions
      );

      // Verify: Returns Set containing file A's path
      expect(affected_files).toBeInstanceOf(Set);
      expect(affected_files.size).toBe(1);
      expect(affected_files.has(file_a)).toBe(true);

      // Verify: Subtype relationship was registered
      const subtypes = registry.get_subtypes(parent_class_id);
      expect(subtypes).toContain(child_class_id);
    });

    it("should return empty set when no new subtypes are registered", () => {
      const file_a = "parent.ts" as FilePath;
      const root_scope_a = `scope:${file_a}:module` as ScopeId;

      const parent_class_id = class_symbol("ParentClass", {
        file_path: file_a,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      const parent_class: ClassDefinition = {
        kind: "class",
        symbol_id: parent_class_id,
        name: "ParentClass" as SymbolName,
        defining_scope_id: root_scope_a,
        location: {
          file_path: file_a,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        methods: [],
        properties: [],
        extends: [],
        decorators: [],
      };

      registry.update_file(file_a, [parent_class]);

      const mock_resolutions = {
        resolve: (): SymbolId | null => null,
      };

      // Call for a file with no classes that extend anything
      const affected_files = registry.resolve_cross_file_type_inheritance(
        file_a,
        mock_resolutions
      );

      // Verify: Returns empty Set
      expect(affected_files).toBeInstanceOf(Set);
      expect(affected_files.size).toBe(0);
    });

    it("should not return parent file if subtype already registered", () => {
      const file_a = "parent.ts" as FilePath;
      const file_b = "child.ts" as FilePath;
      const root_scope_a = `scope:${file_a}:module` as ScopeId;
      const root_scope_b = `scope:${file_b}:module` as ScopeId;

      const parent_class_id = class_symbol("ParentClass", {
        file_path: file_a,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      const child_class_id = class_symbol("ChildClass", {
        file_path: file_b,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      const parent_class: ClassDefinition = {
        kind: "class",
        symbol_id: parent_class_id,
        name: "ParentClass" as SymbolName,
        defining_scope_id: root_scope_a,
        location: {
          file_path: file_a,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        methods: [],
        properties: [],
        extends: [],
        decorators: [],
      };

      const child_class: ClassDefinition = {
        kind: "class",
        symbol_id: child_class_id,
        name: "ChildClass" as SymbolName,
        defining_scope_id: root_scope_b,
        location: {
          file_path: file_b,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        methods: [],
        properties: [],
        extends: ["ParentClass" as SymbolName],
        decorators: [],
      };

      registry.update_file(file_a, [parent_class]);
      registry.update_file(file_b, [child_class]);

      const mock_resolutions = {
        resolve: (_scope_id: ScopeId, name: SymbolName): SymbolId | null => {
          if (name === "ParentClass") {
            return parent_class_id;
          }
          return null;
        },
      };

      // First call: should register and return parent file
      const first_result = registry.resolve_cross_file_type_inheritance(
        file_b,
        mock_resolutions
      );
      expect(first_result.size).toBe(1);
      expect(first_result.has(file_a)).toBe(true);

      // Second call: should NOT return parent file (already registered)
      const second_result = registry.resolve_cross_file_type_inheritance(
        file_b,
        mock_resolutions
      );
      expect(second_result.size).toBe(0);
    });
  });
});

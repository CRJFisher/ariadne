import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DefinitionRegistry } from "./definition";
import {
  function_symbol,
  variable_symbol,
  class_symbol,
  method_symbol,
  property_symbol,
  enum_symbol,
  enum_member_symbol,
  location_key,
} from "@ariadnejs/types";
import type {
  FunctionDefinition,
  VariableDefinition,
  ClassDefinition,
  ConstructorDefinition,
  EnumDefinition,
  ImportDefinition,
  MethodDefinition,
  PropertyDefinition,
  FunctionCollection,
  FilePath,
  Location,
  ScopeId,
  SymbolName,
  SymbolId,
  ModulePath,
} from "@ariadnejs/types";

describe("DefinitionRegistry", () => {
  let registry: DefinitionRegistry;

  beforeEach(() => {
    registry = new DefinitionRegistry();
  });

  describe("update_file", () => {
    it("add definitions from a file", () => {
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

    it("replace definitions when file is updated", () => {
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

      registry.update_file(file1, [func_v1]);

      expect(registry.size()).toBe(1);
      expect(registry.get(func_id_v1)).toEqual(func_v1);

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

      registry.update_file(file1, [func_v2]);

      expect(registry.size()).toBe(1);
      expect(registry.get(func_id_v1)).toBeUndefined();
      expect(registry.get(func_id_v2)).toEqual(func_v2);
    });

    it("handle multiple files independently", () => {
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
      expect(registry.get(func1)).toEqual(func1_def);
      expect(registry.get(func2)).toEqual(func2_def);
    });
  });

  describe("get", () => {
    it("return undefined for unknown symbols", () => {
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

  describe("get_callable_definitions", () => {
    it("returns only callable definitions, excluding variables", () => {
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

      const file_defs = registry.get_callable_definitions();
      expect(file_defs).toEqual([func]);
    });

    it("return empty array when no definitions exist", () => {
      expect(registry.get_callable_definitions()).toEqual([]);
    });
  });

  describe("remove_file", () => {
    it("remove all definitions from a file", () => {
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

    it("does not affect other files", () => {
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
      expect(registry.get(func2)).toEqual(func2_def);
    });

    it("handle removing non-existent file gracefully", () => {
      const unknown_file = "unknown.ts" as FilePath;
      expect(() => registry.remove_file(unknown_file)).not.toThrow();
    });
  });

  describe("First-class properties and methods", () => {
    it("register class properties in by_symbol index", () => {
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

      expect(registry.get(prop_id)).toEqual(property);
    });

    it("register class methods in by_symbol index", () => {
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

      expect(registry.get(method_id)).toEqual(method);
    });

    it("support get_symbol_scope for properties via O(1) lookup", () => {
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
      const scope = registry.get_symbol_scope(prop_id);
      expect(scope).toBe(class_body_scope);
    });

    it("support get_symbol_scope for methods via O(1) lookup", () => {
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
      const scope = registry.get_symbol_scope(method_id);
      expect(scope).toBe(class_body_scope);
    });

    it("handle class with multiple properties and methods", () => {
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

      expect(registry.get(class_id)).toEqual(class_def);
      expect(registry.get(prop1_id)).toEqual(prop1);
      expect(registry.get(prop2_id)).toEqual(prop2);
      expect(registry.get(method_id)).toEqual(method);

      expect(registry.get_symbol_scope(class_id)).toBe(root_scope);
      expect(registry.get_symbol_scope(prop1_id)).toBe(class_body_scope);
      expect(registry.get_symbol_scope(prop2_id)).toBe(class_body_scope);
      expect(registry.get_symbol_scope(method_id)).toBe(class_body_scope);
    });

    it("clean up properties and methods when class is updated", () => {
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

      expect(registry.get(old_method_id)).toEqual(old_method);
      expect(registry.get(old_prop_id)).toEqual(old_prop);

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

      expect(registry.get(old_method_id)).toBeUndefined();
      expect(registry.get(old_prop_id)).toBeUndefined();
      expect(registry.get(new_method_id)).toEqual(new_method);
      expect(registry.get(new_prop_id)).toEqual(new_prop);
    });
  });

  // A Rust `impl E { … }` attaches associated functions to the enum, so `E::assoc()`
  // reaches them through the same flat member index a class uses. Variants are
  // deliberately absent: this index answers callable-member lookups.
  describe("enum members", () => {
    const ENUM_LOC = {
      file_path: "e.rs" as FilePath,
      start_line: 1,
      start_column: 0,
      end_line: 8,
      end_column: 1,
    };
    const PARSE_LOC = { ...ENUM_LOC, start_line: 5, end_line: 7 };

    function make_enum(): {
      enum_id: SymbolId;
      parse_id: SymbolId;
      variant_id: SymbolId;
      definition: EnumDefinition;
    } {
      const enum_id = enum_symbol("MetaVarExpr", ENUM_LOC);
      const parse_id = method_symbol("parse", PARSE_LOC);
      const variant_id = enum_member_symbol("Count", {
        ...ENUM_LOC,
        start_line: 2,
        end_line: 2,
      });
      const parse: MethodDefinition = {
        kind: "method",
        symbol_id: parse_id,
        name: "parse" as SymbolName,
        defining_scope_id: "scope:e.rs:impl:4:0" as ScopeId,
        location: PARSE_LOC,
        parameters: [],
        static: true,
      };
      return {
        enum_id,
        parse_id,
        variant_id,
        definition: {
          kind: "enum",
          symbol_id: enum_id,
          name: "MetaVarExpr" as SymbolName,
          defining_scope_id: "scope:e.rs:file:0:0" as ScopeId,
          location: ENUM_LOC,
          is_exported: true,
          is_const: false,
          members: [
            {
              symbol_id: variant_id,
              name: "Count" as SymbolName,
              location: { ...ENUM_LOC, start_line: 2, end_line: 2 },
            },
          ],
          methods: [parse],
        },
      };
    }

    it("indexes an enum's associated functions as its members", () => {
      const { enum_id, parse_id, definition } = make_enum();
      registry.update_file("e.rs" as FilePath, [definition]);

      expect(registry.get_member_index().get(enum_id)).toEqual(
        new Map<SymbolName, SymbolId>([["parse" as SymbolName, parse_id]])
      );
    });

    it("keeps an enum's variants out of the member index", () => {
      const { enum_id, definition } = make_enum();
      registry.update_file("e.rs" as FilePath, [definition]);

      expect(
        registry.get_member_index().get(enum_id)?.has("Count" as SymbolName)
      ).toBe(false);
    });

    it("registers an enum's associated function by symbol and by location", () => {
      const { parse_id, definition } = make_enum();
      registry.update_file("e.rs" as FilePath, [definition]);

      expect(registry.get(parse_id)?.name).toEqual("parse" as SymbolName);
      expect(registry.get_symbol_at_location(location_key(PARSE_LOC))).toEqual(
        parse_id
      );
    });

    it("evicts an enum's associated functions when the file is removed", () => {
      const { enum_id, parse_id, definition } = make_enum();
      registry.update_file("e.rs" as FilePath, [definition]);
      registry.remove_file("e.rs" as FilePath);

      expect(registry.get(parse_id)).toBeUndefined();
      expect(registry.get_member_index().get(enum_id)).toBeUndefined();
      expect(
        registry.get_symbol_at_location(location_key(PARSE_LOC))
      ).toBeUndefined();
    });
  });

  describe("resolve_cross_file_type_inheritance", () => {
    it("return parent files when registering new subtypes", () => {
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

      const affected_files = registry.resolve_cross_file_type_inheritance(
        file_b,
        mock_resolutions
      );

      expect(affected_files).toEqual(new Set([file_a]));
      expect(registry.get_subtypes(parent_class_id)).toEqual(
        new Set([child_class_id])
      );
    });

    it("return empty set when no new subtypes are registered", () => {
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

      const affected_files = registry.resolve_cross_file_type_inheritance(
        file_a,
        mock_resolutions
      );

      expect(affected_files).toEqual(new Set());
    });

    it("does not return parent file if subtype already registered", () => {
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

      const first_result = registry.resolve_cross_file_type_inheritance(
        file_b,
        mock_resolutions
      );
      expect(first_result).toEqual(new Set([file_a]));

      // Re-resolving the same file registers no new edge, so no parent file is returned.
      const second_result = registry.resolve_cross_file_type_inheritance(
        file_b,
        mock_resolutions
      );
      expect(second_result).toEqual(new Set());
    });
  });

  describe("secondary index queries", () => {
    const file1 = "file1.ts" as FilePath;
    const root_scope = `scope:${file1}:module` as ScopeId;

    function make_function(name: string): FunctionDefinition {
      const location = {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      };
      return {
        kind: "function",
        symbol_id: function_symbol(name as SymbolName, location),
        name: name as SymbolName,
        defining_scope_id: root_scope,
        location,
        is_exported: false,
        signature: { parameters: [] },
        body_scope_id: `scope:${file1}:function:${name}:1:0` as ScopeId,
      };
    }

    it("indexes a definition by scope and by location", () => {
      const func = make_function("foo");
      registry.update_file(file1, [func]);

      expect(registry.get_scope_definitions(root_scope)).toEqual(
        new Map([["foo", func.symbol_id]])
      );
      expect(registry.get_symbol_at_location(location_key(func.location))).toBe(
        func.symbol_id
      );
    });

    it("returns an empty map for a scope with no definitions", () => {
      expect(
        registry.get_scope_definitions("scope:absent.ts:module" as ScopeId)
      ).toEqual(new Map());
    });

    it("excludes imports from the scope index", () => {
      const import_def: ImportDefinition = {
        kind: "import",
        symbol_id: "import:file1.ts:1:0:1:20:helper" as SymbolId,
        name: "helper" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 20,
        },
        import_path: "./helper" as ModulePath,
        import_kind: "named",
      };

      registry.update_file(file1, [import_def]);

      expect(registry.get_scope_definitions(root_scope)).toEqual(new Map());
    });

    it("builds a flat member index for class methods and properties", () => {
      const class_body_scope = `scope:${file1}:class:Box:1:0` as ScopeId;
      const class_id = class_symbol("Box", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });
      const method_id = method_symbol("open", {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 3,
        end_column: 3,
      });
      const prop_id = property_symbol("size", {
        file_path: file1,
        start_line: 4,
        start_column: 2,
        end_line: 4,
        end_column: 6,
      });

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Box" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: false,
        methods: [
          {
            kind: "method",
            symbol_id: method_id,
            name: "open" as SymbolName,
            defining_scope_id: class_body_scope,
            location: {
              file_path: file1,
              start_line: 2,
              start_column: 2,
              end_line: 3,
              end_column: 3,
            },
            parameters: [],
            body_scope_id: `scope:${file1}:method:open:2:2` as ScopeId,
          },
        ],
        properties: [
          {
            kind: "property",
            symbol_id: prop_id,
            name: "size" as SymbolName,
            defining_scope_id: class_body_scope,
            location: {
              file_path: file1,
              start_line: 4,
              start_column: 2,
              end_line: 4,
              end_column: 6,
            },
            decorators: [],
          },
        ],
        extends: [],
        decorators: [],
      };

      registry.update_file(file1, [class_def]);

      expect(registry.get_member_index()).toEqual(
        new Map([
          [
            class_id,
            new Map([
              ["open", method_id],
              ["size", prop_id],
            ]),
          ],
        ])
      );
    });

    it("returns an empty subtype set for a type with no subtypes", () => {
      const func = make_function("foo");
      registry.update_file(file1, [func]);

      expect(registry.get_subtypes(func.symbol_id)).toEqual(new Set());
    });

    it("stores and returns the function collection for a variable", () => {
      const location = {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 20,
      };
      const var_id = variable_symbol("handlers" as SymbolName, location);
      const handler_id = function_symbol("onSave" as SymbolName, {
        file_path: file1,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 10,
      });
      const collection: FunctionCollection = {
        collection_id: var_id,
        collection_type: "Array",
        location,
        stored_functions: [handler_id],
      };
      const variable: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "handlers" as SymbolName,
        defining_scope_id: root_scope,
        location,
        is_exported: false,
        function_collection: collection,
      };

      registry.update_file(file1, [variable]);

      expect(registry.get_function_collection(var_id)).toEqual(collection);
    });

    it("returns undefined for a variable that holds no function collection", () => {
      const location = {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 5,
      };
      const var_id = variable_symbol("x" as SymbolName, location);
      const variable: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "x" as SymbolName,
        defining_scope_id: root_scope,
        location,
        is_exported: false,
      };

      registry.update_file(file1, [variable]);

      expect(registry.get_function_collection(var_id)).toBeUndefined();
    });

    it("evicts a definition from the scope and location indexes on remove_file", () => {
      const func = make_function("foo");
      registry.update_file(file1, [func]);
      registry.remove_file(file1);

      expect(registry.get_scope_definitions(root_scope)).toEqual(new Map());
      expect(
        registry.get_symbol_at_location(location_key(func.location))
      ).toBeUndefined();
    });
  });

  /**
   * `fix_import_definition_locations` (project/fix_import_locations.ts) gives
   * every ImportDefinition the location of the definition it names, so N
   * importers of one exported singleton all carry that singleton's location.
   * The location index holds one value per key, so unless imports stay out of
   * it the survivor is whichever file was written last — the ingest order
   * deciding which symbol answers for a declaration's own location, and a
   * constructor binding looked up there landing on an import symbol whose type
   * is never resolved.
   */
  describe("a declaration whose location several importers carry", () => {
    const declaring_file = "singleton.ts" as FilePath;
    const declaration_location: Location = {
      file_path: declaring_file,
      start_line: 12,
      start_column: 13,
      end_line: 12,
      end_column: 19,
    };
    const declaration: VariableDefinition = {
      kind: "variable",
      symbol_id: variable_symbol("extUri" as SymbolName, declaration_location),
      name: "extUri" as SymbolName,
      defining_scope_id: `scope:${declaring_file}:module` as ScopeId,
      location: declaration_location,
      is_exported: true,
    };

    const first_importer = "consumer_a.ts" as FilePath;
    const second_importer = "consumer_b.ts" as FilePath;

    function importer_of(file: FilePath): ImportDefinition {
      return {
        kind: "import",
        symbol_id: `import:${file}:1:9:1:15:extUri` as SymbolId,
        name: "extUri" as SymbolName,
        defining_scope_id: `scope:${file}:module` as ScopeId,
        location: declaration_location,
        import_path: "./singleton" as ModulePath,
        import_kind: "named",
      };
    }

    function load_declaration_then_both_importers(): void {
      registry.update_file(declaring_file, [declaration]);
      registry.update_file(first_importer, [importer_of(first_importer)]);
      registry.update_file(second_importer, [importer_of(second_importer)]);
    }

    it("answers with the declaration after both importers are written", () => {
      load_declaration_then_both_importers();

      expect(
        registry.get_symbol_at_location(location_key(declaration_location))
      ).toBe(declaration.symbol_id);
    });

    it("keeps the declaration's key when an importer is evicted", () => {
      load_declaration_then_both_importers();

      registry.remove_file(second_importer);

      expect(
        registry.get_symbol_at_location(location_key(declaration_location))
      ).toBe(declaration.symbol_id);
    });
  });

  describe("reverse ownership indices", () => {
    it("evicts a class's own members and leaves another file's alone", () => {
      const kept = inheritance_file(0);
      const evicted = inheritance_file(1);
      registry.update_file(kept.file_id, kept.definitions);
      registry.update_file(evicted.file_id, evicted.definitions);

      registry.remove_file(evicted.file_id);

      for (const member_id of member_ids_of(evicted.definitions)) {
        expect(registry.get_member_owner(member_id)).toBeUndefined();
      }
      for (const class_def of kept.definitions) {
        for (const member_id of member_ids_of([class_def])) {
          expect(registry.get_member_owner(member_id)).toBe(
            class_def.symbol_id
          );
        }
      }
    });

    it("evicts an inheritance edge from the parent's side and the child's", () => {
      const file = inheritance_file(0);
      const [base, child] = file.definitions;
      registry.update_file(file.file_id, file.definitions);

      expect(registry.get_subtypes(base.symbol_id)).toEqual(
        new Set([child.symbol_id])
      );

      registry.remove_file(file.file_id);

      expect(registry.get_subtypes(base.symbol_id)).toEqual(new Set());
      expect(registry["subtype_parents"].get(child.symbol_id)).toBeUndefined();
      expect(registry["type_subtypes"].size).toBe(0);
      expect(registry["owner_members"].size).toBe(0);
    });

    it("keeps both indices consistent through a class-body member alias", () => {
      const file_id = "aliasing.ts" as FilePath;
      const scope_id = `scope:${file_id}:module` as ScopeId;
      const aliased = make_class_with_members(file_id, scope_id, "Mapping", 1, []);
      const target = aliased.methods?.[0];
      if (!target) {
        throw new Error("the fixture class must declare a method to alias");
      }
      const alias_location = member_location(file_id, 7);
      const alias: PropertyDefinition = {
        kind: "property",
        symbol_id: property_symbol("__getitem__" as SymbolName, alias_location),
        name: "__getitem__" as SymbolName,
        defining_scope_id: `scope:${file_id}:class:Mapping:1:0` as ScopeId,
        location: alias_location,
        initial_value: target.name,
        decorators: [],
      };
      const with_alias: ClassDefinition = {
        ...aliased,
        properties: [...aliased.properties, alias],
      };

      registry.update_file(file_id, [with_alias]);

      expect(
        registry.get_member_index().get(with_alias.symbol_id)?.get(
          "__getitem__" as SymbolName
        )
      ).toBe(target.symbol_id);
      expect(registry["verify_reverse_indices"]()).toBeNull();

      registry.remove_file(file_id);

      expect(registry["verify_reverse_indices"]()).toBeNull();
      expect(registry["owner_members"].size).toBe(0);
      expect(registry.get_member_owner(alias.symbol_id)).toBeUndefined();
    });

    it("names the reverse index a write site forgot", () => {
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);

      registry["owner_members"].delete(file.definitions[0].symbol_id);

      expect(registry["verify_reverse_indices"]()).toContain(
        "owner_members is missing"
      );
    });

    it("names the reverse index an eviction path left behind", () => {
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);

      registry["type_subtypes"].clear();

      expect(registry["verify_reverse_indices"]()).toContain(
        "subtype_parents still holds"
      );
    });

    it("throws on the next registry write once a reverse index has diverged", () => {
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);

      registry["owner_members"].delete(file.definitions[0].symbol_id);

      expect(() => registry.remove_file(file.file_id)).toThrow(
        /reverse index diverged/
      );
    });

    it("counts every entry a walk visits, so a silent counter is not read as a keyed path", () => {
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);

      const counts = count_registry_map_access(registry);
      registry.get_callable_definitions();

      expect(counts.scanned_entries).toBe(registry["by_symbol"].size);
    });

    /**
     * The invariant is what makes a forgotten write site loud, so it is armed
     * for every test in this package. It costs a pass over the whole registry,
     * which is exactly the cost these tests exist to prove eviction no longer
     * pays — so they disarm it and put the production path under the counter.
     */
    describe("eviction cost", () => {
      const armed = process.env.ARIADNE_ASSERT_REGISTRY_INVARIANTS;

      beforeEach(() => {
        delete process.env.ARIADNE_ASSERT_REGISTRY_INVARIANTS;
      });

      afterEach(() => {
        if (armed !== undefined) {
          process.env.ARIADNE_ASSERT_REGISTRY_INVARIANTS = armed;
        }
      });

      it("scans no map end to end while evicting, and costs the same per evicted symbol at 200, 600 and 1,200 files", () => {
        const per_symbol: number[] = [];

        for (const file_count of [200, 600, 1200]) {
          const loaded = new DefinitionRegistry();
          const files = [];
          for (let index = 0; index < file_count; index++) {
            const file = inheritance_file(index);
            loaded.update_file(file.file_id, file.definitions);
            files.push(file);
          }

          const counts = count_registry_map_access(loaded);
          for (const file of files) {
            loaded.remove_file(file.file_id);
          }

          const evicted_symbols = file_count * CLASSES_PER_FILE;
          expect(counts.scanned_entries).toBe(0);
          expect(loaded["member_owner"].size).toBe(0);
          expect(loaded["owner_members"].size).toBe(0);
          expect(loaded["type_subtypes"].size).toBe(0);
          expect(loaded["subtype_parents"].size).toBe(0);
          per_symbol.push(counts.keyed_operations / evicted_symbols);
        }

        const lowest = Math.min(...per_symbol);
        const highest = Math.max(...per_symbol);
        expect((highest - lowest) / lowest).toBeLessThanOrEqual(0.25);
      });

      it("scans no map end to end while re-checking a registered cross-file parent", () => {
        const file = inheritance_file(0);
        const [base, child] = file.definitions;
        registry.update_file(file.file_id, file.definitions);

        const counts = count_registry_map_access(registry);
        const affected = registry.resolve_cross_file_type_inheritance(
          file.file_id,
          {
            resolve: (): SymbolId | null => base.symbol_id,
          }
        );

        expect(counts.scanned_entries).toBe(0);
        expect(affected).toEqual(new Set());
        expect(registry.get_subtypes(base.symbol_id)).toEqual(
          new Set([child.symbol_id])
        );
      });
    });
  });
});

/** Classes per file in `inheritance_file`: one base and one subtype of it. */
const CLASSES_PER_FILE = 2;

function member_location(file_id: FilePath, line: number): Location {
  return {
    file_path: file_id,
    start_line: line,
    start_column: 2,
    end_line: line,
    end_column: 20,
  };
}

/**
 * A class carrying one of each member kind `update_file` records ownership for
 * — method, property and constructor — so an eviction covers all three.
 */
function make_class_with_members(
  file_id: FilePath,
  scope_id: ScopeId,
  name: string,
  line: number,
  extends_names: SymbolName[]
): ClassDefinition {
  const location = {
    file_path: file_id,
    start_line: line,
    start_column: 0,
    end_line: line + 5,
    end_column: 1,
  };
  const body_scope = `scope:${file_id}:class:${name}:${line}:0` as ScopeId;

  const method_location = member_location(file_id, line + 1);
  const method: MethodDefinition = {
    kind: "method",
    symbol_id: method_symbol(`${name}_run` as SymbolName, method_location),
    name: `${name}_run` as SymbolName,
    defining_scope_id: body_scope,
    location: method_location,
    parameters: [],
    body_scope_id: `${body_scope}:run` as ScopeId,
    decorators: [],
  };

  const property_location = member_location(file_id, line + 2);
  const property: PropertyDefinition = {
    kind: "property",
    symbol_id: property_symbol(`${name}_state` as SymbolName, property_location),
    name: `${name}_state` as SymbolName,
    defining_scope_id: body_scope,
    location: property_location,
    decorators: [],
  };

  const constructor_location = member_location(file_id, line + 3);
  const class_constructor: ConstructorDefinition = {
    kind: "constructor",
    symbol_id: method_symbol("constructor" as SymbolName, constructor_location),
    name: "constructor" as SymbolName,
    defining_scope_id: body_scope,
    location: constructor_location,
    parameters: [],
    body_scope_id: `${body_scope}:constructor` as ScopeId,
  };

  return {
    kind: "class",
    symbol_id: class_symbol(name, location),
    name: name as SymbolName,
    defining_scope_id: scope_id,
    location,
    is_exported: true,
    extends: extends_names,
    methods: [method],
    properties: [property],
    constructors: [class_constructor],
    decorators: [],
  };
}

/** One file holding a base class and a subtype of it, both with members. */
function inheritance_file(index: number): {
  file_id: FilePath;
  definitions: ClassDefinition[];
} {
  const file_id = `module_${index}.ts` as FilePath;
  const scope_id = `scope:${file_id}:module` as ScopeId;
  const base = make_class_with_members(file_id, scope_id, `Base${index}`, 1, []);
  const child = make_class_with_members(
    file_id,
    scope_id,
    `Child${index}`,
    10,
    [base.name]
  );
  return { file_id, definitions: [base, child] };
}

function member_ids_of(classes: readonly ClassDefinition[]): SymbolId[] {
  return classes.flatMap((class_def) => [
    ...(class_def.methods ?? []).map((method) => method.symbol_id),
    ...class_def.properties.map((property) => property.symbol_id),
    ...(class_def.constructors ?? []).map(
      (class_constructor) => class_constructor.symbol_id
    ),
  ]);
}

interface MapAccessCounts {
  /** Calls to `get`, `set`, `has` and `delete`, whatever the map's size. */
  keyed_operations: number;
  /** Entries visited by an end-to-end walk of a map — the cost being removed. */
  scanned_entries: number;
}

const KEYED_MAP_METHODS = new Set(["get", "set", "has", "delete"]);
const ITERATING_MAP_METHODS = new Set(["entries", "keys", "values"]);

/**
 * `source` behind a counter: keyed lookups counted once each, and every entry
 * an end-to-end walk visits counted as it is yielded.
 *
 * A scan is counted per entry rather than per call, because the number a full
 * corpus load is judged on is entries visited — 2,178,985,276 of them over a
 * 1,200-file load before the reverse indices existed.
 */
function count_map_access<K, V>(
  source: Map<K, V>,
  counts: MapAccessCounts
): Map<K, V> {
  function* counted<T>(items: Iterable<T>): Generator<T> {
    for (const item of items) {
      counts.scanned_entries++;
      yield item;
    }
  }

  return new Proxy(source, {
    get(target, property) {
      if (typeof property === "string" && KEYED_MAP_METHODS.has(property)) {
        const method = Reflect.get(target, property) as (
          ...args: unknown[]
        ) => unknown;
        return (...args: unknown[]): unknown => {
          counts.keyed_operations++;
          return method.apply(target, args);
        };
      }
      if (
        property === Symbol.iterator ||
        (typeof property === "string" && ITERATING_MAP_METHODS.has(property))
      ) {
        const method = Reflect.get(target, property) as () => Iterable<unknown>;
        return (): Generator<unknown> => counted(method.call(target));
      }
      if (property === "forEach") {
        return (
          callback: (value: V, key: K, map: Map<K, V>) => void,
          this_arg?: unknown
        ): void => {
          target.forEach((value, key, map) => {
            counts.scanned_entries++;
            callback.call(this_arg, value, key, map);
          });
        };
      }
      const value = Reflect.get(target, property) as unknown;
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}

/**
 * Every map the registry holds, put behind one counter — not just the two
 * reverse indices, so "no map is walked end to end" is a claim about the whole
 * eviction path rather than about the pair this test was written for.
 */
function count_registry_map_access(
  registry: DefinitionRegistry
): MapAccessCounts {
  const counts: MapAccessCounts = { keyed_operations: 0, scanned_entries: 0 };
  registry["by_symbol"] = count_map_access(registry["by_symbol"], counts);
  registry["by_file"] = count_map_access(registry["by_file"], counts);
  registry["location_to_symbol"] = count_map_access(
    registry["location_to_symbol"],
    counts
  );
  registry["member_index"] = count_map_access(registry["member_index"], counts);
  registry["member_owner"] = count_map_access(registry["member_owner"], counts);
  registry["owner_members"] = count_map_access(
    registry["owner_members"],
    counts
  );
  registry["by_scope"] = count_map_access(registry["by_scope"], counts);
  registry["type_subtypes"] = count_map_access(
    registry["type_subtypes"],
    counts
  );
  registry["subtype_parents"] = count_map_access(
    registry["subtype_parents"],
    counts
  );
  registry["function_collections"] = count_map_access(
    registry["function_collections"],
    counts
  );
  return counts;
}

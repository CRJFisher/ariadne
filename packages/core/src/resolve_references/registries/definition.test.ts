import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DefinitionRegistry, type TypeNameResolver } from "./definition";
import {
  function_symbol,
  variable_symbol,
  class_symbol,
  method_symbol,
  property_symbol,
  enum_symbol,
  enum_member_symbol,
  interface_symbol,
  anonymous_function_symbol,
  location_key,
} from "@ariadnejs/types";
import type {
  FunctionDefinition,
  VariableDefinition,
  ClassDefinition,
  ConstructorDefinition,
  EnumDefinition,
  ImportDefinition,
  InterfaceDefinition,
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

  describe("get_anonymous_callables_in_file", () => {
    it("returns one file's anonymous functions in declaration order, and no named one", () => {
      const file1 = "file1.ts" as FilePath;
      const first = anonymous_function(file1, 5);
      const second = anonymous_function(file1, 9);
      const named = named_function(file1, "run" as SymbolName, 12);

      registry.update_file(file1, [first, named, second]);

      expect(registry.get_anonymous_callables_in_file(file1)).toEqual([
        first,
        second,
      ]);
    });

    it("returns an empty list for a file the registry has never seen", () => {
      expect(
        registry.get_anonymous_callables_in_file("absent.ts" as FilePath)
      ).toEqual([]);
    });

    it("replaces a file's callbacks when the file is re-indexed", () => {
      const file1 = "file1.ts" as FilePath;
      registry.update_file(file1, [anonymous_function(file1, 5)]);

      const moved = anonymous_function(file1, 7);
      registry.update_file(file1, [moved]);

      expect(registry.get_anonymous_callables_in_file(file1)).toEqual([moved]);
    });

    it("drops an evicted file's callbacks and keeps every other file's", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const survivor = anonymous_function(file2, 5);
      registry.update_file(file1, [anonymous_function(file1, 5)]);
      registry.update_file(file2, [survivor]);

      registry.remove_file(file1);

      expect(registry.get_anonymous_callables_in_file(file1)).toEqual([]);
      expect(registry.get_anonymous_callables_in_file(file2)).toEqual([
        survivor,
      ]);
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

  describe("resolve_type_heritage", () => {
    const parent_file = "parent.ts" as FilePath;
    const child_file = "child.ts" as FilePath;

    function parent_and_child(): { parent: ClassDefinition; child: ClassDefinition } {
      const parent = make_class_with_members(
        parent_file,
        `scope:${parent_file}:module` as ScopeId,
        "ParentClass",
        1,
        []
      );
      const child = make_class_with_members(
        child_file,
        `scope:${child_file}:module` as ScopeId,
        "ChildClass",
        1,
        ["ParentClass" as SymbolName]
      );
      registry.update_file(parent_file, [parent]);
      registry.update_file(child_file, [child]);
      return { parent, child };
    }

    it("returns the parents whose subtype set gained the file's subtypes", () => {
      const { parent, child } = parent_and_child();

      const changed = registry.resolve_type_heritage(child_file, (_scope_id, name) =>
        name === parent.name ? parent.symbol_id : null
      );

      expect(changed).toEqual(new Set([parent.symbol_id]));
      expect(new Set(registry.get_subtypes(parent.symbol_id))).toEqual(
        new Set([child.symbol_id])
      );
      expect(registry.get_parent_types(child.symbol_id)).toEqual([parent.symbol_id]);
    });

    it("returns no parent when the file's heritage names nothing that resolves", () => {
      parent_and_child();

      expect(registry.resolve_type_heritage(child_file, () => null)).toEqual(new Set());
      expect(registry.resolve_type_heritage(parent_file, () => null)).toEqual(new Set());
    });

    it("returns no parent when re-resolving leaves the file's edges as they were", () => {
      const { parent, child } = parent_and_child();
      const resolve = (_scope_id: ScopeId, name: SymbolName): SymbolId | null =>
        name === parent.name ? parent.symbol_id : null;

      expect(registry.resolve_type_heritage(child_file, resolve)).toEqual(
        new Set([parent.symbol_id])
      );
      expect(registry.resolve_type_heritage(child_file, resolve)).toEqual(new Set());
      expect(registry.get_parent_types(child.symbol_id)).toEqual([parent.symbol_id]);
    });

    it("returns the parent a re-resolved file no longer extends, and drops the edge", () => {
      const { parent, child } = parent_and_child();
      registry.resolve_type_heritage(child_file, (_scope_id, name) =>
        name === parent.name ? parent.symbol_id : null
      );

      expect(registry.resolve_type_heritage(child_file, () => null)).toEqual(
        new Set([parent.symbol_id])
      );
      expect(new Set(registry.get_subtypes(parent.symbol_id))).toEqual(new Set());
      expect(registry.get_parent_types(child.symbol_id)).toEqual([]);
    });

    it("keys an edge on the definition a qualified parent name resolves to", () => {
      const visitor_file = "output_ast.ts" as FilePath;
      const visitor = interface_with_method(
        visitor_file,
        `scope:${visitor_file}:module` as ScopeId,
        "TypeVisitor",
        1,
        "visitType",
        []
      );
      const emitter_file = "abstract_emitter.ts" as FilePath;
      const emitter = make_class_with_members(
        emitter_file,
        `scope:${emitter_file}:module` as ScopeId,
        "AbstractEmitterVisitor",
        1,
        ["o.TypeVisitor" as SymbolName]
      );
      registry.update_file(visitor_file, [visitor]);
      registry.update_file(emitter_file, [emitter]);
      const names_seen: SymbolName[] = [];

      registry.resolve_type_heritage(emitter_file, (_scope_id, name) => {
        names_seen.push(name);
        return name === "o.TypeVisitor" ? visitor.symbol_id : null;
      });

      expect(names_seen).toEqual(["o.TypeVisitor"]);
      expect(registry.get_parent_types(emitter.symbol_id)).toEqual([visitor.symbol_id]);
    });

    it("registers both edges for a class implementing two same-named interfaces from different modules", () => {
      const facade_a_file = "compiler/src/compiler_facade_interface.ts" as FilePath;
      const facade_b_file = "core/src/compiler/compiler_facade_interface.ts" as FilePath;
      const facade_a = interface_with_method(
        facade_a_file,
        `scope:${facade_a_file}:module` as ScopeId,
        "CompilerFacade",
        1,
        "compilePipe",
        []
      );
      const facade_b = interface_with_method(
        facade_b_file,
        `scope:${facade_b_file}:module` as ScopeId,
        "CompilerFacade",
        1,
        "compilePipe",
        []
      );
      const impl_file = "compiler/src/jit_compiler_facade.ts" as FilePath;
      const impl = make_class_with_members(
        impl_file,
        `scope:${impl_file}:module` as ScopeId,
        "CompilerFacadeImpl",
        1,
        ["core.CompilerFacade" as SymbolName, "CompilerFacade" as SymbolName]
      );
      registry.update_file(facade_a_file, [facade_a]);
      registry.update_file(facade_b_file, [facade_b]);
      registry.update_file(impl_file, [impl]);

      const changed = registry.resolve_type_heritage(impl_file, (_scope_id, name) =>
        name === "core.CompilerFacade" ? facade_b.symbol_id : facade_a.symbol_id
      );

      expect(facade_a.symbol_id).not.toEqual(facade_b.symbol_id);
      expect(changed).toEqual(new Set([facade_a.symbol_id, facade_b.symbol_id]));
      expect(registry.get_parent_types(impl.symbol_id)).toEqual([
        facade_b.symbol_id,
        facade_a.symbol_id,
      ]);
      expect(new Set(registry.get_subtypes(facade_a.symbol_id))).toEqual(
        new Set([impl.symbol_id])
      );
      expect(new Set(registry.get_subtypes(facade_b.symbol_id))).toEqual(
        new Set([impl.symbol_id])
      );
    });

    it("orders parent_types as the declaration writes them: class X extends Base implements I", () => {
      const file_id = "x.ts" as FilePath;
      const scope_id = `scope:${file_id}:module` as ScopeId;
      const contract = interface_with_method(file_id, scope_id, "I", 1, "run", []);
      const base = make_class_with_members(file_id, scope_id, "Base", 10, []);
      const derived = make_class_with_members(file_id, scope_id, "X", 20, [
        base.name,
        contract.name,
      ]);
      registry.update_file(file_id, [contract, base, derived]);

      registry.resolve_type_heritage(file_id, resolve_in_own_scope(registry));

      expect(registry.get_parent_types(derived.symbol_id)).toEqual([
        base.symbol_id,
        contract.symbol_id,
      ]);
    });

    it("keeps a declared parent ahead of a structural one that arrived first", () => {
      const file_id = "x.ts" as FilePath;
      const scope_id = `scope:${file_id}:module` as ScopeId;
      const inferred = interface_with_method(file_id, scope_id, "Disposable", 1, "dispose", []);
      const base = make_class_with_members(file_id, scope_id, "Base", 10, []);
      const derived = make_class_with_members(file_id, scope_id, "X", 20, [base.name]);
      registry.update_file(file_id, [inferred, base, derived]);
      registry["heritage"].register_subtype(
        inferred.symbol_id,
        derived.symbol_id,
        "structural",
        file_id
      );

      registry.resolve_type_heritage(file_id, resolve_in_own_scope(registry));

      expect(registry.get_parent_types(derived.symbol_id)).toEqual([
        base.symbol_id,
        inferred.symbol_id,
      ]);
      expect(registry["verify_reverse_indices"]()).toBeNull();
    });

    it("attaches a Rust impl's methods and records its trait edge from a file that declares neither the trait nor the type, and evicts both with that file", () => {
      const trait_file = "src/fold.rs" as FilePath;
      const trait_def = interface_with_method(
        trait_file,
        `scope:${trait_file}:module` as ScopeId,
        "DocFolder",
        1,
        "fold_item",
        []
      );
      const type_file = "src/cache.rs" as FilePath;
      const type_def = make_class_with_members(
        type_file,
        `scope:${type_file}:module` as ScopeId,
        "CacheBuilder",
        1,
        []
      );
      const impl_file = "src/cache_impl.rs" as FilePath;
      const impl_scope = `scope:${impl_file}:module` as ScopeId;
      const fold_item: MethodDefinition = {
        ...method_in(impl_file, impl_scope, "fold_item", 2),
        impl_self_type: "CacheBuilder" as SymbolName,
        impl_trait_name: "DocFolder" as SymbolName,
      };
      const fold_crate: MethodDefinition = {
        ...method_in(impl_file, impl_scope, "fold_crate", 5),
        impl_self_type: "CacheBuilder" as SymbolName,
        impl_trait_name: "DocFolder" as SymbolName,
      };
      registry.update_file(trait_file, [trait_def]);
      registry.update_file(type_file, [type_def]);
      registry.update_file(impl_file, [fold_item, fold_crate]);

      const resolve = (_scope_id: ScopeId, name: SymbolName): SymbolId | null =>
        name === "DocFolder"
          ? trait_def.symbol_id
          : name === "CacheBuilder"
            ? type_def.symbol_id
            : null;

      registry.attach_impl_methods(impl_file, resolve);
      const changed = registry.resolve_type_heritage(impl_file, resolve);

      expect(registry.get_member_owner(fold_item.symbol_id)).toBe(type_def.symbol_id);
      expect(registry.get_member_index().get(type_def.symbol_id)?.get(fold_crate.name)).toBe(
        fold_crate.symbol_id
      );
      expect(changed).toEqual(new Set([trait_def.symbol_id]));
      expect(registry.get_parent_types(type_def.symbol_id)).toEqual([trait_def.symbol_id]);

      registry.remove_file(impl_file);

      expect(registry.get_parent_types(type_def.symbol_id)).toEqual([]);
      expect(new Set(registry.get_subtypes(trait_def.symbol_id))).toEqual(new Set());
      expect(names_of(registry.get_member_index().get(type_def.symbol_id))).toEqual([
        "CacheBuilder_run",
        "CacheBuilder_state",
        "constructor",
      ]);
      expect(registry.get_member_owner(fold_item.symbol_id)).toBeUndefined();
    });

    it("attaches an inherent Rust impl's method and records no edge for it", () => {
      const type_file = "src/cache.rs" as FilePath;
      const type_def = make_class_with_members(
        type_file,
        `scope:${type_file}:module` as ScopeId,
        "CacheBuilder",
        1,
        []
      );
      const impl_file = "src/cache_impl.rs" as FilePath;
      const build: MethodDefinition = {
        ...method_in(impl_file, `scope:${impl_file}:module` as ScopeId, "build", 2),
        impl_self_type: "CacheBuilder" as SymbolName,
      };
      registry.update_file(type_file, [type_def]);
      registry.update_file(impl_file, [build]);
      registry.attach_impl_methods(impl_file, () => type_def.symbol_id);

      expect(
        registry.resolve_type_heritage(impl_file, () => type_def.symbol_id)
      ).toEqual(new Set());
      expect(registry.get_parent_types(type_def.symbol_id)).toEqual([]);
      expect(registry.get_member_owner(build.symbol_id)).toBe(type_def.symbol_id);
    });

    it("records no edge to a parent that is not a class or interface", () => {
      const { child } = parent_and_child();
      const helper = named_function(parent_file, "ParentClass" as SymbolName, 40);
      registry.update_file(parent_file, [helper]);

      registry.resolve_type_heritage(child_file, () => helper.symbol_id);

      expect(registry.get_parent_types(child.symbol_id)).toEqual([]);
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

      expect(new Set(registry.get_subtypes(func.symbol_id))).toEqual(new Set());
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

  describe("get_scope_rebindings", () => {
    const file = "mapper.py" as FilePath;
    const module_scope = `module:${file}:1:1:9:0` as ScopeId;
    const function_scope = `function:${file}:3:9:9:0` as ScopeId;

    function at(line: number, column: number): Location {
      return { file_path: file, start_line: line, start_column: column, end_line: line, end_column: column + 10 };
    }

    function variable(name: string, scope_id: ScopeId, location: Location): VariableDefinition {
      return {
        kind: "variable",
        symbol_id: variable_symbol(name as SymbolName, location),
        name: name as SymbolName,
        defining_scope_id: scope_id,
        location,
        is_exported: false,
      };
    }

    const later = variable("mapper_cls", function_scope, at(6, 4));
    const earlier = variable("mapper_cls", function_scope, at(4, 4));
    const parameter = {
      kind: "parameter",
      symbol_id: `parameter:${file}:3:10:3:20:mapper_cls` as SymbolId,
      name: "mapper_cls" as SymbolName,
      defining_scope_id: function_scope,
      location: at(3, 10),
    } as const;
    const outer = variable("mapper_cls", module_scope, at(1, 0));
    const single = variable("parser", function_scope, at(5, 4));

    it("lists every binding of a rebound name in its scope in source order, parameters included", () => {
      registry.update_file(file, [later, single, outer, earlier, parameter]);

      expect({
        later: registry.get_scope_rebindings(later.symbol_id),
        parameter: registry.get_scope_rebindings(parameter.symbol_id),
      }).toEqual({
        later: [parameter.symbol_id, earlier.symbol_id, later.symbol_id],
        parameter: [parameter.symbol_id, earlier.symbol_id, later.symbol_id],
      });
    });

    it("holds nothing for a name its scope binds once, whatever an enclosing scope binds", () => {
      registry.update_file(file, [later, single, outer, earlier]);

      expect({
        single: registry.get_scope_rebindings(single.symbol_id),
        outer: registry.get_scope_rebindings(outer.symbol_id),
      }).toEqual({ single: [], outer: [] });
    });

    it("forgets a file's rebindings when the file is removed", () => {
      registry.update_file(file, [later, earlier]);
      registry.remove_file(file);

      expect(registry.get_scope_rebindings(later.symbol_id)).toEqual([]);
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
      registry.resolve_type_heritage(file.file_id, resolve_in_own_scope(registry));

      expect(new Set(registry.get_subtypes(base.symbol_id))).toEqual(
        new Set([child.symbol_id])
      );

      registry.remove_file(file.file_id);

      expect(new Set(registry.get_subtypes(base.symbol_id))).toEqual(new Set());
      expect(registry.get_parent_types(child.symbol_id)).toEqual([]);
      expect(registry["heritage"]["type_subtypes"].size).toBe(0);
      expect(registry["heritage"]["edges_by_file"].size).toBe(0);
      expect(registry["members"]["owner_members"].size).toBe(0);
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
      expect(registry["members"]["owner_members"].size).toBe(0);
      expect(registry.get_member_owner(alias.symbol_id)).toBeUndefined();
    });

    it("names the reverse index a write site forgot", () => {
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);

      registry["members"]["owner_members"].delete(file.definitions[0].symbol_id);

      expect(registry["verify_reverse_indices"]()).toContain(
        "owner_members is missing"
      );
    });

    it("names the reverse index an eviction path left behind", () => {
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);
      registry.resolve_type_heritage(file.file_id, resolve_in_own_scope(registry));

      registry["heritage"]["type_subtypes"].clear();

      expect(registry["verify_reverse_indices"]()).toContain(
        "parent_types still holds"
      );
    });

    it("names a subtype edge its writing file no longer records", () => {
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);
      registry.resolve_type_heritage(file.file_id, resolve_in_own_scope(registry));

      registry["heritage"]["edges_by_file"].clear();

      expect(registry["verify_reverse_indices"]()).toContain(
        "edges_by_file is missing"
      );
    });

    it("names a parent_types list that puts a declared parent behind a structural one", () => {
      const file_id = "x.ts" as FilePath;
      const scope_id = `scope:${file_id}:module` as ScopeId;
      const inferred = interface_with_method(file_id, scope_id, "Disposable", 1, "dispose", []);
      const base = make_class_with_members(file_id, scope_id, "Base", 10, []);
      const derived = make_class_with_members(file_id, scope_id, "X", 20, [base.name]);
      registry.update_file(file_id, [inferred, base, derived]);
      registry.resolve_type_heritage(file_id, resolve_in_own_scope(registry));
      registry["heritage"].register_subtype(
        inferred.symbol_id,
        derived.symbol_id,
        "structural",
        file_id
      );

      registry["heritage"]["parent_types"].get(derived.symbol_id)!.reverse();

      expect(registry["verify_reverse_indices"]()).toContain(
        "declared parent behind a structural one"
      );
    });

    it("throws on the next registry write once a reverse index has diverged", () => {
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);

      registry["members"]["owner_members"].delete(file.definitions[0].symbol_id);

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
            loaded.resolve_type_heritage(file.file_id, resolve_in_own_scope(loaded));
            files.push(file);
          }

          const counts = count_registry_map_access(loaded);
          for (const file of files) {
            loaded.remove_file(file.file_id);
          }

          const evicted_symbols = file_count * CLASSES_PER_FILE;
          expect(counts.scanned_entries).toBe(0);
          expect(loaded["members"]["member_owner"].size).toBe(0);
          expect(loaded["members"]["owner_members"].size).toBe(0);
          expect(loaded["heritage"]["type_subtypes"].size).toBe(0);
          expect(loaded["heritage"]["parent_types"].size).toBe(0);
          expect(loaded["heritage"]["edges_by_file"].size).toBe(0);
          expect(loaded["members"]["member_index"].size).toBe(0);
          expect(loaded["members"]["members_by_file"].size).toBe(0);
          expect(loaded["members"]["members_by_name"].size).toBe(0);
          per_symbol.push(counts.keyed_operations / evicted_symbols);
        }

        const lowest = Math.min(...per_symbol);
        const highest = Math.max(...per_symbol);
        expect((highest - lowest) / lowest).toBeLessThanOrEqual(0.25);
      });

      it("scans no map end to end while re-resolving a file whose heritage is unchanged", () => {
        const file = inheritance_file(0);
        const [base, child] = file.definitions;
        registry.update_file(file.file_id, file.definitions);
        const resolve_base = (): SymbolId | null => base.symbol_id;
        registry.resolve_type_heritage(file.file_id, resolve_base);

        const counts = count_registry_map_access(registry);
        const changed = registry.resolve_type_heritage(file.file_id, resolve_base);

        expect(counts.scanned_entries).toBe(0);
        expect(changed).toEqual(new Set());
        expect(new Set(registry.get_subtypes(base.symbol_id))).toEqual(
          new Set([child.symbol_id])
        );
      });
    });
  });

  /**
   * A type's members are the union of every file that contributes them,
   * recorded per file so an eviction takes back exactly what its file brought.
   * No pipeline pass contributes across files yet — TASK-376.8's `impl` attach
   * pass is the first — so these drive `attach_members` directly.
   */
  describe("member index across files", () => {
    const declaring = "types.rs" as FilePath;
    const declaring_scope = `scope:${declaring}:module` as ScopeId;
    const impl_file = "impls.rs" as FilePath;
    const impl_scope = `scope:${impl_file}:module` as ScopeId;

    function registry_with_cross_file_member(): {
      registry: DefinitionRegistry;
      type: ClassDefinition;
      attached: MethodDefinition;
    } {
      const registry = new DefinitionRegistry();
      const type = make_class_with_members(declaring, declaring_scope, "Lowering", 1, []);
      const attached = method_in(impl_file, impl_scope, "descend", 3);
      registry.update_file(declaring, [type]);
      registry.update_file(impl_file, [attached]);
      registry.attach_members(
        type.symbol_id,
        new Map([[attached.name, attached.symbol_id]])
      );
      return { registry, type, attached };
    }

    it("exposes the union of members attached from two files under one type", () => {
      const { registry, type, attached } = registry_with_cross_file_member();

      expect(names_of(registry.get_member_index().get(type.symbol_id))).toEqual([
        "Lowering_run",
        "Lowering_state",
        "constructor",
        "descend",
      ]);
      expect(registry.get_member_index().get(type.symbol_id)?.get(attached.name)).toBe(
        attached.symbol_id
      );
      expect(registry["verify_reverse_indices"]()).toBeNull();
    });

    it("evicts exactly the evicted file's members and leaves the declaring file's", () => {
      const { registry, type } = registry_with_cross_file_member();

      registry.remove_file(impl_file);

      expect(names_of(registry.get_member_index().get(type.symbol_id))).toEqual([
        "Lowering_run",
        "Lowering_state",
        "constructor",
      ]);
      expect(registry.get_members_by_name("descend" as SymbolName)).toEqual(new Set());
      expect(registry["verify_reverse_indices"]()).toBeNull();
    });

    it("keeps another file's contribution when the declaring file is re-indexed", () => {
      const { registry, type, attached } = registry_with_cross_file_member();

      registry.update_file(declaring, [type]);

      expect(registry.get_member_index().get(type.symbol_id)?.get(attached.name)).toBe(
        attached.symbol_id
      );
      expect(registry["verify_reverse_indices"]()).toBeNull();
    });

    it("neither duplicates nor loses members when a file is updated twice", () => {
      const registry = new DefinitionRegistry();
      const type = make_class_with_members(declaring, declaring_scope, "Lowering", 1, []);
      const dropped = type.methods[0];
      const trimmed: ClassDefinition = { ...type, methods: [] };

      registry.update_file(declaring, [type]);
      registry.update_file(declaring, [trimmed]);

      // The second index is the whole truth about the file: the method it no
      // longer declares is gone from both the index and its provenance.
      expect(names_of(registry.get_member_index().get(type.symbol_id))).toEqual([
        "Lowering_state",
        "constructor",
      ]);
      expect(registry["members"]["members_by_file"].get(declaring)?.get(type.symbol_id)).toEqual(
        new Set(["Lowering_state", "constructor"])
      );
      expect(registry.get_members_by_name(dropped.name)).toEqual(new Set());
      expect(registry.get_members_by_name("Lowering_state" as SymbolName)).toEqual(
        new Set([type.symbol_id])
      );
      expect(registry["verify_reverse_indices"]()).toBeNull();
    });

    it("takes a contribution back from a file that declares nothing of its own", () => {
      const registry = new DefinitionRegistry();
      const type = make_class_with_members(declaring, declaring_scope, "Lowering", 1, []);
      const attached = method_in(impl_file, impl_scope, "descend", 3);
      registry.update_file(declaring, [type]);
      // A Rust `impl` block for a type declared elsewhere indexes to no
      // top-level definition of its own, so the file is absent from by_file.
      registry["by_symbol"].set(attached.symbol_id, attached);
      registry.attach_members(type.symbol_id, [[attached.name, attached.symbol_id]]);
      expect(registry.get_members_by_name(attached.name)).toEqual(
        new Set([type.symbol_id])
      );

      registry.remove_file(impl_file);

      expect(registry.get_member_index().get(type.symbol_id)?.has(attached.name)).toBe(
        false
      );
      expect(registry.get_members_by_name(attached.name)).toEqual(new Set());
      expect(registry["members"]["members_by_file"].has(impl_file)).toBe(false);
      expect(registry["verify_reverse_indices"]()).toBeNull();
    });

    it("re-indexing the contributing file takes its contribution with it until it is attached again", () => {
      const { registry, type, attached } = registry_with_cross_file_member();
      const other = method_in(impl_file, impl_scope, "unrelated", 9);

      registry.update_file(impl_file, [attached, other]);

      // Eviction is per file, so the producer that attached a member re-attaches
      // it when its file is indexed again.
      expect(registry.get_member_index().get(type.symbol_id)?.has(attached.name)).toBe(
        false
      );
      registry.attach_members(type.symbol_id, [[attached.name, attached.symbol_id]]);
      expect(registry.get_member_index().get(type.symbol_id)?.get(attached.name)).toBe(
        attached.symbol_id
      );
      expect(registry["verify_reverse_indices"]()).toBeNull();
    });

    it("keeps a contribution to a type whose own declaration is evicted", () => {
      const { registry, type, attached } = registry_with_cross_file_member();

      registry.remove_file(declaring);

      // The type's own members left with its file; the contribution waits for
      // the declaration to come back, so `get_members_by_name` can name a type
      // the registry no longer holds.
      expect(names_of(registry.get_member_index().get(type.symbol_id))).toEqual([
        "descend",
      ]);
      expect(registry.get_members_by_name(attached.name)).toEqual(
        new Set([type.symbol_id])
      );
      expect(names_of(registry.get_member_closure(type.symbol_id))).toEqual([
        "descend",
      ]);
      expect(registry.get(type.symbol_id)).toBeUndefined();
      expect(registry["verify_reverse_indices"]()).toBeNull();
    });

    it("leaves no member index entry for a type that declares no members", () => {
      const registry = new DefinitionRegistry();
      const declared = interface_with_method(declaring, declaring_scope, "Marker", 1, "mark", []);
      const marker: InterfaceDefinition = { ...declared, methods: [] };
      registry.update_file(declaring, [marker]);
      expect(registry.get_member_index().get(marker.symbol_id)).toBeUndefined();

      registry.remove_file(declaring);

      expect(registry.get_member_index().get(marker.symbol_id)).toBeUndefined();
      expect(registry["verify_reverse_indices"]()).toBeNull();
    });

    it("refuses a member the registry does not hold, because its file is the provenance", () => {
      const registry = new DefinitionRegistry();
      const type = make_class_with_members(declaring, declaring_scope, "Lowering", 1, []);
      const unregistered = method_in(impl_file, impl_scope, "descend", 3);
      registry.update_file(declaring, [type]);

      expect(() =>
        registry.attach_members(type.symbol_id, [
          [unregistered.name, unregistered.symbol_id],
        ])
      ).toThrow("which the registry does not hold");
    });

    it("gives a getter the slot whichever accessor is attached first", () => {
      const registry = new DefinitionRegistry();
      const type = make_class_with_members(declaring, declaring_scope, "Job", 1, []);
      const name = "value" as SymbolName;
      const getter: MethodDefinition = {
        ...method_in(declaring, declaring_scope, name, 20),
        accessor_kind: "getter",
      };
      const setter: MethodDefinition = {
        ...method_in(declaring, declaring_scope, name, 24),
        accessor_kind: "setter",
      };

      for (const order of [
        [getter, setter],
        [setter, getter],
      ]) {
        registry.update_file(declaring, [{ ...type, methods: order }]);
        expect(registry.get_member_index().get(type.symbol_id)?.get(name)).toBe(
          getter.symbol_id
        );
        expect(registry["verify_reverse_indices"]()).toBeNull();
      }
    });

    it("lets the later of two properties hold the name", () => {
      const registry = new DefinitionRegistry();
      const type = make_class_with_members(declaring, declaring_scope, "Job", 1, []);
      const first = type.properties[0];
      const second: PropertyDefinition = {
        ...first,
        symbol_id: property_symbol(first.name, member_location(declaring, 30)),
        location: member_location(declaring, 30),
      };
      registry.update_file(declaring, [{ ...type, properties: [first, second] }]);

      expect(registry.get_member_index().get(type.symbol_id)?.get(first.name)).toBe(
        second.symbol_id
      );
      expect(registry["verify_reverse_indices"]()).toBeNull();
    });

    it("lets a callable take a name a property holds, and keeps the property as a member the type owns", () => {
      const registry = new DefinitionRegistry();
      const type = make_class_with_members(declaring, declaring_scope, "Job", 1, []);
      const field = type.properties[0];
      const method = method_in(impl_file, impl_scope, field.name, 3);
      registry.update_file(declaring, [type]);
      registry.update_file(impl_file, [method]);

      registry.attach_members(type.symbol_id, new Map([[method.name, method.symbol_id]]));

      expect(registry.get_member_index().get(type.symbol_id)?.get(field.name)).toBe(method.symbol_id);
      expect(registry.get_member_owner(field.symbol_id)).toBe(type.symbol_id);
      expect(registry.get(field.symbol_id)).toEqual(field);
      expect(registry["verify_reverse_indices"]()).toBeNull();

      registry.remove_file(impl_file);

      // The name left with the method's file; the field stays a member the
      // type owns, reachable through ownership rather than the callable index.
      expect(registry.get_member_index().get(type.symbol_id)?.has(field.name)).toBe(false);
      expect(registry.get_member_owner(field.symbol_id)).toBe(type.symbol_id);
      expect(registry["verify_reverse_indices"]()).toBeNull();
    });

    it("tears members_by_name down per file", () => {
      const registry = new DefinitionRegistry();
      const first = inheritance_file(0);
      const second = inheritance_file(1);
      registry.update_file(first.file_id, first.definitions);
      registry.update_file(second.file_id, second.definitions);

      expect(registry.get_members_by_name("constructor" as SymbolName)).toEqual(
        new Set([...first.definitions, ...second.definitions].map((def) => def.symbol_id))
      );

      registry.remove_file(first.file_id);

      expect(registry.get_members_by_name("constructor" as SymbolName)).toEqual(
        new Set(second.definitions.map((def) => def.symbol_id))
      );
      expect(registry.get_members_by_name("Base0_run" as SymbolName)).toEqual(new Set());
    });

    it("reports a members_by_file entry a write site failed to populate", () => {
      const registry = new DefinitionRegistry();
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);

      registry["members"]["members_by_file"].clear();

      expect(registry["verify_reverse_indices"]()).toContain("members_by_file is missing");
    });

    it("reports a members_by_file name an eviction path left behind", () => {
      const registry = new DefinitionRegistry();
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);

      const [type_id] = [...registry["members"]["members_by_file"].get(file.file_id)!.keys()];
      registry["members"]["members_by_file"]
        .get(file.file_id)!
        .get(type_id)!
        .add("departed" as SymbolName);

      expect(registry["verify_reverse_indices"]()).toBe(
        `members_by_file["${file.file_id} → ${type_id}"] still holds "departed", which member_index no longer has`
      );
    });

    it("reports a members_by_name entry a write site failed to populate", () => {
      const registry = new DefinitionRegistry();
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);

      registry["members"]["members_by_name"].clear();

      expect(registry["verify_reverse_indices"]()).toContain("members_by_name is missing");
    });

    it("reports a member the index holds that no definition can own", () => {
      const registry = new DefinitionRegistry();
      const file = inheritance_file(0);
      registry.update_file(file.file_id, file.definitions);
      const type_id = file.definitions[0].symbol_id;
      const member_id = registry
        .get_member_index()
        .get(type_id)!
        .get("Base0_run" as SymbolName)!;

      registry["by_symbol"].delete(member_id);

      expect(registry["verify_reverse_indices"]()).toContain("no file can own it");
    });
  });

  describe("take_changed_member_types", () => {
    const file = "shapes.ts" as FilePath;
    const scope = `scope:${file}:module` as ScopeId;
    const impl_file = "impls.rs" as FilePath;
    const impl_scope = `scope:${impl_file}:module` as ScopeId;

    /** `type` with its `run` method moved to `line`: a new symbol under the same name. */
    function with_run_at(type: ClassDefinition, line: number): ClassDefinition {
      const [run, ...rest] = type.methods;
      return { ...type, methods: [method_in(file, run.defining_scope_id, run.name, line), ...rest] };
    }

    it("reports nothing for a file not evicted since it was last asked", () => {
      const type = make_class_with_members(file, scope, "Square", 1, []);
      registry.update_file(file, [type]);
      registry.take_changed_member_types(file);

      expect(registry.take_changed_member_types(file)).toEqual(new Set());
      expect(registry.take_changed_member_types("never_seen.ts" as FilePath)).toEqual(new Set());
    });

    it("reports every type a newly registered file contributes members to", () => {
      const square = make_class_with_members(file, scope, "Square", 1, []);
      const circle = make_class_with_members(file, scope, "Circle", 10, []);

      registry.update_file(file, [square, circle]);

      expect(registry.take_changed_member_types(file)).toEqual(
        new Set([square.symbol_id, circle.symbol_id])
      );
    });

    it("reports nothing when a re-registration contributes the same members", () => {
      const type = make_class_with_members(file, scope, "Square", 1, []);
      registry.update_file(file, [type]);
      registry.take_changed_member_types(file);

      registry.update_file(file, [type]);

      expect(registry.take_changed_member_types(file)).toEqual(new Set());
    });

    it("reports a type whose member moved to a new symbol, and not its unchanged neighbour", () => {
      const square = make_class_with_members(file, scope, "Square", 1, []);
      const circle = make_class_with_members(file, scope, "Circle", 10, []);
      registry.update_file(file, [square, circle]);
      registry.take_changed_member_types(file);

      registry.update_file(file, [with_run_at(square, 4), circle]);

      expect(registry.take_changed_member_types(file)).toEqual(new Set([square.symbol_id]));
    });

    it("compares against the members before the first eviction, however often the file is re-registered before it is asked", () => {
      const type = make_class_with_members(file, scope, "Square", 1, []);
      registry.update_file(file, [type]);
      registry.take_changed_member_types(file);

      registry.update_file(file, [with_run_at(type, 4)]);
      registry.update_file(file, [type]);

      expect(registry.take_changed_member_types(file)).toEqual(new Set());
    });

    it("reports every type a removed file contributed to, including a type another file declares", () => {
      const type = make_class_with_members(file, scope, "Lowering", 1, []);
      const attached = method_in(impl_file, impl_scope, "descend", 3);
      registry.update_file(file, [type]);
      registry.update_file(impl_file, [attached]);
      registry.attach_members(type.symbol_id, [[attached.name, attached.symbol_id]]);
      registry.take_changed_member_types(impl_file);

      registry.remove_file(impl_file);

      expect(registry.take_changed_member_types(impl_file)).toEqual(new Set([type.symbol_id]));
    });
  });

  describe("get_member_closure", () => {
    const file = "hierarchy.ts" as FilePath;
    const scope = `scope:${file}:module` as ScopeId;

    it("returns own members plus the parent-class chain, with the nearest declaration winning", () => {
      const registry = new DefinitionRegistry();
      const base = make_class_with_members(file, scope, "Base", 1, []);
      const child = make_class_with_members(file, scope, "Child", 10, [base.name]);
      const overriding = method_in(file, `scope:${file}:class:Child:10:0` as ScopeId, base.methods[0].name, 12);
      const child_with_override: ClassDefinition = { ...child, methods: [...child.methods, overriding] };
      registry.update_file(file, [base, child_with_override]);
      registry.resolve_type_heritage(file, resolve_in_own_scope(registry));

      const closure = registry.get_member_closure(child.symbol_id);

      expect(names_of(closure)).toEqual([
        "Base_run",
        "Base_state",
        "Child_run",
        "Child_state",
        "constructor",
      ]);
      expect(closure.get(base.methods[0].name)).toBe(overriding.symbol_id);
      expect(closure.get("constructor" as SymbolName)).toBe(child.constructors![0].symbol_id);
    });

    it("excludes an implemented interface's signatures and includes a parent interface's for an interface", () => {
      const registry = new DefinitionRegistry();
      const parent_interface = interface_with_method(file, scope, "Disposable", 1, "dispose", []);
      const child_interface = interface_with_method(file, scope, "Closeable", 5, "close", [parent_interface.name]);
      const implementing = make_class_with_members(file, scope, "Handle", 10, [child_interface.name]);
      registry.update_file(file, [parent_interface, child_interface, implementing]);
      registry.resolve_type_heritage(file, resolve_in_own_scope(registry));

      // `extends` conflates extends and implements, so the class walks no
      // interface: its closure is its own members only.
      expect(names_of(registry.get_member_closure(implementing.symbol_id))).toEqual([
        "Handle_run",
        "Handle_state",
        "constructor",
      ]);
      // An interface walks its parent interfaces.
      expect(names_of(registry.get_member_closure(child_interface.symbol_id))).toEqual([
        "close",
        "dispose",
      ]);
    });

    it("terminates on a cycle in a malformed hierarchy", () => {
      const registry = new DefinitionRegistry();
      const left = make_class_with_members(file, scope, "Left", 1, ["Right" as SymbolName]);
      const right = make_class_with_members(file, scope, "Right", 10, ["Left" as SymbolName]);
      registry.update_file(file, [left, right]);
      registry.resolve_type_heritage(file, resolve_in_own_scope(registry));

      expect(names_of(registry.get_member_closure(left.symbol_id))).toEqual([
        "Left_run",
        "Left_state",
        "Right_run",
        "Right_state",
        "constructor",
      ]);
    });

    it("survives the eviction of a parent's file", () => {
      const registry = new DefinitionRegistry();
      const base_file = "base.ts" as FilePath;
      const base = make_class_with_members(base_file, `scope:${base_file}:module` as ScopeId, "Base", 1, []);
      const child = make_class_with_members(file, scope, "Child", 10, [base.name]);
      registry.update_file(base_file, [base]);
      registry.update_file(file, [child]);
      registry.resolve_type_heritage(file, (_scope_id, name) =>
        name === base.name ? base.symbol_id : null
      );
      expect(names_of(registry.get_member_closure(child.symbol_id))).toEqual([
        "Base_run",
        "Base_state",
        "Child_run",
        "Child_state",
        "constructor",
      ]);

      registry.remove_file(base_file);

      // The edge goes with the parent, so the closure is the child's own
      // members whether the parent's members or the edge left first.
      expect(registry.get_parent_types(child.symbol_id)).toEqual([]);
      expect(names_of(registry.get_member_closure(child.symbol_id))).toEqual([
        "Child_run",
        "Child_state",
        "constructor",
      ]);
    });

    it("keeps a parent class's members and drops an implemented interface's for a class with both", () => {
      const registry = new DefinitionRegistry();
      const contract = interface_with_method(file, scope, "Runnable", 1, "start", []);
      const base = make_class_with_members(file, scope, "Base", 10, []);
      const child = make_class_with_members(file, scope, "Child", 20, [
        base.name,
        contract.name,
      ]);
      registry.update_file(file, [contract, base, child]);
      registry.resolve_type_heritage(file, resolve_in_own_scope(registry));

      expect(names_of(registry.get_member_closure(child.symbol_id))).toEqual([
        "Base_run",
        "Base_state",
        "Child_run",
        "Child_state",
        "constructor",
      ]);
    });
  });
});

/** Classes per file in `inheritance_file`: one base and one subtype of it. */
const CLASSES_PER_FILE = 2;

function function_location(file_id: FilePath, line: number): Location {
  return {
    file_path: file_id,
    start_line: line,
    start_column: 0,
    end_line: line + 2,
    end_column: 1,
  };
}

function anonymous_function(
  file_id: FilePath,
  line: number
): FunctionDefinition {
  const location = function_location(file_id, line);
  return {
    kind: "function",
    symbol_id: anonymous_function_symbol(location),
    name: "<anonymous>" as SymbolName,
    defining_scope_id: `scope:${file_id}:module` as ScopeId,
    location,
    is_exported: false,
    signature: { parameters: [] },
    body_scope_id: `scope:${file_id}:anonymous:${line}` as ScopeId,
  };
}

function named_function(
  file_id: FilePath,
  name: SymbolName,
  line: number
): FunctionDefinition {
  const location = function_location(file_id, line);
  return {
    kind: "function",
    symbol_id: function_symbol(name, location),
    name,
    defining_scope_id: `scope:${file_id}:module` as ScopeId,
    location,
    is_exported: false,
    signature: { parameters: [] },
    body_scope_id: `scope:${file_id}:${name}:${line}` as ScopeId,
  };
}

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

/**
 * Resolves a bare name among the definitions its own scope declares — the
 * shape same-file heritage takes, without the name resolution a project runs.
 */
function resolve_in_own_scope(registry: DefinitionRegistry): TypeNameResolver {
  return (scope_id, type_name) =>
    registry.get_scope_definitions(scope_id).get(type_name) ?? null;
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
  const members = registry["members"];
  members["member_index"] = count_map_access(members["member_index"], counts);
  members["member_owner"] = count_map_access(members["member_owner"], counts);
  members["owner_members"] = count_map_access(
    members["owner_members"],
    counts
  );
  registry["by_scope"] = count_map_access(registry["by_scope"], counts);
  const heritage = registry["heritage"];
  heritage["type_subtypes"] = count_map_access(heritage["type_subtypes"], counts);
  heritage["parent_types"] = count_map_access(heritage["parent_types"], counts);
  heritage["edges_by_file"] = count_map_access(heritage["edges_by_file"], counts);
  registry["function_collections"] = count_map_access(
    registry["function_collections"],
    counts
  );
  members["members_by_file"] = count_map_access(
    members["members_by_file"],
    counts
  );
  members["members_by_name"] = count_map_access(
    members["members_by_name"],
    counts
  );
  return counts;
}

/** A method defined in `file_id`, the way an `impl` block's method belongs to the impl's file. */
function method_in(
  file_id: FilePath,
  owner_scope: ScopeId,
  name: string,
  line: number
): MethodDefinition {
  const location = member_location(file_id, line);
  return {
    kind: "method",
    symbol_id: method_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: owner_scope,
    location,
    parameters: [],
    body_scope_id: `${owner_scope}:${name}` as ScopeId,
    decorators: [],
  };
}

function interface_with_method(
  file_id: FilePath,
  scope_id: ScopeId,
  name: string,
  line: number,
  method_name: string,
  extends_names: SymbolName[]
): InterfaceDefinition {
  const location = {
    file_path: file_id,
    start_line: line,
    start_column: 0,
    end_line: line + 3,
    end_column: 1,
  };
  const body_scope = `scope:${file_id}:interface:${name}:${line}:0` as ScopeId;
  return {
    kind: "interface",
    symbol_id: interface_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: scope_id,
    location,
    is_exported: true,
    extends: extends_names,
    methods: [method_in(file_id, body_scope, method_name, line + 1)],
    properties: [],
  };
}

function names_of(members: ReadonlyMap<SymbolName, SymbolId> | undefined): string[] {
  return [...(members ?? new Map()).keys()].sort();
}


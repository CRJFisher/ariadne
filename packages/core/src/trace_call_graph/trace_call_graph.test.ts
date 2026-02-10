/**
 * Tests for trace_call_graph
 *
 * Verifies that:
 * - Callable definitions (functions, methods with bodies) become call graph nodes
 * - Interface method signatures (no body_scope_id) are excluded from entry points
 * - Entry points are correctly detected as functions with no callers
 */

import { describe, it, expect, beforeEach } from "vitest";
import { trace_call_graph } from "./trace_call_graph";
import { DefinitionRegistry } from "../resolve_references/registries/definition";
import { ResolutionRegistry } from "../resolve_references/resolve_references";
import {
  function_symbol,
  method_symbol,
  class_symbol,
  interface_symbol,
} from "@ariadnejs/types";
import type {
  FunctionDefinition,
  ClassDefinition,
  InterfaceDefinition,
  MethodDefinition,
  FilePath,
  ScopeId,
  SymbolName,
} from "@ariadnejs/types";

describe("trace_call_graph", () => {
  let definitions: DefinitionRegistry;
  let resolutions: ResolutionRegistry;
  const file1 = "test.ts" as FilePath;
  const root_scope = `scope:${file1}:module` as ScopeId;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    resolutions = new ResolutionRegistry();
  });

  it("should be a function", () => {
    expect(typeof trace_call_graph).toBe("function");
  });

  describe("interface method filtering", () => {
    it("should exclude interface method signatures from call graph nodes", () => {
      // Create an interface with method signatures (no body_scope_id)
      const interface_id = interface_symbol("MyInterface" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 1,
      });

      const method_id = method_symbol("doSomething" as SymbolName, {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 2,
        end_column: 30,
      });

      // Interface method signature - NO body_scope_id
      const interface_method: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "doSomething" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 2,
          end_column: 30,
        },
        parameters: [],
        // body_scope_id is intentionally undefined - interface methods have no body
      };

      const interface_def: InterfaceDefinition = {
        kind: "interface",
        symbol_id: interface_id,
        name: "MyInterface" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 10,
          end_column: 1,
        },
        is_exported: true,
        extends: [],
        methods: [interface_method],
        properties: [],
      };

      definitions.update_file(file1, [interface_def]);

      const call_graph = trace_call_graph(definitions, resolutions);

      // Interface method should NOT be in the call graph nodes
      expect(call_graph.nodes.has(method_id)).toBe(false);
      expect(call_graph.nodes.size).toBe(0);

      // Interface method should NOT be an entry point
      expect(call_graph.entry_points).not.toContain(method_id);
      expect(call_graph.entry_points.length).toBe(0);
    });

    it("should include class methods with body_scope_id as entry points", () => {
      const class_id = class_symbol("MyClass" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 1,
      });

      const method_id = method_symbol("doSomething" as SymbolName, {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 5,
        end_column: 3,
      });

      const method_body_scope = `scope:${file1}:method:doSomething:2:2` as ScopeId;

      // Class method WITH body_scope_id
      const class_method: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "doSomething" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 5,
          end_column: 3,
        },
        parameters: [],
        body_scope_id: method_body_scope, // Has a body
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
          end_line: 10,
          end_column: 1,
        },
        is_exported: true,
        extends: [],
        methods: [class_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(file1, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions);

      // Class method WITH body should be in the call graph nodes
      expect(call_graph.nodes.has(method_id)).toBe(true);
      expect(call_graph.nodes.size).toBe(1);

      // Class method with no callers should be an entry point
      expect(call_graph.entry_points).toContain(method_id);
      expect(call_graph.entry_points.length).toBe(1);
    });

    it("should include functions as entry points when not called", () => {
      const func_id = function_symbol("myFunction" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      const func_body_scope = `scope:${file1}:function:myFunction:1:0` as ScopeId;

      const func_def: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "myFunction" as SymbolName,
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
        body_scope_id: func_body_scope,
      };

      definitions.update_file(file1, [func_def]);

      const call_graph = trace_call_graph(definitions, resolutions);

      // Function should be in the call graph nodes
      expect(call_graph.nodes.has(func_id)).toBe(true);

      // Function with no callers should be an entry point
      expect(call_graph.entry_points).toContain(func_id);
    });

    it("should correctly distinguish interface methods from class methods", () => {
      // Interface with method signature (no body)
      const interface_id = interface_symbol("Processor" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      const interface_method_id = method_symbol("process" as SymbolName, {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 2,
        end_column: 20,
      });

      const interface_method: MethodDefinition = {
        kind: "method",
        symbol_id: interface_method_id,
        name: "process" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 2,
          end_column: 20,
        },
        parameters: [],
        // No body_scope_id - interface method
      };

      const interface_def: InterfaceDefinition = {
        kind: "interface",
        symbol_id: interface_id,
        name: "Processor" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        extends: [],
        methods: [interface_method],
        properties: [],
      };

      // Class implementing the interface (has body)
      const class_id = class_symbol("MyProcessor" as SymbolName, {
        file_path: file1,
        start_line: 10,
        start_column: 0,
        end_line: 20,
        end_column: 1,
      });

      const class_method_id = method_symbol("process" as SymbolName, {
        file_path: file1,
        start_line: 11,
        start_column: 2,
        end_line: 15,
        end_column: 3,
      });

      const class_method_body_scope = `scope:${file1}:method:process:11:2` as ScopeId;

      const class_method: MethodDefinition = {
        kind: "method",
        symbol_id: class_method_id,
        name: "process" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 11,
          start_column: 2,
          end_line: 15,
          end_column: 3,
        },
        parameters: [],
        body_scope_id: class_method_body_scope, // Has implementation
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyProcessor" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 10,
          start_column: 0,
          end_line: 20,
          end_column: 1,
        },
        is_exported: true,
        extends: ["Processor" as SymbolName],
        methods: [class_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(file1, [interface_def, class_def]);

      const call_graph = trace_call_graph(definitions, resolutions);

      // Only the class method (with body) should be in nodes
      expect(call_graph.nodes.has(interface_method_id)).toBe(false);
      expect(call_graph.nodes.has(class_method_id)).toBe(true);
      expect(call_graph.nodes.size).toBe(1);

      // Only the class method should be an entry point
      expect(call_graph.entry_points).not.toContain(interface_method_id);
      expect(call_graph.entry_points).toContain(class_method_id);
      expect(call_graph.entry_points.length).toBe(1);
    });
  });

  describe("Python dunder method filtering", () => {
    const python_file = "test.py" as FilePath;
    const python_scope = `scope:${python_file}:module` as ScopeId;

    it("should filter framework-invoked dunder methods from entry points", () => {
      // Create __str__ method (framework-invoked, should be filtered)
      const class_id = class_symbol("MyClass" as SymbolName, {
        file_path: python_file,
        start_line: 1,
        start_column: 0,
        end_line: 20,
        end_column: 0,
      });

      const str_method_id = method_symbol("__str__" as SymbolName, {
        file_path: python_file,
        start_line: 2,
        start_column: 4,
        end_line: 4,
        end_column: 0,
      });

      const str_method: MethodDefinition = {
        kind: "method",
        symbol_id: str_method_id,
        name: "__str__" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 2,
          start_column: 4,
          end_line: 4,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:__str__:2:4` as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 1,
          start_column: 0,
          end_line: 20,
          end_column: 0,
        },
        is_exported: false,
        extends: [],
        methods: [str_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(python_file, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions);

      // __str__ should be in nodes (it has a body)
      expect(call_graph.nodes.has(str_method_id)).toBe(true);

      // But __str__ should NOT be an entry point (filtered)
      expect(call_graph.entry_points).not.toContain(str_method_id);
      expect(call_graph.entry_points.length).toBe(0);
    });

    it("should NOT filter traceable dunder methods like __init__", () => {
      const class_id = class_symbol("MyClass" as SymbolName, {
        file_path: python_file,
        start_line: 1,
        start_column: 0,
        end_line: 20,
        end_column: 0,
      });

      const init_method_id = method_symbol("__init__" as SymbolName, {
        file_path: python_file,
        start_line: 2,
        start_column: 4,
        end_line: 5,
        end_column: 0,
      });

      const init_method: MethodDefinition = {
        kind: "method",
        symbol_id: init_method_id,
        name: "__init__" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 2,
          start_column: 4,
          end_line: 5,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:__init__:2:4` as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 1,
          start_column: 0,
          end_line: 20,
          end_column: 0,
        },
        is_exported: false,
        extends: [],
        methods: [init_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(python_file, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions);

      // __init__ should be in nodes
      expect(call_graph.nodes.has(init_method_id)).toBe(true);

      // __init__ SHOULD be an entry point (traceable via constructor calls)
      expect(call_graph.entry_points).toContain(init_method_id);
    });

    it("should NOT filter traceable dunder methods like __call__", () => {
      const class_id = class_symbol("Callable" as SymbolName, {
        file_path: python_file,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const call_method_id = method_symbol("__call__" as SymbolName, {
        file_path: python_file,
        start_line: 2,
        start_column: 4,
        end_line: 5,
        end_column: 0,
      });

      const call_method: MethodDefinition = {
        kind: "method",
        symbol_id: call_method_id,
        name: "__call__" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 2,
          start_column: 4,
          end_line: 5,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:__call__:2:4` as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Callable" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 1,
          start_column: 0,
          end_line: 10,
          end_column: 0,
        },
        is_exported: false,
        extends: [],
        methods: [call_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(python_file, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions);

      // __call__ should be in nodes
      expect(call_graph.nodes.has(call_method_id)).toBe(true);

      // __call__ SHOULD be an entry point (traceable via instance() calls)
      expect(call_graph.entry_points).toContain(call_method_id);
    });

    it("should filter multiple framework-invoked dunder methods", () => {
      const class_id = class_symbol("MyClass" as SymbolName, {
        file_path: python_file,
        start_line: 1,
        start_column: 0,
        end_line: 30,
        end_column: 0,
      });

      // __repr__ - framework-invoked
      const repr_method_id = method_symbol("__repr__" as SymbolName, {
        file_path: python_file,
        start_line: 2,
        start_column: 4,
        end_line: 4,
        end_column: 0,
      });

      const repr_method: MethodDefinition = {
        kind: "method",
        symbol_id: repr_method_id,
        name: "__repr__" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 2,
          start_column: 4,
          end_line: 4,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:__repr__:2:4` as ScopeId,
      };

      // __eq__ - framework-invoked
      const eq_method_id = method_symbol("__eq__" as SymbolName, {
        file_path: python_file,
        start_line: 5,
        start_column: 4,
        end_line: 7,
        end_column: 0,
      });

      const eq_method: MethodDefinition = {
        kind: "method",
        symbol_id: eq_method_id,
        name: "__eq__" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 5,
          start_column: 4,
          end_line: 7,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:__eq__:5:4` as ScopeId,
      };

      // Regular method - should remain
      const process_method_id = method_symbol("process" as SymbolName, {
        file_path: python_file,
        start_line: 8,
        start_column: 4,
        end_line: 10,
        end_column: 0,
      });

      const process_method: MethodDefinition = {
        kind: "method",
        symbol_id: process_method_id,
        name: "process" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 8,
          start_column: 4,
          end_line: 10,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:process:8:4` as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 1,
          start_column: 0,
          end_line: 30,
          end_column: 0,
        },
        is_exported: false,
        extends: [],
        methods: [repr_method, eq_method, process_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(python_file, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions);

      // All methods should be in nodes
      expect(call_graph.nodes.has(repr_method_id)).toBe(true);
      expect(call_graph.nodes.has(eq_method_id)).toBe(true);
      expect(call_graph.nodes.has(process_method_id)).toBe(true);

      // Only the regular method should be an entry point
      expect(call_graph.entry_points).not.toContain(repr_method_id);
      expect(call_graph.entry_points).not.toContain(eq_method_id);
      expect(call_graph.entry_points).toContain(process_method_id);
      expect(call_graph.entry_points.length).toBe(1);
    });

    it("should NOT filter dunder methods in TypeScript files", () => {
      // TypeScript doesn't have dunder method convention
      const ts_file = "test.ts" as FilePath;
      const ts_scope = `scope:${ts_file}:module` as ScopeId;

      const class_id = class_symbol("MyClass" as SymbolName, {
        file_path: ts_file,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      // Hypothetical __str__ in TypeScript (unusual but valid)
      const str_method_id = method_symbol("__str__" as SymbolName, {
        file_path: ts_file,
        start_line: 2,
        start_column: 2,
        end_line: 4,
        end_column: 0,
      });

      const str_method: MethodDefinition = {
        kind: "method",
        symbol_id: str_method_id,
        name: "__str__" as SymbolName,
        defining_scope_id: ts_scope,
        location: {
          file_path: ts_file,
          start_line: 2,
          start_column: 2,
          end_line: 4,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${ts_file}:method:__str__:2:2` as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: ts_scope,
        location: {
          file_path: ts_file,
          start_line: 1,
          start_column: 0,
          end_line: 10,
          end_column: 0,
        },
        is_exported: false,
        extends: [],
        methods: [str_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(ts_file, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions);

      // In TypeScript, __str__ should remain an entry point (not filtered)
      expect(call_graph.nodes.has(str_method_id)).toBe(true);
      expect(call_graph.entry_points).toContain(str_method_id);
    });
  });
});

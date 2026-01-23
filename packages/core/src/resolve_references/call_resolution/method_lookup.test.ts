/**
 * Unit Tests for Method Lookup Module
 *
 * Tests the core function for looking up methods on resolved receiver types:
 * - resolve_method_on_type: Main entry point for method lookup
 *
 * Scenarios covered:
 * - Regular class method lookup
 * - Interface polymorphic resolution
 * - Object literal FunctionCollection lookup
 * - Namespace import method lookup
 * - Fallback paths and error cases
 *
 * For full integration tests, see method.test.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolve_method_on_type } from "./method_lookup";
import type { ResolutionContext } from "./receiver_resolution";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ResolutionRegistry } from "../resolve_references";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  MethodDefinition,
  ClassDefinition,
  InterfaceDefinition,
  FunctionDefinition,
  VariableDefinition,
  ImportDefinition,
} from "@ariadnejs/types";
import {
  class_symbol,
  interface_symbol,
  method_symbol,
  function_symbol,
  variable_symbol,
} from "@ariadnejs/types";

// Test fixtures
const TEST_FILE = "test.ts" as FilePath;
const UTILS_FILE = "utils.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;
const UTILS_SCOPE_ID = "scope:utils.ts:file:0:0" as ScopeId;
const CLASS_SCOPE_ID = "scope:test.ts:MyClass:1:0" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 15,
  end_line: 5,
  end_column: 22,
};

describe("resolve_method_on_type", () => {
  let scopes: ScopeRegistry;
  let definitions: DefinitionRegistry;
  let types: TypeRegistry;
  let resolutions: ResolutionRegistry;
  let context: ResolutionContext;

  beforeEach(() => {
    scopes = new ScopeRegistry();
    definitions = new DefinitionRegistry();
    types = new TypeRegistry();
    resolutions = new ResolutionRegistry();
    context = { scopes, definitions, types, resolutions };
  });

  describe("Regular class method lookup", () => {
    it("should find method via TypeRegistry", () => {
      const class_id = class_symbol("MyClass", TEST_FILE, MOCK_LOCATION);
      const method_id = method_symbol("process", MOCK_LOCATION);

      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "process" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: "scope:test.ts:MyClass.process:2:2" as ScopeId,
        decorators: [],
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [method_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [class_def, method_def]);

      // Setup TypeRegistry to return the method
      types["resolved_type_members"] = new Map();
      types["resolved_type_members"].set(
        class_id,
        new Map([[("process" as SymbolName), method_id]])
      );

      const result = resolve_method_on_type(
        class_id,
        "process" as SymbolName,
        context
      );

      expect(result).toEqual([method_id]);
    });

    it("should find method via DefinitionRegistry fallback", () => {
      const class_id = class_symbol("MyClass", TEST_FILE, MOCK_LOCATION);
      const method_id = method_symbol("process", MOCK_LOCATION);

      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "process" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: "scope:test.ts:MyClass.process:2:2" as ScopeId,
        decorators: [],
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [method_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [class_def, method_def]);

      // TypeRegistry doesn't have the member, so it should fall back to member_index
      const result = resolve_method_on_type(
        class_id,
        "process" as SymbolName,
        context
      );

      expect(result).toEqual([method_id]);
    });

    it("should return empty array if method not found", () => {
      const class_id = class_symbol("MyClass", TEST_FILE, MOCK_LOCATION);

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [class_def]);

      const result = resolve_method_on_type(
        class_id,
        "nonexistent" as SymbolName,
        context
      );

      expect(result).toEqual([]);
    });
  });

  describe("Interface polymorphic resolution", () => {
    it("should resolve method to all implementations", () => {
      const interface_id = interface_symbol("Handler", TEST_FILE, MOCK_LOCATION);
      const class_a_id = class_symbol("HandlerA", TEST_FILE, { ...MOCK_LOCATION, start_line: 10 });
      const class_b_id = class_symbol("HandlerB", TEST_FILE, { ...MOCK_LOCATION, start_line: 20 });
      const method_a_id = method_symbol("process", { ...MOCK_LOCATION, start_line: 12 });
      const method_b_id = method_symbol("process", { ...MOCK_LOCATION, start_line: 22 });
      const interface_method_id = method_symbol("process", MOCK_LOCATION);

      // Setup interface
      const interface_method_def: MethodDefinition = {
        kind: "method",
        symbol_id: interface_method_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:test.ts:Handler:1:0" as ScopeId,
        location: MOCK_LOCATION,
        parameters: [],
        decorators: [],
      };

      const interface_def: InterfaceDefinition = {
        kind: "interface",
        symbol_id: interface_id,
        name: "Handler" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [interface_method_def],
        properties: [],
      };

      // Setup class A that implements Handler
      const method_a_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_a_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:test.ts:HandlerA:10:0" as ScopeId,
        location: { ...MOCK_LOCATION, start_line: 12 },
        parameters: [],
        body_scope_id: "scope:test.ts:HandlerA.process:12:2" as ScopeId,
        decorators: [],
      };

      const class_a_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_a_id,
        name: "HandlerA" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 10 },
        is_exported: false,
        extends: [],
        implements: ["Handler" as SymbolName],
        methods: [method_a_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Setup class B that implements Handler
      const method_b_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_b_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:test.ts:HandlerB:20:0" as ScopeId,
        location: { ...MOCK_LOCATION, start_line: 22 },
        parameters: [],
        body_scope_id: "scope:test.ts:HandlerB.process:22:2" as ScopeId,
        decorators: [],
      };

      const class_b_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_b_id,
        name: "HandlerB" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 20 },
        is_exported: false,
        extends: [],
        implements: ["Handler" as SymbolName],
        methods: [method_b_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [
        interface_def,
        interface_method_def,
        class_a_def,
        method_a_def,
        class_b_def,
        method_b_def,
      ]);

      // Set up type inheritance index (interface → implementing classes)
      definitions["type_subtypes"] = new Map();
      definitions["type_subtypes"].set(interface_id, new Set([class_a_id, class_b_id]));

      // Setup TypeRegistry to return the interface method
      types["resolved_type_members"] = new Map();
      types["resolved_type_members"].set(
        interface_id,
        new Map([[("process" as SymbolName), interface_method_id]])
      );

      const result = resolve_method_on_type(
        interface_id,
        "process" as SymbolName,
        context
      );

      // Should return both implementation methods
      expect(result).toHaveLength(2);
      expect(result).toContain(method_a_id);
      expect(result).toContain(method_b_id);
    });

    it("should return empty array for interface with no implementations", () => {
      const interface_id = interface_symbol("Handler", TEST_FILE, MOCK_LOCATION);
      const interface_method_id = method_symbol("process", MOCK_LOCATION);

      const interface_method_def: MethodDefinition = {
        kind: "method",
        symbol_id: interface_method_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:test.ts:Handler:1:0" as ScopeId,
        location: MOCK_LOCATION,
        parameters: [],
        decorators: [],
      };

      const interface_def: InterfaceDefinition = {
        kind: "interface",
        symbol_id: interface_id,
        name: "Handler" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [interface_method_def],
        properties: [],
      };

      definitions.update_file(TEST_FILE, [interface_def, interface_method_def]);

      // Setup TypeRegistry to return the interface method
      types["resolved_type_members"] = new Map();
      types["resolved_type_members"].set(
        interface_id,
        new Map([[("process" as SymbolName), interface_method_id]])
      );

      const result = resolve_method_on_type(
        interface_id,
        "process" as SymbolName,
        context
      );

      // No implementations = empty result
      expect(result).toEqual([]);
    });
  });

  describe("Class polymorphic resolution", () => {
    it("should resolve method to base and all child overrides", () => {
      const base_class_id = class_symbol("Base", TEST_FILE, MOCK_LOCATION);
      const child_class_id = class_symbol("Child", TEST_FILE, { ...MOCK_LOCATION, start_line: 10 });
      const base_method_id = method_symbol("helper", MOCK_LOCATION);
      const child_method_id = method_symbol("helper", { ...MOCK_LOCATION, start_line: 12 });

      // Setup base class with method
      const base_method_def: MethodDefinition = {
        kind: "method",
        symbol_id: base_method_id,
        name: "helper" as SymbolName,
        defining_scope_id: "scope:test.ts:Base:1:0" as ScopeId,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: "scope:test.ts:Base.helper:2:2" as ScopeId,
        decorators: [],
      };

      const base_class_def: ClassDefinition = {
        kind: "class",
        symbol_id: base_class_id,
        name: "Base" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [base_method_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Setup child class that extends Base and overrides helper
      const child_method_def: MethodDefinition = {
        kind: "method",
        symbol_id: child_method_id,
        name: "helper" as SymbolName,
        defining_scope_id: "scope:test.ts:Child:10:0" as ScopeId,
        location: { ...MOCK_LOCATION, start_line: 12 },
        parameters: [],
        body_scope_id: "scope:test.ts:Child.helper:12:2" as ScopeId,
        decorators: [],
      };

      const child_class_def: ClassDefinition = {
        kind: "class",
        symbol_id: child_class_id,
        name: "Child" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 10 },
        is_exported: false,
        extends: ["Base" as SymbolName],
        methods: [child_method_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [
        base_class_def,
        base_method_def,
        child_class_def,
        child_method_def,
      ]);

      // Set up type subtypes index (Base → Child)
      definitions["type_subtypes"] = new Map();
      definitions["type_subtypes"].set(base_class_id, new Set([child_class_id]));

      // Setup TypeRegistry to return the base method
      types["resolved_type_members"] = new Map();
      types["resolved_type_members"].set(
        base_class_id,
        new Map([[("helper" as SymbolName), base_method_id]])
      );

      const result = resolve_method_on_type(
        base_class_id,
        "helper" as SymbolName,
        context
      );

      // Should return both base and child methods
      expect(result).toHaveLength(2);
      expect(result).toContain(base_method_id);
      expect(result).toContain(child_method_id);
    });

    it("should resolve multi-level inheritance (3 levels)", () => {
      const class_a_id = class_symbol("A", TEST_FILE, MOCK_LOCATION);
      const class_b_id = class_symbol("B", TEST_FILE, { ...MOCK_LOCATION, start_line: 10 });
      const class_c_id = class_symbol("C", TEST_FILE, { ...MOCK_LOCATION, start_line: 20 });
      const method_a_id = method_symbol("helper", MOCK_LOCATION);
      const method_b_id = method_symbol("helper", { ...MOCK_LOCATION, start_line: 12 });
      const method_c_id = method_symbol("helper", { ...MOCK_LOCATION, start_line: 22 });

      // Setup class A
      const method_a_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_a_id,
        name: "helper" as SymbolName,
        defining_scope_id: "scope:test.ts:A:1:0" as ScopeId,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: "scope:test.ts:A.helper:2:2" as ScopeId,
        decorators: [],
      };

      const class_a_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_a_id,
        name: "A" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [method_a_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Setup class B extends A
      const method_b_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_b_id,
        name: "helper" as SymbolName,
        defining_scope_id: "scope:test.ts:B:10:0" as ScopeId,
        location: { ...MOCK_LOCATION, start_line: 12 },
        parameters: [],
        body_scope_id: "scope:test.ts:B.helper:12:2" as ScopeId,
        decorators: [],
      };

      const class_b_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_b_id,
        name: "B" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 10 },
        is_exported: false,
        extends: ["A" as SymbolName],
        methods: [method_b_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Setup class C extends B
      const method_c_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_c_id,
        name: "helper" as SymbolName,
        defining_scope_id: "scope:test.ts:C:20:0" as ScopeId,
        location: { ...MOCK_LOCATION, start_line: 22 },
        parameters: [],
        body_scope_id: "scope:test.ts:C.helper:22:2" as ScopeId,
        decorators: [],
      };

      const class_c_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_c_id,
        name: "C" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 20 },
        is_exported: false,
        extends: ["B" as SymbolName],
        methods: [method_c_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [
        class_a_def, method_a_def,
        class_b_def, method_b_def,
        class_c_def, method_c_def,
      ]);

      // Set up transitive type subtypes index (A → B → C)
      definitions["type_subtypes"] = new Map();
      definitions["type_subtypes"].set(class_a_id, new Set([class_b_id]));
      definitions["type_subtypes"].set(class_b_id, new Set([class_c_id]));

      // Setup TypeRegistry to return A's method
      types["resolved_type_members"] = new Map();
      types["resolved_type_members"].set(
        class_a_id,
        new Map([[("helper" as SymbolName), method_a_id]])
      );

      const result = resolve_method_on_type(
        class_a_id,
        "helper" as SymbolName,
        context
      );

      // Should return all three methods
      expect(result).toHaveLength(3);
      expect(result).toContain(method_a_id);
      expect(result).toContain(method_b_id);
      expect(result).toContain(method_c_id);
    });

    it("should return only base method when no overrides exist", () => {
      const base_class_id = class_symbol("Base", TEST_FILE, MOCK_LOCATION);
      const child_class_id = class_symbol("Child", TEST_FILE, { ...MOCK_LOCATION, start_line: 10 });
      const base_method_id = method_symbol("helper", MOCK_LOCATION);

      // Setup base class with method
      const base_method_def: MethodDefinition = {
        kind: "method",
        symbol_id: base_method_id,
        name: "helper" as SymbolName,
        defining_scope_id: "scope:test.ts:Base:1:0" as ScopeId,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: "scope:test.ts:Base.helper:2:2" as ScopeId,
        decorators: [],
      };

      const base_class_def: ClassDefinition = {
        kind: "class",
        symbol_id: base_class_id,
        name: "Base" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [base_method_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Setup child class that extends Base but does NOT override helper
      const child_class_def: ClassDefinition = {
        kind: "class",
        symbol_id: child_class_id,
        name: "Child" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 10 },
        is_exported: false,
        extends: ["Base" as SymbolName],
        methods: [], // No methods - no override
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [
        base_class_def,
        base_method_def,
        child_class_def,
      ]);

      // Set up type subtypes index (Base → Child)
      definitions["type_subtypes"] = new Map();
      definitions["type_subtypes"].set(base_class_id, new Set([child_class_id]));

      // Setup TypeRegistry
      types["resolved_type_members"] = new Map();
      types["resolved_type_members"].set(
        base_class_id,
        new Map([[("helper" as SymbolName), base_method_id]])
      );

      const result = resolve_method_on_type(
        base_class_id,
        "helper" as SymbolName,
        context
      );

      // Should return only base method
      expect(result).toEqual([base_method_id]);
    });

    it("should handle sibling classes both overriding", () => {
      const base_class_id = class_symbol("Base", TEST_FILE, MOCK_LOCATION);
      const child1_class_id = class_symbol("Child1", TEST_FILE, { ...MOCK_LOCATION, start_line: 10 });
      const child2_class_id = class_symbol("Child2", TEST_FILE, { ...MOCK_LOCATION, start_line: 20 });
      const base_method_id = method_symbol("method", MOCK_LOCATION);
      const child1_method_id = method_symbol("method", { ...MOCK_LOCATION, start_line: 12 });
      const child2_method_id = method_symbol("method", { ...MOCK_LOCATION, start_line: 22 });

      // Setup base class
      const base_method_def: MethodDefinition = {
        kind: "method",
        symbol_id: base_method_id,
        name: "method" as SymbolName,
        defining_scope_id: "scope:test.ts:Base:1:0" as ScopeId,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: "scope:test.ts:Base.method:2:2" as ScopeId,
        decorators: [],
      };

      const base_class_def: ClassDefinition = {
        kind: "class",
        symbol_id: base_class_id,
        name: "Base" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [base_method_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Setup Child1 that overrides
      const child1_method_def: MethodDefinition = {
        kind: "method",
        symbol_id: child1_method_id,
        name: "method" as SymbolName,
        defining_scope_id: "scope:test.ts:Child1:10:0" as ScopeId,
        location: { ...MOCK_LOCATION, start_line: 12 },
        parameters: [],
        body_scope_id: "scope:test.ts:Child1.method:12:2" as ScopeId,
        decorators: [],
      };

      const child1_class_def: ClassDefinition = {
        kind: "class",
        symbol_id: child1_class_id,
        name: "Child1" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 10 },
        is_exported: false,
        extends: ["Base" as SymbolName],
        methods: [child1_method_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Setup Child2 that overrides
      const child2_method_def: MethodDefinition = {
        kind: "method",
        symbol_id: child2_method_id,
        name: "method" as SymbolName,
        defining_scope_id: "scope:test.ts:Child2:20:0" as ScopeId,
        location: { ...MOCK_LOCATION, start_line: 22 },
        parameters: [],
        body_scope_id: "scope:test.ts:Child2.method:22:2" as ScopeId,
        decorators: [],
      };

      const child2_class_def: ClassDefinition = {
        kind: "class",
        symbol_id: child2_class_id,
        name: "Child2" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 20 },
        is_exported: false,
        extends: ["Base" as SymbolName],
        methods: [child2_method_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [
        base_class_def, base_method_def,
        child1_class_def, child1_method_def,
        child2_class_def, child2_method_def,
      ]);

      // Set up type subtypes index (Base → Child1, Base → Child2)
      definitions["type_subtypes"] = new Map();
      definitions["type_subtypes"].set(base_class_id, new Set([child1_class_id, child2_class_id]));

      // Setup TypeRegistry
      types["resolved_type_members"] = new Map();
      types["resolved_type_members"].set(
        base_class_id,
        new Map([[("method" as SymbolName), base_method_id]])
      );

      const result = resolve_method_on_type(
        base_class_id,
        "method" as SymbolName,
        context
      );

      // Should return all three methods
      expect(result).toHaveLength(3);
      expect(result).toContain(base_method_id);
      expect(result).toContain(child1_method_id);
      expect(result).toContain(child2_method_id);
    });
  });

  describe("Namespace import method lookup", () => {
    it("should resolve method from source file exports", () => {
      const namespace_import_id = "import:test.ts:1:0:1:20:utils" as SymbolId;
      const helper_fn_id = function_symbol("helper", UTILS_FILE, {
        ...MOCK_LOCATION,
        file_path: UTILS_FILE,
      });

      // Setup namespace import
      const import_def: ImportDefinition = {
        kind: "import",
        symbol_id: namespace_import_id,
        name: "utils" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        import_kind: "namespace",
        source_path: "./utils",
        is_exported: false,
      };

      // Setup exported function in utils.ts
      const helper_def: FunctionDefinition = {
        kind: "function",
        symbol_id: helper_fn_id,
        name: "helper" as SymbolName,
        defining_scope_id: UTILS_SCOPE_ID,
        location: { ...MOCK_LOCATION, file_path: UTILS_FILE },
        parameters: [],
        body_scope_id: "scope:utils.ts:helper:1:0" as ScopeId,
        is_exported: true,
        decorators: [],
      };

      definitions.update_file(TEST_FILE, [import_def]);
      definitions.update_file(UTILS_FILE, [helper_def]);

      // Add import path resolver to context
      const context_with_resolver: ResolutionContext = {
        ...context,
        resolve_import_path: (import_id) =>
          import_id === namespace_import_id ? UTILS_FILE : undefined,
      };

      const result = resolve_method_on_type(
        namespace_import_id,
        "helper" as SymbolName,
        context_with_resolver
      );

      expect(result).toEqual([helper_fn_id]);
    });

    it("should return empty for non-exported function", () => {
      const namespace_import_id = "import:test.ts:1:0:1:20:utils" as SymbolId;
      const private_fn_id = function_symbol("private_helper", UTILS_FILE, {
        ...MOCK_LOCATION,
        file_path: UTILS_FILE,
      });

      const import_def: ImportDefinition = {
        kind: "import",
        symbol_id: namespace_import_id,
        name: "utils" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        import_kind: "namespace",
        source_path: "./utils",
        is_exported: false,
      };

      // Non-exported function
      const private_def: FunctionDefinition = {
        kind: "function",
        symbol_id: private_fn_id,
        name: "private_helper" as SymbolName,
        defining_scope_id: UTILS_SCOPE_ID,
        location: { ...MOCK_LOCATION, file_path: UTILS_FILE },
        parameters: [],
        body_scope_id: "scope:utils.ts:private_helper:1:0" as ScopeId,
        is_exported: false, // Not exported
        decorators: [],
      };

      definitions.update_file(TEST_FILE, [import_def]);
      definitions.update_file(UTILS_FILE, [private_def]);

      // Add import path resolver to context
      const context_with_resolver: ResolutionContext = {
        ...context,
        resolve_import_path: (import_id) =>
          import_id === namespace_import_id ? UTILS_FILE : undefined,
      };

      const result = resolve_method_on_type(
        namespace_import_id,
        "private_helper" as SymbolName,
        context_with_resolver
      );

      expect(result).toEqual([]);
    });

    it("should return empty for non-existent function", () => {
      const namespace_import_id = "import:test.ts:1:0:1:20:utils" as SymbolId;

      const import_def: ImportDefinition = {
        kind: "import",
        symbol_id: namespace_import_id,
        name: "utils" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        import_kind: "namespace",
        source_path: "./utils",
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [import_def]);

      // Add import path resolver to context
      const context_with_resolver: ResolutionContext = {
        ...context,
        resolve_import_path: (import_id) =>
          import_id === namespace_import_id ? UTILS_FILE : undefined,
      };

      const result = resolve_method_on_type(
        namespace_import_id,
        "nonexistent" as SymbolName,
        context_with_resolver
      );

      expect(result).toEqual([]);
    });

    it("should return empty when no import path resolver is provided", () => {
      const namespace_import_id = "import:test.ts:1:0:1:20:utils" as SymbolId;

      const import_def: ImportDefinition = {
        kind: "import",
        symbol_id: namespace_import_id,
        name: "utils" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        import_kind: "namespace",
        source_path: "./utils",
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [import_def]);

      // Use context without resolver
      const result = resolve_method_on_type(
        namespace_import_id,
        "helper" as SymbolName,
        context
      );

      expect(result).toEqual([]);
    });
  });

  describe("Object literal FunctionCollection lookup", () => {
    it("should find method in stored_functions", () => {
      const var_id = variable_symbol("HANDLERS", MOCK_LOCATION);
      const method_fn_id = function_symbol("process", TEST_FILE, MOCK_LOCATION);

      // Setup variable with FunctionCollection
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "HANDLERS" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };

      // Setup the method function
      const method_def: FunctionDefinition = {
        kind: "function",
        symbol_id: method_fn_id,
        name: "process" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: "scope:test.ts:process:5:0" as ScopeId,
        is_exported: false,
        decorators: [],
      };

      definitions.update_file(TEST_FILE, [var_def, method_def]);

      // Setup FunctionCollection
      definitions["function_collections"] = new Map();
      definitions["function_collections"].set(var_id, {
        symbol_id: var_id,
        stored_functions: [method_fn_id],
        stored_references: [],
      });

      const result = resolve_method_on_type(
        var_id,
        "process" as SymbolName,
        context
      );

      expect(result).toEqual([method_fn_id]);
    });

    it("should find method in stored_references via resolution", () => {
      const var_id = variable_symbol("HANDLERS", MOCK_LOCATION);
      const external_fn_id = function_symbol("external_process", TEST_FILE, {
        ...MOCK_LOCATION,
        start_line: 1,
      });

      // Setup variable with FunctionCollection
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "HANDLERS" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };

      // Setup the external function
      const external_def: FunctionDefinition = {
        kind: "function",
        symbol_id: external_fn_id,
        name: "external_process" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 1 },
        parameters: [],
        body_scope_id: "scope:test.ts:external_process:1:0" as ScopeId,
        is_exported: false,
        decorators: [],
      };

      definitions.update_file(TEST_FILE, [var_def, external_def]);

      // Setup FunctionCollection with stored_references
      definitions["function_collections"] = new Map();
      definitions["function_collections"].set(var_id, {
        symbol_id: var_id,
        stored_functions: [],
        stored_references: ["external_process" as SymbolName],
      });

      // Setup resolution for the reference
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("external_process" as SymbolName, external_fn_id);
      resolutions["resolutions_by_scope"] = new Map();
      resolutions["resolutions_by_scope"].set(FILE_SCOPE_ID, scope_resolutions);

      const result = resolve_method_on_type(
        var_id,
        "external_process" as SymbolName,
        context
      );

      expect(result).toEqual([external_fn_id]);
    });

    it("should return empty for method not in collection", () => {
      const var_id = variable_symbol("HANDLERS", MOCK_LOCATION);
      const other_fn_id = function_symbol("other", TEST_FILE, MOCK_LOCATION);

      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "HANDLERS" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };

      const other_def: FunctionDefinition = {
        kind: "function",
        symbol_id: other_fn_id,
        name: "other" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: "scope:test.ts:other:5:0" as ScopeId,
        is_exported: false,
        decorators: [],
      };

      definitions.update_file(TEST_FILE, [var_def, other_def]);

      // Setup FunctionCollection with only "other"
      definitions["function_collections"] = new Map();
      definitions["function_collections"].set(var_id, {
        symbol_id: var_id,
        stored_functions: [other_fn_id],
        stored_references: [],
      });

      const result = resolve_method_on_type(
        var_id,
        "nonexistent" as SymbolName,
        context
      );

      expect(result).toEqual([]);
    });
  });

  describe("Edge cases", () => {
    it("should handle unknown receiver type", () => {
      const unknown_id = "unknown:test.ts:1:0:1:10:mystery" as SymbolId;

      const result = resolve_method_on_type(
        unknown_id,
        "method" as SymbolName,
        context
      );

      expect(result).toEqual([]);
    });

    it("should prefer TypeRegistry over member_index", () => {
      const class_id = class_symbol("MyClass", TEST_FILE, MOCK_LOCATION);
      const method_id_registry = method_symbol("process", MOCK_LOCATION);
      const method_id_index = method_symbol("process", { ...MOCK_LOCATION, start_line: 99 });

      const method_def_index: MethodDefinition = {
        kind: "method",
        symbol_id: method_id_index,
        name: "process" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 99 },
        parameters: [],
        body_scope_id: "scope:test.ts:MyClass.process:99:2" as ScopeId,
        decorators: [],
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [method_def_index],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [class_def, method_def_index]);

      // TypeRegistry returns a different method id
      types["resolved_type_members"] = new Map();
      types["resolved_type_members"].set(
        class_id,
        new Map([[("process" as SymbolName), method_id_registry]])
      );

      const result = resolve_method_on_type(
        class_id,
        "process" as SymbolName,
        context
      );

      // Should return the TypeRegistry result, not the member_index one
      expect(result).toEqual([method_id_registry]);
    });
  });

  describe("Named import method lookup", () => {
    const IMPORT_GRAPH_FILE = "/test/import_graph.ts" as FilePath;
    const IMPORT_GRAPH_SCOPE = "module:import_graph.ts:1:1:100:1" as ScopeId;

    it("should resolve method through named import to actual class", () => {
      // This tests the pattern:
      // import { ImportGraph } from "./import_graph";
      // class Project { imports: ImportGraph; update() { this.imports.update_file(...); } }

      const import_id = "import:test.ts:1:0:1:30:ImportGraph" as SymbolId;
      const actual_class_id = class_symbol("ImportGraph", IMPORT_GRAPH_FILE, {
        ...MOCK_LOCATION,
        file_path: IMPORT_GRAPH_FILE,
      });
      const update_method_id = method_symbol("update_file", {
        ...MOCK_LOCATION,
        file_path: IMPORT_GRAPH_FILE,
        start_line: 55,
      });

      // Setup named import in project.ts
      const import_def: ImportDefinition = {
        kind: "import",
        symbol_id: import_id,
        name: "ImportGraph" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        import_kind: "named",
        source_path: "./import_graph",
        is_exported: false,
      };

      // Setup actual class in import_graph.ts
      const update_method_def: MethodDefinition = {
        kind: "method",
        symbol_id: update_method_id,
        name: "update_file" as SymbolName,
        defining_scope_id: "scope:import_graph.ts:ImportGraph:1:0" as ScopeId,
        location: { ...MOCK_LOCATION, file_path: IMPORT_GRAPH_FILE, start_line: 55 },
        parameters: [],
        body_scope_id: "scope:import_graph.ts:update_file:55:2" as ScopeId,
        decorators: [],
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: actual_class_id,
        name: "ImportGraph" as SymbolName,
        defining_scope_id: IMPORT_GRAPH_SCOPE,
        location: { ...MOCK_LOCATION, file_path: IMPORT_GRAPH_FILE },
        is_exported: true,
        extends: [],
        methods: [update_method_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [import_def]);
      definitions.update_file(IMPORT_GRAPH_FILE, [class_def, update_method_def]);

      // Add import path resolver
      const context_with_resolver: ResolutionContext = {
        ...context,
        resolve_import_path: (id) =>
          id === import_id ? IMPORT_GRAPH_FILE : undefined,
      };

      const result = resolve_method_on_type(
        import_id,
        "update_file" as SymbolName,
        context_with_resolver
      );

      expect(result).toEqual([update_method_id]);
    });

    it("should return empty for non-exported class in source file", () => {
      const import_id = "import:test.ts:1:0:1:30:PrivateClass" as SymbolId;
      const private_class_id = class_symbol("PrivateClass", IMPORT_GRAPH_FILE, {
        ...MOCK_LOCATION,
        file_path: IMPORT_GRAPH_FILE,
      });

      // Setup named import
      const import_def: ImportDefinition = {
        kind: "import",
        symbol_id: import_id,
        name: "PrivateClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        import_kind: "named",
        source_path: "./import_graph",
        is_exported: false,
      };

      // Setup non-exported class
      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: private_class_id,
        name: "PrivateClass" as SymbolName,
        defining_scope_id: IMPORT_GRAPH_SCOPE,
        location: { ...MOCK_LOCATION, file_path: IMPORT_GRAPH_FILE },
        is_exported: false, // Not exported!
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [import_def]);
      definitions.update_file(IMPORT_GRAPH_FILE, [class_def]);

      const context_with_resolver: ResolutionContext = {
        ...context,
        resolve_import_path: (id) =>
          id === import_id ? IMPORT_GRAPH_FILE : undefined,
      };

      const result = resolve_method_on_type(
        import_id,
        "some_method" as SymbolName,
        context_with_resolver
      );

      expect(result).toEqual([]);
    });
  });
});

/**
 * Tests for Constructor Call Resolution
 *
 * Verifies that resolve_constructor_call() correctly:
 * 1. Resolves constructor calls to the constructor symbol
 * 2. Falls back to class symbol when no explicit constructor exists
 * 3. Returns empty array for unresolved cases
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolve_constructor_call } from "./constructor";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ResolutionRegistry } from "../resolve_references";
import { create_constructor_call_reference } from "../../index_single_file/references/factories";
import { class_symbol } from "@ariadnejs/types";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  MethodDefinition,
  ClassDefinition,
  ConstructorDefinition,
} from "@ariadnejs/types";

// Test fixtures
const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;
const CLASS_SCOPE_ID = "scope:test.ts:MyClass:1:0" as ScopeId;
const CONSTRUCTOR_SCOPE_ID = "scope:test.ts:MyClass.constructor:2:2" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 15,
  end_line: 5,
  end_column: 22,
};

describe("Constructor Call Resolution", () => {
  let definitions: DefinitionRegistry;
  let types: TypeRegistry;
  let resolutions: ResolutionRegistry;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    types = new TypeRegistry();
    resolutions = new ResolutionRegistry();
  });

  describe("Resolves to constructor symbol", () => {
    it("should resolve constructor call to explicit constructor symbol", () => {
      // Setup: class MyClass { constructor() {} }
      //        const obj = new MyClass();
      const class_id = class_symbol("MyClass", TEST_FILE, MOCK_LOCATION);
      const constructor_id =
        "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

      // Create constructor definition
      const constructor_def: ConstructorDefinition = {
        kind: "constructor",
        symbol_id: constructor_id,
        name: "constructor" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: {
          ...MOCK_LOCATION,
          start_line: 2,
        },
        parameters: [],
        body_scope_id: CONSTRUCTOR_SCOPE_ID,
      };

      // Create class definition with constructor
      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: {
          ...MOCK_LOCATION,
          start_line: 1,
        },
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [constructor_def], // Constructor in separate array
      };

      definitions.update_file(TEST_FILE, [class_def, constructor_def]);

      // Set up resolution registry to resolve 'MyClass' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("MyClass" as SymbolName, class_id);
      resolutions["resolutions_by_scope"] = new Map();
      resolutions["resolutions_by_scope"].set(FILE_SCOPE_ID, scope_resolutions);

      // Create constructor call: new MyClass()
      const call_ref = create_constructor_call_reference(
        "MyClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      // Act
      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions,
        types
      );

      // Assert - should resolve to constructor symbol, not class symbol
      expect(resolved).toEqual([constructor_id]);
    });

    it("should resolve constructor with parameters", () => {
      // Setup: class User { constructor(name: string, age: number) {} }
      const class_id = class_symbol("User", TEST_FILE, MOCK_LOCATION);
      const constructor_id =
        "constructor:test.ts:2:2:5:3:constructor" as SymbolId;

      const constructor_def: ConstructorDefinition = {
        kind: "constructor",
        symbol_id: constructor_id,
        name: "constructor" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: {
          ...MOCK_LOCATION,
          start_line: 2,
        },
        parameters: [
          {
            kind: "parameter",
            symbol_id: "param:test.ts:2:14:2:18:name" as SymbolId,
            name: "name" as SymbolName,
            defining_scope_id: CONSTRUCTOR_SCOPE_ID,
            location: { ...MOCK_LOCATION, start_line: 2, start_column: 14 },
          },
          {
            kind: "parameter",
            symbol_id: "param:test.ts:2:28:2:31:age" as SymbolId,
            name: "age" as SymbolName,
            defining_scope_id: CONSTRUCTOR_SCOPE_ID,
            location: { ...MOCK_LOCATION, start_line: 2, start_column: 28 },
          },
        ],
        body_scope_id: CONSTRUCTOR_SCOPE_ID,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "User" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [constructor_def],
      };

      definitions.update_file(TEST_FILE, [class_def, constructor_def]);

      // Set up resolution
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("User" as SymbolName, class_id);
      resolutions["resolutions_by_scope"] = new Map();
      resolutions["resolutions_by_scope"].set(FILE_SCOPE_ID, scope_resolutions);

      // Create constructor call: new User("Alice", 30)
      const call_ref = create_constructor_call_reference(
        "User" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      // Act
      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions,
        types
      );

      // Assert
      expect(resolved).toEqual([constructor_id]);
    });
  });

  describe("Falls back to class symbol", () => {
    it("should return class symbol when no explicit constructor exists", () => {
      // Setup: class SimpleClass { }
      //        const obj = new SimpleClass();
      const class_id = class_symbol("SimpleClass", TEST_FILE, MOCK_LOCATION);

      // Create class definition WITHOUT constructor
      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "SimpleClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        // No constructor field - undefined
      };

      definitions.update_file(TEST_FILE, [class_def]);

      // Set up resolution
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("SimpleClass" as SymbolName, class_id);
      resolutions["resolutions_by_scope"] = new Map();
      resolutions["resolutions_by_scope"].set(FILE_SCOPE_ID, scope_resolutions);

      // Create constructor call: new SimpleClass()
      const call_ref = create_constructor_call_reference(
        "SimpleClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      // Act
      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions,
        types
      );

      // Assert - falls back to class symbol
      expect(resolved).toEqual([class_id]);
    });

    it("should return class symbol when constructor array is empty", () => {
      const class_id = class_symbol("EmptyClass", TEST_FILE, MOCK_LOCATION);

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "EmptyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [], // Empty constructor array
      };

      definitions.update_file(TEST_FILE, [class_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("EmptyClass" as SymbolName, class_id);
      resolutions["resolutions_by_scope"] = new Map();
      resolutions["resolutions_by_scope"].set(FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "EmptyClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions,
        types
      );

      expect(resolved).toEqual([class_id]);
    });
  });

  describe("Unresolved Cases", () => {
    it("should return empty array when class not found in scope", () => {
      // Class name not resolved - e.g., undefined class or missing import
      resolutions["resolutions_by_scope"] = new Map();
      resolutions["resolutions_by_scope"].set(FILE_SCOPE_ID, new Map());

      const call_ref = create_constructor_call_reference(
        "UndefinedClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions,
        types
      );

      expect(resolved).toEqual([]);
    });

    it("should return empty array when symbol is not a class", () => {
      // Setup: function NotAClass() {}
      //        new NotAClass(); // <- this should fail
      const func_id = "function:test.ts:1:0:3:1:NotAClass" as SymbolId;

      definitions.update_file(TEST_FILE, [
        {
          kind: "function",
          symbol_id: func_id,
          name: "NotAClass" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: MOCK_LOCATION,
          is_exported: false,
          parameters: [],
          body_scope_id: "scope:test.ts:NotAClass:1:0" as ScopeId,
        },
      ]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("NotAClass" as SymbolName, func_id);
      resolutions["resolutions_by_scope"] = new Map();
      resolutions["resolutions_by_scope"].set(FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "NotAClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions,
        types
      );

      // Function is not a class, so resolution fails
      expect(resolved).toEqual([]);
    });

    it("should return empty array when definition not found", () => {
      // Symbol resolves but has no definition in registry
      const unknown_id = "class:test.ts:1:0:1:10:Unknown" as SymbolId;

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("Unknown" as SymbolName, unknown_id);
      resolutions["resolutions_by_scope"] = new Map();
      resolutions["resolutions_by_scope"].set(FILE_SCOPE_ID, scope_resolutions);

      // Don't add definition to registry

      const call_ref = create_constructor_call_reference(
        "Unknown" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions,
        types
      );

      expect(resolved).toEqual([]);
    });
  });

  describe("Bug fix verification: constructor in separate field", () => {
    it("should NOT find constructor when stored in methods array (old bug behavior)", () => {
      // This test verifies the bug is fixed: constructors should NOT be looked up in methods
      const class_id = class_symbol("BuggyClass", TEST_FILE, MOCK_LOCATION);

      // Create a method named "constructor" in the methods array
      // This is NOT how constructors should be stored
      const fake_constructor_method: MethodDefinition = {
        kind: "method",
        symbol_id: "method:test.ts:2:2:4:3:constructor" as SymbolId,
        name: "constructor" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 2 },
        parameters: [],
        body_scope_id: CONSTRUCTOR_SCOPE_ID,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "BuggyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [fake_constructor_method], // WRONG: constructor in methods
        properties: [],
        decorators: [],
        // No constructor field
      };

      definitions.update_file(TEST_FILE, [class_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("BuggyClass" as SymbolName, class_id);
      resolutions["resolutions_by_scope"] = new Map();
      resolutions["resolutions_by_scope"].set(FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "BuggyClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions,
        types
      );

      // Should NOT find the "constructor" in methods array
      // Should fall back to class symbol
      expect(resolved).toEqual([class_id]);
      expect(resolved).not.toContain(fake_constructor_method.symbol_id);
    });
  });
});

/**
 * Tests for Constructor Call Resolution
 *
 * Verifies that resolve_constructor_call() correctly:
 * 1. Resolves constructor calls to the constructor symbol
 * 2. Falls back to class symbol when no explicit constructor exists
 * 3. Returns empty array for unresolved cases
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolve_constructor_call, find_constructor_in_class_hierarchy, enrich_class_calls_with_constructors } from "./constructor";
import { DefinitionRegistry } from "../registries/definition";
import { ResolutionRegistry } from "../resolve_references";
import { set_test_resolutions } from "../resolve_references.test";
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
  FunctionDefinition,
} from "@ariadnejs/types";

// Test fixtures
const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;
const CLASS_SCOPE_ID = "scope:test.ts:MyClass:1:0" as ScopeId;
const PARENT_CLASS_SCOPE_ID = "scope:test.ts:Parent:1:0" as ScopeId;
const CONSTRUCTOR_SCOPE_ID = "scope:test.ts:MyClass.constructor:2:2" as ScopeId;
const PARENT_CONSTRUCTOR_SCOPE_ID = "scope:test.ts:Parent.constructor:2:2" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 15,
  end_line: 5,
  end_column: 22,
};

describe("Constructor Call Resolution", () => {
  let definitions: DefinitionRegistry;
  let resolutions: ResolutionRegistry;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    resolutions = new ResolutionRegistry();
  });

  describe("Resolves to constructor symbol", () => {
    it("should resolve constructor call to explicit constructor symbol", () => {
      // Setup: class MyClass { constructor() {} }
      //        const obj = new MyClass();
      const class_id = class_symbol("MyClass", MOCK_LOCATION);
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
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

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
        resolutions
      );

      // Assert - should resolve to constructor symbol, not class symbol
      expect(resolved).toEqual([constructor_id]);
    });

    it("should resolve constructor with parameters", () => {
      // Setup: class User { constructor(name: string, age: number) {} }
      const class_id = class_symbol("User", MOCK_LOCATION);
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
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

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
        resolutions
      );

      // Assert
      expect(resolved).toEqual([constructor_id]);
    });
  });

  describe("Falls back to class symbol", () => {
    it("should return class symbol when no explicit constructor exists", () => {
      // Setup: class SimpleClass { }
      //        const obj = new SimpleClass();
      const class_id = class_symbol("SimpleClass", MOCK_LOCATION);

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
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

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
        resolutions
      );

      // Assert - falls back to class symbol
      expect(resolved).toEqual([class_id]);
    });

    it("should return class symbol when constructor array is empty", () => {
      const class_id = class_symbol("EmptyClass", MOCK_LOCATION);

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
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "EmptyClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions
      );

      expect(resolved).toEqual([class_id]);
    });
  });

  describe("Unresolved Cases", () => {
    it("should return empty array when class not found in scope", () => {
      // Class name not resolved - e.g., undefined class or missing import
      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map());

      const call_ref = create_constructor_call_reference(
        "UndefinedClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions
      );

      expect(resolved).toEqual([]);
    });

    it("should return empty array when symbol is not a class", () => {
      // Setup: function NotAClass() {}
      //        new NotAClass(); // <- this should fail
      const func_id = "function:test.ts:1:0:3:1:NotAClass" as SymbolId;

      const func_def: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "NotAClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        signature: {
          parameters: [],
        },
        body_scope_id: "scope:test.ts:NotAClass:1:0" as ScopeId,
      };

      definitions.update_file(TEST_FILE, [func_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("NotAClass" as SymbolName, func_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "NotAClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions
      );

      // Function is not a class, so resolution fails
      expect(resolved).toEqual([]);
    });

    it("should return empty array when definition not found", () => {
      // Symbol resolves but has no definition in registry
      const unknown_id = "class:test.ts:1:0:1:10:Unknown" as SymbolId;

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("Unknown" as SymbolName, unknown_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Don't add definition to registry

      const call_ref = create_constructor_call_reference(
        "Unknown" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions
      );

      expect(resolved).toEqual([]);
    });
  });

  describe("Bug fix verification: constructor in separate field", () => {
    it("should NOT find constructor when stored in methods array (old bug behavior)", () => {
      // This test verifies the bug is fixed: constructors should NOT be looked up in methods
      const class_id = class_symbol("BuggyClass", MOCK_LOCATION);

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
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "BuggyClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        resolutions
      );

      // Should NOT find the "constructor" in methods array
      // Should fall back to class symbol
      expect(resolved).toEqual([class_id]);
      expect(resolved).not.toContain(fake_constructor_method.symbol_id);
    });
  });
});

describe("find_constructor_in_class_hierarchy", () => {
  let definitions: DefinitionRegistry;
  let resolutions: ResolutionRegistry;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    resolutions = new ResolutionRegistry();
  });

  it("returns direct constructor when class has one", () => {
    const class_id = class_symbol("MyClass", MOCK_LOCATION);
    const constructor_id = "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

    const constructor_def: ConstructorDefinition = {
      kind: "constructor",
      symbol_id: constructor_id,
      name: "constructor" as SymbolName,
      defining_scope_id: CLASS_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 2 },
      parameters: [],
      body_scope_id: CONSTRUCTOR_SCOPE_ID,
    };

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
      constructors: [constructor_def],
    };

    definitions.update_file(TEST_FILE, [class_def, constructor_def]);

    const result = find_constructor_in_class_hierarchy(class_def, definitions, resolutions);
    expect(result).toBe(constructor_id);
  });

  it("walks up to parent when child has no constructor", () => {
    const parent_id = class_symbol("Parent", MOCK_LOCATION);
    const child_id = class_symbol("Child", { ...MOCK_LOCATION, start_line: 10 });
    const parent_ctor_id = "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

    const parent_ctor: ConstructorDefinition = {
      kind: "constructor",
      symbol_id: parent_ctor_id,
      name: "__init__" as SymbolName,
      defining_scope_id: PARENT_CLASS_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 2 },
      parameters: [],
      body_scope_id: PARENT_CONSTRUCTOR_SCOPE_ID,
    };

    const parent_def: ClassDefinition = {
      kind: "class",
      symbol_id: parent_id,
      name: "Parent" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructors: [parent_ctor],
    };

    const child_def: ClassDefinition = {
      kind: "class",
      symbol_id: child_id,
      name: "Child" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 10 },
      is_exported: false,
      extends: ["Parent" as SymbolName],
      methods: [],
      properties: [],
      decorators: [],
      // No constructors
    };

    definitions.update_file(TEST_FILE, [parent_def, parent_ctor, child_def]);

    // Set up resolution: "Parent" resolves to parent_id in FILE_SCOPE_ID
    const scope_resolutions = new Map<SymbolName, SymbolId>();
    scope_resolutions.set("Parent" as SymbolName, parent_id);
    set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

    const result = find_constructor_in_class_hierarchy(child_def, definitions, resolutions);
    expect(result).toBe(parent_ctor_id);
  });

  it("returns null when no constructor in hierarchy", () => {
    const class_id = class_symbol("NoCtorClass", MOCK_LOCATION);

    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id: class_id,
      name: "NoCtorClass" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
    };

    definitions.update_file(TEST_FILE, [class_def]);

    const result = find_constructor_in_class_hierarchy(class_def, definitions, resolutions);
    expect(result).toBeNull();
  });

  it("handles missing parent gracefully", () => {
    const child_id = class_symbol("Orphan", MOCK_LOCATION);

    const child_def: ClassDefinition = {
      kind: "class",
      symbol_id: child_id,
      name: "Orphan" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      extends: ["NonExistent" as SymbolName],
      methods: [],
      properties: [],
      decorators: [],
    };

    definitions.update_file(TEST_FILE, [child_def]);
    // "NonExistent" is not in resolutions

    const result = find_constructor_in_class_hierarchy(child_def, definitions, resolutions);
    expect(result).toBeNull();
  });

  it("handles cycles in class hierarchy", () => {
    const class_a_id = class_symbol("ClassA", MOCK_LOCATION);
    const class_b_id = class_symbol("ClassB", { ...MOCK_LOCATION, start_line: 10 });

    const class_a: ClassDefinition = {
      kind: "class",
      symbol_id: class_a_id,
      name: "ClassA" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      extends: ["ClassB" as SymbolName],
      methods: [],
      properties: [],
      decorators: [],
    };

    const class_b: ClassDefinition = {
      kind: "class",
      symbol_id: class_b_id,
      name: "ClassB" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 10 },
      is_exported: false,
      extends: ["ClassA" as SymbolName],
      methods: [],
      properties: [],
      decorators: [],
    };

    definitions.update_file(TEST_FILE, [class_a, class_b]);

    const scope_resolutions = new Map<SymbolName, SymbolId>();
    scope_resolutions.set("ClassA" as SymbolName, class_a_id);
    scope_resolutions.set("ClassB" as SymbolName, class_b_id);
    set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

    // Should not infinite loop — returns null
    const result = find_constructor_in_class_hierarchy(class_a, definitions, resolutions);
    expect(result).toBeNull();
  });
});

describe("enrich_class_calls_with_constructors", () => {
  let definitions: DefinitionRegistry;
  let resolutions: ResolutionRegistry;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    resolutions = new ResolutionRegistry();
  });

  it("adds constructor when resolved symbol is a class", () => {
    const class_id = class_symbol("MyClass", MOCK_LOCATION);
    const constructor_id = "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

    const constructor_def: ConstructorDefinition = {
      kind: "constructor",
      symbol_id: constructor_id,
      name: "constructor" as SymbolName,
      defining_scope_id: CLASS_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 2 },
      parameters: [],
      body_scope_id: CONSTRUCTOR_SCOPE_ID,
    };

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
      constructors: [constructor_def],
    };

    definitions.update_file(TEST_FILE, [class_def, constructor_def]);

    const result = enrich_class_calls_with_constructors([class_id], definitions, resolutions);
    expect(result).toEqual([class_id, constructor_id]);
  });

  it("is idempotent — does not duplicate constructor already in list", () => {
    const class_id = class_symbol("MyClass", MOCK_LOCATION);
    const constructor_id = "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

    const constructor_def: ConstructorDefinition = {
      kind: "constructor",
      symbol_id: constructor_id,
      name: "constructor" as SymbolName,
      defining_scope_id: CLASS_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 2 },
      parameters: [],
      body_scope_id: CONSTRUCTOR_SCOPE_ID,
    };

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
      constructors: [constructor_def],
    };

    definitions.update_file(TEST_FILE, [class_def, constructor_def]);

    // Constructor already in the list
    const result = enrich_class_calls_with_constructors(
      [class_id, constructor_id],
      definitions,
      resolutions
    );
    expect(result).toEqual([class_id, constructor_id]);
  });

  it("passes through non-class symbols unchanged", () => {
    const func_id = "function:test.ts:1:0:3:1:myFunc" as SymbolId;
    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id: func_id,
      name: "myFunc" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      signature: { parameters: [] },
      body_scope_id: "scope:test.ts:myFunc:1:0" as ScopeId,
    };

    definitions.update_file(TEST_FILE, [func_def]);

    const result = enrich_class_calls_with_constructors([func_id], definitions, resolutions);
    expect(result).toEqual([func_id]);
  });

  it("returns empty array unchanged", () => {
    const result = enrich_class_calls_with_constructors([], definitions, resolutions);
    expect(result).toEqual([]);
  });
});

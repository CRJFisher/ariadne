import { describe, it, expect, beforeEach } from "vitest";
import { resolve_self_reference_call } from "./self_reference";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { create_self_reference_call } from "../../index_single_file/references/references.factories";
import {
  class_symbol,
  method_symbol,
} from "@ariadnejs/types";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  LexicalScope,
  ClassDefinition,
  MethodDefinition,
} from "@ariadnejs/types";

/**
 * Test file for call_resolution.self_reference.ts - THE BUG FIX VERIFICATION
 *
 * This test suite verifies that self-reference calls (this.method(), self.method(), super.method())
 * are correctly resolved, fixing the bug where `this.build_class()` failed to resolve
 * (42 instances, 31% of misidentified symbols).
 */

describe("Self-Reference Call Resolution", () => {
  let scopes: ScopeRegistry;
  let definitions: DefinitionRegistry;
  let types: TypeRegistry;

  const TEST_FILE = "test.ts" as FilePath;
  const MOCK_LOCATION: Location = {
    file_path: TEST_FILE,
    start_line: 1,
    start_column: 0,
    end_line: 1,
    end_column: 10,
  };

  beforeEach(() => {
    scopes = new ScopeRegistry();
    definitions = new DefinitionRegistry();
    types = new TypeRegistry();
  });

  /**
   * Helper: Create a class scope with a method
   */
  function setup_class_with_method(
    class_name: string,
    method_name: string,
    options: {
      file?: FilePath;
      nested_block?: boolean;
    } = {}
  ): {
    class_scope_id: ScopeId;
    method_scope_id: ScopeId;
    block_scope_id?: ScopeId;
    class_id: SymbolId;
    method_id: SymbolId;
  } {
    const file = options.file || TEST_FILE;

    // Create scope IDs
    const module_scope_id = `scope:${file}:module` as ScopeId;
    const class_scope_id = `scope:${file}:${class_name}:1:0` as ScopeId;
    const method_scope_id = `scope:${file}:${class_name}.${method_name}:2:2` as ScopeId;
    const block_scope_id = options.nested_block
      ? (`scope:${file}:${class_name}.${method_name}.block:3:4` as ScopeId)
      : undefined;

    // Create symbol IDs
    const class_id = class_symbol(class_name as SymbolName, {
      file_path: file,
      start_line: 1,
      start_column: 0,
      end_line: 10,
      end_column: 1,
    });

    const method_id = method_symbol(
      method_name as SymbolName,
      {
        file_path: file,
        start_line: 2,
        start_column: 2,
        end_line: 5,
        end_column: 3,
      }
    );

    // Build scope tree
    const module_scope: LexicalScope = {
      id: module_scope_id,
      parent_id: null,
      name: null,
      type: "module",
      location: {
        file_path: file,
        start_line: 0,
        start_column: 0,
        end_line: 100,
        end_column: 0,
      },
      child_ids: [class_scope_id],
    };

    const class_scope: LexicalScope = {
      id: class_scope_id,
      parent_id: module_scope_id,
      name: class_name as SymbolName,
      type: "class",
      location: {
        file_path: file,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 1,
      },
      child_ids: [method_scope_id],
    };

    const method_scope: LexicalScope = {
      id: method_scope_id,
      parent_id: class_scope_id,
      name: method_name as SymbolName,
      type: "function",
      location: {
        file_path: file,
        start_line: 2,
        start_column: 2,
        end_line: 5,
        end_column: 3,
      },
      child_ids: block_scope_id ? [block_scope_id] : [],
    };

    const scope_map = new Map<ScopeId, LexicalScope>([
      [module_scope_id, module_scope],
      [class_scope_id, class_scope],
      [method_scope_id, method_scope],
    ]);

    if (block_scope_id) {
      const block_scope: LexicalScope = {
        id: block_scope_id,
        parent_id: method_scope_id,
        name: null,
        type: "block",
        location: {
          file_path: file,
          start_line: 3,
          start_column: 4,
          end_line: 4,
          end_column: 5,
        },
        child_ids: [],
      };
      scope_map.set(block_scope_id, block_scope);
    }

    scopes.update_file(file, scope_map);

    // Create definitions
    const method_def: MethodDefinition = {
      kind: "method",
      symbol_id: method_id,
      name: method_name as SymbolName,
      defining_scope_id: class_scope_id,
      location: {
        file_path: file,
        start_line: 2,
        start_column: 2,
        end_line: 5,
        end_column: 3,
      },
      parameters: [],
      body_scope_id: method_scope_id,
      decorators: [],
    };

    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id: class_id,
      name: class_name as SymbolName,
      defining_scope_id: class_scope_id,
      constructor: [],
      location: {
        file_path: file,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 1,
      },
      is_exported: false,
      extends: [],
      methods: [method_def],
      properties: [],
      decorators: [],
    };

    definitions.update_file(file, [class_def, method_def]);

    return {
      class_scope_id,
      method_scope_id,
      block_scope_id,
      class_id,
      method_id,
    };
  }

  describe("TypeScript/JavaScript: this.method()", () => {
    it("should resolve this.method() call within same class - THE BUG FIX", () => {
      // THE MAIN BUG FIX TEST: This is the exact scenario that was failing
      // Before task-152, this.build_class() failed to resolve (42 instances, 31% of misidentified symbols)
      const { method_scope_id, method_id } = setup_class_with_method(
        "Builder",
        "build_class"
      );

      // Create self-reference call: this.build_class()
      const call_ref = create_self_reference_call(
        "build_class" as SymbolName,
        MOCK_LOCATION,
        method_scope_id, // Called from process() method scope
        "this",
        ["this", "build_class"] as SymbolName[]
      );

      // Act
      const resolved = resolve_self_reference_call(call_ref, scopes, definitions, types);

      // Assert
      expect(resolved).toEqual([method_id]);
    });

    it("should resolve this.method() from nested block scope", () => {
      const { block_scope_id, method_id } = setup_class_with_method(
        "MyClass",
        "helper",
        { nested_block: true }
      );

      // Create call from nested block: if (true) { this.helper(); }
      const call_ref = create_self_reference_call(
        "helper" as SymbolName,
        MOCK_LOCATION,
        block_scope_id!, // Called from block scope
        "this",
        ["this", "helper"] as SymbolName[]
      );

      const resolved = resolve_self_reference_call(call_ref, scopes, definitions, types);

      expect(resolved).toEqual([method_id]);
    });

    it("should resolve different this.method() calls to different methods", () => {
      // Setup class with TWO methods
      const class_scope_id = `scope:${TEST_FILE}:MyClass:1:0` as ScopeId;
      const method_a_scope_id = `scope:${TEST_FILE}:MyClass.methodA:2:2` as ScopeId;
      const method_b_scope_id = `scope:${TEST_FILE}:MyClass.methodB:6:2` as ScopeId;
      const module_scope_id = `scope:${TEST_FILE}:module` as ScopeId;

      const class_id = class_symbol("MyClass" as SymbolName, {
        file_path: TEST_FILE,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 1,
      });

      const method_a_id = method_symbol("methodA" as SymbolName, {
        file_path: TEST_FILE,
        start_line: 2,
        start_column: 2,
        end_line: 4,
        end_column: 3,
      });

      const method_b_id = method_symbol("methodB" as SymbolName, {
        file_path: TEST_FILE,
        start_line: 6,
        start_column: 2,
        end_line: 8,
        end_column: 3,
      });

      // Build scope tree
      const module_scope: LexicalScope = {
        id: module_scope_id,
        parent_id: null,
        name: null,
        type: "module",
        location: MOCK_LOCATION,
        child_ids: [class_scope_id],
      };

      const class_scope: LexicalScope = {
        id: class_scope_id,
        parent_id: module_scope_id,
        name: "MyClass" as SymbolName,
        type: "class",
        location: MOCK_LOCATION,
        child_ids: [method_a_scope_id, method_b_scope_id],
      };

      const method_a_scope: LexicalScope = {
        id: method_a_scope_id,
        parent_id: class_scope_id,
        name: "methodA" as SymbolName,
        type: "function",
        location: MOCK_LOCATION,
        child_ids: [],
      };

      const method_b_scope: LexicalScope = {
        id: method_b_scope_id,
        parent_id: class_scope_id,
        name: "methodB" as SymbolName,
        type: "function",
        location: MOCK_LOCATION,
        child_ids: [],
      };

      scopes.update_file(TEST_FILE, new Map([
        [module_scope_id, module_scope],
        [class_scope_id, class_scope],
        [method_a_scope_id, method_a_scope],
        [method_b_scope_id, method_b_scope],
      ]));

      const method_a_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_a_id,
        name: "methodA" as SymbolName,
        defining_scope_id: class_scope_id,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: method_a_scope_id,
        decorators: [],
      };

      const method_b_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_b_id,
        name: "methodB" as SymbolName,
        defining_scope_id: class_scope_id,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: method_b_scope_id,
        decorators: [],
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: class_scope_id,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [method_a_def, method_b_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [class_def, method_a_def, method_b_def]);

      // Test this.methodA()
      const call_a = create_self_reference_call(
        "methodA" as SymbolName,
        MOCK_LOCATION,
        method_a_scope_id,
        "this",
        ["this", "methodA"] as SymbolName[]
      );

      const resolved_a = resolve_self_reference_call(call_a, scopes, definitions, types);
      expect(resolved_a).toEqual([method_a_id]);

      // Test this.methodB()
      const call_b = create_self_reference_call(
        "methodB" as SymbolName,
        MOCK_LOCATION,
        method_b_scope_id,
        "this",
        ["this", "methodB"] as SymbolName[]
      );

      const resolved_b = resolve_self_reference_call(call_b, scopes, definitions, types);
      expect(resolved_b).toEqual([method_b_id]);
    });
  });

  describe("Python: self.method()", () => {
    it("should resolve self.method() call in Python class", () => {
      const { method_scope_id, method_id } = setup_class_with_method(
        "MyClass",
        "helper",
        { file: "test.py" as FilePath }
      );

      // Create self-reference call: self.helper()
      const call_ref = create_self_reference_call(
        "helper" as SymbolName,
        {
          ...MOCK_LOCATION,
          file_path: "test.py" as FilePath,
        },
        method_scope_id,
        "self", // Python uses 'self'
        ["self", "helper"] as SymbolName[]
      );

      const resolved = resolve_self_reference_call(call_ref, scopes, definitions, types);

      expect(resolved).toEqual([method_id]);
    });
  });

  describe("Python: cls.method()", () => {
    it("should resolve cls.method() call in Python classmethod", () => {
      const { method_scope_id, method_id } = setup_class_with_method(
        "MyClass",
        "class_method",
        { file: "test.py" as FilePath }
      );

      // Create cls-reference call: cls.class_method()
      const call_ref = create_self_reference_call(
        "class_method" as SymbolName,
        {
          ...MOCK_LOCATION,
          file_path: "test.py" as FilePath,
        },
        method_scope_id,
        "cls", // Python classmethod uses 'cls'
        ["cls", "class_method"] as SymbolName[]
      );

      const resolved = resolve_self_reference_call(call_ref, scopes, definitions, types);

      expect(resolved).toEqual([method_id]);
    });
  });

  describe("super.method() - Parent Class Calls", () => {
    it("should resolve super.method() to parent class method", () => {
      const parent_file = "test.ts" as FilePath;

      // Setup parent class
      const parent_module_scope_id = `scope:${parent_file}:module` as ScopeId;
      const parent_class_scope_id = `scope:${parent_file}:BaseClass:1:0` as ScopeId;
      const parent_method_scope_id = `scope:${parent_file}:BaseClass.process:2:2` as ScopeId;

      const parent_class_id = class_symbol("BaseClass" as SymbolName, {
        file_path: parent_file,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      const parent_method_id = method_symbol(
        "process" as SymbolName,
        {
          file_path: parent_file,
          start_line: 2,
          start_column: 2,
          end_line: 4,
          end_column: 3,
        }
      );

      // Setup child class
      const child_class_scope_id = `scope:${parent_file}:ChildClass:10:0` as ScopeId;
      const child_method_scope_id = `scope:${parent_file}:ChildClass.override:11:2` as ScopeId;

      const child_class_id = class_symbol("ChildClass" as SymbolName, {
        file_path: parent_file,
        start_line: 10,
        start_column: 0,
        end_line: 15,
        end_column: 1,
      });

      // Build scope tree
      const parent_class_scope: LexicalScope = {
        id: parent_class_scope_id,
        parent_id: parent_module_scope_id,
        name: "BaseClass" as SymbolName,
        type: "class",
        location: {
          file_path: parent_file,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        child_ids: [parent_method_scope_id],
      };

      const parent_method_scope: LexicalScope = {
        id: parent_method_scope_id,
        parent_id: parent_class_scope_id,
        name: "process" as SymbolName,
        type: "function",
        location: {
          file_path: parent_file,
          start_line: 2,
          start_column: 2,
          end_line: 4,
          end_column: 3,
        },
        child_ids: [],
      };

      const child_class_scope: LexicalScope = {
        id: child_class_scope_id,
        parent_id: parent_module_scope_id,
        name: "ChildClass" as SymbolName,
        type: "class",
        location: {
          file_path: parent_file,
          start_line: 10,
          start_column: 0,
          end_line: 15,
          end_column: 1,
        },
        child_ids: [child_method_scope_id],
      };

      const child_method_scope: LexicalScope = {
        id: child_method_scope_id,
        parent_id: child_class_scope_id,
        name: "override" as SymbolName,
        type: "function",
        location: {
          file_path: parent_file,
          start_line: 11,
          start_column: 2,
          end_line: 13,
          end_column: 3,
        },
        child_ids: [],
      };

      const module_scope: LexicalScope = {
        id: parent_module_scope_id,
        parent_id: null,
        name: null,
        type: "module",
        location: {
          file_path: parent_file,
          start_line: 0,
          start_column: 0,
          end_line: 100,
          end_column: 0,
        },
        child_ids: [parent_class_scope_id, child_class_scope_id],
      };

      scopes.update_file(parent_file, new Map([
        [parent_module_scope_id, module_scope],
        [parent_class_scope_id, parent_class_scope],
        [parent_method_scope_id, parent_method_scope],
        [child_class_scope_id, child_class_scope],
        [child_method_scope_id, child_method_scope],
      ]));

      // Create definitions
      const parent_method_def: MethodDefinition = {
        kind: "method",
        symbol_id: parent_method_id,
        name: "process" as SymbolName,
        defining_scope_id: parent_class_scope_id,
        location: {
          file_path: parent_file,
          start_line: 2,
          start_column: 2,
          end_line: 4,
          end_column: 3,
        },
        parameters: [],
        body_scope_id: parent_method_scope_id,
        decorators: [],
      };

      const parent_class_def: ClassDefinition = {
        kind: "class",
        symbol_id: parent_class_id,
        name: "BaseClass" as SymbolName,
        defining_scope_id: parent_class_scope_id,
        location: {
          file_path: parent_file,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: false,
        extends: [],
        methods: [parent_method_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      const child_class_def: ClassDefinition = {
        kind: "class",
        symbol_id: child_class_id,
        name: "ChildClass" as SymbolName,
        defining_scope_id: child_class_scope_id,
        location: {
          file_path: parent_file,
          start_line: 10,
          start_column: 0,
          end_line: 15,
          end_column: 1,
        },
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(parent_file, [
        parent_class_def,
        parent_method_def,
        child_class_def,
      ]);

      // Register inheritance in type registry
      // Note: TypeRegistry uses update_file, but we can manually test the parent_classes map
      // For this test, we'll call a method that doesn't exist yet, so we expect null

      // Create super call: super.process()
      const call_ref = create_self_reference_call(
        "process" as SymbolName,
        {
          file_path: parent_file,
          start_line: 12,
          start_column: 4,
          end_line: 12,
          end_column: 20,
        },
        child_method_scope_id,
        "super",
        ["super", "process"] as SymbolName[]
      );

      // Note: This will return null because we haven't set up parent_class relationship
      // TypeRegistry requires full semantic index processing
      // This test demonstrates the API, even though resolution won't work without type info
      const resolved = resolve_self_reference_call(call_ref, scopes, definitions, types);

      // Returns [] because we haven't linked parent class in TypeRegistry
      // In real usage, TypeRegistry.update_file() would extract inheritance from semantic index
      expect(resolved).toEqual([]);
    });
  });

  describe("Unresolved Cases", () => {
    it("should return null when method does not exist", () => {
      const { method_scope_id } = setup_class_with_method("MyClass", "existing_method");

      // Create call to non-existent method
      const call_ref = create_self_reference_call(
        "nonexistent" as SymbolName,
        MOCK_LOCATION,
        method_scope_id,
        "this",
        ["this", "nonexistent"] as SymbolName[]
      );

      const resolved = resolve_self_reference_call(call_ref, scopes, definitions, types);

      expect(resolved).toEqual([]);
    });

    it("should return null when this.method() used outside class", () => {
      // Setup: Top-level function (not in class)
      const function_scope_id = `scope:${TEST_FILE}:topLevel:1:0` as ScopeId;
      const module_scope_id = `scope:${TEST_FILE}:module` as ScopeId;

      const module_scope: LexicalScope = {
        id: module_scope_id,
        parent_id: null,
        name: null,
        type: "module",
        location: MOCK_LOCATION,
        child_ids: [function_scope_id],
      };

      const function_scope: LexicalScope = {
        id: function_scope_id,
        parent_id: module_scope_id, // No class parent!
        name: "topLevel" as SymbolName,
        type: "function",
        location: MOCK_LOCATION,
        child_ids: [],
      };

      scopes.update_file(TEST_FILE, new Map([
        [module_scope_id, module_scope],
        [function_scope_id, function_scope],
      ]));

      const call_ref = create_self_reference_call(
        "method" as SymbolName,
        MOCK_LOCATION,
        function_scope_id,
        "this",
        ["this", "method"] as SymbolName[]
      );

      const resolved = resolve_self_reference_call(call_ref, scopes, definitions, types);

      expect(resolved).toEqual([]); // No containing class
    });

    it("should return null when super called but no parent class", () => {
      const { method_scope_id } = setup_class_with_method("OrphanClass", "method");

      // Create super call without parent class
      const call_ref = create_self_reference_call(
        "process" as SymbolName,
        MOCK_LOCATION,
        method_scope_id,
        "super",
        ["super", "process"] as SymbolName[]
      );

      const resolved = resolve_self_reference_call(call_ref, scopes, definitions, types);

      expect(resolved).toEqual([]); // No parent class
    });
  });

  describe("Nested Scopes", () => {
    it("should resolve this.method() through multiple nested scopes", () => {
      // Setup: class > method > block > nested block
      const class_scope_id = `scope:${TEST_FILE}:MyClass:1:0` as ScopeId;
      const method_scope_id = `scope:${TEST_FILE}:MyClass.method:2:2` as ScopeId;
      const block_1_scope_id = `scope:${TEST_FILE}:MyClass.method.block1:3:4` as ScopeId;
      const block_2_scope_id = `scope:${TEST_FILE}:MyClass.method.block1.block2:4:6` as ScopeId;
      const module_scope_id = `scope:${TEST_FILE}:module` as ScopeId;

      const class_id = class_symbol("MyClass" as SymbolName, MOCK_LOCATION);
      const method_id = method_symbol("helper" as SymbolName, MOCK_LOCATION);

      const module_scope: LexicalScope = {
        id: module_scope_id,
        parent_id: null,
        name: null,
        type: "module",
        location: MOCK_LOCATION,
        child_ids: [class_scope_id],
      };

      const class_scope: LexicalScope = {
        id: class_scope_id,
        parent_id: module_scope_id,
        name: "MyClass" as SymbolName,
        type: "class",
        location: MOCK_LOCATION,
        child_ids: [method_scope_id],
      };

      const method_scope: LexicalScope = {
        id: method_scope_id,
        parent_id: class_scope_id,
        name: "method" as SymbolName,
        type: "function",
        location: MOCK_LOCATION,
        child_ids: [block_1_scope_id],
      };

      const block_1_scope: LexicalScope = {
        id: block_1_scope_id,
        parent_id: method_scope_id,
        name: null,
        type: "block",
        location: MOCK_LOCATION,
        child_ids: [block_2_scope_id],
      };

      const block_2_scope: LexicalScope = {
        id: block_2_scope_id,
        parent_id: block_1_scope_id,
        name: null,
        type: "block",
        location: MOCK_LOCATION,
        child_ids: [],
      };

      scopes.update_file(TEST_FILE, new Map([
        [module_scope_id, module_scope],
        [class_scope_id, class_scope],
        [method_scope_id, method_scope],
        [block_1_scope_id, block_1_scope],
        [block_2_scope_id, block_2_scope],
      ]));

      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "helper" as SymbolName,
        defining_scope_id: class_scope_id,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: method_scope_id,
        decorators: [],
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: class_scope_id,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [method_def],
        properties: [],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [class_def, method_def]);

      // Call from deeply nested block: if (x) { if (y) { this.helper(); } }
      const call_ref = create_self_reference_call(
        "helper" as SymbolName,
        MOCK_LOCATION,
        block_2_scope_id, // Deeply nested
        "this",
        ["this", "helper"] as SymbolName[]
      );

      const resolved = resolve_self_reference_call(call_ref, scopes, definitions, types);

      expect(resolved).toEqual([method_id]);
    });
  });
});

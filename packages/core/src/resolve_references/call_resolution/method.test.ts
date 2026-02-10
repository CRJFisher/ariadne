/**
 * Tests for Method Call Resolution
 *
 * Verifies that resolve_method_call() correctly:
 * 1. Resolves basic obj.method() calls
 * 2. Resolves method calls after constructor
 * 3. Resolves chained method calls
 * 4. Resolves property access chains
 * 5. Returns empty array for unresolved cases
 * 6. Handles namespace imports (utils.helper())
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolve_method_call } from "./method";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ResolutionRegistry } from "../resolve_references";
import { set_test_resolutions } from "../resolve_references.test";
import { create_method_call_reference } from "../../index_single_file/references/factories";
import { method_symbol, class_symbol, function_symbol, variable_symbol } from "@ariadnejs/types";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  MethodDefinition,
  ClassDefinition,
  VariableDefinition,
} from "@ariadnejs/types";

// Test fixtures
const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;
const CLASS_SCOPE_ID = "scope:test.ts:MyClass:1:0" as ScopeId;
const METHOD_SCOPE_ID = "scope:test.ts:MyClass.process:2:2" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 15,
  end_line: 5,
  end_column: 22,
};

const MOCK_RECEIVER_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 10,
  end_line: 5,
  end_column: 13,
};

describe("Method Call Resolution", () => {
  let scopes: ScopeRegistry;
  let definitions: DefinitionRegistry;
  let types: TypeRegistry;
  let resolutions: ResolutionRegistry;

  beforeEach(() => {
    scopes = new ScopeRegistry();
    definitions = new DefinitionRegistry();
    types = new TypeRegistry();
    resolutions = new ResolutionRegistry();
  });

  describe("Basic Method Calls", () => {
    it("should resolve method call on object", () => {
      // Setup: const obj = new MyClass(); obj.process();
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const class_id = class_symbol("MyClass", TEST_FILE, MOCK_LOCATION);
      const method_id = method_symbol("process", {
        ...MOCK_LOCATION,
        start_line: 3,
      });

      // Create scope map
      const scope_map = new Map();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "file",
        location: {
          file_path: TEST_FILE,
          start_line: 0,
          start_column: 0,
          end_line: 10,
          end_column: 0,
        },
        parent_id: null,
        child_ids: [CLASS_SCOPE_ID],
      });
      scopes.update_file(TEST_FILE, scope_map);

      // Create definitions
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };

      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "process" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: {
          ...MOCK_LOCATION,
          start_line: 3,
        },
        parameters: [],
        body_scope_id: METHOD_SCOPE_ID,
        decorators: [],
      };

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
        methods: [method_def],
        properties: [],
        decorators: [],
        constructors: [],
      };

      definitions.update_file(TEST_FILE, [var_def, class_def, method_def]);

      // Set type of variable to class (using hack for testing)
      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, class_id);

      // Set up resolution registry to resolve 'obj' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Create method call: obj.process()
      const call_ref = create_method_call_reference(
        "process" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "process"] as SymbolName[]
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert
      expect(resolved).toEqual([method_id]);
    });

    it("should resolve method call using TypeRegistry.get_type_member", () => {
      // Setup: Similar to above, but method added via TypeRegistry
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const class_id = class_symbol("MyClass", TEST_FILE, MOCK_LOCATION);
      const method_id = method_symbol("getData", {
        ...MOCK_LOCATION,
        start_line: 3,
      });

      // Create definitions
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      // Set type binding (using hack for testing)
      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, class_id);

      // Add method to TypeRegistry type members (simulates caching)
      types["resolved_type_members"] = new Map();
      const member_map = new Map();
      member_map.set("getData" as SymbolName, method_id);
      types["resolved_type_members"].set(class_id, member_map);

      // Set up resolution for 'obj'
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Create method call: obj.getData()
      const call_ref = create_method_call_reference(
        "getData" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "getData"] as SymbolName[]
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert
      expect(resolved).toEqual([method_id]);
    });
  });

  describe("Method Calls After Constructor", () => {
    it("should resolve method call on newly constructed object", () => {
      // Scenario: const obj = new MyClass(); obj.method();
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const class_id = class_symbol("MyClass", TEST_FILE, MOCK_LOCATION);
      const method_id = method_symbol("method", {
        ...MOCK_LOCATION,
        start_line: 3,
      });

      // Create definitions
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      // Constructor tracking would set this type binding (using hack for testing)
      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, class_id);

      // Add method to class (using hack for testing)
      types["resolved_type_members"] = new Map();
      const member_map = new Map();
      member_map.set("method" as SymbolName, method_id);
      types["resolved_type_members"].set(class_id, member_map);

      // Resolve 'obj' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Create method call
      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "method"] as SymbolName[]
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert
      expect(resolved).toEqual([method_id]);
    });
  });

  describe("Chained Method Calls", () => {
    it("should resolve chained method calls (fluent interface)", () => {
      // Scenario: builder.setName("foo").setAge(25)
      // Each method returns the same Builder type
      const builder_symbol_id = variable_symbol("builder", MOCK_LOCATION);
      const builder_class_id = class_symbol("Builder", TEST_FILE, MOCK_LOCATION);
      const set_name_id = method_symbol("setName", {
        ...MOCK_LOCATION,
        start_line: 2,
      });
      const set_age_id = method_symbol("setAge", {
        ...MOCK_LOCATION,
        start_line: 3,
      });

      // Create definitions
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: builder_symbol_id,
        name: "builder" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      // Set builder type (using hack for testing)
      types["symbol_types"] = new Map();
      types["symbol_types"].set(builder_symbol_id, builder_class_id);

      // Add methods to Builder class (using hack for testing)
      types["resolved_type_members"] = new Map();
      const builder_member_map = new Map();
      builder_member_map.set("setName" as SymbolName, set_name_id);
      builder_member_map.set("setAge" as SymbolName, set_age_id);
      types["resolved_type_members"].set(builder_class_id, builder_member_map);

      // Both methods return Builder (fluent interface)
      types["symbol_types"].set(set_name_id, builder_class_id);
      types["symbol_types"].set(set_age_id, builder_class_id);

      // Resolve 'builder' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("builder" as SymbolName, builder_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Test first call: builder.setName()
      const first_call = create_method_call_reference(
        "setName" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["builder", "setName"] as SymbolName[]
      );

      const resolved_first = resolve_method_call(
        first_call,
        scopes,
        definitions,
        types,
        resolutions
      );

      expect(resolved_first).toEqual([set_name_id]);

      // Test second call: (result).setAge()
      // NOTE: In real resolution, the property_chain would be:
      // ['builder', 'setName', 'setAge'] for full chain resolution
      // But we test simple chaining here
      const second_call = create_method_call_reference(
        "setAge" as SymbolName,
        { ...MOCK_LOCATION, start_line: 6 },
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["builder", "setAge"] as SymbolName[]
      );

      const resolved_second = resolve_method_call(
        second_call,
        scopes,
        definitions,
        types,
        resolutions
      );

      expect(resolved_second).toEqual([set_age_id]);
    });
  });

  describe("Property Access Chains", () => {
    it("should resolve method call on property chain", () => {
      // Scenario: obj.field.method()
      // property_chain: ['obj', 'field', 'method']
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const outer_class_id = class_symbol("OuterClass", TEST_FILE, MOCK_LOCATION);
      const field_symbol_id = variable_symbol("field", {
        ...MOCK_LOCATION,
        start_line: 2,
      });
      const inner_class_id = class_symbol("InnerClass", TEST_FILE, {
        ...MOCK_LOCATION,
        start_line: 10,
      });
      const method_id = method_symbol("method", {
        ...MOCK_LOCATION,
        start_line: 11,
      });

      // Create definitions
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      // obj has type OuterClass (using hack for testing)
      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, outer_class_id);

      // OuterClass has field 'field' of type InnerClass
      types["resolved_type_members"] = new Map();
      const outer_member_map = new Map();
      outer_member_map.set("field" as SymbolName, field_symbol_id);
      types["resolved_type_members"].set(outer_class_id, outer_member_map);
      types["symbol_types"].set(field_symbol_id, inner_class_id);

      // InnerClass has method 'method'
      const inner_member_map = new Map();
      inner_member_map.set("method" as SymbolName, method_id);
      types["resolved_type_members"].set(inner_class_id, inner_member_map);

      // Resolve 'obj' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Create method call: obj.field.method()
      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "field", "method"] as SymbolName[]
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert
      expect(resolved).toEqual([method_id]);
    });
  });

  describe("Namespace Import Resolution", () => {
    const UTILS_FILE = "utils.ts" as FilePath;
    const UTILS_SCOPE_ID = "scope:utils.ts:file:0:0" as ScopeId;

    it("should resolve namespace import method calls when import_path resolver is provided", () => {
      // Scenario: import * as utils from './utils'; utils.helper();
      // This test verifies that namespace imports work when the resolve_import_path callback is provided
      const utils_import_id = "import:test.ts:1:0:1:30:utils" as SymbolId;
      const helper_id = function_symbol("helper", UTILS_FILE, {
        file_path: UTILS_FILE,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      // Create utils.ts function first
      definitions.update_file(UTILS_FILE, [{
        kind: "function",
        symbol_id: helper_id,
        name: "helper" as SymbolName,
        defining_scope_id: UTILS_SCOPE_ID,
        location: {
          file_path: UTILS_FILE,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        parameters: [],
        body_scope_id: "scope:utils.ts:helper:1:0" as ScopeId,
        decorators: [],
      }]);

      // Create import in current file with proper import definition
      definitions.update_file(TEST_FILE, [{
        kind: "import",
        symbol_id: utils_import_id,
        name: "utils" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION, // Import location is in test.ts (where the import statement is)
        is_exported: false,
        import_kind: "namespace",
        import_path: "./utils",
      }]);

      // Resolve 'utils' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("utils" as SymbolName, utils_import_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Create method call: utils.helper()
      const call_ref = create_method_call_reference(
        "helper" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["utils", "helper"] as SymbolName[]
      );

      // Create a mock import_path resolver that maps the import symbol to the source file
      const resolve_import_path = (import_id: SymbolId) => {
        if (import_id === utils_import_id) {
          return UTILS_FILE;
        }
        return undefined;
      };

      // Act - pass the resolve_import_path callback
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        resolve_import_path
      );

      // Assert - should resolve to the helper function
      expect(resolved).toEqual([helper_id]);
    });

    it("should return empty when no import_path resolver is provided", () => {
      // This test demonstrates the failure case when resolve_import_path is not provided
      // This is the bug we need to trap: the full integration flow must provide this resolver
      const utils_import_id = "import:test.ts:1:0:1:30:utils" as SymbolId;
      const helper_id = function_symbol("helper", UTILS_FILE, {
        file_path: UTILS_FILE,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      // Create utils.ts function first
      definitions.update_file(UTILS_FILE, [{
        kind: "function",
        symbol_id: helper_id,
        name: "helper" as SymbolName,
        defining_scope_id: UTILS_SCOPE_ID,
        location: {
          file_path: UTILS_FILE,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        parameters: [],
        body_scope_id: "scope:utils.ts:helper:1:0" as ScopeId,
        decorators: [],
      }]);

      // Create import in current file
      definitions.update_file(TEST_FILE, [{
        kind: "import",
        symbol_id: utils_import_id,
        name: "utils" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        import_kind: "namespace",
        import_path: "./utils",
      }]);

      // Resolve 'utils' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("utils" as SymbolName, utils_import_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Create method call: utils.helper()
      const call_ref = create_method_call_reference(
        "helper" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["utils", "helper"] as SymbolName[]
      );

      // Act - WITHOUT resolve_import_path callback
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
        // No resolve_import_path provided
      );

      // Assert - should return empty (cannot resolve without the resolver)
      expect(resolved).toEqual([]);
    });

    it("should return empty when import_path resolver returns undefined (external module)", () => {
      // This test demonstrates behavior for external modules (os, pandas, etc.)
      // where the resolved path doesn't exist in the project
      const os_import_id = "import:test.ts:1:0:1:10:os" as SymbolId;

      // Create import for external module
      definitions.update_file(TEST_FILE, [{
        kind: "import",
        symbol_id: os_import_id,
        name: "os" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        import_kind: "namespace",
        import_path: "os",
      }]);

      // Resolve 'os' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("os" as SymbolName, os_import_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Create method call: os.listdir()
      const call_ref = create_method_call_reference(
        "listdir" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["os", "listdir"] as SymbolName[]
      );

      // Mock resolver that returns undefined for external modules
      const resolve_import_path = (_import_id: SymbolId) => undefined;

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        resolve_import_path
      );

      // Assert - should return empty (external module not in project)
      expect(resolved).toEqual([]);
    });
  });

  describe("Unresolved Cases", () => {
    it("should return null when receiver type unknown", () => {
      // Test: obj.method() when obj has no type information
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);

      // Create definitions
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      // NO type binding set for obj

      // Resolve 'obj' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Create method call
      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "method"] as SymbolName[]
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert
      expect(resolved).toEqual([]);
    });

    it("should return null when receiver not in scope", () => {
      // Test: obj.method() when 'obj' not resolved in scope
      const method_id = method_symbol("method", MOCK_LOCATION);

      // NO resolution for 'obj' in scope
      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map());

      // Create method call
      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "method"] as SymbolName[]
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert
      expect(resolved).toEqual([]);
    });

    it("should return null when method not on type", () => {
      // Test: obj.nonExistentMethod() when type doesn't have that method
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const class_id = class_symbol("MyClass", TEST_FILE, MOCK_LOCATION);

      // Create definitions
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      // Set type binding (using hack for testing)
      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, class_id);

      // NO method added to class

      // Resolve 'obj' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Create method call for non-existent method
      const call_ref = create_method_call_reference(
        "nonExistentMethod" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "nonExistentMethod"] as SymbolName[]
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert
      expect(resolved).toEqual([]);
    });

    it("should return null for empty property chain", () => {
      // Edge case: Empty property chain
      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        [] as SymbolName[] // Empty chain
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert
      expect(resolved).toEqual([]);
    });

    it("should return null when property chain has unresolved intermediate", () => {
      // Test: obj.unknownField.method() where 'unknownField' doesn't exist
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const class_id = class_symbol("MyClass", TEST_FILE, MOCK_LOCATION);

      // Create definitions
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      // Set type binding (using hack for testing)
      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, class_id);

      // NO 'unknownField' member on class

      // Resolve 'obj' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Create method call with unresolved intermediate
      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "unknownField", "method"] as SymbolName[]
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert
      expect(resolved).toEqual([]);
    });
  });

  describe("Polymorphic Interface Resolution (Task 11.158)", () => {
    it("should resolve interface method call to all implementations", () => {
      // Setup: interface Handler { process(): void; }
      //        class HandlerA implements Handler { process() {} }
      //        class HandlerB implements Handler { process() {} }
      //        function run(h: Handler) { h.process(); }

      const handler_param_id = variable_symbol("h", MOCK_LOCATION);
      const interface_id = class_symbol("Handler", TEST_FILE, {
        ...MOCK_LOCATION,
        start_line: 1,
      });
      const interface_method_id = method_symbol("process", {
        ...MOCK_LOCATION,
        start_line: 1,
        start_column: 20,
      });

      const handler_a_id = class_symbol("HandlerA", TEST_FILE, {
        ...MOCK_LOCATION,
        start_line: 3,
      });
      const handler_a_process_id = method_symbol("process", {
        ...MOCK_LOCATION,
        start_line: 3,
        start_column: 20,
      });

      const handler_b_id = class_symbol("HandlerB", TEST_FILE, {
        ...MOCK_LOCATION,
        start_line: 6,
      });
      const handler_b_process_id = method_symbol("process", {
        ...MOCK_LOCATION,
        start_line: 6,
        start_column: 20,
      });

      // Create interface definition
      const interface_method: MethodDefinition = {
        kind: "method",
        symbol_id: interface_method_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:Handler" as ScopeId,
        location: {
          ...MOCK_LOCATION,
          start_line: 1,
          start_column: 20,
        },
        parameters: [],
      };

      const interface_def: import("@ariadnejs/types").InterfaceDefinition = {
        kind: "interface",
        symbol_id: interface_id,
        name: "Handler" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 1 },
        is_exported: false,
        extends: [],
        methods: [interface_method],
        properties: [],
      };

      // Create HandlerA implementation
      const handler_a_method: MethodDefinition = {
        kind: "method",
        symbol_id: handler_a_process_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:HandlerA" as ScopeId,
        location: {
          ...MOCK_LOCATION,
          start_line: 3,
          start_column: 20,
        },
        parameters: [],
        body_scope_id: "scope:HandlerA.process" as ScopeId,
      };

      const handler_a_def: ClassDefinition = {
        kind: "class",
        symbol_id: handler_a_id,
        name: "HandlerA" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 3 },
        is_exported: false,
        extends: ["Handler" as SymbolName], // implements Handler
        methods: [handler_a_method],
        properties: [],
        decorators: [],
      };

      // Create HandlerB implementation
      const handler_b_method: MethodDefinition = {
        kind: "method",
        symbol_id: handler_b_process_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:HandlerB" as ScopeId,
        location: {
          ...MOCK_LOCATION,
          start_line: 6,
          start_column: 20,
        },
        parameters: [],
        body_scope_id: "scope:HandlerB.process" as ScopeId,
      };

      const handler_b_def: ClassDefinition = {
        kind: "class",
        symbol_id: handler_b_id,
        name: "HandlerB" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 6 },
        is_exported: false,
        extends: ["Handler" as SymbolName], // implements Handler
        methods: [handler_b_method],
        properties: [],
        decorators: [],
      };

      // Create parameter definition
      const param_def: VariableDefinition = {
        kind: "variable",
        symbol_id: handler_param_id,
        name: "h" as SymbolName,
        defining_scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
      };

      // Register definitions
      definitions.update_file(TEST_FILE, [
        interface_def,
        handler_a_def,
        handler_b_def,
        param_def,
      ]);

      // Set type binding: h has type Handler (interface)
      types["symbol_types"] = new Map();
      types["symbol_types"].set(handler_param_id, interface_id);

      // Resolve 'h' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("h" as SymbolName, handler_param_id);
      set_test_resolutions(resolutions, METHOD_SCOPE_ID, scope_resolutions);

      // Create method call: h.process()
      const call_ref = create_method_call_reference(
        "process" as SymbolName,
        MOCK_LOCATION,
        METHOD_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["h", "process"] as SymbolName[]
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert: Should resolve to BOTH implementations
      expect(resolved).toHaveLength(2);
      expect(resolved).toContain(handler_a_process_id);
      expect(resolved).toContain(handler_b_process_id);
    });

    it("should return single resolution for concrete class method call", () => {
      // Setup: class User { getName(): string {} }
      //        function test(u: User) { u.getName(); }
      // This is NOT polymorphic - should return single resolution

      const user_param_id = variable_symbol("u", MOCK_LOCATION);
      const class_id = class_symbol("User", TEST_FILE, MOCK_LOCATION);
      const method_id = method_symbol("getName", {
        ...MOCK_LOCATION,
        start_line: 2,
      });

      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "getName" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 2 },
        parameters: [],
        body_scope_id: "scope:User.getName" as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "User" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [method_def],
        properties: [],
        decorators: [],
      };

      const param_def: VariableDefinition = {
        kind: "variable",
        symbol_id: user_param_id,
        name: "u" as SymbolName,
        defining_scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
      };

      definitions.update_file(TEST_FILE, [class_def, param_def]);

      // Set type binding
      types["symbol_types"] = new Map();
      types["symbol_types"].set(user_param_id, class_id);

      // Resolve 'u' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("u" as SymbolName, user_param_id);
      set_test_resolutions(resolutions, METHOD_SCOPE_ID, scope_resolutions);

      // Create method call: u.getName()
      const call_ref = create_method_call_reference(
        "getName" as SymbolName,
        MOCK_LOCATION,
        METHOD_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["u", "getName"] as SymbolName[]
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert: Should return single resolution (not polymorphic)
      expect(resolved).toEqual([method_id]);
    });

    it("should return empty array when interface has no implementations", () => {
      // Setup: interface EmptyHandler { process(): void; }
      //        function run(h: EmptyHandler) { h.process(); }
      // No implementations exist

      const handler_param_id = variable_symbol("h", MOCK_LOCATION);
      const interface_id = class_symbol("EmptyHandler", TEST_FILE, MOCK_LOCATION);
      const interface_method_id = method_symbol("process", {
        ...MOCK_LOCATION,
        start_line: 1,
      });

      const interface_method: MethodDefinition = {
        kind: "method",
        symbol_id: interface_method_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:EmptyHandler" as ScopeId,
        location: { ...MOCK_LOCATION, start_line: 1 },
        parameters: [],
      };

      const interface_def: import("@ariadnejs/types").InterfaceDefinition = {
        kind: "interface",
        symbol_id: interface_id,
        name: "EmptyHandler" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [interface_method],
        properties: [],
      };

      const param_def: VariableDefinition = {
        kind: "variable",
        symbol_id: handler_param_id,
        name: "h" as SymbolName,
        defining_scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
      };

      definitions.update_file(TEST_FILE, [interface_def, param_def]);

      // Set type binding
      types["symbol_types"] = new Map();
      types["symbol_types"].set(handler_param_id, interface_id);

      // Resolve 'h' in scope
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("h" as SymbolName, handler_param_id);
      set_test_resolutions(resolutions, METHOD_SCOPE_ID, scope_resolutions);

      // Create method call: h.process()
      const call_ref = create_method_call_reference(
        "process" as SymbolName,
        MOCK_LOCATION,
        METHOD_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["h", "process"] as SymbolName[]
      );

      // Act
      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions
      );

      // Assert: Should return empty array (no implementations found)
      expect(resolved).toEqual([]);
    });
  });
});

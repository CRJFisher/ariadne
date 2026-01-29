/**
 * Tests for Python Reference Preprocessing
 *
 * Verifies that:
 * 1. function_call to class → converts to constructor_call with construct_target
 * 2. function_call to function → no change (stays function_call)
 * 3. method_call → no change (not processed)
 * 4. References without resolution → no change
 */

import { describe, it, expect, beforeEach } from "vitest";
import { preprocess_python_references } from "./preprocess_references.python";
import { ReferenceRegistry } from "./registries/reference";
import { DefinitionRegistry } from "./registries/definition";
import { class_symbol, function_symbol } from "@ariadnejs/types";
import type {
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  ClassDefinition,
  FunctionDefinition,
  FunctionCallReference,
  MethodCallReference,
  ConstructorCallReference,
  SymbolId,
} from "@ariadnejs/types";
import type { ResolutionRegistry } from "./resolve_references";

// Test fixtures
const TEST_FILE = "test.py" as FilePath;
const FILE_SCOPE_ID = "scope:test.py:file:0:0" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 1,
  start_column: 0,
  end_line: 1,
  end_column: 10,
};

const CALL_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 0,
  end_line: 5,
  end_column: 15,
};

const TARGET_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 0,
  end_line: 5,
  end_column: 3,
};

/**
 * Mock ResolutionRegistry that allows setting up resolutions for tests
 */
class MockResolutionRegistry {
  private resolutions: Map<string, SymbolId> = new Map();

  set_resolution(scope_id: ScopeId, name: SymbolName, symbol_id: SymbolId): void {
    this.resolutions.set(`${scope_id}:${name}`, symbol_id);
  }

  resolve(scope_id: ScopeId, name: SymbolName): SymbolId | null {
    return this.resolutions.get(`${scope_id}:${name}`) ?? null;
  }
}

describe("preprocess_python_references", () => {
  let references: ReferenceRegistry;
  let definitions: DefinitionRegistry;
  let resolutions: MockResolutionRegistry;

  beforeEach(() => {
    references = new ReferenceRegistry();
    definitions = new DefinitionRegistry();
    resolutions = new MockResolutionRegistry();
  });

  it("should convert function_call to constructor_call when callee is a class", () => {
    // Set up a class definition
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
    };
    definitions.update_file(TEST_FILE, [class_def]);

    // Set up resolution: MyClass -> class symbol
    resolutions.set_resolution(FILE_SCOPE_ID, "MyClass" as SymbolName, class_id);

    // Set up a function_call reference with potential_construct_target
    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "MyClass" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
      potential_construct_target: TARGET_LOCATION,
    };
    references.update_file(TEST_FILE, [func_call]);

    // Run preprocessing
    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions as unknown as ResolutionRegistry
    );

    // Verify the reference was converted to constructor_call
    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs.length).toBe(1);

    const result = updated_refs[0] as ConstructorCallReference;
    expect(result).toEqual({
      kind: "constructor_call",
      name: "MyClass" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
      construct_target: TARGET_LOCATION,
    });
  });

  it("should preserve function_call when callee is a function (not a class)", () => {
    // Set up a function definition
    const func_id = function_symbol("my_function", TEST_FILE, MOCK_LOCATION);
    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id: func_id,
      name: "my_function" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      parameters: [],
      body_scope_id: "scope:test.py:my_function:1:0" as ScopeId,
      decorators: [],
    };
    definitions.update_file(TEST_FILE, [func_def]);

    // Set up resolution: my_function -> function symbol
    resolutions.set_resolution(FILE_SCOPE_ID, "my_function" as SymbolName, func_id);

    // Set up a function_call reference
    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "my_function" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
    };
    references.update_file(TEST_FILE, [func_call]);

    // Run preprocessing
    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions as unknown as ResolutionRegistry
    );

    // Verify the reference was NOT converted
    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs.length).toBe(1);
    expect(updated_refs[0]).toEqual(func_call);
  });

  it("should not modify method_call references", () => {
    const method_call: MethodCallReference = {
      kind: "method_call",
      name: "process" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
      receiver_location: TARGET_LOCATION,
      property_chain: ["obj", "process"] as SymbolName[],
    };
    references.update_file(TEST_FILE, [method_call]);

    // Run preprocessing
    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions as unknown as ResolutionRegistry
    );

    // Verify method_call was not modified
    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs.length).toBe(1);
    expect(updated_refs[0]).toEqual(method_call);
  });

  it("should not modify function_call when callee cannot be resolved", () => {
    // No definition or resolution set up for "unknown_func"
    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "unknown_func" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
    };
    references.update_file(TEST_FILE, [func_call]);

    // Run preprocessing
    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions as unknown as ResolutionRegistry
    );

    // Verify the reference was NOT converted
    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs.length).toBe(1);
    expect(updated_refs[0]).toEqual(func_call);
  });

  it("should handle empty file references gracefully", () => {
    // No references set up for TEST_FILE
    // Should not throw
    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions as unknown as ResolutionRegistry
    );

    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs.length).toBe(0);
  });

  it("should handle constructor_call without potential_construct_target", () => {
    // Set up a class definition
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
    };
    definitions.update_file(TEST_FILE, [class_def]);

    // Set up resolution
    resolutions.set_resolution(FILE_SCOPE_ID, "MyClass" as SymbolName, class_id);

    // Set up a function_call reference WITHOUT potential_construct_target
    // (e.g., standalone call: MyClass() without assignment)
    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "MyClass" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
      // No potential_construct_target
    };
    references.update_file(TEST_FILE, [func_call]);

    // Run preprocessing
    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions as unknown as ResolutionRegistry
    );

    // Verify the reference was converted to constructor_call with undefined construct_target
    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs.length).toBe(1);

    const result = updated_refs[0] as ConstructorCallReference;
    expect(result).toEqual({
      kind: "constructor_call",
      name: "MyClass" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
      construct_target: undefined,
    });
  });
});

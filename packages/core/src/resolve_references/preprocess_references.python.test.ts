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

  it("converts function_call to constructor_call when callee is a class", () => {
    const class_id = class_symbol("MyClass", MOCK_LOCATION);
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

    resolutions.set_resolution(FILE_SCOPE_ID, "MyClass" as SymbolName, class_id);

    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "MyClass" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
      potential_construct_target: TARGET_LOCATION,
    };
    references.update_file(TEST_FILE, [func_call]);

    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions
    );

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

  it("preserves function_call when callee is a function, not a class", () => {
    const func_id = function_symbol("my_function" as SymbolName, MOCK_LOCATION);
    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id: func_id,
      name: "my_function" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      signature: { parameters: [] },
      body_scope_id: "scope:test.py:my_function:1:0" as ScopeId,
      decorators: [],
    };
    definitions.update_file(TEST_FILE, [func_def]);

    resolutions.set_resolution(FILE_SCOPE_ID, "my_function" as SymbolName, func_id);

    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "my_function" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
    };
    references.update_file(TEST_FILE, [func_call]);

    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions
    );

    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs.length).toBe(1);
    expect(updated_refs[0]).toEqual(func_call);
  });

  it("leaves method_call references unchanged", () => {
    const method_call: MethodCallReference = {
      kind: "method_call",
      name: "process" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
      receiver_location: TARGET_LOCATION,
      property_chain: ["obj", "process"] as SymbolName[],
      is_optional_chain: false,
    };
    references.update_file(TEST_FILE, [method_call]);

    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions
    );

    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs.length).toBe(1);
    expect(updated_refs[0]).toEqual(method_call);
  });

  it("preserves function_call when the callee name does not resolve", () => {
    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "unknown_func" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
    };
    references.update_file(TEST_FILE, [func_call]);

    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions
    );

    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs.length).toBe(1);
    expect(updated_refs[0]).toEqual(func_call);
  });

  it("preserves function_call when resolution points to a missing definition", () => {
    const dangling_id = class_symbol("Ghost", MOCK_LOCATION);
    resolutions.set_resolution(FILE_SCOPE_ID, "Ghost" as SymbolName, dangling_id);

    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "Ghost" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
    };
    references.update_file(TEST_FILE, [func_call]);

    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions
    );

    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs.length).toBe(1);
    expect(updated_refs[0]).toEqual(func_call);
  });

  it("returns without mutating the registry when the file has no references", () => {
    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions
    );

    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs.length).toBe(0);
  });

  it("converts a class instantiation with no assignment target to an undefined construct_target", () => {
    const class_id = class_symbol("MyClass", MOCK_LOCATION);
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

    resolutions.set_resolution(FILE_SCOPE_ID, "MyClass" as SymbolName, class_id);

    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "MyClass" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
    };
    references.update_file(TEST_FILE, [func_call]);

    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions
    );

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

  it("rewrites only the class-callee references and preserves the rest in order", () => {
    const class_id = class_symbol("MyClass", MOCK_LOCATION);
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
    const func_id = function_symbol("my_function" as SymbolName, MOCK_LOCATION);
    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id: func_id,
      name: "my_function" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      signature: { parameters: [] },
      body_scope_id: "scope:test.py:my_function:1:0" as ScopeId,
      decorators: [],
    };
    definitions.update_file(TEST_FILE, [class_def, func_def]);

    resolutions.set_resolution(FILE_SCOPE_ID, "MyClass" as SymbolName, class_id);
    resolutions.set_resolution(FILE_SCOPE_ID, "my_function" as SymbolName, func_id);

    const class_call: FunctionCallReference = {
      kind: "function_call",
      name: "MyClass" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
      potential_construct_target: TARGET_LOCATION,
    };
    const function_call: FunctionCallReference = {
      kind: "function_call",
      name: "my_function" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
    };
    const method_call: MethodCallReference = {
      kind: "method_call",
      name: "process" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
      receiver_location: TARGET_LOCATION,
      property_chain: ["obj", "process"] as SymbolName[],
      is_optional_chain: false,
    };
    references.update_file(TEST_FILE, [class_call, function_call, method_call]);

    preprocess_python_references(
      TEST_FILE,
      references,
      definitions,
      resolutions
    );

    const updated_refs = references.get_file_references(TEST_FILE);
    expect(updated_refs).toEqual([
      {
        kind: "constructor_call",
        name: "MyClass" as SymbolName,
        location: CALL_LOCATION,
        scope_id: FILE_SCOPE_ID,
        construct_target: TARGET_LOCATION,
      },
      function_call,
      method_call,
    ]);
  });
});

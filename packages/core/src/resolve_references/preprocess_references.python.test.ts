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
  private resolutions: Map<string, readonly SymbolId[]> = new Map();

  set_resolution(scope_id: ScopeId, name: SymbolName, ...symbol_ids: SymbolId[]): void {
    this.resolutions.set(`${scope_id}:${name}`, symbol_ids);
  }

  resolve_all(scope_id: ScopeId, name: SymbolName): readonly SymbolId[] {
    return this.resolutions.get(`${scope_id}:${name}`) ?? [];
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

  it("carries a list element's instantiation target onto the constructor call as its element target", () => {
    const class_id = class_symbol("Suite", MOCK_LOCATION);
    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id: class_id,
      name: "Suite" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
    };
    definitions.update_file(TEST_FILE, [class_def]);
    resolutions.set_resolution(FILE_SCOPE_ID, "Suite" as SymbolName, class_id);
    references.update_file(TEST_FILE, [
      {
        kind: "function_call",
        name: "Suite" as SymbolName,
        location: CALL_LOCATION,
        scope_id: FILE_SCOPE_ID,
        potential_construct_element_of: TARGET_LOCATION,
      },
    ]);

    preprocess_python_references(TEST_FILE, references, definitions, resolutions);

    expect(references.get_file_references(TEST_FILE)).toEqual([
      {
        kind: "constructor_call",
        name: "Suite" as SymbolName,
        location: CALL_LOCATION,
        scope_id: FILE_SCOPE_ID,
        construct_element_of: TARGET_LOCATION,
      },
    ]);
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

  describe("a name that sibling branches bind to different symbols", () => {
    const WRITER_LOCATION: Location = { ...MOCK_LOCATION, start_line: 2 };
    const WRITER_117_LOCATION: Location = { ...MOCK_LOCATION, start_line: 3 };
    const FACTORY_LOCATION: Location = { ...MOCK_LOCATION, start_line: 4 };

    function class_definition(name: string, location: Location): ClassDefinition {
      return {
        kind: "class",
        symbol_id: class_symbol(name as SymbolName, location),
        name: name as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
      };
    }

    const call: FunctionCallReference = {
      kind: "function_call",
      name: "writer" as SymbolName,
      location: CALL_LOCATION,
      scope_id: FILE_SCOPE_ID,
    };

    it("converts the call to a constructor_call when every branch binds a class", () => {
      const first = class_definition("StataWriter", WRITER_LOCATION);
      const second = class_definition("StataWriter117", WRITER_117_LOCATION);
      definitions.update_file(TEST_FILE, [first, second]);
      resolutions.set_resolution(
        FILE_SCOPE_ID,
        "writer" as SymbolName,
        first.symbol_id,
        second.symbol_id
      );
      references.update_file(TEST_FILE, [call]);

      preprocess_python_references(TEST_FILE, references, definitions, resolutions);

      expect(references.get_file_references(TEST_FILE)).toEqual([
        {
          kind: "constructor_call",
          name: "writer" as SymbolName,
          location: CALL_LOCATION,
          scope_id: FILE_SCOPE_ID,
        },
      ]);
    });

    it("leaves the call a function_call when one branch binds a function", () => {
      const writer = class_definition("StataWriter", WRITER_LOCATION);
      const factory: FunctionDefinition = {
        kind: "function",
        symbol_id: function_symbol("make_writer" as SymbolName, FACTORY_LOCATION),
        name: "make_writer" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: FACTORY_LOCATION,
        is_exported: false,
        signature: { parameters: [] },
        decorators: [],
        body_scope_id: FILE_SCOPE_ID,
      };
      definitions.update_file(TEST_FILE, [writer, factory]);
      resolutions.set_resolution(
        FILE_SCOPE_ID,
        "writer" as SymbolName,
        writer.symbol_id,
        factory.symbol_id
      );
      references.update_file(TEST_FILE, [call]);

      preprocess_python_references(TEST_FILE, references, definitions, resolutions);

      expect(references.get_file_references(TEST_FILE)).toEqual([call]);
    });
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

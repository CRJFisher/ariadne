/**
 * Python-specific tests for function resolution
 */

import { describe, it, expect } from "vitest";
import { resolve_function_call } from "./function_resolution";
import {
  FunctionCall,
  FunctionDefinition,
  Import,
  Export,
  NamedImport,
  NamedExport,
  NamespaceImport,
  SymbolName,
  FilePath,
  function_symbol,
  ScopeTree,
  ScopeName,
  function_scope,
  module_scope,
  class_scope,
  block_scope,
} from "@ariadnejs/types";
import { FileResolutionContext } from "./symbol_resolution";

describe("Python function resolution", () => {
  it("should NOT resolve function called before definition", () => {
    const file_path: FilePath = "src/order.py" as FilePath;

    // Function defined after the call
    const late_func: FunctionDefinition = {
      name: "late_function" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 1,
        end_line: 12,
        end_column: 20,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    // Call before definition
    const call: FunctionCall = {
      callee: "late_function" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 15,
      },
      arguments: [],
      is_async_call: false,
    };

    const root_scope_id = module_scope({
      file_path,
      line: 1,
      column: 1,
      end_line: 20,
      end_column: 1,
    });

    const context: FileResolutionContext = {
      scope_tree: {
        root_id: root_scope_id,
        file_path,
        nodes: new Map([
          [root_scope_id, {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path,
              line: 1,
              column: 1,
              end_line: 20,
              end_column: 1,
            },
            child_ids: [],
          }],
        ]),
        scope_depths: new Map([[root_scope_id, 0]]),
      } as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "python",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("late_function" as SymbolName, late_func.location), late_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeUndefined(); // Python requires definition before use
  });

  it("should resolve module imports with 'from module import func'", () => {
    const file_a: FilePath = "utils.py" as FilePath;
    const file_b: FilePath = "main.py" as FilePath;

    const util_func: FunctionDefinition = {
      name: "process_data" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 3,
        end_column: 20,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    const exports_a: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "process_data" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    // from utils import process_data
    const imports_b: Import[] = [
      {
        kind: "named",
        source: "utils" as any,
        imports: [
          {
            name: "process_data" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const call: FunctionCall = {
      callee: "process_data" as SymbolName,
      location: {
        file_path: file_b,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 13,
      },
      arguments: [],
      is_async_call: false,
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path: file_b,
            line: 1,
            column: 1,
            end_line: 20,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([
        [file_b, imports_b],
      ]),
      exports_by_file: new Map([
        [file_a, exports_a],
      ]),
      language: "python",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map([
            [function_symbol("process_data" as SymbolName, util_func.location), util_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("process_data");
  });

  it("should resolve 'import module' with qualified calls", () => {
    const file_a: FilePath = "math_utils.py" as FilePath;
    const file_b: FilePath = "calculator.py" as FilePath;

    const sqrt_func: FunctionDefinition = {
      name: "sqrt" as SymbolName,
      location: {
        file_path: file_a,
        line: 5,
        column: 1,
        end_line: 7,
        end_column: 20,
      },
      parameters: [{
        name: "x" as SymbolName,
        type: "float",
        is_optional: false,
        is_rest: false,
      }],
      is_async: false,
      is_generator: false,
      return_type: "float",
    };

    const exports_a: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "sqrt" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    // import math_utils
    const imports_b: Import[] = [
      {
        kind: "namespace",
        source: "math_utils" as any,
        namespace_name: "math_utils" as any,
      } as unknown as NamespaceImport,
    ];

    const call: FunctionCall = {
      callee: "math_utils.sqrt" as SymbolName,
      location: {
        file_path: file_b,
        line: 10,
        column: 10,
        end_line: 10,
        end_column: 26,
      },
      arguments: [{
        value: "16",
        type: "int",
      }],
      is_async_call: false,
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path: file_b,
            line: 1,
            column: 1,
            end_line: 15,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([
        [file_b, imports_b],
      ]),
      exports_by_file: new Map([
        [file_a, exports_a],
      ]),
      language: "python",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map([
            [function_symbol("sqrt" as SymbolName, sqrt_func.location), sqrt_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("sqrt");
  });

  it("should resolve decorated functions", () => {
    const file_path: FilePath = "decorators.py" as FilePath;

    const decorated_func: FunctionDefinition = {
      name: "cached_function" as SymbolName,
      location: {
        file_path,
        line: 3,
        column: 1,
        end_line: 5,
        end_column: 20,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
      decorators: ["@cache", "@timing"],
    };

    const call: FunctionCall = {
      callee: "cached_function" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 10,
        end_line: 10,
        end_column: 26,
      },
      arguments: [],
      is_async_call: false,
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path,
            line: 1,
            column: 1,
            end_line: 15,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "python",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("cached_function" as SymbolName, decorated_func.location), decorated_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("cached_function");
    expect(resolved?.decorators).toContain("@cache");
  });

  it("should resolve async/await coroutines", () => {
    const file_path: FilePath = "async_code.py" as FilePath;

    const async_func: FunctionDefinition = {
      name: "fetch_data" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 3,
        end_column: 20,
      },
      parameters: [{
        name: "url" as SymbolName,
        type: "str",
        is_optional: false,
        is_rest: false,
      }],
      is_async: true,
      is_generator: false,
      return_type: "Any",
    };

    const call: FunctionCall = {
      callee: "fetch_data" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 10,
        end_line: 10,
        end_column: 21,
      },
      arguments: [{
        value: "'https://api.example.com'",
        type: "str",
      }],
      is_async_call: true,
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path,
            line: 1,
            column: 1,
            end_line: 15,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "python",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("fetch_data" as SymbolName, async_func.location), async_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("fetch_data");
    expect(resolved?.is_async).toBe(true);
  });

  it("should resolve nested function definitions", () => {
    const file_path: FilePath = "nested.py" as FilePath;

    // Inner function defined inside outer function
    const inner_func: FunctionDefinition = {
      name: "inner" as SymbolName,
      location: {
        file_path,
        line: 3,
        column: 5,
        end_line: 5,
        end_column: 20,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    // Call from within the same outer function
    const call: FunctionCall = {
      callee: "inner" as SymbolName,
      location: {
        file_path,
        line: 6,
        column: 5,
        end_line: 6,
        end_column: 11,
      },
      arguments: [],
      is_async_call: false,
    };

    const outer_scope_id = function_scope({
      file_path,
      line: 1,
      column: 1,
      end_line: 8,
      end_column: 1,
    });

    const inner_scope_id = function_scope({
      file_path,
      line: 3,
      column: 5,
      end_line: 5,
      end_column: 20,
    });

    const context: FileResolutionContext = {
      scope_tree: {
        root_id: outer_scope_id,
        file_path,
        nodes: new Map([
          [outer_scope_id, {
            id: outer_scope_id,
            type: "function",
            parent_id: null,
            name: null,
            location: {
              file_path,
              line: 1,
              column: 1,
              end_line: 10,
              end_column: 1,
            },
            child_ids: [inner_scope_id],
          }],
          [inner_scope_id, {
            id: inner_scope_id,
            type: "function",
            parent_id: outer_scope_id,
            name: "inner" as ScopeName,
            location: {
              file_path,
              line: 3,
              column: 5,
              end_line: 5,
              end_column: 20,
            },
            child_ids: [],
          }],
        ]),
        scope_depths: new Map([
          [outer_scope_id, 0],
          [inner_scope_id, 1],
        ]),
      } as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "python",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("inner" as SymbolName, inner_func.location), inner_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("inner");
  });

  it("should resolve lambda functions assigned to variables", () => {
    const file_path: FilePath = "lambdas.py" as FilePath;

    const lambda_func: FunctionDefinition = {
      name: "square" as SymbolName, // Variable name holding the lambda
      location: {
        file_path,
        line: 2,
        column: 10,
        end_line: 2,
        end_column: 25,
      },
      parameters: [{
        name: "x" as SymbolName,
        type: undefined,
        is_optional: false,
        is_rest: false,
      }],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    const call: FunctionCall = {
      callee: "square" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 10,
        end_line: 5,
        end_column: 17,
      },
      arguments: [{
        value: "5",
        type: "int",
      }],
      is_async_call: false,
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path,
            line: 1,
            column: 1,
            end_line: 10,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "python",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("square" as SymbolName, lambda_func.location), lambda_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("square");
  });
});
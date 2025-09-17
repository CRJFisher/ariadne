/**
 * JavaScript-specific tests for function resolution
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
  DefaultImport,
  DefaultExport,
  SymbolName,
  FilePath,
  function_symbol,
  ScopeTree,
  function_scope,
  block_scope,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../symbol_resolution";

describe("JavaScript function resolution", () => {
  it("should resolve CommonJS require and module.exports", () => {
    const file_a: FilePath = "src/utils.js" as FilePath;
    const file_b: FilePath = "src/main.js" as FilePath;

    // CommonJS export
    const exported_func: FunctionDefinition = {
      name: "processData" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 3,
        end_column: 2,
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
            local_name: "processData" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    // CommonJS require
    const imports_b: Import[] = [
      {
        kind: "named",
        source: "./utils.js" as any,
        imports: [
          {
            name: "processData" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const call: FunctionCall = {
      callee: "processData" as SymbolName,
      location: {
        file_path: file_b,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 15,
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
      language: "javascript",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map([
            [function_symbol("processData" as SymbolName, exported_func.location), exported_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("processData");
  });

  it("should resolve var hoisting", () => {
    const file_path: FilePath = "src/hoisting.js" as FilePath;

    // var function expression (hoisted declaration, not initialization)
    const var_func: FunctionDefinition = {
      name: "hoistedVar" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 1,
        end_line: 12,
        end_column: 2,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    // Call after var declaration but before initialization
    const call: FunctionCall = {
      callee: "hoistedVar" as SymbolName,
      location: {
        file_path,
        line: 15, // After the definition
        column: 1,
        end_line: 15,
        end_column: 15,
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
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "javascript",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("hoistedVar" as SymbolName, var_func.location), var_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("hoistedVar");
  });

  it("should resolve immediately invoked function expressions (IIFE)", () => {
    const file_path: FilePath = "src/iife.js" as FilePath;

    // Function returned from IIFE
    const iife_func: FunctionDefinition = {
      name: "publicApi" as SymbolName,
      location: {
        file_path,
        line: 3,
        column: 10,
        end_line: 5,
        end_column: 11,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    const call: FunctionCall = {
      callee: "publicApi" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 12,
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
      language: "javascript",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("publicApi" as SymbolName, iife_func.location), iife_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("publicApi");
  });

  it("should resolve generator functions", () => {
    const file_path: FilePath = "src/generators.js" as FilePath;

    const generator_func: FunctionDefinition = {
      name: "numberGenerator" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 5,
        end_column: 2,
      },
      parameters: [],
      is_async: false,
      is_generator: true,
      return_type: undefined,
    };

    const call: FunctionCall = {
      callee: "numberGenerator" as SymbolName,
      location: {
        file_path,
        line: 7,
        column: 10,
        end_line: 7,
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
      language: "javascript",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("numberGenerator" as SymbolName, generator_func.location), generator_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("numberGenerator");
    expect(resolved?.is_generator).toBe(true);
  });

  it("should handle prototype method calls", () => {
    const file_path: FilePath = "src/prototype.js" as FilePath;

    // Constructor function
    const constructor_func: FunctionDefinition = {
      name: "MyClass" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 3,
        end_column: 2,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    const call: FunctionCall = {
      callee: "MyClass" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 10,
        end_line: 10,
        end_column: 18,
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
      language: "javascript",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("MyClass" as SymbolName, constructor_func.location), constructor_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("MyClass");
  });

  it("should resolve dynamic imports", () => {
    const file_a: FilePath = "src/dynamic.js" as FilePath;
    const file_b: FilePath = "src/loader.js" as FilePath;

    const dynamic_func: FunctionDefinition = {
      name: "lazyLoad" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 3,
        end_column: 2,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    const exports_a: Export[] = [
      {
        kind: "default",
        symbol: "lazyLoad" as SymbolName,
        is_declaration: true,
      } as unknown as DefaultExport,
    ];

    // Dynamic import resolved to default
    const imports_b: Import[] = [
      {
        kind: "default",
        source: "./dynamic.js" as any,
        name: "lazyLoad" as SymbolName,
        is_dynamic: true,
      } as unknown as DefaultImport,
    ];

    const call: FunctionCall = {
      callee: "lazyLoad" as SymbolName,
      location: {
        file_path: file_b,
        line: 10,
        column: 10,
        end_line: 10,
        end_column: 19,
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
      language: "javascript",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map([
            [function_symbol("lazyLoad" as SymbolName, dynamic_func.location), dynamic_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("lazyLoad");
  });
});
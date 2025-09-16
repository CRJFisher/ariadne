/**
 * Tests for symbol resolution focusing on function call resolution
 */

import { describe, it, expect } from "vitest";
import {
  resolve_function_call,
  FileResolutionContext,
} from "./symbol_resolution";
import {
  FunctionCall,
  FunctionDefinition,
  Import,
  Export,
  NamedImport,
  NamedExport,
  DefaultImport,
  DefaultExport,
  NamespaceImport,
  ReExport,
  NamespaceExport,
  SymbolName,
  FilePath,
  function_symbol,
  ScopeTree,
  Language,
} from "@ariadnejs/types";

describe("resolve_function_call", () => {
  it("should resolve imported named function", () => {
    // Setup: File A exports a function, File B imports and calls it
    const file_a: FilePath = "src/utils.ts" as FilePath;
    const file_b: FilePath = "src/main.ts" as FilePath;

    // File A exports 'processData' function
    const processData_def: FunctionDefinition = {
      name: "processData" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 20,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    // File B imports processData
    const imports_b: Import[] = [
      {
        kind: "named",
        source: file_a,
        imports: [
          {
            name: "processData" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    // File A exports processData
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

    // Function call in file B
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

    // Create resolution context
    const context: FileResolutionContext = {
      scope_tree: {
        root: { id: "root" as any, type: "root" as any },
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
      language: "typescript" as Language,
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map([
            [function_symbol("processData" as SymbolName, {
              file_path: file_a,
              line: 0,
              column: 0,
              end_line: 0,
              end_column: 0,
            }), processData_def],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    // Test resolution
    const resolved = resolve_function_call(call, context);

    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("processData");
    expect(resolved?.location.file_path).toBe(file_a);
  });

  it("should resolve default import", () => {
    const file_a: FilePath = "src/utils.ts" as FilePath;
    const file_b: FilePath = "src/main.ts" as FilePath;

    // File A has a default export
    const defaultFunc_def: FunctionDefinition = {
      name: "defaultFunc" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 20,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    // File B imports default as 'myFunc'
    const imports_b: Import[] = [
      {
        kind: "default",
        source: file_a,
        name: "myFunc" as SymbolName,
      } as unknown as DefaultImport,
    ];

    // File A exports default
    const exports_a: Export[] = [
      {
        kind: "default",
        symbol: "defaultFunc" as SymbolName,
        is_declaration: true,
      } as unknown as DefaultExport,
    ];

    // Function call in file B using the imported name
    const call: FunctionCall = {
      callee: "myFunc" as SymbolName,
      location: {
        file_path: file_b,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 10,
      },
      arguments: [],
      is_async_call: false,
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: { id: "root" as any, type: "root" as any },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      global_symbols: {} as GlobalSymbolTable,
      imports_by_file: new Map([
        [file_b, imports_b],
      ]),
      exports_by_file: new Map([
        [file_a, exports_a],
      ]),
      language: "typescript" as Language,
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map([
            [function_symbol("defaultFunc" as SymbolName, {
              file_path: file_a,
              line: 0,
              column: 0,
              end_line: 0,
              end_column: 0,
            }), defaultFunc_def],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);

    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("defaultFunc");
  });

  it("should resolve namespace member call", () => {
    const file_a: FilePath = "src/utils.ts" as FilePath;
    const file_b: FilePath = "src/main.ts" as FilePath;

    const sqrt_def: FunctionDefinition = {
      name: "sqrt" as SymbolName,
      location: {
        file_path: file_a,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 20,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    // File B imports * as math
    const imports_b: Import[] = [
      {
        kind: "namespace",
        source: file_a,
        namespace_name: "math" as any,
      } as unknown as NamespaceImport,
    ];

    // File A exports sqrt
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

    // Function call in file B using namespace
    const call: FunctionCall = {
      callee: "math.sqrt" as SymbolName,
      location: {
        file_path: file_b,
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
        root: { id: "root" as any, type: "root" as any },
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
      language: "typescript" as Language,
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map([
            [function_symbol("sqrt" as SymbolName, {
              file_path: file_a,
              line: 0,
              column: 0,
              end_line: 0,
              end_column: 0,
            }), sqrt_def],
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

  it("should resolve re-exported function", () => {
    const file_a: FilePath = "src/original.ts" as FilePath;
    const file_b: FilePath = "src/reexport.ts" as FilePath;
    const file_c: FilePath = "src/main.ts" as FilePath;

    const original_def: FunctionDefinition = {
      name: "originalFunc" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 20,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    // File C imports from file B (re-exporter)
    const imports_c: Import[] = [
      {
        kind: "named",
        source: file_b,
        imports: [
          {
            name: "originalFunc" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    // File B re-exports from file A
    const exports_b: Export[] = [
      {
        kind: "reexport",
        source: file_a,
        exports: [
          {
            source_name: "originalFunc" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as ReExport,
    ];

    // File A exports originalFunc
    const exports_a: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "originalFunc" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: FunctionCall = {
      callee: "originalFunc" as SymbolName,
      location: {
        file_path: file_c,
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
        root: { id: "root" as any, type: "root" as any },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([
        [file_c, imports_c],
      ]),
      exports_by_file: new Map([
        [file_a, exports_a],
        [file_b, exports_b],
      ]),
      language: "typescript" as Language,
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map([
            [function_symbol("originalFunc" as SymbolName, {
              file_path: file_a,
              line: 0,
              column: 0,
              end_line: 0,
              end_column: 0,
            }), original_def],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);

    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("originalFunc");
    expect(resolved?.location.file_path).toBe(file_a);
  });
});
/**
 * Tests for function resolution helper functions
 */

import { describe, it, expect } from "vitest";
// Note: These functions will need to be exported from function_resolution.ts for testing
// For now, we'll test them through the main resolve_function_call function

import { resolve_function_call } from "./function_resolution";
import {
  SymbolName,
  FilePath,
  Import,
  Export,
  NamedImport,
  NamedExport,
  DefaultImport,
  DefaultExport,
  NamespaceImport,
  FunctionDefinition,
  FunctionCall,
  function_symbol,
  ScopeTree,
  function_scope,
  ModulePath,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../symbol_resolution";

describe("parse_qualified_name", () => {
  it("should parse simple function name", () => {
    const file_path: FilePath = "test.ts" as FilePath;

    // Test simple name through a namespace import that won't match
    const call: FunctionCall = {
      callee: "simpleFunc" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 11,
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
          parent_id: undefined,
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "typescript",
      definitions: new Map(),
    };

    // The function won't resolve, but it tests the parsing logic
    const result = resolve_function_call(call, context);
    expect(result).toBeUndefined();
  });

  it("should parse namespace.member pattern", () => {
    const file_a: FilePath = "module.ts" as FilePath;
    const file_b: FilePath = "test.ts" as FilePath;

    // This tests the parse_qualified_name function indirectly
    const func: FunctionDefinition = {
      name: "func" as SymbolName,
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

    const imports: Import[] = [
      {
        kind: "namespace",
        source: file_a,
        namespace_name: "ns" as any,
      } as unknown as NamespaceImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "func" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: FunctionCall = {
      callee: "ns.func" as SymbolName,
      location: {
        file_path: file_b,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 8,
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
            end_line: 10,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map([
              [function_symbol("func" as SymbolName, func.location), func],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const result = resolve_function_call(call, context);
    expect(result).toBeDefined();
    expect(result?.name).toBe("func");
  });

  it("should parse deeply nested namespace pattern", () => {
    const file_path: FilePath = "test.ts" as FilePath;

    // Test deep nesting: a.b.c.func
    const call: FunctionCall = {
      callee: "a.b.c.func" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 11,
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
          parent_id: undefined,
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "typescript",
      definitions: new Map(),
    };

    // Won't resolve but tests parsing of deep nesting
    const result = resolve_function_call(call, context);
    expect(result).toBeUndefined();
  });
});

describe("match_callee_to_import", () => {
  it("should match named import", () => {
    const file_a: FilePath = "utils.ts" as FilePath;
    const file_b: FilePath = "test.ts" as FilePath;

    const func: FunctionDefinition = {
      name: "utilFunc" as SymbolName,
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

    const imports: Import[] = [
      {
        kind: "named",
        source: file_a,
        imports: [
          {
            name: "utilFunc" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "utilFunc" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: FunctionCall = {
      callee: "utilFunc" as SymbolName,
      location: {
        file_path: file_b,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 9,
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
            end_line: 10,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map([
              [function_symbol("utilFunc" as SymbolName, func.location), func],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const result = resolve_function_call(call, context);
    expect(result).toBeDefined();
    expect(result?.name).toBe("utilFunc");
  });

  it("should match aliased import", () => {
    const file_a: FilePath = "utils.ts" as FilePath;
    const file_b: FilePath = "test.ts" as FilePath;

    const func: FunctionDefinition = {
      name: "originalName" as SymbolName,
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

    const imports: Import[] = [
      {
        kind: "named",
        source: file_a,
        imports: [
          {
            name: "originalName" as SymbolName,
            alias: "aliasedName" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "originalName" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: FunctionCall = {
      callee: "aliasedName" as SymbolName,
      location: {
        file_path: file_b,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 12,
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
            end_line: 10,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map([
              [
                function_symbol("originalName" as SymbolName, func.location),
                func,
              ],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const result = resolve_function_call(call, context);
    expect(result).toBeDefined();
    expect(result?.name).toBe("originalName");
  });

  it("should match default import", () => {
    const file_a: FilePath = "utils.ts" as FilePath;
    const file_b: FilePath = "test.ts" as FilePath;

    const func: FunctionDefinition = {
      name: "defaultFunc" as SymbolName,
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

    const imports: Import[] = [
      {
        kind: "default",
        source: file_a,
        name: "myDefault" as SymbolName,
      } as unknown as DefaultImport,
    ];

    const exports: Export[] = [
      {
        kind: "default",
        symbol: "defaultFunc" as SymbolName,
        is_declaration: true,
      } as unknown as DefaultExport,
    ];

    const call: FunctionCall = {
      callee: "myDefault" as SymbolName,
      location: {
        file_path: file_b,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 10,
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
            end_line: 10,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map([
              [
                function_symbol("defaultFunc" as SymbolName, func.location),
                func,
              ],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const result = resolve_function_call(call, context);
    expect(result).toBeDefined();
    expect(result?.name).toBe("defaultFunc");
  });

  it("should NOT match namespace import for simple call", () => {
    const file_a: FilePath = "utils.ts" as FilePath;
    const file_b: FilePath = "test.ts" as FilePath;

    const imports: Import[] = [
      {
        kind: "namespace",
        source: file_a,
        namespace_name: "utils" as any,
      } as unknown as NamespaceImport,
    ];

    // Try to call just "func" when it's imported as namespace
    const call: FunctionCall = {
      callee: "func" as SymbolName,
      location: {
        file_path: file_b,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 5,
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
            end_line: 10,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map(),
      language: "typescript",
      definitions: new Map(),
    };

    const result = resolve_function_call(call, context);
    expect(result).toBeUndefined(); // Should not match namespace import
  });
});

describe("resolve_module_to_file", () => {
  it("should resolve relative path ./module", () => {
    const file_a: FilePath = "src/utils.ts" as FilePath;
    const file_b: FilePath = "src/main.ts" as FilePath;

    const func: FunctionDefinition = {
      name: "helper" as SymbolName,
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

    const imports: Import[] = [
      {
        kind: "named",
        source: "./utils" as ModulePath,
        imports: [
          {
            name: "helper" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "helper" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: FunctionCall = {
      callee: "helper" as SymbolName,
      location: {
        file_path: file_b,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 7,
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
            end_line: 10,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map([
              [function_symbol("helper" as SymbolName, func.location), func],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const result = resolve_function_call(call, context);
    expect(result).toBeDefined();
    expect(result?.name).toBe("helper");
  });

  it("should resolve parent directory ../module", () => {
    const file_a: FilePath = "utils.ts" as FilePath;
    const file_b: FilePath = "src/main.ts" as FilePath;

    const func: FunctionDefinition = {
      name: "parentFunc" as SymbolName,
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

    const imports: Import[] = [
      {
        kind: "named",
        source: "../utils" as ModulePath,
        imports: [
          {
            name: "parentFunc" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "parentFunc" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: FunctionCall = {
      callee: "parentFunc" as SymbolName,
      location: {
        file_path: file_b,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 11,
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
            end_line: 10,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map([
              [
                function_symbol("parentFunc" as SymbolName, func.location),
                func,
              ],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const result = resolve_function_call(call, context);
    expect(result).toBeDefined();
    expect(result?.name).toBe("parentFunc");
  });
});

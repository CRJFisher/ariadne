/**
 * TypeScript-specific tests for function resolution
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
  NamespaceImport,
  ReExport,
  SymbolName,
  FilePath,
  function_symbol,
  ScopeTree,
  function_scope,
  class_scope,
  block_scope,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../symbol_resolution";

describe("TypeScript function resolution", () => {
  it("should resolve hoisted function declarations", () => {
    const file_path: FilePath = "src/hoisting.ts" as FilePath;

    const func_location = {
      file_path,
      line: 10,
      column: 1,
      end_line: 12,
      end_column: 2,
    };
    const func_name = "hoistedFunc" as SymbolName;
    // Function defined after the call (hoisting)
    const hoisted_func: FunctionDefinition = {
      name: func_name,
      location: func_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      symbol: function_symbol(func_name, func_location),
    };

    // Call before definition
    const call: FunctionCall = {
      callee: func_name,
      location: {
        file_path,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 15,
      },
      arguments: [],
      symbol: function_symbol(func_name, func_location),
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
          parent_id: undefined,
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "typescript",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map([
              [
                function_symbol(
                  "hoistedFunc" as SymbolName,
                  hoisted_func.location
                ),
                hoisted_func,
              ],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("hoistedFunc");
  });

  it("should resolve arrow functions in scope", () => {
    const file_path: FilePath = "src/arrow.ts" as FilePath;

    // Arrow function assigned to const
    const arrow_func: FunctionDefinition = {
      name: "arrowFunc" as SymbolName,
      location: {
        file_path,
        line: 3,
        column: 7,
        end_line: 3,
        end_column: 30,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    const call: FunctionCall = {
      callee: "arrowFunc" as SymbolName,
      location: {
        file_path,
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
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map([
              [
                function_symbol("arrowFunc" as SymbolName, arrow_func.location),
                arrow_func,
              ],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("arrowFunc");
  });

  it("should resolve async/await functions", () => {
    const file_path: FilePath = "src/async.ts" as FilePath;

    const async_func: FunctionDefinition = {
      name: "fetchData" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 3,
        end_column: 2,
      },
      parameters: [],
      is_async: true,
      is_generator: false,
      return_type: "Promise<Data>",
    };

    const call: FunctionCall = {
      callee: "fetchData" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 10,
        end_line: 5,
        end_column: 20,
      },
      arguments: [],
      is_async_call: true,
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
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map([
              [
                function_symbol("fetchData" as SymbolName, async_func.location),
                async_func,
              ],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("fetchData");
    expect(resolved?.is_async).toBe(true);
  });

  it("should resolve generic functions", () => {
    const file_path: FilePath = "src/generics.ts" as FilePath;

    const generic_func: FunctionDefinition = {
      name: "identity" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 3,
        end_column: 2,
      },
      parameters: [
        {
          name: "value" as SymbolName,
          type: "T",
          is_optional: false,
          is_rest: false,
        },
      ],
      is_async: false,
      is_generator: false,
      return_type: "T",
      type_parameters: ["T"],
    };

    const call: FunctionCall = {
      callee: "identity" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 20,
      },
      arguments: [
        {
          value: "string literal",
          type: "string",
        },
      ],
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
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map([
              [
                function_symbol(
                  "identity" as SymbolName,
                  generic_func.location
                ),
                generic_func,
              ],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("identity");
    expect(resolved?.type_parameters).toContain("T");
  });

  it("should resolve type-only imports (should NOT resolve)", () => {
    const file_a: FilePath = "src/types.ts" as FilePath;
    const file_b: FilePath = "src/consumer.ts" as FilePath;

    // Type-only import should not resolve to function
    const imports_b: Import[] = [
      {
        kind: "named",
        source: file_a,
        imports: [
          {
            name: "MyType" as SymbolName,
            is_type_only: true,
          },
        ],
        is_type_only: true,
      } as unknown as NamedImport,
    ];

    const call: FunctionCall = {
      callee: "MyType" as SymbolName,
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
      imports_by_file: new Map([[file_b, imports_b]]),
      exports_by_file: new Map(),
      language: "typescript",
      definitions: new Map(),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeUndefined(); // Type-only imports should not resolve
  });

  it("should resolve nested scope functions", () => {
    const file_path: FilePath = "src/nested.ts" as FilePath;

    const inner_func: FunctionDefinition = {
      name: "innerFunc" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 5,
        end_line: 7,
        end_column: 6,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    // Call from within the same nested scope
    const call: FunctionCall = {
      callee: "innerFunc" as SymbolName,
      location: {
        file_path,
        line: 6,
        column: 10,
        end_line: 6,
        end_column: 20,
      },
      arguments: [],
      is_async_call: false,
    };

    const outer_scope_id = function_scope({
      file_path,
      line: 1,
      column: 1,
      end_line: 10,
      end_column: 1,
    });

    const inner_scope_id = block_scope({
      file_path,
      line: 3,
      column: 1,
      end_line: 8,
      end_column: 1,
    });

    const context: FileResolutionContext = {
      scope_tree: {
        root_id: outer_scope_id,
        file_path,
        nodes: new Map([
          [
            outer_scope_id,
            {
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
            },
          ],
          [
            inner_scope_id,
            {
              id: inner_scope_id,
              type: "block",
              parent_id: outer_scope_id,
              name: null,
              location: {
                file_path,
                line: 3,
                column: 1,
                end_line: 8,
                end_column: 1,
              },
              child_ids: [],
            },
          ],
        ]),
        scope_depths: new Map([
          [outer_scope_id, 0],
          [inner_scope_id, 1],
        ]),
      } as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "typescript",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map([
              [
                function_symbol("innerFunc" as SymbolName, inner_func.location),
                inner_func,
              ],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("innerFunc");
  });

  it("should resolve module augmentation functions", () => {
    const file_a: FilePath = "src/augmentation.ts" as FilePath;
    const file_b: FilePath = "src/original.ts" as FilePath;

    // TypeScript module augmentation
    const augmented_func: FunctionDefinition = {
      name: "augmentedMethod" as SymbolName,
      location: {
        file_path: file_a,
        line: 5,
        column: 5,
        end_line: 7,
        end_column: 6,
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
            local_name: "augmentedMethod" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const imports_b: Import[] = [
      {
        kind: "named",
        source: file_a,
        imports: [
          {
            name: "augmentedMethod" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const call: FunctionCall = {
      callee: "augmentedMethod" as SymbolName,
      location: {
        file_path: file_b,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 16,
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
          parent_id: undefined,
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports_b]]),
      exports_by_file: new Map([[file_a, exports_a]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map([
              [
                function_symbol(
                  "augmentedMethod" as SymbolName,
                  augmented_func.location
                ),
                augmented_func,
              ],
            ]),
            classes: new Map(),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("augmentedMethod");
  });
});

/**
 * Rust-specific tests for function resolution
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
  function_scope,
  block_scope,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../symbol_resolution";

describe("Rust function resolution", () => {
  it("should resolve functions regardless of definition order", () => {
    const file_path: FilePath = "src/lib.rs" as FilePath;

    // Function can be called before definition in Rust
    const func_def: FunctionDefinition = {
      name: "process" as SymbolName,
      location: {
        file_path,
        line: 15,
        column: 1,
        end_line: 17,
        end_column: 2,
      },
      parameters: [],
      is_async: false,
      is_generator: false,
      return_type: undefined,
    };

    // Call before definition (valid in Rust)
    const call: FunctionCall = {
      callee: "process" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 5,
        end_line: 5,
        end_column: 13,
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
      language: "rust",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("process" as SymbolName, func_def.location), func_def],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("process");
  });

  it("should resolve module path imports", () => {
    const file_a: FilePath = "src/utils.rs" as FilePath;
    const file_b: FilePath = "src/main.rs" as FilePath;

    const util_func: FunctionDefinition = {
      name: "calculate" as SymbolName,
      location: {
        file_path: file_a,
        line: 3,
        column: 1,
        end_line: 5,
        end_column: 2,
      },
      parameters: [{
        name: "x" as SymbolName,
        type: "i32",
        is_optional: false,
        is_rest: false,
      }],
      is_async: false,
      is_generator: false,
      return_type: "i32",
    };

    const exports_a: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "calculate" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    // use utils::calculate;
    const imports_b: Import[] = [
      {
        kind: "named",
        source: "utils" as any,
        imports: [
          {
            name: "calculate" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const call: FunctionCall = {
      callee: "calculate" as SymbolName,
      location: {
        file_path: file_b,
        line: 10,
        column: 10,
        end_line: 10,
        end_column: 20,
      },
      arguments: [{
        value: "42",
        type: "i32",
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
      language: "rust",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map([
            [function_symbol("calculate" as SymbolName, util_func.location), util_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("calculate");
    expect(resolved?.return_type).toBe("i32");
  });

  it("should resolve crate path imports", () => {
    const file_a: FilePath = "src/lib.rs" as FilePath;
    const file_b: FilePath = "src/bin/main.rs" as FilePath;

    const lib_func: FunctionDefinition = {
      name: "library_function" as SymbolName,
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
      return_type: "String",
    };

    const exports_a: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "library_function" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    // use my_crate::library_function;
    const imports_b: Import[] = [
      {
        kind: "namespace",
        source: "my_crate" as any,
        namespace_name: "my_crate" as any,
      } as unknown as NamespaceImport,
    ];

    const call: FunctionCall = {
      callee: "my_crate::library_function" as SymbolName,
      location: {
        file_path: file_b,
        line: 10,
        column: 10,
        end_line: 10,
        end_column: 37,
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
      language: "rust",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map([
            [function_symbol("library_function" as SymbolName, lib_func.location), lib_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("library_function");
  });

  it("should resolve async functions", () => {
    const file_path: FilePath = "src/async_code.rs" as FilePath;

    const async_func: FunctionDefinition = {
      name: "fetch_data" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 5,
        end_column: 2,
      },
      parameters: [{
        name: "url" as SymbolName,
        type: "&str",
        is_optional: false,
        is_rest: false,
      }],
      is_async: true,
      is_generator: false,
      return_type: "Result<String, Error>",
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
        value: '"https://api.example.com"',
        type: "&str",
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
      language: "rust",
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

  it("should resolve generic functions", () => {
    const file_path: FilePath = "src/generics.rs" as FilePath;

    const generic_func: FunctionDefinition = {
      name: "swap" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 4,
        end_column: 2,
      },
      parameters: [
        {
          name: "a" as SymbolName,
          type: "&mut T",
          is_optional: false,
          is_rest: false,
        },
        {
          name: "b" as SymbolName,
          type: "&mut T",
          is_optional: false,
          is_rest: false,
        }
      ],
      is_async: false,
      is_generator: false,
      return_type: undefined,
      type_parameters: ["T"],
    };

    const call: FunctionCall = {
      callee: "swap" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 5,
        end_line: 10,
        end_column: 17,
      },
      arguments: [
        {
          value: "&mut x",
          type: "&mut i32",
        },
        {
          value: "&mut y",
          type: "&mut i32",
        }
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
      language: "rust",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("swap" as SymbolName, generic_func.location), generic_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("swap");
    expect(resolved?.type_parameters).toContain("T");
  });

  it("should resolve closures assigned to variables", () => {
    const file_path: FilePath = "src/closures.rs" as FilePath;

    const closure_func: FunctionDefinition = {
      name: "add_one" as SymbolName, // Variable holding the closure
      location: {
        file_path,
        line: 3,
        column: 10,
        end_line: 3,
        end_column: 30,
      },
      parameters: [{
        name: "x" as SymbolName,
        type: "i32",
        is_optional: false,
        is_rest: false,
      }],
      is_async: false,
      is_generator: false,
      return_type: "i32",
    };

    const call: FunctionCall = {
      callee: "add_one" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 10,
        end_line: 5,
        end_column: 18,
      },
      arguments: [{
        value: "5",
        type: "i32",
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
      language: "rust",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("add_one" as SymbolName, closure_func.location), closure_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("add_one");
  });

  it("should resolve macro invocations (special case)", () => {
    const file_path: FilePath = "src/macros.rs" as FilePath;

    // Macro that expands to a function
    const macro_func: FunctionDefinition = {
      name: "my_macro" as SymbolName,
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
      is_macro: true,
    };

    // Macro invocation with !
    const call: FunctionCall = {
      callee: "my_macro" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 5,
        end_line: 10,
        end_column: 15,
      },
      arguments: [],
      is_async_call: false,
      is_macro_call: true,
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
      language: "rust",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map([
            [function_symbol("my_macro" as SymbolName, macro_func.location), macro_func],
          ]),
          classes: new Map(),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_function_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("my_macro");
    expect(resolved?.is_macro).toBe(true);
  });
});
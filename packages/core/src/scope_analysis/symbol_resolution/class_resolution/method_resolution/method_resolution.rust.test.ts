/**
 * Rust-specific tests for method resolution
 */

import { describe, it, expect } from "vitest";
import { resolve_method_call } from "./method_resolution";
import { create_test_scope_tree, create_test_scope_node, create_test_context } from "./method_resolution.test";
import {
  MethodCall,
  MethodDefinition,
  ClassDefinition,
  Import,
  Export,
  NamedImport,
  NamedExport,
  SymbolName,
  FilePath,
  method_symbol,
  class_symbol,
  ScopeTree,
  ScopeNode,
  function_scope,
  class_scope,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../../symbol_resolution";

describe("Rust method resolution", () => {
  it("should resolve self.method() calls in impl blocks", () => {
    const file_path: FilePath = "src/lib.rs" as FilePath;

    const struct_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 5,
      end_column: 2,
    };

    const method_location = {
      file_path,
      line: 8,
      column: 4,
      end_line: 10,
      end_column: 5,
    };

    const method: MethodDefinition = {
      name: "process" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("process" as SymbolName, "DataStore" as SymbolName, method_location),
    };

    const struct_def: ClassDefinition = {
      name: "DataStore" as SymbolName,
      location: struct_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("DataStore" as SymbolName, struct_location),
    };

    const call: MethodCall = {
      receiver: "self" as SymbolName,
      method_name: "process" as SymbolName,
      location: {
        file_path,
        line: 9,  // Call is inside the impl block
        column: 8,
        end_line: 9,
        end_column: 21,
      },
      arguments: [],
      is_async_call: false,
    };

    const struct_scope_id = class_scope(struct_location);
    const struct_scope_node = create_test_scope_node(
      struct_scope_id,
      "class",
      struct_location
    );

    // Create a method scope that contains the call, with class as parent
    const method_scope_id = function_scope(method_location);
    const method_scope_node = create_test_scope_node(
      method_scope_id,
      "function",
      method_location,
      struct_scope_id  // Set parent to struct scope
    );

    // Build proper scope hierarchy
    const scopes = new Map([
      [struct_scope_id, struct_scope_node],
      [method_scope_id, method_scope_node]
    ]);

    const scope_tree = create_test_scope_tree(struct_scope_node, scopes);

    const context = create_test_context(
      "rust",
      scope_tree,
      new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([[struct_def.symbol, struct_def]]),
          methods: new Map([[method.symbol, method]]),
        }],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("process");
  });

  it("should resolve associated function calls (Type::method())", () => {
    const file_path: FilePath = "src/main.rs" as FilePath;

    const struct_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 5,
      end_column: 2,
    };

    const method_location = {
      file_path,
      line: 8,
      column: 4,
      end_line: 10,
      end_column: 5,
    };

    const associated_fn: MethodDefinition = {
      name: "new" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: "Self",
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: true,
      symbol: method_symbol("new" as SymbolName, "Config" as SymbolName, method_location),
    };

    const struct_def: ClassDefinition = {
      name: "Config" as SymbolName,
      location: struct_location,
      methods: [associated_fn],
      extends: [],
      implements: [],
      symbol: class_symbol("Config" as SymbolName, struct_location),
    };

    const call: MethodCall = {
      receiver: "Config" as SymbolName,
      method_name: "new" as SymbolName,
      location: {
        file_path,
        line: 20,
        column: 4,
        end_line: 20,
        end_column: 16,
      },
      arguments: [],
      is_async_call: false,
    };

    const root_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 30,
      end_column: 1,
    };
    const root_scope_id = function_scope(root_location);
    const root_scope_node = create_test_scope_node(
      root_scope_id,
      "function",
      root_location
    );
    const scope_tree = create_test_scope_tree(root_scope_node);

    const context = create_test_context(
      "rust",
      scope_tree,
      new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([[struct_def.symbol, struct_def]]),
          methods: new Map([[associated_fn.symbol, associated_fn]]),
        }],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("new");
    expect(resolved?.is_static).toBe(true);
  });

  it("should resolve methods from used modules", () => {
    const import_file: FilePath = "src/main.rs" as FilePath;
    const export_file: FilePath = "src/lib.rs" as FilePath;

    const struct_location = {
      file_path: export_file,
      line: 1,
      column: 1,
      end_line: 5,
      end_column: 2,
    };

    const method_location = {
      file_path: export_file,
      line: 8,
      column: 4,
      end_line: 10,
      end_column: 5,
    };

    const method: MethodDefinition = {
      name: "execute" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("execute" as SymbolName, "Processor" as SymbolName, method_location),
    };

    const struct_def: ClassDefinition = {
      name: "Processor" as SymbolName,
      location: struct_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("Processor" as SymbolName, struct_location),
    };

    // use crate::Processor;
    const import_stmt: NamedImport = {
      kind: "named",
      source: "crate" as any,
      imports: [{
        name: "Processor" as SymbolName,
        is_type_only: false,
      }],
    };

    const export_stmt: NamedExport = {
      kind: "named",
      exports: [{
        local_name: "Processor" as SymbolName,
        exported_name: "Processor" as SymbolName,
        is_type_only: false,
      }],
    };

    const call: MethodCall = {
      receiver: "Processor" as SymbolName,
      method_name: "execute" as SymbolName,
      location: {
        file_path: import_file,
        line: 10,
        column: 4,
        end_line: 10,
        end_column: 25,
      },
      arguments: [],
      is_async_call: false,
    };

    const root_location = {
      file_path: import_file,
      line: 1,
      column: 1,
      end_line: 30,
      end_column: 1,
    };
    const root_scope_id = function_scope(root_location);
    const root_scope_node = create_test_scope_node(
      root_scope_id,
      "function",
      root_location
    );
    const scope_tree = create_test_scope_tree(root_scope_node);

    const context = create_test_context(
      "rust",
      scope_tree,
      new Map([
        [export_file, {
          functions: new Map(),
          classes: new Map([[struct_def.symbol, struct_def]]),
          methods: new Map([[method.symbol, method]]),
        }],
      ]),
      new Map([
        [import_file, [import_stmt]],
      ]),
      new Map([
        [export_file, [export_stmt]],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("execute");
  });

  it("should resolve trait implementations", () => {
    const file_path: FilePath = "src/traits.rs" as FilePath;

    const struct_location = {
      file_path,
      line: 10,
      column: 1,
      end_line: 12,
      end_column: 2,
    };

    const method_location = {
      file_path,
      line: 15,
      column: 4,
      end_line: 17,
      end_column: 5,
    };

    const trait_method: MethodDefinition = {
      name: "display" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: "String",
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("display" as SymbolName, "Widget" as SymbolName, method_location),
    };

    const struct_def: ClassDefinition = {
      name: "Widget" as SymbolName,
      location: struct_location,
      methods: [trait_method],
      extends: [],
      implements: ["Display" as SymbolName],  // Implements Display trait
      symbol: class_symbol("Widget" as SymbolName, struct_location),
    };

    const call: MethodCall = {
      receiver: "Widget" as SymbolName,
      method_name: "display" as SymbolName,
      location: {
        file_path,
        line: 25,
        column: 4,
        end_line: 25,
        end_column: 20,
      },
      arguments: [],
      is_async_call: false,
    };

    const root_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 30,
      end_column: 1,
    };
    const root_scope_id = function_scope(root_location);
    const root_scope_node = create_test_scope_node(
      root_scope_id,
      "function",
      root_location
    );
    const scope_tree = create_test_scope_tree(root_scope_node);

    const context = create_test_context(
      "rust",
      scope_tree,
      new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([[struct_def.symbol, struct_def]]),
          methods: new Map([[trait_method.symbol, trait_method]]),
        }],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("display");
  });

  it("should resolve qualified path method calls", () => {
    const file_path: FilePath = "src/qualified.rs" as FilePath;

    const struct_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 5,
      end_column: 2,
    };

    const method_location = {
      file_path,
      line: 8,
      column: 4,
      end_line: 10,
      end_column: 5,
    };

    const method: MethodDefinition = {
      name: "from_str" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: "Result<Self, Error>",
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: true,
      symbol: method_symbol("from_str" as SymbolName, "Config" as SymbolName, method_location),
    };

    const struct_def: ClassDefinition = {
      name: "Config" as SymbolName,
      location: struct_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("Config" as SymbolName, struct_location),
    };

    const call: MethodCall = {
      receiver: "std::str::FromStr::Config" as SymbolName,
      method_name: "from_str" as SymbolName,
      location: {
        file_path,
        line: 20,
        column: 4,
        end_line: 20,
        end_column: 35,
      },
      arguments: [],
      is_async_call: false,
    };

    const root_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 30,
      end_column: 1,
    };
    const root_scope_id = function_scope(root_location);
    const root_scope_node = create_test_scope_node(
      root_scope_id,
      "function",
      root_location
    );
    const scope_tree = create_test_scope_tree(root_scope_node);

    const context = create_test_context(
      "rust",
      scope_tree,
      new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([[struct_def.symbol, struct_def]]),
          methods: new Map([[method.symbol, method]]),
        }],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("from_str");
  });

  it("should resolve Self type methods", () => {
    const file_path: FilePath = "src/builder.rs" as FilePath;

    const struct_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 5,
      end_column: 2,
    };

    const method_location = {
      file_path,
      line: 8,
      column: 4,
      end_line: 10,
      end_column: 5,
    };

    const method: MethodDefinition = {
      name: "build" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: "Self",
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("build" as SymbolName, "Builder" as SymbolName, method_location),
    };

    const struct_def: ClassDefinition = {
      name: "Builder" as SymbolName,
      location: struct_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("Builder" as SymbolName, struct_location),
    };

    const call: MethodCall = {
      receiver: "Self" as SymbolName,
      method_name: "build" as SymbolName,
      location: {
        file_path,
        line: 9,  // Call is inside a method in the impl block
        column: 8,
        end_line: 9,
        end_column: 20,
      },
      arguments: [],
      is_async_call: false,
    };

    const struct_scope_id = class_scope(struct_location);
    const struct_scope_node = create_test_scope_node(
      struct_scope_id,
      "class",
      struct_location
    );

    // Create a method scope that contains the call, with class as parent
    const method_scope_id = function_scope(method_location);
    const method_scope_node = create_test_scope_node(
      method_scope_id,
      "function",
      method_location,
      struct_scope_id  // Set parent to struct scope
    );

    // Build proper scope hierarchy
    const scopes = new Map([
      [struct_scope_id, struct_scope_node],
      [method_scope_id, method_scope_node]
    ]);

    const scope_tree = create_test_scope_tree(struct_scope_node, scopes);

    const context = create_test_context(
      "rust",
      scope_tree,
      new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([[struct_def.symbol, struct_def]]),
          methods: new Map([[method.symbol, method]]),
        }],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("build");
  });
});
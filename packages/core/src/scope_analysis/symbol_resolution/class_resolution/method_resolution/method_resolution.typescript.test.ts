/**
 * TypeScript-specific tests for method resolution
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
  DefaultImport,
  DefaultExport,
  NamespaceImport,
  SymbolName,
  FilePath,
  method_symbol,
  class_symbol,
  ScopeTree,
  ScopeNode,
  function_scope,
  class_scope,
  block_scope,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../../symbol_resolution";

describe("TypeScript method resolution", () => {
  it("should resolve this.method() calls within class", () => {
    const file_path: FilePath = "src/MyClass.ts" as FilePath;

    const class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 20,
      end_column: 2,
    };

    const method_location = {
      file_path,
      line: 5,
      column: 3,
      end_line: 7,
      end_column: 4,
    };

    const method: MethodDefinition = {
      name: "doWork" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("doWork" as SymbolName, "MyClass" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "MyClass" as SymbolName,
      location: class_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("MyClass" as SymbolName, class_location),
    };

    const call: MethodCall = {
      receiver: "this" as SymbolName,
      method_name: "doWork" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 5,
        end_line: 10,
        end_column: 20,
      },
      arguments: [],
      is_async_call: false,
    };

    // Create a class scope
    const class_scope_id = class_scope(class_location);
    const class_scope_node = create_test_scope_node(
      class_scope_id,
      "class",
      class_location
    );
    const scope_tree = create_test_scope_tree(class_scope_node);

    const context = create_test_context(
      "typescript",
      scope_tree,
      new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([[class_def.symbol, class_def]]),
          methods: new Map([[method.symbol, method]]),
        }],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("doWork");
  });

  it("should resolve static method calls", () => {
    const file_path: FilePath = "src/Utils.ts" as FilePath;

    const class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 15,
      end_column: 2,
    };

    const method_location = {
      file_path,
      line: 3,
      column: 3,
      end_line: 5,
      end_column: 4,
    };

    const static_method: MethodDefinition = {
      name: "getInstance" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: true,
      symbol: method_symbol("getInstance" as SymbolName, "Utils" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "Utils" as SymbolName,
      location: class_location,
      methods: [static_method],
      extends: [],
      implements: [],
      symbol: class_symbol("Utils" as SymbolName, class_location),
    };

    const call: MethodCall = {
      receiver: "Utils" as SymbolName,
      method_name: "getInstance" as SymbolName,
      location: {
        file_path,
        line: 20,
        column: 1,
        end_line: 20,
        end_column: 25,
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
      "typescript",
      scope_tree,
      new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([[class_def.symbol, class_def]]),
          methods: new Map([[static_method.symbol, static_method]]),
        }],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("getInstance");
    expect(resolved?.is_static).toBe(true);
  });

  it("should resolve methods on imported classes", () => {
    const import_file: FilePath = "src/main.ts" as FilePath;
    const export_file: FilePath = "src/models/User.ts" as FilePath;

    const class_location = {
      file_path: export_file,
      line: 1,
      column: 1,
      end_line: 10,
      end_column: 2,
    };

    const method_location = {
      file_path: export_file,
      line: 3,
      column: 3,
      end_line: 5,
      end_column: 4,
    };

    const method: MethodDefinition = {
      name: "getName" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: "string",
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("getName" as SymbolName, "User" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "User" as SymbolName,
      location: class_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("User" as SymbolName, class_location),
    };

    // Import in main.ts
    const import_stmt: NamedImport = {
      kind: "named",
      source: "./models/User" as any,
      imports: [{
        name: "User" as SymbolName,
        is_type_only: false,
      }],
    };

    // Export from User.ts
    const export_stmt: NamedExport = {
      kind: "named",
      exports: [{
        local_name: "User" as SymbolName,
        exported_name: "User" as SymbolName,
        is_type_only: false,
      }],
    };

    const call: MethodCall = {
      receiver: "User" as SymbolName,
      method_name: "getName" as SymbolName,
      location: {
        file_path: import_file,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 20,
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
      "typescript",
      scope_tree,
      new Map([
        [export_file, {
          functions: new Map(),
          classes: new Map([[class_def.symbol, class_def]]),
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
    expect(resolved?.name).toBe("getName");
  });

  it("should resolve inherited methods", () => {
    const file_path: FilePath = "src/inheritance.ts" as FilePath;

    const base_class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 10,
      end_column: 2,
    };

    const derived_class_location = {
      file_path,
      line: 12,
      column: 1,
      end_line: 20,
      end_column: 2,
    };

    const base_method_location = {
      file_path,
      line: 3,
      column: 3,
      end_line: 5,
      end_column: 4,
    };

    const base_method: MethodDefinition = {
      name: "baseMethod" as SymbolName,
      location: base_method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("baseMethod" as SymbolName, "BaseClass" as SymbolName, base_method_location),
    };

    const base_class: ClassDefinition = {
      name: "BaseClass" as SymbolName,
      location: base_class_location,
      methods: [base_method],
      extends: [],
      implements: [],
      symbol: class_symbol("BaseClass" as SymbolName, base_class_location),
    };

    const derived_class: ClassDefinition = {
      name: "DerivedClass" as SymbolName,
      location: derived_class_location,
      methods: [],
      extends: ["BaseClass" as SymbolName],
      implements: [],
      symbol: class_symbol("DerivedClass" as SymbolName, derived_class_location),
    };

    const call: MethodCall = {
      receiver: "DerivedClass" as SymbolName,
      method_name: "baseMethod" as SymbolName,
      location: {
        file_path,
        line: 25,
        column: 1,
        end_line: 25,
        end_column: 30,
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
      "typescript",
      scope_tree,
      new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([
            [base_class.symbol, base_class],
            [derived_class.symbol, derived_class],
          ]),
          methods: new Map([[base_method.symbol, base_method]]),
        }],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("baseMethod");
  });

  it("should resolve namespace method calls", () => {
    const import_file: FilePath = "src/app.ts" as FilePath;
    const export_file: FilePath = "src/lib/utilities.ts" as FilePath;

    const class_location = {
      file_path: export_file,
      line: 1,
      column: 1,
      end_line: 10,
      end_column: 2,
    };

    const method_location = {
      file_path: export_file,
      line: 3,
      column: 3,
      end_line: 5,
      end_column: 4,
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
      is_static: true,
      symbol: method_symbol("process" as SymbolName, "Utilities" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "Utilities" as SymbolName,
      location: class_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("Utilities" as SymbolName, class_location),
    };

    // Namespace import
    const namespace_import: NamespaceImport = {
      kind: "namespace",
      source: "./lib/utilities" as any,
      namespace_name: "utils" as SymbolName,
    };

    const export_stmt: NamedExport = {
      kind: "named",
      exports: [{
        local_name: "Utilities" as SymbolName,
        exported_name: "Utilities" as SymbolName,
        is_type_only: false,
      }],
    };

    const call: MethodCall = {
      receiver: "utils" as SymbolName,
      method_name: "process" as SymbolName,
      location: {
        file_path: import_file,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 20,
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
      "typescript",
      scope_tree,
      new Map([
        [export_file, {
          functions: new Map(),
          classes: new Map([[class_def.symbol, class_def]]),
          methods: new Map([[method.symbol, method]]),
        }],
      ]),
      new Map([
        [import_file, [namespace_import]],
      ]),
      new Map([
        [export_file, [export_stmt]],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("process");
  });
});
/**
 * JavaScript-specific tests for method resolution
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

describe("JavaScript method resolution", () => {
  it("should resolve this.method() in ES6 classes", () => {
    const file_path: FilePath = "src/Component.js" as FilePath;

    const class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 15,
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
      name: "render" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("render" as SymbolName, "Component" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "Component" as SymbolName,
      location: class_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("Component" as SymbolName, class_location),
    };

    const call: MethodCall = {
      receiver: "this" as SymbolName,
      method_name: "render" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 5,
        end_line: 10,
        end_column: 18,
      },
      arguments: [],
      is_async_call: false,
    };

    const class_scope_id = class_scope(class_location);
    const class_scope_node = create_test_scope_node(
      class_scope_id,
      "class",
      class_location
    );
    const scope_tree = create_test_scope_tree(class_scope_node);

    const context = create_test_context(
      "javascript",
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
    expect(resolved?.name).toBe("render");
  });

  it("should resolve CommonJS imported class methods", () => {
    const import_file: FilePath = "src/app.js" as FilePath;
    const export_file: FilePath = "src/models/User.js" as FilePath;

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
      name: "validate" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("validate" as SymbolName, "User" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "User" as SymbolName,
      location: class_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("User" as SymbolName, class_location),
    };

    // CommonJS-style import
    const import_stmt: NamedImport = {
      kind: "named",
      source: "./models/User" as any,
      imports: [{
        name: "User" as SymbolName,
        is_type_only: false,
      }],
    };

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
      method_name: "validate" as SymbolName,
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
      "javascript",
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
    expect(resolved?.name).toBe("validate");
  });

  it("should resolve class inheritance with extends", () => {
    const file_path: FilePath = "src/components.js" as FilePath;

    const base_class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 8,
      end_column: 2,
    };

    const child_class_location = {
      file_path,
      line: 10,
      column: 1,
      end_line: 15,
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
      name: "init" as SymbolName,
      location: base_method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("init" as SymbolName, "BaseComponent" as SymbolName, base_method_location),
    };

    const base_class: ClassDefinition = {
      name: "BaseComponent" as SymbolName,
      location: base_class_location,
      methods: [base_method],
      extends: [],
      implements: [],
      symbol: class_symbol("BaseComponent" as SymbolName, base_class_location),
    };

    const child_class: ClassDefinition = {
      name: "ChildComponent" as SymbolName,
      location: child_class_location,
      methods: [],
      extends: ["BaseComponent" as SymbolName],
      implements: [],
      symbol: class_symbol("ChildComponent" as SymbolName, child_class_location),
    };

    const call: MethodCall = {
      receiver: "ChildComponent" as SymbolName,
      method_name: "init" as SymbolName,
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
      "javascript",
      scope_tree,
      new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([
            [base_class.symbol, base_class],
            [child_class.symbol, child_class],
          ]),
          methods: new Map([[base_method.symbol, base_method]]),
        }],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("init");
  });

  it("should resolve default export class methods", () => {
    const import_file: FilePath = "src/index.js" as FilePath;
    const export_file: FilePath = "src/Widget.js" as FilePath;

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
      name: "mount" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("mount" as SymbolName, "Widget" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "Widget" as SymbolName,
      location: class_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("Widget" as SymbolName, class_location),
    };

    const import_stmt: DefaultImport = {
      kind: "default",
      source: "./Widget" as any,
      name: "Widget" as SymbolName,
    };

    const export_stmt: DefaultExport = {
      kind: "default",
      symbol: "Widget" as SymbolName,
    };

    const call: MethodCall = {
      receiver: "Widget" as SymbolName,
      method_name: "mount" as SymbolName,
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
      "javascript",
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
    expect(resolved?.name).toBe("mount");
  });

  it("should resolve static method calls", () => {
    const file_path: FilePath = "src/helpers.js" as FilePath;

    const class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 12,
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
      name: "create" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: true,
      symbol: method_symbol("create" as SymbolName, "Factory" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "Factory" as SymbolName,
      location: class_location,
      methods: [static_method],
      extends: [],
      implements: [],
      symbol: class_symbol("Factory" as SymbolName, class_location),
    };

    const call: MethodCall = {
      receiver: "Factory" as SymbolName,
      method_name: "create" as SymbolName,
      location: {
        file_path,
        line: 20,
        column: 1,
        end_line: 20,
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
      "javascript",
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
    expect(resolved?.name).toBe("create");
    expect(resolved?.is_static).toBe(true);
  });
});
/**
 * Python-specific tests for method resolution
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

describe("Python method resolution", () => {
  it("should resolve self.method() calls within class", () => {
    const file_path: FilePath = "src/models.py" as FilePath;

    const class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 20,
      end_column: 1,
    };

    const method_location = {
      file_path,
      line: 5,
      column: 4,
      end_line: 7,
      end_column: 8,
    };

    const method: MethodDefinition = {
      name: "process_data" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("process_data" as SymbolName, "DataProcessor" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "DataProcessor" as SymbolName,
      location: class_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("DataProcessor" as SymbolName, class_location),
    };

    const call: MethodCall = {
      receiver: "self" as SymbolName,
      method_name: "process_data" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 8,
        end_line: 10,
        end_column: 28,
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
      "python",
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
    expect(resolved?.name).toBe("process_data");
  });

  it("should resolve cls.method() in class methods", () => {
    const file_path: FilePath = "src/factory.py" as FilePath;

    const class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 15,
      end_column: 1,
    };

    const method_location = {
      file_path,
      line: 3,
      column: 4,
      end_line: 5,
      end_column: 8,
    };

    const class_method: MethodDefinition = {
      name: "create" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,  // In Python, @classmethod is not exactly static
      symbol: method_symbol("create" as SymbolName, "Factory" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "Factory" as SymbolName,
      location: class_location,
      methods: [class_method],
      extends: [],
      implements: [],
      symbol: class_symbol("Factory" as SymbolName, class_location),
    };

    const call: MethodCall = {
      receiver: "cls" as SymbolName,
      method_name: "create" as SymbolName,
      location: {
        file_path,
        line: 8,
        column: 8,
        end_line: 8,
        end_column: 20,
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
      "python",
      scope_tree,
      new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([[class_def.symbol, class_def]]),
          methods: new Map([[class_method.symbol, class_method]]),
        }],
      ])
    );

    const resolved = resolve_method_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("create");
  });

  it("should resolve inherited methods", () => {
    const file_path: FilePath = "src/inheritance.py" as FilePath;

    const base_class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 10,
      end_column: 1,
    };

    const derived_class_location = {
      file_path,
      line: 12,
      column: 1,
      end_line: 20,
      end_column: 1,
    };

    const base_method_location = {
      file_path,
      line: 3,
      column: 4,
      end_line: 5,
      end_column: 8,
    };

    const base_method: MethodDefinition = {
      name: "base_method" as SymbolName,
      location: base_method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("base_method" as SymbolName, "BaseClass" as SymbolName, base_method_location),
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
      method_name: "base_method" as SymbolName,
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
      "python",
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
    expect(resolved?.name).toBe("base_method");
  });

  it("should resolve imported class methods", () => {
    const import_file: FilePath = "main.py" as FilePath;
    const export_file: FilePath = "utils/helper.py" as FilePath;

    const class_location = {
      file_path: export_file,
      line: 1,
      column: 1,
      end_line: 10,
      end_column: 1,
    };

    const method_location = {
      file_path: export_file,
      line: 3,
      column: 4,
      end_line: 5,
      end_column: 8,
    };

    const method: MethodDefinition = {
      name: "compute" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("compute" as SymbolName, "Calculator" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "Calculator" as SymbolName,
      location: class_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("Calculator" as SymbolName, class_location),
    };

    // Python import: from utils.helper import Calculator
    const import_stmt: NamedImport = {
      kind: "named",
      source: "./utils/helper" as any,
      imports: [{
        name: "Calculator" as SymbolName,
        is_type_only: false,
      }],
    };

    // Python exports are implicit but we track them
    const export_stmt: NamedExport = {
      kind: "named",
      exports: [{
        local_name: "Calculator" as SymbolName,
        exported_name: "Calculator" as SymbolName,
        is_type_only: false,
      }],
    };

    const call: MethodCall = {
      receiver: "Calculator" as SymbolName,
      method_name: "compute" as SymbolName,
      location: {
        file_path: import_file,
        line: 10,
        column: 1,
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
      "python",
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
    expect(resolved?.name).toBe("compute");
  });

  it("should resolve super() method calls", () => {
    const file_path: FilePath = "src/override.py" as FilePath;

    const base_class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 10,
      end_column: 1,
    };

    const derived_class_location = {
      file_path,
      line: 12,
      column: 1,
      end_line: 25,
      end_column: 1,
    };

    const base_method_location = {
      file_path,
      line: 3,
      column: 4,
      end_line: 5,
      end_column: 8,
    };

    const base_method: MethodDefinition = {
      name: "__init__" as SymbolName,
      location: base_method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("__init__" as SymbolName, "Parent" as SymbolName, base_method_location),
    };

    const base_class: ClassDefinition = {
      name: "Parent" as SymbolName,
      location: base_class_location,
      methods: [base_method],
      extends: [],
      implements: [],
      symbol: class_symbol("Parent" as SymbolName, base_class_location),
    };

    const derived_class: ClassDefinition = {
      name: "Child" as SymbolName,
      location: derived_class_location,
      methods: [],
      extends: ["Parent" as SymbolName],
      implements: [],
      symbol: class_symbol("Child" as SymbolName, derived_class_location),
    };

    const call: MethodCall = {
      receiver: "super()" as SymbolName,
      method_name: "__init__" as SymbolName,
      location: {
        file_path,
        line: 15,
        column: 8,
        end_line: 15,
        end_column: 30,
      },
      arguments: [],
      is_async_call: false,
    };

    // Create scope hierarchy with child class
    const derived_scope_id = class_scope(derived_class_location);
    const derived_scope_node = create_test_scope_node(
      derived_scope_id,
      "class",
      derived_class_location
    );
    const scope_tree = create_test_scope_tree(derived_scope_node);

    const context = create_test_context(
      "python",
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
    expect(resolved?.name).toBe("__init__");
  });

  it("should resolve static method calls", () => {
    const file_path: FilePath = "src/utils.py" as FilePath;

    const class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 15,
      end_column: 1,
    };

    const method_location = {
      file_path,
      line: 3,
      column: 4,
      end_line: 5,
      end_column: 8,
    };

    const static_method: MethodDefinition = {
      name: "format_date" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: true,
      symbol: method_symbol("format_date" as SymbolName, "DateUtils" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "DateUtils" as SymbolName,
      location: class_location,
      methods: [static_method],
      extends: [],
      implements: [],
      symbol: class_symbol("DateUtils" as SymbolName, class_location),
    };

    const call: MethodCall = {
      receiver: "DateUtils" as SymbolName,
      method_name: "format_date" as SymbolName,
      location: {
        file_path,
        line: 20,
        column: 1,
        end_line: 20,
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
      "python",
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
    expect(resolved?.name).toBe("format_date");
    expect(resolved?.is_static).toBe(true);
  });
});
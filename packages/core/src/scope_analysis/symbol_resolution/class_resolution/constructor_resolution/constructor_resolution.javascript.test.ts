/**
 * JavaScript-specific tests for constructor resolution
 */

import { describe, it, expect } from "vitest";
import { resolve_constructor_call } from "./constructor_resolution";
import {
  ConstructorCall,
  ClassDefinition,
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
  class_symbol,
  ScopeTree,
  function_scope,
  class_scope,
  block_scope,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../../symbol_resolution";

describe("JavaScript constructor resolution", () => {
  it("should resolve local class constructor", () => {
    const file_path: FilePath = "src/app.js" as FilePath;

    const cls: ClassDefinition = {
      name: "MyClass" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 5,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const call: ConstructorCall = {
      class_name: "MyClass" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 20,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({ file_path, line: 1, column: 1, end_line: 20, end_column: 1 }),
          type: "function",
          parent_id: undefined,
          location: { file_path, line: 1, column: 1, end_line: 20, end_column: 1 },
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
          functions: new Map(),
          classes: new Map([[class_symbol("MyClass" as SymbolName, cls.location), cls]]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("MyClass");
  });

  it("should handle temporal dead zone for class declarations", () => {
    const file_path: FilePath = "src/tdz.js" as FilePath;

    const cls: ClassDefinition = {
      name: "MyClass" as SymbolName,
      location: {
        file_path,
        line: 15,
        column: 1,
        end_line: 20,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    // Call before declaration - should fail due to temporal dead zone
    const call: ConstructorCall = {
      class_name: "MyClass" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 20,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({ file_path, line: 1, column: 1, end_line: 25, end_column: 1 }),
          type: "function",
          parent_id: undefined,
          location: { file_path, line: 1, column: 1, end_line: 25, end_column: 1 },
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
          functions: new Map(),
          classes: new Map([[class_symbol("MyClass" as SymbolName, cls.location), cls]]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeUndefined(); // Should fail due to temporal dead zone
  });

  it("should resolve named imported class", () => {
    const file_a: FilePath = "src/models/User.js" as FilePath;
    const file_b: FilePath = "src/services/auth.js" as FilePath;

    const cls: ClassDefinition = {
      name: "User" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 10,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "named",
        source: "../models/User" as any,
        imports: [
          {
            name: "User" as SymbolName,
            is_type_only: false,
          }
        ],
      } as unknown as NamedImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "User" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "User" as SymbolName,
      location: {
        file_path: file_b,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 15,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({ file_path: file_b, line: 1, column: 1, end_line: 20, end_column: 1 }),
          type: "function",
          parent_id: undefined,
          location: { file_path: file_b, line: 1, column: 1, end_line: 20, end_column: 1 },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "javascript",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map(),
          classes: new Map([[class_symbol("User" as SymbolName, cls.location), cls]]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("User");
  });

  it("should resolve default imported class", () => {
    const file_a: FilePath = "src/components/Button.js" as FilePath;
    const file_b: FilePath = "src/app.js" as FilePath;

    const cls: ClassDefinition = {
      name: "ButtonComponent" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 15,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "default",
        source: "./components/Button" as any,
        name: "Button" as SymbolName,
      } as unknown as DefaultImport,
    ];

    const exports: Export[] = [
      {
        kind: "default",
        symbol: "ButtonComponent" as SymbolName,
      } as unknown as DefaultExport,
    ];

    const call: ConstructorCall = {
      class_name: "Button" as SymbolName,
      location: {
        file_path: file_b,
        line: 20,
        column: 1,
        end_line: 20,
        end_column: 20,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({ file_path: file_b, line: 1, column: 1, end_line: 30, end_column: 1 }),
          type: "function",
          parent_id: undefined,
          location: { file_path: file_b, line: 1, column: 1, end_line: 30, end_column: 1 },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "javascript",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map(),
          classes: new Map([[class_symbol("ButtonComponent" as SymbolName, cls.location), cls]]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("ButtonComponent");
  });

  it("should resolve namespace imported class", () => {
    const file_a: FilePath = "src/utils/index.js" as FilePath;
    const file_b: FilePath = "src/app.js" as FilePath;

    const cls: ClassDefinition = {
      name: "Helper" as SymbolName,
      location: {
        file_path: file_a,
        line: 10,
        column: 1,
        end_line: 20,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "namespace",
        source: "./utils" as any,
        namespace_name: "Utils" as any,
      } as unknown as NamespaceImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "Helper" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "Utils.Helper" as SymbolName,
      location: {
        file_path: file_b,
        line: 25,
        column: 1,
        end_line: 25,
        end_column: 25,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({ file_path: file_b, line: 1, column: 1, end_line: 30, end_column: 1 }),
          type: "function",
          parent_id: undefined,
          location: { file_path: file_b, line: 1, column: 1, end_line: 30, end_column: 1 },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "javascript",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map(),
          classes: new Map([[class_symbol("Helper" as SymbolName, cls.location), cls]]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("Helper");
  });

  it("should resolve class with inheritance", () => {
    const file_path: FilePath = "src/inheritance.js" as FilePath;

    const baseClass: ClassDefinition = {
      name: "BaseClass" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 5,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const derivedClass: ClassDefinition = {
      name: "DerivedClass" as SymbolName,
      location: {
        file_path,
        line: 7,
        column: 1,
        end_line: 15,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: ["BaseClass" as SymbolName],
      extends: ["BaseClass" as SymbolName],
    };

    const call: ConstructorCall = {
      class_name: "DerivedClass" as SymbolName,
      location: {
        file_path,
        line: 20,
        column: 1,
        end_line: 20,
        end_column: 25,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({ file_path, line: 1, column: 1, end_line: 25, end_column: 1 }),
          type: "function",
          parent_id: undefined,
          location: { file_path, line: 1, column: 1, end_line: 25, end_column: 1 },
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
          functions: new Map(),
          classes: new Map([
            [class_symbol("BaseClass" as SymbolName, baseClass.location), baseClass],
            [class_symbol("DerivedClass" as SymbolName, derivedClass.location), derivedClass],
          ]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("DerivedClass");
    expect(resolved?.extends?.[0]).toBe("BaseClass");
  });

  it("should resolve re-exported class", () => {
    const file_a: FilePath = "src/models/User.js" as FilePath;
    const file_b: FilePath = "src/models/index.js" as FilePath;
    const file_c: FilePath = "src/app.js" as FilePath;

    const cls: ClassDefinition = {
      name: "User" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 10,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const exports_a: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "User" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const exports_b: Export[] = [
      {
        kind: "reexport",
        source: "src/models/User.js" as any,
        exports: [
          {
            source_name: "User" as SymbolName,
            exported_name: "User" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as ReExport,
    ];

    const imports_c: Import[] = [
      {
        kind: "named",
        source: "src/models/index.js" as any,
        imports: [
          {
            name: "User" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const call: ConstructorCall = {
      class_name: "User" as SymbolName,
      location: {
        file_path: file_c,
        line: 15,
        column: 1,
        end_line: 15,
        end_column: 15,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({ file_path: file_c, line: 1, column: 1, end_line: 20, end_column: 1 }),
          type: "function",
          parent_id: undefined,
          location: { file_path: file_c, line: 1, column: 1, end_line: 20, end_column: 1 },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_c, imports_c]]),
      exports_by_file: new Map([
        [file_a, exports_a],
        [file_b, exports_b],
      ]),
      language: "javascript",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map(),
          classes: new Map([[class_symbol("User" as SymbolName, cls.location), cls]]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("User");
  });
});
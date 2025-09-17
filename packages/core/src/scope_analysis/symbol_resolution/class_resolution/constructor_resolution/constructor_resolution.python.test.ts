/**
 * Python-specific tests for constructor resolution
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
  NamespaceImport,
  SymbolName,
  FilePath,
  class_symbol,
  ScopeTree,
  function_scope,
  class_scope,
  block_scope,
  ScopeNode,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../../symbol_resolution";

describe("Python constructor resolution", () => {
  it("should resolve local class constructor", () => {
    const file_path: FilePath = "src/models.py" as FilePath;

    const cls: ClassDefinition = {
      name: "User" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 1,
        end_line: 15,
        end_column: 1,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const call: ConstructorCall = {
      class_name: "User" as SymbolName,
      location: {
        file_path,
        line: 20,
        column: 1,
        end_line: 20,
        end_column: 10,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({ file_path, line: 1, column: 1, end_line: 30, end_column: 1 }),
          type: "function",
          parent_id: undefined,
          location: { file_path, line: 1, column: 1, end_line: 30, end_column: 1 },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "python",
      definitions_by_file: new Map([
        [file_path, {
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

  it("should require class to be defined before use", () => {
    const file_path: FilePath = "src/order.py" as FilePath;

    const cls: ClassDefinition = {
      name: "MyClass" as SymbolName,
      location: {
        file_path,
        line: 25,
        column: 1,
        end_line: 30,
        end_column: 1,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    // Call before definition - should fail in Python
    const call: ConstructorCall = {
      class_name: "MyClass" as SymbolName,
      location: {
        file_path,
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
          id: function_scope({ file_path, line: 1, column: 1, end_line: 35, end_column: 1 }),
          type: "function",
          parent_id: undefined,
          location: { file_path, line: 1, column: 1, end_line: 35, end_column: 1 },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "python",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([[class_symbol("MyClass" as SymbolName, cls.location), cls]]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeUndefined(); // Should fail - class not yet defined
  });

  it("should resolve super() call to parent class", () => {
    const file_path: FilePath = "src/inheritance.py" as FilePath;

    const baseClass: ClassDefinition = {
      name: "BaseClass" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 5,
        end_column: 1,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const derivedClass: ClassDefinition = {
      name: "DerivedClass" as SymbolName,
      location: {
        file_path,
        line: 8,
        column: 1,
        end_line: 15,
        end_column: 1,
      },
      methods: [],
      properties: [],
      base_classes: ["BaseClass" as SymbolName],
    };

    // super() call within DerivedClass
    const call: ConstructorCall = {
      class_name: "super" as SymbolName,
      location: {
        file_path,
        line: 10, // Inside DerivedClass.__init__
        column: 9,
        end_line: 10,
        end_column: 16,
      },
      arguments: [],
    };

    const classScope: ScopeNode = {
      id: class_scope({ file_path, line: 8, column: 1, end_line: 15, end_column: 1 }),
      type: "class",
      parent_id: function_scope({ file_path, line: 1, column: 1, end_line: 20, end_column: 1 }),
      location: { file_path, line: 8, column: 1, end_line: 15, end_column: 1 },
    };

    const rootId = function_scope({ file_path, line: 1, column: 1, end_line: 20, end_column: 1 });
    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: rootId,
          type: "function",
          parent_id: undefined,
          location: { file_path, line: 1, column: 1, end_line: 20, end_column: 1 },
        },
        nodes: new Map([
          [rootId, {
            id: rootId,
            type: "function",
            parent_id: undefined,
            location: { file_path, line: 1, column: 1, end_line: 20, end_column: 1 },
          }],
          [classScope.id, classScope],
        ]),
        scope_depths: new Map([
          [rootId, 0],
          [classScope.id, 1],
        ]),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "python",
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
    expect(resolved?.name).toBe("BaseClass");
  });

  it("should resolve from import", () => {
    const file_a: FilePath = "models/user.py" as FilePath;
    const file_b: FilePath = "services/auth.py" as FilePath;

    const cls: ClassDefinition = {
      name: "User" as SymbolName,
      location: {
        file_path: file_a,
        line: 10,
        column: 1,
        end_line: 20,
        end_column: 1,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "named",
        source: "../models/user" as any,
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
        line: 25,
        column: 1,
        end_line: 25,
        end_column: 10,
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
      language: "python",
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

  it("should resolve import with alias", () => {
    const file_a: FilePath = "models/user.py" as FilePath;
    const file_b: FilePath = "app.py" as FilePath;

    const cls: ClassDefinition = {
      name: "UserModel" as SymbolName,
      location: {
        file_path: file_a,
        line: 5,
        column: 1,
        end_line: 15,
        end_column: 1,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "named",
        source: "models.user" as any,
        imports: [
          {
            name: "UserModel" as SymbolName,
            alias: "User" as SymbolName,
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
            local_name: "UserModel" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "User" as SymbolName,
      location: {
        file_path: file_b,
        line: 20,
        column: 1,
        end_line: 20,
        end_column: 10,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({ file_path: file_b, line: 1, column: 1, end_line: 25, end_column: 1 }),
          type: "function",
          parent_id: undefined,
          location: { file_path: file_b, line: 1, column: 1, end_line: 25, end_column: 1 },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "python",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map(),
          classes: new Map([[class_symbol("UserModel" as SymbolName, cls.location), cls]]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("UserModel");
  });

  it("should resolve module import with dot notation", () => {
    const file_a: FilePath = "models/__init__.py" as FilePath;
    const file_b: FilePath = "main.py" as FilePath;

    const cls: ClassDefinition = {
      name: "Model" as SymbolName,
      location: {
        file_path: file_a,
        line: 10,
        column: 1,
        end_line: 20,
        end_column: 1,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "namespace",
        source: "models/__init__.py" as any,
        namespace_name: "models" as any,
      } as unknown as NamespaceImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "Model" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "models.Model" as SymbolName,
      location: {
        file_path: file_b,
        line: 15,
        column: 1,
        end_line: 15,
        end_column: 20,
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
      language: "python",
      definitions_by_file: new Map([
        [file_a, {
          functions: new Map(),
          classes: new Map([[class_symbol("Model" as SymbolName, cls.location), cls]]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("Model");
  });

  it("should resolve multiple inheritance", () => {
    const file_path: FilePath = "src/multiple.py" as FilePath;

    const base1: ClassDefinition = {
      name: "Base1" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 3,
        end_column: 1,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const base2: ClassDefinition = {
      name: "Base2" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 1,
        end_line: 7,
        end_column: 1,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const derived: ClassDefinition = {
      name: "MultipleInheritance" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 1,
        end_line: 15,
        end_column: 1,
      },
      methods: [],
      properties: [],
      base_classes: ["Base1" as SymbolName, "Base2" as SymbolName],
    };

    const call: ConstructorCall = {
      class_name: "MultipleInheritance" as SymbolName,
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
      language: "python",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([
            [class_symbol("Base1" as SymbolName, base1.location), base1],
            [class_symbol("Base2" as SymbolName, base2.location), base2],
            [class_symbol("MultipleInheritance" as SymbolName, derived.location), derived],
          ]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("MultipleInheritance");
    expect(resolved?.base_classes).toContain("Base1");
    expect(resolved?.base_classes).toContain("Base2");
  });

  it("should resolve nested class", () => {
    const file_path: FilePath = "src/nested.py" as FilePath;

    const outerClass: ClassDefinition = {
      name: "OuterClass" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 10,
        end_column: 1,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const innerClass: ClassDefinition = {
      name: "InnerClass" as SymbolName,
      location: {
        file_path,
        line: 3,
        column: 5,
        end_line: 8,
        end_column: 5,
      },
      methods: [],
      properties: [],
      base_classes: [],
      parent_class: "OuterClass" as SymbolName, // Python-specific nested class
    };

    const call: ConstructorCall = {
      class_name: "InnerClass" as SymbolName,
      location: {
        file_path,
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
      language: "python",
      definitions_by_file: new Map([
        [file_path, {
          functions: new Map(),
          classes: new Map([
            [class_symbol("OuterClass" as SymbolName, outerClass.location), outerClass],
            [class_symbol("InnerClass" as SymbolName, innerClass.location), innerClass],
          ]),
          methods: new Map(),
        }],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("InnerClass");
  });
});
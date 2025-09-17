/**
 * Tests for class resolution utility functions
 */

import { describe, it, expect } from "vitest";
import {
  find_class_in_file,
  resolve_imported_class,
  find_default_exported_class,
  resolve_module_to_file,
  find_containing_class_scope,
  get_class_from_scope,
  is_scope_ancestor_or_same,
  find_parent_class,
} from "./class_resolution_utils";
import {
  ClassDefinition,
  FilePath,
  SymbolName,
  Import,
  Export,
  NamedImport,
  NamedExport,
  DefaultExport,
  NamespaceImport,
  ModulePath,
  class_symbol,
  ScopeTree,
  ScopeNode,
  function_scope,
  class_scope,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../symbol_resolution";

describe("find_class_in_file", () => {
  it("should find a class by name in a file", () => {
    const file_path: FilePath = "test.ts" as FilePath;
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

    const definitions_by_file = new Map([
      [
        file_path,
        {
          functions: new Map(),
          classes: new Map([
            [class_symbol("MyClass" as SymbolName, cls.location), cls],
          ]),
          methods: new Map(),
        },
      ],
    ]);

    const result = find_class_in_file(
      "MyClass" as SymbolName,
      file_path,
      definitions_by_file
    );
    expect(result).toBe(cls);
  });

  it("should return undefined if class not found", () => {
    const file_path: FilePath = "test.ts" as FilePath;
    const definitions_by_file = new Map([
      [
        file_path,
        {
          functions: new Map(),
          classes: new Map(),
          methods: new Map(),
        },
      ],
    ]);

    const result = find_class_in_file(
      "NonExistent" as SymbolName,
      file_path,
      definitions_by_file
    );
    expect(result).toBeUndefined();
  });
});

describe("resolve_module_to_file", () => {
  it("should resolve relative imports with ../", () => {
    const context: FileResolutionContext = {
      language: "typescript",
      exports_by_file: new Map([["src/models/User.ts" as FilePath, []]]),
      imports_by_file: new Map(),
      definitions: new Map(),
      scope_tree: {} as ScopeTree,
    };

    const result = resolve_module_to_file(
      "../models/User" as ModulePath,
      "src/services/auth.ts" as FilePath,
      context
    );
    expect(result).toBe("src/models/User.ts");
  });

  it("should resolve relative imports with ./", () => {
    const context: FileResolutionContext = {
      language: "typescript",
      exports_by_file: new Map([["src/utils.ts" as FilePath, []]]),
      imports_by_file: new Map(),
      definitions: new Map(),
      scope_tree: {} as ScopeTree,
    };

    const result = resolve_module_to_file(
      "./utils" as ModulePath,
      "src/main.ts" as FilePath,
      context
    );
    expect(result).toBe("src/utils.ts");
  });

  it("should resolve index files", () => {
    const context: FileResolutionContext = {
      language: "typescript",
      exports_by_file: new Map([["src/components/index.ts" as FilePath, []]]),
      imports_by_file: new Map(),
      definitions: new Map(),
      scope_tree: {} as ScopeTree,
    };

    const result = resolve_module_to_file(
      "./components" as ModulePath,
      "src/app.ts" as FilePath,
      context
    );
    expect(result).toBe("src/components/index.ts");
  });

  it("should resolve Python __init__.py files", () => {
    const context: FileResolutionContext = {
      language: "python",
      exports_by_file: new Map([["models/__init__.py" as FilePath, []]]),
      imports_by_file: new Map(),
      definitions: new Map(),
      scope_tree: {} as ScopeTree,
    };

    const result = resolve_module_to_file(
      "./models" as ModulePath,
      "app.py" as FilePath,
      context
    );
    expect(result).toBe("models/__init__.py");
  });

  it("should resolve Python dotted module paths", () => {
    const context: FileResolutionContext = {
      language: "python",
      exports_by_file: new Map([["models/user.py" as FilePath, []]]),
      imports_by_file: new Map(),
      definitions: new Map(),
      scope_tree: {} as ScopeTree,
    };

    const result = resolve_module_to_file(
      "models.user" as ModulePath,
      "app.py" as FilePath,
      context
    );
    expect(result).toBe("models/user.py");
  });

  it("should resolve Rust src/lib.rs for crate imports", () => {
    const context: FileResolutionContext = {
      language: "rust",
      exports_by_file: new Map([["src/lib.rs" as FilePath, []]]),
      imports_by_file: new Map(),
      definitions: new Map(),
      scope_tree: {} as ScopeTree,
    };

    const result = resolve_module_to_file(
      "mycrate" as ModulePath,
      "src/main.rs" as FilePath,
      context
    );
    expect(result).toBe("src/lib.rs");
  });
});

describe("resolve_imported_class", () => {
  it("should resolve a named imported class", () => {
    const file_a: FilePath = "src/models.ts" as FilePath;
    const file_b: FilePath = "src/app.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "User" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 5,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "named",
        source: file_a as ModulePath,
        imports: [
          {
            name: "User" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const context: FileResolutionContext = {
      language: "typescript",
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, []]]),
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [class_symbol("User" as SymbolName, cls.location), cls],
            ]),
            methods: new Map(),
          },
        ],
      ]),
      scope_tree: {} as ScopeTree,
    };

    const result = resolve_imported_class(
      "User" as SymbolName,
      file_b,
      context
    );
    expect(result).toBe(cls);
  });

  it("should resolve an aliased imported class", () => {
    const file_a: FilePath = "src/models.ts" as FilePath;
    const file_b: FilePath = "src/app.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "UserModel" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 5,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "named",
        source: file_a as ModulePath,
        imports: [
          {
            name: "UserModel" as SymbolName,
            alias: "User" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const context: FileResolutionContext = {
      language: "typescript",
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, []]]),
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [class_symbol("UserModel" as SymbolName, cls.location), cls],
            ]),
            methods: new Map(),
          },
        ],
      ]),
      scope_tree: {} as ScopeTree,
    };

    const result = resolve_imported_class(
      "User" as SymbolName,
      file_b,
      context
    );
    expect(result).toBe(cls);
  });
});

describe("find_default_exported_class", () => {
  it("should find the default exported class", () => {
    const file_path: FilePath = "src/component.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "MyComponent" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 10,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const exports: Export[] = [
      {
        kind: "default",
        symbol: "MyComponent" as SymbolName,
      } as unknown as DefaultExport,
    ];

    const context: FileResolutionContext = {
      language: "typescript",
      imports_by_file: new Map(),
      exports_by_file: new Map([[file_path, exports]]),
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [class_symbol("MyComponent" as SymbolName, cls.location), cls],
            ]),
            methods: new Map(),
          },
        ],
      ]),
      scope_tree: {} as ScopeTree,
    };

    const result = find_default_exported_class(file_path, context);
    expect(result).toBe(cls);
  });
});

describe("find_containing_class_scope", () => {
  it("should find the containing class scope", () => {
    const file_path: FilePath = "test.ts" as FilePath;
    const rootId = function_scope({
      file_path,
      line: 1,
      column: 1,
      end_line: 20,
      end_column: 1,
    });
    const classId = class_scope({
      file_path,
      line: 5,
      column: 1,
      end_line: 15,
      end_column: 2,
    });
    const methodId = function_scope({
      file_path,
      line: 7,
      column: 3,
      end_line: 10,
      end_column: 4,
    });

    const classNode: ScopeNode = {
      id: classId,
      type: "class",
      parent_id: rootId,
      location: { file_path, line: 5, column: 1, end_line: 15, end_column: 2 },
    };

    const methodNode: ScopeNode = {
      id: methodId,
      type: "function",
      parent_id: classId,
      location: { file_path, line: 7, column: 3, end_line: 10, end_column: 4 },
    };

    const scope_tree: ScopeTree = {
      root: {
        id: rootId,
        type: "function",
        parent_id: undefined,
        location: {
          file_path,
          line: 1,
          column: 1,
          end_line: 20,
          end_column: 1,
        },
      },
      nodes: new Map([
        [classId, classNode],
        [methodId, methodNode],
      ]),
      get_symbols_in_scope: () => new Map(),
      get_parent_scope: () => undefined,
    } as unknown as ScopeTree;

    const result = find_containing_class_scope(methodId, scope_tree);
    expect(result).toBe(classNode);
  });

  it("should return undefined if no class scope found", () => {
    const file_path: FilePath = "test.ts" as FilePath;
    const rootId = function_scope({
      file_path,
      line: 1,
      column: 1,
      end_line: 20,
      end_column: 1,
    });
    const funcId = function_scope({
      file_path,
      line: 5,
      column: 1,
      end_line: 10,
      end_column: 2,
    });

    const funcNode: ScopeNode = {
      id: funcId,
      type: "function",
      parent_id: rootId,
      location: { file_path, line: 5, column: 1, end_line: 10, end_column: 2 },
    };

    const scope_tree: ScopeTree = {
      root: {
        id: rootId,
        type: "function",
        parent_id: undefined,
        location: {
          file_path,
          line: 1,
          column: 1,
          end_line: 20,
          end_column: 1,
        },
      },
      nodes: new Map([[funcId, funcNode]]),
      get_symbols_in_scope: () => new Map(),
      get_parent_scope: () => undefined,
    } as unknown as ScopeTree;

    const result = find_containing_class_scope(funcId, scope_tree);
    expect(result).toBeUndefined();
  });
});

describe("is_scope_ancestor_or_same", () => {
  it("should return true for same scope", () => {
    const file_path: FilePath = "test.ts" as FilePath;
    const scopeId = function_scope({
      file_path,
      line: 1,
      column: 1,
      end_line: 10,
      end_column: 1,
    });

    const scope_tree: ScopeTree = {
      root: {
        id: scopeId,
        type: "function",
        parent_id: undefined,
        location: {
          file_path,
          line: 1,
          column: 1,
          end_line: 10,
          end_column: 1,
        },
      },
      nodes: new Map(),
      get_symbols_in_scope: () => new Map(),
      get_parent_scope: () => undefined,
    } as unknown as ScopeTree;

    const result = is_scope_ancestor_or_same(scopeId, scopeId, scope_tree);
    expect(result).toBe(true);
  });

  it("should return true for ancestor scope", () => {
    const file_path: FilePath = "test.ts" as FilePath;
    const rootId = function_scope({
      file_path,
      line: 1,
      column: 1,
      end_line: 20,
      end_column: 1,
    });
    const childId = function_scope({
      file_path,
      line: 5,
      column: 1,
      end_line: 10,
      end_column: 2,
    });

    const childNode: ScopeNode = {
      id: childId,
      type: "function",
      parent_id: rootId,
      location: { file_path, line: 5, column: 1, end_line: 10, end_column: 2 },
    };

    const scope_tree: ScopeTree = {
      root: {
        id: rootId,
        type: "function",
        parent_id: undefined,
        location: {
          file_path,
          line: 1,
          column: 1,
          end_line: 20,
          end_column: 1,
        },
      },
      nodes: new Map([[childId, childNode]]),
      get_symbols_in_scope: () => new Map(),
      get_parent_scope: () => undefined,
    } as unknown as ScopeTree;

    const result = is_scope_ancestor_or_same(rootId, childId, scope_tree);
    expect(result).toBe(true);
  });

  it("should return false for non-ancestor scope", () => {
    const file_path: FilePath = "test.ts" as FilePath;
    const rootId = function_scope({
      file_path,
      line: 1,
      column: 1,
      end_line: 30,
      end_column: 1,
    });
    const scope1Id = function_scope({
      file_path,
      line: 5,
      column: 1,
      end_line: 10,
      end_column: 2,
    });
    const scope2Id = function_scope({
      file_path,
      line: 15,
      column: 1,
      end_line: 20,
      end_column: 2,
    });

    const scope1Node: ScopeNode = {
      id: scope1Id,
      type: "function",
      parent_id: rootId,
      location: { file_path, line: 5, column: 1, end_line: 10, end_column: 2 },
    };

    const scope2Node: ScopeNode = {
      id: scope2Id,
      type: "function",
      parent_id: rootId,
      location: { file_path, line: 15, column: 1, end_line: 20, end_column: 2 },
    };

    const scope_tree: ScopeTree = {
      root: {
        id: rootId,
        type: "function",
        parent_id: undefined,
        location: {
          file_path,
          line: 1,
          column: 1,
          end_line: 30,
          end_column: 1,
        },
      },
      nodes: new Map([
        [scope1Id, scope1Node],
        [scope2Id, scope2Node],
      ]),
      get_symbols_in_scope: () => new Map(),
      get_parent_scope: () => undefined,
    } as unknown as ScopeTree;

    const result = is_scope_ancestor_or_same(scope1Id, scope2Id, scope_tree);
    expect(result).toBe(false);
  });
});

describe("find_parent_class", () => {
  it("should find parent class in same file", () => {
    const file_path: FilePath = "test.ts" as FilePath;

    const parentClass: ClassDefinition = {
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

    const context: FileResolutionContext = {
      language: "typescript",
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("BaseClass" as SymbolName, parentClass.location),
                parentClass,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
      scope_tree: {} as ScopeTree,
    };

    const result = find_parent_class(
      "BaseClass" as SymbolName,
      file_path,
      context
    );
    expect(result).toBe(parentClass);
  });

  it("should find imported parent class", () => {
    const file_a: FilePath = "src/base.ts" as FilePath;
    const file_b: FilePath = "src/derived.ts" as FilePath;

    const parentClass: ClassDefinition = {
      name: "BaseClass" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 5,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "named",
        source: file_a as ModulePath,
        imports: [
          {
            name: "BaseClass" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const context: FileResolutionContext = {
      language: "typescript",
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, []]]),
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("BaseClass" as SymbolName, parentClass.location),
                parentClass,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
      scope_tree: {} as ScopeTree,
    };

    const result = find_parent_class(
      "BaseClass" as SymbolName,
      file_b,
      context
    );
    expect(result).toBe(parentClass);
  });
});

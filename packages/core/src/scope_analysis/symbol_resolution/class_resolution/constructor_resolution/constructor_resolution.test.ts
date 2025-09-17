/**
 * Tests for constructor resolution helper functions
 */

import { describe, it, expect } from "vitest";
// Note: These functions will need to be exported from constructor_resolution.ts for testing
// For now, we'll test them through the main resolve_constructor_call function

import { resolve_constructor_call } from "./constructor_resolution";
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
  ClassDefinition,
  ConstructorCall,
  class_symbol,
  ScopeTree,
  function_scope,
  ModulePath,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../../symbol_resolution";

describe("parse_qualified_class_name", () => {
  it("should parse simple class name", () => {
    const file_path: FilePath = "test.ts" as FilePath;

    // Test simple name through a constructor call
    const call: ConstructorCall = {
      class_name: "SimpleClass" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 15,
      },
      arguments: [],
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

    // The class won't resolve, but it tests the parsing logic
    const result = resolve_constructor_call(call, context);
    expect(result).toBeUndefined();
  });

  it("should parse namespace.Class pattern", () => {
    const file_a: FilePath = "module.ts" as FilePath;
    const file_b: FilePath = "test.ts" as FilePath;

    // This tests the parse_qualified_class_name function indirectly
    const cls: ClassDefinition = {
      name: "MyClass" as SymbolName,
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
            local_name: "MyClass" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "ns.MyClass" as SymbolName,
      location: {
        file_path: file_b,
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
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [class_symbol("MyClass" as SymbolName, cls.location), cls],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const result = resolve_constructor_call(call, context);
    expect(result).toBeDefined();
    expect(result?.name).toBe("MyClass");
  });
});

describe("match_class_to_import", () => {
  it("should match named import", () => {
    const file_a: FilePath = "classes.ts" as FilePath;
    const file_b: FilePath = "test.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "ImportedClass" as SymbolName,
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
        source: file_a,
        imports: [
          {
            name: "ImportedClass" as SymbolName,
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
            local_name: "ImportedClass" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "ImportedClass" as SymbolName,
      location: {
        file_path: file_b,
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
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [class_symbol("ImportedClass" as SymbolName, cls.location), cls],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const result = resolve_constructor_call(call, context);
    expect(result).toBeDefined();
    expect(result?.name).toBe("ImportedClass");
  });

  it("should match aliased import", () => {
    const file_a: FilePath = "classes.ts" as FilePath;
    const file_b: FilePath = "test.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "OriginalClass" as SymbolName,
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
        source: file_a,
        imports: [
          {
            name: "OriginalClass" as SymbolName,
            alias: "AliasedClass" as SymbolName,
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
            local_name: "OriginalClass" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "AliasedClass" as SymbolName,
      location: {
        file_path: file_b,
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
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [class_symbol("OriginalClass" as SymbolName, cls.location), cls],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const result = resolve_constructor_call(call, context);
    expect(result).toBeDefined();
    expect(result?.name).toBe("OriginalClass");
  });
});

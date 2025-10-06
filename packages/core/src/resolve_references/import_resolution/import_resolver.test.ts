/**
 * Tests for core import resolution functionality
 */

import { describe, it, expect } from "vitest";
import { extract_import_specs, resolve_export_chain } from "./import_resolver";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  ScopeId,
  ImportDefinition,
  FunctionDefinition,
  ClassDefinition,
  VariableDefinition,
  InterfaceDefinition,
  EnumDefinition,
  TypeAliasDefinition,
  LexicalScope,
  ModulePath,
} from "@ariadnejs/types";

// Test helper to create a minimal semantic index
function create_test_index(
  file_path: FilePath,
  language: "javascript" | "typescript" | "python" | "rust" = "javascript",
  options: {
    imports?: Map<SymbolId, ImportDefinition>;
    functions?: Map<SymbolId, FunctionDefinition>;
    classes?: Map<SymbolId, ClassDefinition>;
    variables?: Map<SymbolId, VariableDefinition>;
    interfaces?: Map<SymbolId, InterfaceDefinition>;
    enums?: Map<SymbolId, EnumDefinition>;
    types?: Map<SymbolId, TypeAliasDefinition>;
    scopes?: Map<ScopeId, LexicalScope>;
    root_scope_id?: ScopeId;
  } = {}
): SemanticIndex {
  const root_scope_id = (options.root_scope_id || "scope-0") as ScopeId;

  return {
    file_path,
    language,
    root_scope_id,
    scopes:
      options.scopes ||
      new Map([
        [
          root_scope_id,
          {
            id: root_scope_id,
            name: null,
            type: "module",
            parent_id: null,
            child_ids: [],
            location: {
              file_path: file_path,
              start_line: 0,
              start_column: 0,
              end_line: 0,
              end_column: 0,
            },
          },
        ],
      ]),
    functions: options.functions || new Map(),
    classes: options.classes || new Map(),
    variables: options.variables || new Map(),
    interfaces: options.interfaces || new Map(),
    enums: options.enums || new Map(),
    namespaces: new Map(),
    types: options.types || new Map(),
    imported_symbols: options.imports || new Map(),
    references: [],
    symbols_by_name: new Map(),
    type_bindings: new Map(),
    type_members: new Map(),
    type_alias_metadata: new Map(),
  };
}

describe("extract_import_specs", () => {
  it("should extract named import specs", () => {
    const file_path = "/test/file.js" as FilePath;
    const scope_id = "scope-0" as ScopeId;

    const import_def: ImportDefinition = {
      kind: "import",
      symbol_id: "import-1" as SymbolId,
      name: "foo" as SymbolName,
      defining_scope_id: scope_id,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 20,
      },
      import_path: "./utils.js" as ModulePath,
      import_kind: "named",
      availability: {
        scope: "file-private",
      },
    };

    const index = create_test_index(file_path, "javascript", {
      imports: new Map([["import-1" as SymbolId, import_def]]),
      root_scope_id: scope_id,
    });

    const specs = extract_import_specs(scope_id, index, file_path);

    expect(specs).toHaveLength(1);
    expect(specs[0].local_name).toBe("foo" as SymbolName);
    expect(specs[0].import_name).toBe("foo" as SymbolName);
    expect(specs[0].import_kind).toBe("named");
  });

  it("should extract aliased import specs", () => {
    const file_path = "/test/file.js" as FilePath;
    const scope_id = "scope-0" as ScopeId;

    const import_def: ImportDefinition = {
      kind: "import",
      symbol_id: "import-1" as SymbolId,
      name: "bar" as SymbolName,
      defining_scope_id: scope_id,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 30,
      },
      import_path: "./utils.js" as ModulePath,
      import_kind: "named",
      original_name: "foo" as SymbolName,
      availability: {
        scope: "file-private",
      },
    };

    const index = create_test_index(file_path, "javascript", {
      imports: new Map([["import-1" as SymbolId, import_def]]),
      root_scope_id: scope_id,
    });

    const specs = extract_import_specs(scope_id, index, file_path);

    expect(specs).toHaveLength(1);
    expect(specs[0].local_name).toBe("bar" as SymbolName);
    expect(specs[0].import_name).toBe("foo" as SymbolName);
  });

  it("should only extract imports from specified scope", () => {
    const file_path = "/test/file.js" as FilePath;
    const scope1 = "scope-1" as ScopeId;
    const scope2 = "scope-2" as ScopeId;

    const import1: ImportDefinition = {
      kind: "import",
      symbol_id: "import-1" as SymbolId,
      name: "foo" as SymbolName,
      defining_scope_id: scope1,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 20,
      },
      import_path: "./utils.js" as ModulePath,
      import_kind: "named",
      availability: {
        scope: "file-private",
      },
    };

    const import2: ImportDefinition = {
      kind: "import",
      symbol_id: "import-2" as SymbolId,
      name: "bar" as SymbolName,
      defining_scope_id: scope2,
      location: {
        file_path: file_path,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 20,
      },
      import_path: "./helpers.js" as ModulePath,
      import_kind: "named",
      availability: {
        scope: "file-private",
      },
    };

    const index = create_test_index(file_path, "javascript", {
      imports: new Map([
        ["import-1" as SymbolId, import1],
        ["import-2" as SymbolId, import2],
      ]),
      root_scope_id: scope1,
    });

    const specs = extract_import_specs(scope1, index, file_path);

    expect(specs).toHaveLength(1);
    expect(specs[0].local_name).toBe("foo" as SymbolName);
  });
});

describe("resolve_export_chain", () => {
  it("should resolve direct export", () => {
    const file_path = "/test/utils.js" as FilePath;
    const symbol_id = "func-1" as SymbolId;

    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id,
      name: "helper" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      },
      signature: {
        parameters: [],
        return_type: "void" as SymbolName,
      },
      availability: {
        scope: "file-export",
      },
    };

    const index = create_test_index(file_path, "javascript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);

    const result = resolve_export_chain(
      file_path,
      "helper" as SymbolName,
      indices
    );

    expect(result).toBe(symbol_id);
  });

  it("should throw error for non-existent export", () => {
    const file_path = "/test/utils.js" as FilePath;
    const index = create_test_index(file_path, "javascript");
    const indices = new Map([[file_path, index]]);

    expect(() => {
      resolve_export_chain(file_path, "nonexistent" as SymbolName, indices);
    }).toThrow("Export not found");
  });

  it("should throw error for non-existent file", () => {
    const file_path = "/test/utils.js" as FilePath;
    const indices = new Map();

    expect(() => {
      resolve_export_chain(file_path, "helper" as SymbolName, indices);
    }).toThrow("Source index not found");
  });

  it("should resolve re-exported symbol (without chain following)", () => {
    // NOTE: Full re-export chain following is not yet implemented
    // This test verifies that re-exported symbols return their own symbol_id
    const file_path = "/test/a.js" as FilePath;
    const symbol_id = "reexport-1" as SymbolId;

    const reexport_def: FunctionDefinition = {
      kind: "function",
      symbol_id,
      name: "helper" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 30,
      },
      signature: {
        parameters: [],
        return_type: "void" as SymbolName,
      },
      availability: {
        scope: "file-export",
        export: {
          name: "helper" as SymbolName,
          is_reexport: true,
        },
      },
    };

    const index = create_test_index(file_path, "javascript", {
      functions: new Map([[symbol_id, reexport_def]]),
    });

    const indices = new Map([[file_path, index]]);

    const result = resolve_export_chain(
      file_path,
      "helper" as SymbolName,
      indices
    );

    // Returns the re-export's own symbol_id (not following the chain)
    expect(result).toBe(symbol_id);
  });

  // NOTE: Circular re-export detection will be implemented when full chain following is added
  // For now, re-exports just return their own symbol_id without following chains

  it("should find exported classes", () => {
    const file_path = "/test/classes.js" as FilePath;
    const symbol_id = "class-1" as SymbolId;

    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id,
      name: "MyClass" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      },
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructor: [],
      availability: {
        scope: "public",
      },
    };

    const index = create_test_index(file_path, "javascript", {
      classes: new Map([[symbol_id, class_def]]),
    });

    const indices = new Map([[file_path, index]]);

    const result = resolve_export_chain(
      file_path,
      "MyClass" as SymbolName,
      indices
    );

    expect(result).toBe(symbol_id);
  });

  it("should find exported variables", () => {
    const file_path = "/test/vars.js" as FilePath;
    const symbol_id = "var-1" as SymbolId;

    const var_def: VariableDefinition = {
      kind: "variable",
      symbol_id,
      name: "config" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 30,
      },
      availability: {
        scope: "file-export",
      },
    };

    const index = create_test_index(file_path, "javascript", {
      variables: new Map([[symbol_id, var_def]]),
    });

    const indices = new Map([[file_path, index]]);

    const result = resolve_export_chain(
      file_path,
      "config" as SymbolName,
      indices
    );

    expect(result).toBe(symbol_id);
  });

  it("should throw error for non-exported symbols", () => {
    const file_path = "/test/utils.js" as FilePath;
    const symbol_id = "func-1" as SymbolId;

    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id,
      name: "private_helper" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      signature: {
        parameters: [],
        return_type: "void" as SymbolName,
      },
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      },
      availability: {
        scope: "package-internal", // Not exported!
      },
    };

    const index = create_test_index(file_path, "javascript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);

    expect(() => {
      resolve_export_chain(file_path, "private_helper" as SymbolName, indices);
    }).toThrow("Export not found");
  });
});

describe("Export Alias Resolution", () => {
  it("resolves import using export alias", () => {
    // lib.ts: export { internalFoo as publicFoo }
    const file_path = "/test/lib.ts" as FilePath;
    const symbol_id = "func-1" as SymbolId;

    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id,
      name: "internalFoo" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      },
      signature: {
        parameters: [],
        return_type: "number" as SymbolName,
      },
      is_exported: true,
      export: {
        export_name: "publicFoo" as SymbolName,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);

    // main.ts: import { publicFoo } from './lib'
    const result = resolve_export_chain(
      file_path,
      "publicFoo" as SymbolName,
      indices
    );

    expect(result).toBe(symbol_id);
  });

  it("resolves import using definition name when no alias", () => {
    // lib.ts: export function foo() {}
    const file_path = "/test/lib.ts" as FilePath;
    const symbol_id = "func-1" as SymbolId;

    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id,
      name: "foo" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      },
      signature: {
        parameters: [],
        return_type: "void" as SymbolName,
      },
      is_exported: true,
      // No export alias
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);

    // main.ts: import { foo } from './lib'
    const result = resolve_export_chain(
      file_path,
      "foo" as SymbolName,
      indices
    );

    expect(result).toBe(symbol_id);
  });

  it("fails when import name does not match export or definition name", () => {
    // lib.ts: export { internalFoo as publicFoo }
    const file_path = "/test/lib.ts" as FilePath;
    const symbol_id = "func-1" as SymbolId;

    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id,
      name: "internalFoo" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      },
      signature: {
        parameters: [],
        return_type: "void" as SymbolName,
      },
      is_exported: true,
      export: {
        export_name: "publicFoo" as SymbolName,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);

    // main.ts: import { wrongName } from './lib'
    expect(() => {
      resolve_export_chain(file_path, "wrongName" as SymbolName, indices);
    }).toThrow("Export not found");
  });

  it("cannot import by internal name when export alias is used", () => {
    // lib.ts: export { internalFoo as publicFoo }
    const file_path = "/test/lib.ts" as FilePath;
    const symbol_id = "func-1" as SymbolId;

    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id,
      name: "internalFoo" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      },
      signature: {
        parameters: [],
        return_type: "void" as SymbolName,
      },
      is_exported: true,
      export: {
        export_name: "publicFoo" as SymbolName,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);

    // main.ts: import { internalFoo } from './lib'
    // This should FAIL because the export alias means only 'publicFoo' is accessible
    expect(() => {
      resolve_export_chain(file_path, "internalFoo" as SymbolName, indices);
    }).toThrow("Export not found");
  });

  it("resolves export alias for classes", () => {
    // lib.ts: export { InternalClass as PublicClass }
    const file_path = "/test/lib.ts" as FilePath;
    const symbol_id = "class-1" as SymbolId;

    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id,
      name: "InternalClass" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      },
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructor: [],
      is_exported: true,
      export: {
        export_name: "PublicClass" as SymbolName,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      classes: new Map([[symbol_id, class_def]]),
    });

    const indices = new Map([[file_path, index]]);

    // main.ts: import { PublicClass } from './lib'
    const result = resolve_export_chain(
      file_path,
      "PublicClass" as SymbolName,
      indices
    );

    expect(result).toBe(symbol_id);
  });

  it("resolves export alias for variables", () => {
    // lib.ts: export { internalConfig as config }
    const file_path = "/test/lib.ts" as FilePath;
    const symbol_id = "var-1" as SymbolId;

    const var_def: VariableDefinition = {
      kind: "variable",
      symbol_id,
      name: "internalConfig" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 30,
      },
      is_exported: true,
      export: {
        export_name: "config" as SymbolName,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      variables: new Map([[symbol_id, var_def]]),
    });

    const indices = new Map([[file_path, index]]);

    // main.ts: import { config } from './lib'
    const result = resolve_export_chain(
      file_path,
      "config" as SymbolName,
      indices
    );

    expect(result).toBe(symbol_id);
  });

  it("resolves export alias for interfaces", () => {
    // lib.ts: export { InternalInterface as PublicInterface }
    const file_path = "/test/lib.ts" as FilePath;
    const symbol_id = "interface-1" as SymbolId;

    const interface_def: InterfaceDefinition = {
      kind: "interface",
      symbol_id,
      name: "InternalInterface" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      },
      extends: [],
      methods: [],
      properties: [],
      is_exported: true,
      export: {
        export_name: "PublicInterface" as SymbolName,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      interfaces: new Map([[symbol_id, interface_def]]),
    });

    const indices = new Map([[file_path, index]]);

    // main.ts: import { PublicInterface } from './lib'
    const result = resolve_export_chain(
      file_path,
      "PublicInterface" as SymbolName,
      indices
    );

    expect(result).toBe(symbol_id);
  });

  it("resolves export alias for enums", () => {
    // lib.ts: export { InternalStatus as Status }
    const file_path = "/test/lib.ts" as FilePath;
    const symbol_id = "enum-1" as SymbolId;

    const enum_def: EnumDefinition = {
      kind: "enum",
      symbol_id,
      name: "InternalStatus" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      },
      members: [],
      is_const: false,
      is_exported: true,
      export: {
        export_name: "Status" as SymbolName,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      enums: new Map([[symbol_id, enum_def]]),
    });

    const indices = new Map([[file_path, index]]);

    // main.ts: import { Status } from './lib'
    const result = resolve_export_chain(
      file_path,
      "Status" as SymbolName,
      indices
    );

    expect(result).toBe(symbol_id);
  });

  it("resolves export alias for type aliases", () => {
    // lib.ts: export { InternalType as PublicType }
    const file_path = "/test/lib.ts" as FilePath;
    const symbol_id = "type-1" as SymbolId;

    const type_def: TypeAliasDefinition = {
      kind: "type_alias",
      symbol_id,
      name: "InternalType" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 40,
      },
      is_exported: true,
      export: {
        export_name: "PublicType" as SymbolName,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      types: new Map([[symbol_id, type_def]]),
    });

    const indices = new Map([[file_path, index]]);

    // main.ts: import { PublicType } from './lib'
    const result = resolve_export_chain(
      file_path,
      "PublicType" as SymbolName,
      indices
    );

    expect(result).toBe(symbol_id);
  });

  it("resolves correct symbol when multiple exports have different aliases", () => {
    // lib.ts:
    //   function foo() {}
    //   function bar() {}
    //   export { foo as publicFoo, bar as publicBar }
    const file_path = "/test/lib.ts" as FilePath;
    const foo_id = "func-1" as SymbolId;
    const bar_id = "func-2" as SymbolId;

    const foo_def: FunctionDefinition = {
      kind: "function",
      symbol_id: foo_id,
      name: "foo" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 20,
      },
      signature: { parameters: [], return_type: "void" as SymbolName },
      is_exported: true,
      export: {
        export_name: "publicFoo" as SymbolName,
      },
    };

    const bar_def: FunctionDefinition = {
      kind: "function",
      symbol_id: bar_id,
      name: "bar" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 20,
      },
      signature: { parameters: [], return_type: "void" as SymbolName },
      is_exported: true,
      export: {
        export_name: "publicBar" as SymbolName,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([
        [foo_id, foo_def],
        [bar_id, bar_def],
      ]),
    });

    const indices = new Map([[file_path, index]]);

    // Verify each alias resolves to correct symbol
    expect(resolve_export_chain(file_path, "publicFoo" as SymbolName, indices)).toBe(foo_id);
    expect(resolve_export_chain(file_path, "publicBar" as SymbolName, indices)).toBe(bar_id);

    // Verify internal names are not accessible
    expect(() => {
      resolve_export_chain(file_path, "foo" as SymbolName, indices);
    }).toThrow("Export not found");
    expect(() => {
      resolve_export_chain(file_path, "bar" as SymbolName, indices);
    }).toThrow("Export not found");
  });

  it("resolves re-exported import with alias", () => {
    // base.ts: function core() {}; export { core }
    const base_file = "/test/base.ts" as FilePath;
    const core_id = "func-1" as SymbolId;

    const core_def: FunctionDefinition = {
      kind: "function",
      symbol_id: core_id,
      name: "core" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: base_file,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 20,
      },
      signature: { parameters: [], return_type: "void" as SymbolName },
      is_exported: true,
    };

    const base_index = create_test_index(base_file, "typescript", {
      functions: new Map([[core_id, core_def]]),
    });

    // middle.ts: export { core as publicCore } from './base'
    const middle_file = "/test/middle.ts" as FilePath;
    const reexport_id = "import-1" as SymbolId;

    const reexport_def: ImportDefinition = {
      kind: "import",
      symbol_id: reexport_id,
      name: "core" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: middle_file,
        start_line: 1,
        start_column: 9,
        end_line: 1,
        end_column: 13,
      },
      import_path: "./base.ts" as ModulePath,
      import_kind: "named",
      is_exported: true,
      export: {
        export_name: "publicCore" as SymbolName,
        is_reexport: true,
      },
    };

    const middle_index = create_test_index(middle_file, "typescript", {
      imports: new Map([[reexport_id, reexport_def]]),
    });

    const indices = new Map([
      [base_file, base_index],
      [middle_file, middle_index],
    ]);

    // main.ts: import { publicCore } from './middle'
    const result = resolve_export_chain(
      middle_file,
      "publicCore" as SymbolName,
      indices
    );

    // Should follow chain and resolve to core in base.ts
    expect(result).toBe(core_id);
  });

  it("handles mixed aliased and non-aliased exports", () => {
    // lib.ts:
    //   export function direct() {}
    //   function internal() {}
    //   export { internal as aliased }
    const file_path = "/test/lib.ts" as FilePath;
    const direct_id = "func-1" as SymbolId;
    const internal_id = "func-2" as SymbolId;

    const direct_def: FunctionDefinition = {
      kind: "function",
      symbol_id: direct_id,
      name: "direct" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 30,
      },
      signature: { parameters: [], return_type: "void" as SymbolName },
      is_exported: true,
      // No alias - exported directly
    };

    const internal_def: FunctionDefinition = {
      kind: "function",
      symbol_id: internal_id,
      name: "internal" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 30,
      },
      signature: { parameters: [], return_type: "void" as SymbolName },
      is_exported: true,
      export: {
        export_name: "aliased" as SymbolName,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([
        [direct_id, direct_def],
        [internal_id, internal_def],
      ]),
    });

    const indices = new Map([[file_path, index]]);

    // Direct export works with its name
    expect(resolve_export_chain(file_path, "direct" as SymbolName, indices)).toBe(direct_id);

    // Aliased export works with alias
    expect(resolve_export_chain(file_path, "aliased" as SymbolName, indices)).toBe(internal_id);

    // Internal name not accessible when aliased
    expect(() => {
      resolve_export_chain(file_path, "internal" as SymbolName, indices);
    }).toThrow("Export not found");
  });
});

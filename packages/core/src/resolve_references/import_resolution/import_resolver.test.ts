/**
 * Tests for core import resolution functionality
 */

import { describe, it, expect } from "vitest";
import { extract_import_specs, resolve_export_chain } from "./import_resolver";
import { build_file_tree } from "../symbol_resolution.test_helpers";
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
  SymbolKind,
  AnyDefinition,
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
  const functions = options.functions || new Map();
  const classes = options.classes || new Map();
  const variables = options.variables || new Map();
  const interfaces = options.interfaces || new Map();
  const enums = options.enums || new Map();
  const types = options.types || new Map();
  const imports = options.imports || new Map();

  // Build scope_to_definitions map
  const scope_to_definitions = new Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>();

  const add_to_scope_map = (def: any) => {
    if (!scope_to_definitions.has(def.defining_scope_id)) {
      scope_to_definitions.set(def.defining_scope_id, new Map());
    }
    const scope_map = scope_to_definitions.get(def.defining_scope_id)!;
    if (!scope_map.has(def.kind)) {
      scope_map.set(def.kind, []);
    }
    scope_map.get(def.kind)!.push(def);
  };

  for (const def of functions.values()) {
    add_to_scope_map(def);
  }
  for (const def of classes.values()) {
    add_to_scope_map(def);
  }
  for (const def of variables.values()) {
    add_to_scope_map(def);
  }
  for (const def of interfaces.values()) {
    add_to_scope_map(def);
  }
  for (const def of enums.values()) {
    add_to_scope_map(def);
  }
  for (const def of types.values()) {
    add_to_scope_map(def);
  }
  for (const def of imports.values()) {
    add_to_scope_map(def);
  }

  // Build exported_symbols map from all definitions
  const exported_symbols = new Map();
  for (const def of functions.values()) {
    if (def.is_exported) {
      const export_name = def.export?.export_name || def.name;
      exported_symbols.set(export_name, def);
    }
  }
  for (const def of classes.values()) {
    if (def.is_exported) {
      const export_name = def.export?.export_name || def.name;
      exported_symbols.set(export_name, def);
    }
  }
  for (const def of variables.values()) {
    if (def.is_exported) {
      const export_name = def.export?.export_name || def.name;
      exported_symbols.set(export_name, def);
    }
  }
  for (const def of interfaces.values()) {
    if (def.is_exported) {
      const export_name = def.export?.export_name || def.name;
      exported_symbols.set(export_name, def);
    }
  }
  for (const def of enums.values()) {
    if (def.is_exported) {
      const export_name = def.export?.export_name || def.name;
      exported_symbols.set(export_name, def);
    }
  }
  for (const def of types.values()) {
    if (def.is_exported) {
      const export_name = def.export?.export_name || def.name;
      exported_symbols.set(export_name, def);
    }
  }
  for (const def of imports.values()) {
    // Imports are exported if they have an export field (re-exports)
    if (def.export) {
      const export_name = def.export.export_name || def.name;
      exported_symbols.set(export_name, def);
    }
  }

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
    functions,
    classes,
    variables,
    interfaces,
    enums,
    namespaces: new Map(),
    types,
    imported_symbols: imports,
    references: [],
    scope_to_definitions,
    exported_symbols,
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
    };

    const index = create_test_index(file_path, "javascript", {
      imports: new Map([["import-1" as SymbolId, import_def]]),
      root_scope_id: scope_id,
    });

    const root_folder = build_file_tree([file_path]);
    const specs = extract_import_specs(scope_id, index, file_path, root_folder);

    expect(specs).toHaveLength(1);
    expect(specs[0].local_name).toBe("foo" as SymbolName);
    expect(specs[0].import_name).toBe("foo" as SymbolName);
    expect(specs[0].import_kind).toBe("named");
  });

  it("should extract default import specs", () => {
    const file_path = "/test/file.js" as FilePath;
    const scope_id = "scope-0" as ScopeId;

    const import_def: ImportDefinition = {
      kind: "import",
      symbol_id: "import-1" as SymbolId,
      name: "MyComponent" as SymbolName,
      defining_scope_id: scope_id,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 30,
      },
      import_path: "./component.js" as ModulePath,
      import_kind: "default",
    };

    const index = create_test_index(file_path, "javascript", {
      imports: new Map([["import-1" as SymbolId, import_def]]),
      root_scope_id: scope_id,
    });

    const root_folder = build_file_tree([file_path]);
    const specs = extract_import_specs(scope_id, index, file_path, root_folder);

    expect(specs).toHaveLength(1);
    expect(specs[0].local_name).toBe("MyComponent" as SymbolName);
    expect(specs[0].import_name).toBe("MyComponent" as SymbolName); // Falls back to name
    expect(specs[0].import_kind).toBe("default");
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
    };

    const index = create_test_index(file_path, "javascript", {
      imports: new Map([["import-1" as SymbolId, import_def]]),
      root_scope_id: scope_id,
    });

    const root_folder = build_file_tree([file_path]);
    const specs = extract_import_specs(scope_id, index, file_path, root_folder);

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
    };

    const index = create_test_index(file_path, "javascript", {
      imports: new Map([
        ["import-1" as SymbolId, import1],
        ["import-2" as SymbolId, import2],
      ]),
      root_scope_id: scope1,
    });

    const root_folder = build_file_tree([file_path]);
    const specs = extract_import_specs(scope1, index, file_path, root_folder);

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
      is_exported: true,
    };

    const index = create_test_index(file_path, "javascript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    const result = resolve_export_chain(
      file_path,
      "helper" as SymbolName,
      indices,
      root_folder
    );

    expect(result).toBe(symbol_id);
  });

  it("should throw error for non-existent export", () => {
    const file_path = "/test/utils.js" as FilePath;
    const index = create_test_index(file_path, "javascript");
    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    expect(() => {
      resolve_export_chain(file_path, "nonexistent" as SymbolName, indices, root_folder);
    }).toThrow("Export not found");
  });

  it("should throw error for non-existent file", () => {
    const file_path = "/test/utils.js" as FilePath;
    const indices = new Map();
    const root_folder = build_file_tree([file_path as FilePath]);

    expect(() => {
      resolve_export_chain(file_path, "helper" as SymbolName, indices, root_folder);
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
      is_exported: true,
      export: {
        export_name: "helper" as SymbolName,
        is_reexport: true,
      },
    };

    const index = create_test_index(file_path, "javascript", {
      functions: new Map([[symbol_id, reexport_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    const result = resolve_export_chain(
      file_path,
      "helper" as SymbolName,
      indices,
      root_folder
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
      is_exported: true,
    };

    const index = create_test_index(file_path, "javascript", {
      classes: new Map([[symbol_id, class_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    const result = resolve_export_chain(
      file_path,
      "MyClass" as SymbolName,
      indices,
      root_folder
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
      is_exported: true,
    };

    const index = create_test_index(file_path, "javascript", {
      variables: new Map([[symbol_id, var_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    const result = resolve_export_chain(
      file_path,
      "config" as SymbolName,
      indices,
      root_folder
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
      is_exported: false,
    };

    const index = create_test_index(file_path, "javascript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    expect(() => {
      resolve_export_chain(file_path, "private_helper" as SymbolName, indices, root_folder);
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
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import { publicFoo } from './lib'
    const result = resolve_export_chain(
      file_path,
      "publicFoo" as SymbolName,
      indices,
      root_folder
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
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import { foo } from './lib'
    const result = resolve_export_chain(
      file_path,
      "foo" as SymbolName,
      indices,
      root_folder
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
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import { wrongName } from './lib'
    expect(() => {
      resolve_export_chain(file_path, "wrongName" as SymbolName, indices, root_folder);
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
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import { internalFoo } from './lib'
    // This should FAIL because the export alias means only 'publicFoo' is accessible
    expect(() => {
      resolve_export_chain(file_path, "internalFoo" as SymbolName, indices, root_folder);
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
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import { PublicClass } from './lib'
    const result = resolve_export_chain(
      file_path,
      "PublicClass" as SymbolName,
      indices,
      root_folder
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
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import { config } from './lib'
    const result = resolve_export_chain(
      file_path,
      "config" as SymbolName,
      indices,
      root_folder
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
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import { PublicInterface } from './lib'
    const result = resolve_export_chain(
      file_path,
      "PublicInterface" as SymbolName,
      indices,
      root_folder
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
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import { Status } from './lib'
    const result = resolve_export_chain(
      file_path,
      "Status" as SymbolName,
      indices,
      root_folder
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
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import { PublicType } from './lib'
    const result = resolve_export_chain(
      file_path,
      "PublicType" as SymbolName,
      indices,
      root_folder
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
    const root_folder = build_file_tree([file_path as FilePath]);

    // Verify each alias resolves to correct symbol
    expect(resolve_export_chain(file_path, "publicFoo" as SymbolName, indices, root_folder)).toBe(foo_id);
    expect(resolve_export_chain(file_path, "publicBar" as SymbolName, indices, root_folder)).toBe(bar_id);

    // Verify internal names are not accessible
    expect(() => {
      resolve_export_chain(file_path, "foo" as SymbolName, indices, root_folder);
    }).toThrow("Export not found");
    expect(() => {
      resolve_export_chain(file_path, "bar" as SymbolName, indices, root_folder);
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
    const root_folder = build_file_tree([base_file as FilePath, middle_file as FilePath]);

    // main.ts: import { publicCore } from './middle'
    const result = resolve_export_chain(
      middle_file,
      "publicCore" as SymbolName,
      indices,
      root_folder
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
    const root_folder = build_file_tree([file_path as FilePath]);

    // Direct export works with its name
    expect(resolve_export_chain(file_path, "direct" as SymbolName, indices, root_folder)).toBe(direct_id);

    // Aliased export works with alias
    expect(resolve_export_chain(file_path, "aliased" as SymbolName, indices, root_folder)).toBe(internal_id);

    // Internal name not accessible when aliased
    expect(() => {
      resolve_export_chain(file_path, "internal" as SymbolName, indices, root_folder);
    }).toThrow("Export not found");
  });
});

describe("Default Export Resolution", () => {
  it("resolves default import to default function export", () => {
    // math.ts: export default function calculate() {}
    const file_path = "/test/math.ts" as FilePath;
    const symbol_id = "func-1" as SymbolId;

    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id,
      name: "calculate" as SymbolName,
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
        is_default: true,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import calc from './math'
    // Local name "calc" should be ignored for default imports
    const result = resolve_export_chain(
      file_path,
      "calc" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBe(symbol_id);
  });

  it("resolves default import to default class export", () => {
    // user.ts: export default class User {}
    const file_path = "/test/user.ts" as FilePath;
    const symbol_id = "class-1" as SymbolId;

    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id,
      name: "User" as SymbolName,
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
        is_default: true,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      classes: new Map([[symbol_id, class_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import MyUser from './user'
    const result = resolve_export_chain(
      file_path,
      "MyUser" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBe(symbol_id);
  });

  it("resolves default import to default variable export", () => {
    // config.ts: const cfg = {...}; export default cfg;
    const file_path = "/test/config.ts" as FilePath;
    const symbol_id = "var-1" as SymbolId;

    const var_def: VariableDefinition = {
      kind: "variable",
      symbol_id,
      name: "cfg" as SymbolName,
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
        is_default: true,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      variables: new Map([[symbol_id, var_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import config from './config'
    const result = resolve_export_chain(
      file_path,
      "config" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBe(symbol_id);
  });

  it("resolves default import to default interface export", () => {
    // types.ts: export default interface IConfig {}
    const file_path = "/test/types.ts" as FilePath;
    const symbol_id = "interface-1" as SymbolId;

    const interface_def: InterfaceDefinition = {
      kind: "interface",
      symbol_id,
      name: "IConfig" as SymbolName,
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
        is_default: true,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      interfaces: new Map([[symbol_id, interface_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import Config from './types'
    const result = resolve_export_chain(
      file_path,
      "Config" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBe(symbol_id);
  });

  it("resolves default import to default enum export", () => {
    // status.ts: export default enum Status {}
    const file_path = "/test/status.ts" as FilePath;
    const symbol_id = "enum-1" as SymbolId;

    const enum_def: EnumDefinition = {
      kind: "enum",
      symbol_id,
      name: "Status" as SymbolName,
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
        is_default: true,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      enums: new Map([[symbol_id, enum_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import MyStatus from './status'
    const result = resolve_export_chain(
      file_path,
      "MyStatus" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBe(symbol_id);
  });

  it("resolves default import to default type alias export", () => {
    // types.ts: type Config = {...}; export default Config;
    const file_path = "/test/types.ts" as FilePath;
    const symbol_id = "type-1" as SymbolId;

    const type_def: TypeAliasDefinition = {
      kind: "type_alias",
      symbol_id,
      name: "Config" as SymbolName,
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
        is_default: true,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      types: new Map([[symbol_id, type_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import MyConfig from './types'
    const result = resolve_export_chain(
      file_path,
      "MyConfig" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBe(symbol_id);
  });

  it("throws when no default export exists", () => {
    // lib.ts: export function foo() {}  (no default)
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
      // No is_default flag
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import something from './lib'
    expect(() => {
      resolve_export_chain(
        file_path,
        "something" as SymbolName,
        indices,
        root_folder,
        "default"
      );
    }).toThrow("Default export not found");
  });

  it("handles default re-exports", () => {
    // base.ts: export default function core() {}
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
        end_line: 3,
        end_column: 1,
      },
      signature: {
        parameters: [],
        return_type: "void" as SymbolName,
      },
      is_exported: true,
      export: {
        is_default: true,
      },
    };

    const base_index = create_test_index(base_file, "typescript", {
      functions: new Map([[core_id, core_def]]),
    });

    // barrel.ts: export { default } from './base'
    const barrel_file = "/test/barrel.ts" as FilePath;
    const reexport_id = "import-1" as SymbolId;

    const reexport_def: ImportDefinition = {
      kind: "import",
      symbol_id: reexport_id,
      name: "default" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: barrel_file,
        start_line: 1,
        start_column: 9,
        end_line: 1,
        end_column: 16,
      },
      import_path: "./base.ts" as ModulePath,
      import_kind: "default",
      export: {
        is_default: true,
        is_reexport: true,
      },
    };

    const barrel_index = create_test_index(barrel_file, "typescript", {
      imports: new Map([[reexport_id, reexport_def]]),
    });

    const indices = new Map([
      [base_file, base_index],
      [barrel_file, barrel_index],
    ]);
    const root_folder = build_file_tree([base_file as FilePath, barrel_file as FilePath]);

    // main.ts: import something from './barrel'
    const result = resolve_export_chain(
      barrel_file,
      "something" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    // Should follow chain and resolve to core in base.ts
    expect(result).toBe(core_id);
  });

  it("default and named exports can coexist", () => {
    // lib.ts:
    //   export default function main() {}
    //   export function helper() {}
    const file_path = "/test/lib.ts" as FilePath;
    const main_id = "func-1" as SymbolId;
    const helper_id = "func-2" as SymbolId;

    const main_def: FunctionDefinition = {
      kind: "function",
      symbol_id: main_id,
      name: "main" as SymbolName,
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
        is_default: true,
      },
    };

    const helper_def: FunctionDefinition = {
      kind: "function",
      symbol_id: helper_id,
      name: "helper" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 5,
        start_column: 0,
        end_line: 7,
        end_column: 1,
      },
      signature: {
        parameters: [],
        return_type: "void" as SymbolName,
      },
      is_exported: true,
      // No is_default - this is a named export
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([
        [main_id, main_def],
        [helper_id, helper_def],
      ]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // Default import: import lib from './lib'
    const default_result = resolve_export_chain(
      file_path,
      "lib" as SymbolName,
      indices,
      root_folder,
      "default"
    );
    expect(default_result).toBe(main_id);

    // Named import: import { helper } from './lib'
    const named_result = resolve_export_chain(
      file_path,
      "helper" as SymbolName,
      indices,
      root_folder,
      "named"
    );
    expect(named_result).toBe(helper_id);
  });

  it("throws when multiple default exports exist (indexing bug)", () => {
    // This should never happen in a correctly indexed file, but we validate it
    const file_path = "/test/broken.ts" as FilePath;
    const func_id = "func-1" as SymbolId;
    const class_id = "class-1" as SymbolId;

    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id: func_id,
      name: "main" as SymbolName,
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
        is_default: true,
      },
    };

    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id: class_id,
      name: "MainClass" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 5,
        start_column: 0,
        end_line: 7,
        end_column: 1,
      },
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructor: [],
      is_exported: true,
      export: {
        is_default: true, // ERROR: Second default export!
      },
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([[func_id, func_def]]),
      classes: new Map([[class_id, class_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // Should throw because file has two default exports
    expect(() => {
      resolve_export_chain(
        file_path,
        "anything" as SymbolName,
        indices,
        root_folder,
        "default"
      );
    }).toThrow("Multiple default exports found");
  });

  it("detects circular default re-export chains", () => {
    // a.ts: export { default } from './b'
    const a_file = "/test/a.ts" as FilePath;
    const a_import_id = "import-1" as SymbolId;

    const a_reexport: ImportDefinition = {
      kind: "import",
      symbol_id: a_import_id,
      name: "default" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: a_file,
        start_line: 1,
        start_column: 9,
        end_line: 1,
        end_column: 16,
      },
      import_path: "./b.ts" as ModulePath,
      import_kind: "default",
      export: {
        is_default: true,
        is_reexport: true,
      },
    };

    const a_index = create_test_index(a_file, "typescript", {
      imports: new Map([[a_import_id, a_reexport]]),
    });

    // b.ts: export { default } from './a'
    const b_file = "/test/b.ts" as FilePath;
    const b_import_id = "import-1" as SymbolId;

    const b_reexport: ImportDefinition = {
      kind: "import",
      symbol_id: b_import_id,
      name: "default" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: b_file,
        start_line: 1,
        start_column: 9,
        end_line: 1,
        end_column: 16,
      },
      import_path: "./a.ts" as ModulePath,
      import_kind: "default",
      export: {
        is_default: true,
        is_reexport: true,
      },
    };

    const b_index = create_test_index(b_file, "typescript", {
      imports: new Map([[b_import_id, b_reexport]]),
    });

    const indices = new Map([
      [a_file, a_index],
      [b_file, b_index],
    ]);
    const root_folder = build_file_tree([a_file as FilePath, b_file as FilePath]);

    // main.ts: import foo from './a'
    // Should detect cycle and return null (not throw)
    const result = resolve_export_chain(
      a_file,
      "foo" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBeNull();
  });

  it("ignores local import name - same default export with different import names", () => {
    // math.ts: export default function calculate() {}
    const file_path = "/test/math.ts" as FilePath;
    const symbol_id = "func-1" as SymbolId;

    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id,
      name: "calculate" as SymbolName,
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
        is_default: true,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // All these different local names should resolve to the same default export
    const names = ["calc", "calculator", "doMath", "fn", "X"];

    for (const local_name of names) {
      const result = resolve_export_chain(
        file_path,
        local_name as SymbolName,
        indices,
        root_folder,
        "default"
      );
      expect(result).toBe(symbol_id);
    }
  });

  it("handles anonymous default function export", () => {
    // math.ts: export default function() { return 42; }
    const file_path = "/test/math.ts" as FilePath;
    const symbol_id = "func-1" as SymbolId;

    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id,
      name: "<anonymous>" as SymbolName, // Generated name for anonymous function
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: file_path,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 40,
      },
      signature: {
        parameters: [],
        return_type: "number" as SymbolName,
      },
      is_exported: true,
      export: {
        is_default: true,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      functions: new Map([[symbol_id, func_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import calc from './math'
    const result = resolve_export_chain(
      file_path,
      "calc" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBe(symbol_id);
  });

  it("handles anonymous default class export", () => {
    // component.ts: export default class { }
    const file_path = "/test/component.ts" as FilePath;
    const symbol_id = "class-1" as SymbolId;

    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id,
      name: "<anonymous>" as SymbolName,
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
      decorators: [],
      constructor: [],
      is_exported: true,
      export: {
        is_default: true,
      },
    };

    const index = create_test_index(file_path, "typescript", {
      classes: new Map([[symbol_id, class_def]]),
    });

    const indices = new Map([[file_path, index]]);
    const root_folder = build_file_tree([file_path as FilePath]);

    // main.ts: import Component from './component'
    const result = resolve_export_chain(
      file_path,
      "Component" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBe(symbol_id);
  });

  it("handles multi-level default re-export chains", () => {
    // base.ts: export default function core() {}
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
        end_line: 3,
        end_column: 1,
      },
      signature: {
        parameters: [],
        return_type: "void" as SymbolName,
      },
      is_exported: true,
      export: {
        is_default: true,
      },
    };

    const base_index = create_test_index(base_file, "typescript", {
      functions: new Map([[core_id, core_def]]),
    });

    // middle.ts: export { default } from './base'
    const middle_file = "/test/middle.ts" as FilePath;
    const middle_reexport_id = "import-1" as SymbolId;

    const middle_reexport: ImportDefinition = {
      kind: "import",
      symbol_id: middle_reexport_id,
      name: "default" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: middle_file,
        start_line: 1,
        start_column: 9,
        end_line: 1,
        end_column: 16,
      },
      import_path: "./base.ts" as ModulePath,
      import_kind: "default",
      export: {
        is_default: true,
        is_reexport: true,
      },
    };

    const middle_index = create_test_index(middle_file, "typescript", {
      imports: new Map([[middle_reexport_id, middle_reexport]]),
    });

    // barrel.ts: export { default } from './middle'
    const barrel_file = "/test/barrel.ts" as FilePath;
    const barrel_reexport_id = "import-2" as SymbolId;

    const barrel_reexport: ImportDefinition = {
      kind: "import",
      symbol_id: barrel_reexport_id,
      name: "default" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: barrel_file,
        start_line: 1,
        start_column: 9,
        end_line: 1,
        end_column: 16,
      },
      import_path: "./middle.ts" as ModulePath,
      import_kind: "default",
      export: {
        is_default: true,
        is_reexport: true,
      },
    };

    const barrel_index = create_test_index(barrel_file, "typescript", {
      imports: new Map([[barrel_reexport_id, barrel_reexport]]),
    });

    const indices = new Map([
      [base_file, base_index],
      [middle_file, middle_index],
      [barrel_file, barrel_index],
    ]);
    const root_folder = build_file_tree([base_file as FilePath, middle_file as FilePath, barrel_file as FilePath]);

    // main.ts: import something from './barrel'
    // Should follow chain: barrel → middle → base
    const result = resolve_export_chain(
      barrel_file,
      "something" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBe(core_id);
  });

  it("handles default class re-export chain", () => {
    // base.ts: export default class Component {}
    const base_file = "/test/base.ts" as FilePath;
    const component_id = "class-1" as SymbolId;

    const component_def: ClassDefinition = {
      kind: "class",
      symbol_id: component_id,
      name: "Component" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: base_file,
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
        is_default: true,
      },
    };

    const base_index = create_test_index(base_file, "typescript", {
      classes: new Map([[component_id, component_def]]),
    });

    // barrel.ts: export { default } from './base'
    const barrel_file = "/test/barrel.ts" as FilePath;
    const reexport_id = "import-1" as SymbolId;

    const reexport_def: ImportDefinition = {
      kind: "import",
      symbol_id: reexport_id,
      name: "default" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: barrel_file,
        start_line: 1,
        start_column: 9,
        end_line: 1,
        end_column: 16,
      },
      import_path: "./base.ts" as ModulePath,
      import_kind: "default",
      export: {
        is_default: true,
        is_reexport: true,
      },
    };

    const barrel_index = create_test_index(barrel_file, "typescript", {
      imports: new Map([[reexport_id, reexport_def]]),
    });

    const indices = new Map([
      [base_file, base_index],
      [barrel_file, barrel_index],
    ]);
    const root_folder = build_file_tree([base_file as FilePath, barrel_file as FilePath]);

    // main.ts: import MyComponent from './barrel'
    const result = resolve_export_chain(
      barrel_file,
      "MyComponent" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBe(component_id);
  });

  it("handles default variable re-export chain", () => {
    // config.ts: const settings = {...}; export default settings;
    const config_file = "/test/config.ts" as FilePath;
    const settings_id = "var-1" as SymbolId;

    const settings_def: VariableDefinition = {
      kind: "variable",
      symbol_id: settings_id,
      name: "settings" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: config_file,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 40,
      },
      is_exported: true,
      export: {
        is_default: true,
      },
    };

    const config_index = create_test_index(config_file, "typescript", {
      variables: new Map([[settings_id, settings_def]]),
    });

    // index.ts: export { default } from './config'
    const index_file = "/test/index.ts" as FilePath;
    const reexport_id = "import-1" as SymbolId;

    const reexport_def: ImportDefinition = {
      kind: "import",
      symbol_id: reexport_id,
      name: "default" as SymbolName,
      defining_scope_id: "scope-0" as ScopeId,
      location: {
        file_path: index_file,
        start_line: 1,
        start_column: 9,
        end_line: 1,
        end_column: 16,
      },
      import_path: "./config.ts" as ModulePath,
      import_kind: "default",
      export: {
        is_default: true,
        is_reexport: true,
      },
    };

    const index_index = create_test_index(index_file, "typescript", {
      imports: new Map([[reexport_id, reexport_def]]),
    });

    const indices = new Map([
      [config_file, config_index],
      [index_file, index_index],
    ]);
    const root_folder = build_file_tree([config_file as FilePath, index_file as FilePath]);

    // main.ts: import config from './index'
    const result = resolve_export_chain(
      index_file,
      "config" as SymbolName,
      indices,
      root_folder,
      "default"
    );

    expect(result).toBe(settings_id);
  });
});

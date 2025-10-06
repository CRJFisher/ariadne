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
    interfaces: new Map(),
    enums: new Map(),
    namespaces: new Map(),
    types: new Map(),
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

  it("should return null for non-existent export", () => {
    const file_path = "/test/utils.js" as FilePath;
    const index = create_test_index(file_path, "javascript");
    const indices = new Map([[file_path, index]]);

    const result = resolve_export_chain(
      file_path,
      "nonexistent" as SymbolName,
      indices
    );

    expect(result).toBeNull();
  });

  it("should return null for non-existent file", () => {
    const file_path = "/test/utils.js" as FilePath;
    const indices = new Map();

    const result = resolve_export_chain(
      file_path,
      "helper" as SymbolName,
      indices
    );

    expect(result).toBeNull();
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

  it("should not find non-exported symbols", () => {
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

    const result = resolve_export_chain(
      file_path,
      "private_helper" as SymbolName,
      indices
    );

    expect(result).toBeNull();
  });
});

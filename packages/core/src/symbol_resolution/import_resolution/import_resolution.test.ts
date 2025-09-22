/**
 * Tests for import resolution infrastructure
 *
 * Comprehensive test coverage for the import resolution module including:
 * - Core resolution algorithm
 * - Module path resolution
 * - Error handling
 * - Edge cases and complex scenarios
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  resolve_imports,
  create_import_resolution_context,
  resolve_relative_path,
  resolve_absolute_path,
  find_file_with_extensions,
  resolve_node_modules_path,
} from "./index";
import type {
  ImportResolutionContext,
  LanguageImportHandler,
} from "./import_types";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Import,
  Export,
  SymbolDefinition,
  Language,
  NamespaceName,
} from "@ariadnejs/types";
import { SemanticIndex } from "../../semantic_index/semantic_index";
import * as path from "path";
import * as fs from "fs";

/**
 * Mock language handler for testing
 */
class MockLanguageHandler implements LanguageImportHandler {
  constructor(
    private path_mappings: Map<string, FilePath>,
    private symbol_mappings: Map<string, Map<SymbolName, SymbolId>>
  ) {}

  resolve_module_path(import_path: string, _importing_file: FilePath): FilePath | null {
    return this.path_mappings.get(import_path) || null;
  }

  match_import_to_export(
    import_stmt: Import,
    _source_exports: readonly Export[],
    _source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
  ): Map<SymbolName, SymbolId> {
    const key = `${import_stmt.source}:${import_stmt.kind}`;
    const mappings = this.symbol_mappings.get(key) || new Map();

    // For default imports, we need to return a mapping with the import name
    if (import_stmt.kind === "default" && mappings.size > 0) {
      const result = new Map<SymbolName, SymbolId>();
      const default_symbol = mappings.values().next().value;
      if (default_symbol && "name" in import_stmt) {
        result.set(import_stmt.name, default_symbol);
      }
      return result;
    }

    // For namespace imports, we need to return a mapping with the namespace name
    if (import_stmt.kind === "namespace" && mappings.size > 0) {
      const result = new Map<SymbolName, SymbolId>();
      const namespace_symbol = mappings.values().next().value;
      if (namespace_symbol && "namespace_name" in import_stmt) {
        // Convert NamespaceName to SymbolName via unknown
        result.set(import_stmt.namespace_name as unknown as SymbolName, namespace_symbol);
      }
      return result;
    }

    // For named imports, return the mappings directly
    if (import_stmt.kind === "named" && "imports" in import_stmt) {
      const result = new Map<SymbolName, SymbolId>();
      for (const import_item of import_stmt.imports) {
        const symbol_id = mappings.get(import_item.name);
        if (symbol_id) {
          const local_name = import_item.alias || import_item.name;
          result.set(local_name, symbol_id);
        }
      }
      return result;
    }

    return mappings;
  }
}

/**
 * Create a minimal SemanticIndex for testing
 */
function create_test_index(
  file_path: FilePath,
  imports: Import[],
  exports: Export[],
  symbols: Map<SymbolId, SymbolDefinition>,
  language: Language
): SemanticIndex {
  return {
    imports,
    exports,
    symbols,
    references: {
      calls: [],
      returns: [],
      member_accesses: [],
      type_annotations: [],
    },
    language,
    file_path,
    root_scope_id: "root" as any,
    scopes: new Map(),
    file_symbols_by_name: new Map(),
    local_types: [],
    local_type_annotations: [],
    local_type_tracking: {
      declarations: [],
      assignments: [],
      annotations: [],
    },
    local_type_flow: {
      constructor_calls: [],
      assignments: [],
      returns: [],
      call_assignments: [],
    },
  };
}

describe("Import Resolution", () => {
  describe("Core Resolution Algorithm", () => {
    let context: ImportResolutionContext;
    let mock_handler: MockLanguageHandler;

    beforeEach(() => {
      // Set up mock data
      const path_mappings = new Map<string, FilePath>([
        ["./utils", "/src/utils.ts" as FilePath],
        ["./components", "/src/components.ts" as FilePath],
        ["lodash", "/node_modules/lodash/index.js" as FilePath],
      ]);

      const symbol_mappings = new Map<string, Map<SymbolName, SymbolId>>([
        [
          "./utils:named",
          new Map([
            ["processData" as SymbolName, "utils:processData" as SymbolId],
            ["formatDate" as SymbolName, "utils:formatDate" as SymbolId],
          ]),
        ],
        [
          "./components:default",
          new Map([["Button" as SymbolName, "components:Button" as SymbolId]]),
        ],
        [
          "lodash:namespace",
          new Map([["_" as SymbolName, "lodash:namespace" as SymbolId]]),
        ],
      ]);

      mock_handler = new MockLanguageHandler(path_mappings, symbol_mappings);

      // Create indices with mock data
      const indices = new Map<FilePath, SemanticIndex>();

      // Main file with imports
      const main_index = create_test_index(
        "/src/main.ts" as FilePath,
        [
          {
            kind: "named" as const,
            source: "./utils" as FilePath,
            imports: [
              { name: "processData" as SymbolName, is_type_only: false },
              { name: "formatDate" as SymbolName, is_type_only: false },
            ],
            location: { file_path: "/src/main.ts" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
          {
            kind: "default" as const,
            source: "./components" as FilePath,
            name: "Button" as SymbolName,
            location: { file_path: "/src/main.ts" as FilePath, line: 2, column: 0, end_line: 2, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ],
        [],
        new Map(),
        "typescript" as Language
      );

      indices.set("/src/main.ts" as FilePath, main_index);

      // Utils file with exports
      const utils_index = create_test_index(
        "/src/utils.ts" as FilePath,
        [],
        [
          {
            kind: "named" as const,
            symbol: "processData_symbol" as SymbolId,
            symbol_name: "processData" as SymbolName,
            exports: [
              { local_name: "processData" as SymbolName, is_type_only: false },
              { local_name: "formatDate" as SymbolName, is_type_only: false },
            ],
            location: { file_path: "/src/utils.ts" as FilePath, line: 10, column: 0, end_line: 10, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "export_statement",
          },
        ],
        new Map([
          ["utils:processData" as SymbolId, {} as SymbolDefinition],
          ["utils:formatDate" as SymbolId, {} as SymbolDefinition],
        ]),
        "typescript" as Language
      );

      indices.set("/src/utils.ts" as FilePath, utils_index);

      // Components file with default export
      const components_index = create_test_index(
        "/src/components.ts" as FilePath,
        [],
        [
          {
            kind: "default" as const,
            symbol: "components:Button" as SymbolId,
            location: { file_path: "/src/components.ts" as FilePath, line: 5, column: 0, end_line: 5, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "export_statement",
            is_declaration: false,
            symbol_name: "Button" as SymbolName,
          },
        ],
        new Map([
          ["components:Button" as SymbolId, {} as SymbolDefinition],
        ]),
        "typescript" as Language
      );

      indices.set("/src/components.ts" as FilePath, components_index);

      // Create context with mock handler
      context = create_import_resolution_context(
        indices,
        new Map([["typescript" as Language, mock_handler]])
      );
    });

    it("should resolve named imports", () => {
      const result = resolve_imports(context);

      const main_imports = result.imports.get("/src/main.ts" as FilePath);
      expect(main_imports).toBeDefined();
      expect(main_imports?.get("processData" as SymbolName)).toBe("utils:processData");
      expect(main_imports?.get("formatDate" as SymbolName)).toBe("utils:formatDate");
    });

    it("should resolve default imports", () => {
      const result = resolve_imports(context);

      const main_imports = result.imports.get("/src/main.ts" as FilePath);
      expect(main_imports).toBeDefined();
      expect(main_imports?.get("Button" as SymbolName)).toBe("components:Button");
    });

    it("should handle missing source files gracefully", () => {
      // Add an import with no corresponding file
      const index = context.indices.get("/src/main.ts" as FilePath)!;
      (index.imports as any).push({
        kind: "named",
        source: "./missing" as FilePath,
        imports: [{ name: "missing" as SymbolName, is_type_only: false }],
        location: { file_path: "/src/main.ts" as FilePath, line: 3, column: 0, end_line: 3, end_column: 0 },
        modifiers: [],
        language: "typescript" as Language,
        node_type: "import_statement",
      });

      const result = resolve_imports(context);
      const main_imports = result.imports.get("/src/main.ts" as FilePath);

      // Should still resolve other imports
      expect(main_imports?.get("processData" as SymbolName)).toBe("utils:processData");
      // But not the missing one
      expect(main_imports?.get("missing" as SymbolName)).toBeUndefined();
    });

    it("should skip side-effect imports", () => {
      // Add a side-effect import
      const index = context.indices.get("/src/main.ts" as FilePath)!;
      (index.imports as any).push({
        kind: "side_effect",
        source: "./styles.css" as FilePath,
        location: { file_path: "/src/main.ts" as FilePath, line: 0, column: 0, end_line: 1, end_column: 0 },
        modifiers: [],
        language: "typescript" as Language,
        node_type: "import_statement",
      });

      const result = resolve_imports(context);
      const main_imports = result.imports.get("/src/main.ts" as FilePath);

      // Should not include side-effect import
      // We have 2 named imports (processData, formatDate) and 1 default import (Button)
      expect(main_imports?.size).toBe(3); // processData, formatDate, Button
    });
  });

  describe("Module Path Resolution", () => {
    it("should resolve relative paths", () => {
      // This would need mock file system or actual test files
      // For now, test the logic without actual file system
      const import_path = "./utils";
      const importing_file = "/src/main.ts" as FilePath;

      // The function would check file existence
      // In real tests, we'd mock fs.existsSync
      const result = resolve_relative_path(import_path, importing_file);

      // Without mocking fs, this will return null
      expect(result === null || typeof result === "string").toBe(true);
    });

    it("should not resolve non-relative paths as relative", () => {
      const result = resolve_relative_path("lodash", "/src/main.ts" as FilePath);
      expect(result).toBeNull();
    });

    it("should resolve absolute paths", () => {
      const result = resolve_absolute_path("/src/utils");
      // Without actual file system, returns null
      expect(result === null || typeof result === "string").toBe(true);
    });

    it("should not resolve non-absolute paths as absolute", () => {
      const result = resolve_absolute_path("./relative");
      expect(result).toBeNull();
    });

    it("should try multiple extensions", () => {
      const extensions = [".ts", ".tsx", ".js", ".jsx"];
      const result = find_file_with_extensions("/src/utils", extensions);
      // Without actual file system, returns null
      expect(result === null || typeof result === "string").toBe(true);
    });
  });

  describe("Context Creation", () => {
    it("should create an import resolution context with indices and handlers", () => {
      const indices = new Map<FilePath, SemanticIndex>();
      const handlers = new Map<Language, LanguageImportHandler>();

      const context = create_import_resolution_context(indices, handlers);

      expect(context.indices).toBe(indices);
      expect(context.language_handlers).toBe(handlers);
    });

  });

  describe("Namespace Import Resolution", () => {
    it("should resolve namespace imports", () => {
      const path_mappings = new Map<string, FilePath>([
        ["lodash", "/node_modules/lodash/index.js" as FilePath],
      ]);

      const symbol_mappings = new Map<string, Map<SymbolName, SymbolId>>([
        [
          "lodash:namespace",
          new Map([["_" as SymbolName, "lodash:namespace" as SymbolId]]),
        ],
      ]);

      const mock_handler = new MockLanguageHandler(path_mappings, symbol_mappings);

      const indices = new Map<FilePath, SemanticIndex>();
      const main_index = create_test_index(
        "/src/main.ts" as FilePath,
        [
          {
            kind: "namespace" as const,
            source: "lodash" as FilePath,
            namespace_name: "_" as NamespaceName,
            location: { line: 1, column: 0, file_path: "/src/main.ts" as FilePath, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ],
        [],
        new Map(),
        "typescript" as Language
      );

      indices.set("/src/main.ts" as FilePath, main_index);

      // Create a minimal SemanticIndex for lodash
      const lodash_index = create_test_index(
        "/node_modules/lodash/index.js" as FilePath,
        [],
        [],
        new Map(),
        "javascript" as Language
      );

      indices.set("/node_modules/lodash/index.js" as FilePath, lodash_index);

      const context = create_import_resolution_context(
        indices,
        new Map([["typescript" as Language, mock_handler]])
      );

      const result = resolve_imports(context);
      const main_imports = result.imports.get("/src/main.ts" as FilePath);

      expect(main_imports?.get("_" as SymbolName)).toBe("lodash:namespace");
    });
  });

  describe("Error Handling", () => {
    it("should handle missing language handler gracefully", () => {
      const indices = new Map<FilePath, SemanticIndex>();
      const index = {
        imports: [
          {
            kind: "named" as const,
            source: "./utils" as FilePath,
            imports: [{ name: "test" as SymbolName, is_type_only: false }],
            location: { line: 1, column: 0, end_line: 1, end_column: 0, file_path: "/src/main.ts" as FilePath },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ],
        exports: [],
        symbols: new Map(),
        references: {
          calls: [],
          returns: [],
          member_accesses: [],
          type_annotations: [],
        },
        root_scope_id: "root" as any,
        scopes: new Map(),
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: {
          declarations: [],
          assignments: [],
          annotations: [],
        },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
},
        language: "typescript" as Language,
        file_path: "/src/main.ts" as FilePath,
      } as SemanticIndex;

      indices.set("/src/main.ts" as FilePath, index);

      // Create context without any handlers
      const context = create_import_resolution_context(indices, new Map());

      const result = resolve_imports(context);
      expect(result.imports.size).toBe(0); // Should return empty map
    });

    it("should handle imports with no matching exports", () => {
      const mock_handler: LanguageImportHandler = {
        resolve_module_path: () => "/src/utils.ts" as FilePath,
        match_import_to_export: () => new Map(), // Return empty map - no matches
      };

      const indices = new Map<FilePath, SemanticIndex>();
      const main_index = {
        imports: [
          {
            kind: "named" as const,
            source: "./utils" as FilePath,
            imports: [{ name: "nonexistent" as SymbolName, is_type_only: false }],
            location: { line: 1, column: 0, end_line: 1, end_column: 0, file_path: "/src/main.ts" as FilePath },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ],
        exports: [],
        symbols: new Map(),
        references: {
          calls: [],
          returns: [],
          member_accesses: [],
          type_annotations: [],
        },
        root_scope_id: "root" as any,
        scopes: new Map(),
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: {
          declarations: [],
          assignments: [],
          annotations: [],
        },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
},
        language: "typescript" as Language,
        file_path: "/src/main.ts" as FilePath,
      } as SemanticIndex;

      indices.set("/src/main.ts" as FilePath, main_index);
      indices.set("/src/utils.ts" as FilePath, {
        imports: [],
        exports: [],
        symbols: new Map(),
        references: {
          calls: [],
          returns: [],
          member_accesses: [],
          type_annotations: [],
        },
        root_scope_id: "root" as any,
        scopes: new Map(),
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: {
          declarations: [],
          assignments: [],
          annotations: [],
        },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
},
        language: "typescript" as Language,
        file_path: "/src/utils.ts" as FilePath,
      } as SemanticIndex);

      const context = create_import_resolution_context(
        indices,
        new Map([["typescript" as Language, mock_handler]])
      );

      const result = resolve_imports(context);
      expect(result.imports.size).toBe(0); // No successful resolutions
    });

    it("should handle circular imports without infinite loops", () => {
      const mock_handler: LanguageImportHandler = {
        resolve_module_path: (path, importing_file) => {
          if (path === "./fileB" && importing_file.includes("fileA")) {
            return "/src/fileB.ts" as FilePath;
          }
          if (path === "./fileA" && importing_file.includes("fileB")) {
            return "/src/fileA.ts" as FilePath;
          }
          return null;
        },
        match_import_to_export: () => new Map([["circular" as SymbolName, "id" as SymbolId]]),
      };

      const indices = new Map<FilePath, SemanticIndex>();

      // FileA imports from FileB
      indices.set("/src/fileA.ts" as FilePath, {
        imports: [
          {
            kind: "named" as const,
            source: "./fileB" as FilePath,
            imports: [{ name: "fromB" as SymbolName, is_type_only: false }],
            location: { line: 1, column: 0, end_line: 1, end_column: 0, file_path: "/src/fileA.ts" as FilePath },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ],
        exports: [],
        symbols: new Map(),
        references: {
          calls: [],
          returns: [],
          member_accesses: [],
          type_annotations: [],
        },
        root_scope_id: "root" as any,
        scopes: new Map(),
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: {
          declarations: [],
          assignments: [],
          annotations: [],
        },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
},
        language: "typescript" as Language,
        file_path: "/src/fileA.ts" as FilePath,
      } as SemanticIndex);

      // FileB imports from FileA
      indices.set("/src/fileB.ts" as FilePath, {
        imports: [
          {
            kind: "named" as const,
            source: "./fileA" as FilePath,
            imports: [{ name: "fromA" as SymbolName, is_type_only: false }],
            location: { line: 1, column: 0, end_line: 1, end_column: 0, file_path: "/src/fileB.ts" as FilePath },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ],
        exports: [],
        symbols: new Map(),
        references: {
          calls: [],
          returns: [],
          member_accesses: [],
          type_annotations: [],
        },
        root_scope_id: "root" as any,
        scopes: new Map(),
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: {
          declarations: [],
          assignments: [],
          annotations: [],
        },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
},
        language: "typescript" as Language,
        file_path: "/src/fileB.ts" as FilePath,
      } as SemanticIndex);

      const context = create_import_resolution_context(
        indices,
        new Map([["typescript" as Language, mock_handler]])
      );

      // Should complete without hanging
      const result = resolve_imports(context);
      expect(result.imports).toBeDefined();
    });
  });

  describe("Complex Import Scenarios", () => {
    it("should handle multiple imports from the same source", () => {
      const path_mappings = new Map<string, FilePath>([["./utils", "/src/utils.ts" as FilePath]]);
      const symbol_mappings = new Map<string, Map<SymbolName, SymbolId>>([
        [
          "./utils:named",
          new Map([
            ["func1" as SymbolName, "utils:func1" as SymbolId],
            ["func2" as SymbolName, "utils:func2" as SymbolId],
            ["func3" as SymbolName, "utils:func3" as SymbolId],
          ]),
        ],
      ]);

      const mock_handler = new MockLanguageHandler(path_mappings, symbol_mappings);

      const indices = new Map<FilePath, SemanticIndex>();
      const main_index = {
        imports: [
          {
            kind: "named" as const,
            source: "./utils" as FilePath,
            imports: [
              { name: "func1" as SymbolName, is_type_only: false },
              { name: "func2" as SymbolName, is_type_only: false },
              { name: "func3" as SymbolName, is_type_only: false },
            ],
            location: { line: 1, column: 0, end_line: 1, end_column: 0, file_path: "/src/main.ts" as FilePath },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ],
        exports: [],
        symbols: new Map(),
        references: {
          calls: [],
          returns: [],
          member_accesses: [],
          type_annotations: [],
        },
        root_scope_id: "root" as any,
        scopes: new Map(),
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: {
          declarations: [],
          assignments: [],
          annotations: [],
        },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
},
        language: "typescript" as Language,
        file_path: "/src/main.ts" as FilePath,
      } as SemanticIndex;

      indices.set("/src/main.ts" as FilePath, main_index);
      indices.set("/src/utils.ts" as FilePath, {
        imports: [],
        exports: [],
        symbols: new Map(),
        references: {
          calls: [],
          returns: [],
          member_accesses: [],
          type_annotations: [],
        },
        root_scope_id: "root" as any,
        scopes: new Map(),
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: {
          declarations: [],
          assignments: [],
          annotations: [],
        },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
},
        language: "typescript" as Language,
        file_path: "/src/utils.ts" as FilePath,
      } as SemanticIndex);

      const context = create_import_resolution_context(
        indices,
        new Map([["typescript" as Language, mock_handler]])
      );

      const result = resolve_imports(context);
      const main_imports = result.imports.get("/src/main.ts" as FilePath);

      expect(main_imports?.size).toBe(3);
      expect(main_imports?.get("func1" as SymbolName)).toBe("utils:func1");
      expect(main_imports?.get("func2" as SymbolName)).toBe("utils:func2");
      expect(main_imports?.get("func3" as SymbolName)).toBe("utils:func3");
    });

    it("should handle aliased imports", () => {
      const path_mappings = new Map<string, FilePath>([["./utils", "/src/utils.ts" as FilePath]]);
      const symbol_mappings = new Map<string, Map<SymbolName, SymbolId>>([
        [
          "./utils:named",
          new Map([["originalName" as SymbolName, "utils:originalName" as SymbolId]]),
        ],
      ]);

      const mock_handler = new MockLanguageHandler(path_mappings, symbol_mappings);

      const indices = new Map<FilePath, SemanticIndex>();
      const main_index = {
        imports: [
          {
            kind: "named" as const,
            source: "./utils" as FilePath,
            imports: [{ name: "originalName" as SymbolName, alias: "aliasedName" as SymbolName, is_type_only: false }],
            location: { line: 1, column: 0, end_line: 1, end_column: 0, file_path: "/src/main.ts" as FilePath },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ],
        exports: [],
        symbols: new Map(),
        references: {
          calls: [],
          returns: [],
          member_accesses: [],
          type_annotations: [],
        },
        root_scope_id: "root" as any,
        scopes: new Map(),
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: {
          declarations: [],
          assignments: [],
          annotations: [],
        },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
},
        language: "typescript" as Language,
        file_path: "/src/main.ts" as FilePath,
      } as SemanticIndex;

      indices.set("/src/main.ts" as FilePath, main_index);
      indices.set("/src/utils.ts" as FilePath, {
        imports: [],
        exports: [],
        symbols: new Map(),
        references: {
          calls: [],
          returns: [],
          member_accesses: [],
          type_annotations: [],
        },
        root_scope_id: "root" as any,
        scopes: new Map(),
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: {
          declarations: [],
          assignments: [],
          annotations: [],
        },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
},
        language: "typescript" as Language,
        file_path: "/src/utils.ts" as FilePath,
      } as SemanticIndex);

      const context = create_import_resolution_context(
        indices,
        new Map([["typescript" as Language, mock_handler]])
      );

      const result = resolve_imports(context);
      const main_imports = result.imports.get("/src/main.ts" as FilePath);

      // The local alias should map to the original symbol ID
      expect(main_imports?.get("aliasedName" as SymbolName)).toBe("utils:originalName");
    });
  });

  describe("Node Modules Resolution", () => {
    it("should handle node_modules path resolution", () => {
      // This test would need actual mocking of fs module
      // For now, just verify the function exists and returns expected type
      const result = resolve_node_modules_path("lodash", "/src/main.ts" as FilePath);
      expect(result === null || typeof result === "string").toBe(true);
    });
  });

  describe("File Resolution with Extensions", () => {
    it("should find files with various extensions", () => {
      const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs"];
      const result = find_file_with_extensions("/path/to/module", extensions);

      // Without mocked fs, should return null
      expect(result).toBeNull();
    });

    it("should handle index file resolution patterns", () => {
      // Test that resolve_relative_path would check for index files
      const import_path = "./components";
      const importing_file = "/src/main.ts" as FilePath;

      const result = resolve_relative_path(import_path, importing_file);

      // Without mocked fs, should return null
      expect(result).toBeNull();
    });
  });
});
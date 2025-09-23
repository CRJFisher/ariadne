/**
 * Tests for import resolution module
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  resolve_imports,
} from "./index";
import type {
  ImportResolutionContext,
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
  ScopeId,
} from "@ariadnejs/types";
import { SemanticIndex } from "../../semantic_index/semantic_index";
import * as fs from "fs";
import { resolve_module_path } from "./module_resolver";

// Mock fs
vi.mock("fs");

/**
 * Create a minimal SemanticIndex for testing
 */
function create_test_index(
  file_path: FilePath,
  imports: Import[] = [],
  exports: Export[] = [],
  symbols: ReadonlyMap<SymbolId, SymbolDefinition> = new Map(),
  language: Language = "typescript"
): SemanticIndex {
  return {
    file_path,
    language,
    imports,
    exports,
    symbols,
    scopes: new Map(),
    references: {
      calls: [],
      returns: [],
      member_accesses: [],
      type_annotations: [],
    },
    local_types: [],
    local_type_annotations: [],
    local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] },
    local_type_tracking: { annotations: [], declarations: [], assignments: [] },
    root_scope_id: "root" as ScopeId,
    file_symbols_by_name: new Map(),
  };
}

describe("Import Resolution", () => {
  describe("Core Resolution Algorithm", () => {
    let context: ImportResolutionContext;

    beforeEach(() => {
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
          ["processData_symbol" as SymbolId, {} as SymbolDefinition],
          ["formatDate_symbol" as SymbolId, {} as SymbolDefinition],
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

      // Create context
      context = { indices };
    });

    it("should resolve named imports", () => {
      const result = resolve_imports(context);

      const main_imports = result.imports.get("/src/main.ts" as FilePath);
      expect(main_imports).toBeDefined();
      expect(main_imports?.get("processData" as SymbolName)).toBe("processData_symbol");
      expect(main_imports?.get("formatDate" as SymbolName)).toBe("processData_symbol");
    });

    it("should resolve default imports", () => {
      const result = resolve_imports(context);

      const main_imports = result.imports.get("/src/main.ts" as FilePath);
      expect(main_imports).toBeDefined();
      expect(main_imports?.get("Button" as SymbolName)).toBe("components:Button");
    });

    it("should handle missing source files gracefully", () => {
      // Add an import with missing source
      const main_index = context.indices.get("/src/main.ts" as FilePath)!;
      const updated_index = {
        ...main_index,
        imports: [
          ...main_index.imports,
          {
            kind: "named" as const,
            source: "./missing" as FilePath,
            imports: [{ name: "missing" as SymbolName, is_type_only: false }],
            location: { file_path: "/src/main.ts" as FilePath, line: 3, column: 0, end_line: 3, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ],
      };

      const indices = new Map(context.indices);
      indices.set("/src/main.ts" as FilePath, updated_index);
      const new_context = { indices };

      const result = resolve_imports(new_context);
      const main_imports = result.imports.get("/src/main.ts" as FilePath);

      // Should still resolve other imports
      expect(main_imports?.get("processData" as SymbolName)).toBe("processData_symbol");
      // But not the missing one
      expect(main_imports?.get("missing" as SymbolName)).toBeUndefined();
    });

    it("should skip side-effect imports", () => {
      const indices = new Map<FilePath, SemanticIndex>();
      const index = create_test_index(
        "/src/app.ts" as FilePath,
        [
          {
            kind: "side_effect" as const,
            source: "./polyfills" as FilePath,
            location: { file_path: "/src/app.ts" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ]
      );
      indices.set("/src/app.ts" as FilePath, index);

      const context = { indices };
      const result = resolve_imports(context);

      const app_imports = result.imports.get("/src/app.ts" as FilePath);
      expect(app_imports).toBeUndefined();
    });
  });

  describe("Namespace Import Resolution", () => {
    it("should resolve namespace imports", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // Main file with namespace import
      const main_index = create_test_index(
        "/src/main.ts" as FilePath,
        [
          {
            kind: "namespace" as const,
            source: "lodash" as FilePath,
            namespace_name: "_" as NamespaceName,
            // exports: new Map(), // removed - not part of NamespaceImport type
            location: { file_path: "/src/main.ts" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ]
      );
      indices.set("/src/main.ts" as FilePath, main_index);

      // Lodash with exports
      const lodash_index = create_test_index(
        "lodash" as FilePath,
        [],
        [
          {
            kind: "named" as const,
            symbol: "lodash:debounce" as SymbolId,
            symbol_name: "debounce" as SymbolName,
            exports: [{ local_name: "debounce" as SymbolName, is_type_only: false }],
            location: { file_path: "lodash" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "export_statement",
          },
        ]
      );
      indices.set("lodash" as FilePath, lodash_index);

      const context = { indices };
      const result = resolve_imports(context);

      const main_imports = result.imports.get("/src/main.ts" as FilePath);

      expect(main_imports?.get("_" as SymbolName)).toBe("lodash:debounce");
    });
  });

  describe("Error Handling", () => {
    it("should handle missing language handler gracefully", () => {
      const indices = new Map<FilePath, SemanticIndex>();
      const index = create_test_index(
        "/src/main.ts" as FilePath,
        [
          {
            kind: "named" as const,
            source: "./utils" as FilePath,
            imports: [{ name: "test" as SymbolName, is_type_only: false }],
            location: { file_path: "/src/main.ts" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "unknown" as Language,
            node_type: "import_statement",
          },
        ],
        [],
        new Map(),
        "unknown" as Language
      );
      indices.set("/src/main.ts" as FilePath, index);

      const context = { indices };
      const result = resolve_imports(context);

      // Should handle gracefully without throwing
      expect(result.imports.size).toBe(0);
    });

    it("should handle imports with no matching exports", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      const main_index = create_test_index(
        "/src/main.ts" as FilePath,
        [
          {
            kind: "named" as const,
            source: "./utils" as FilePath,
            imports: [{ name: "nonExistent" as SymbolName, is_type_only: false }],
            location: { file_path: "/src/main.ts" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ]
      );
      indices.set("/src/main.ts" as FilePath, main_index);

      const utils_index = create_test_index("/src/utils.ts" as FilePath, [], []);
      indices.set("/src/utils.ts" as FilePath, utils_index);

      const context = { indices };
      const result = resolve_imports(context);

      const main_imports = result.imports.get("/src/main.ts" as FilePath);
      expect(main_imports?.get("nonExistent" as SymbolName)).toBeUndefined();
    });

    it("should handle circular imports without infinite loops", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // File A imports from B
      const file_a = create_test_index(
        "/src/a.ts" as FilePath,
        [
          {
            kind: "named" as const,
            source: "./b" as FilePath,
            imports: [{ name: "fromB" as SymbolName, is_type_only: false }],
            location: { file_path: "/src/a.ts" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ],
        [
          {
            kind: "named" as const,
            symbol: "a:fromA" as SymbolId,
            symbol_name: "fromA" as SymbolName,
            exports: [{ local_name: "fromA" as SymbolName, is_type_only: false }],
            location: { file_path: "/src/a.ts" as FilePath, line: 2, column: 0, end_line: 2, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "export_statement",
          },
        ]
      );
      indices.set("/src/a.ts" as FilePath, file_a);

      // File B imports from A
      const file_b = create_test_index(
        "/src/b.ts" as FilePath,
        [
          {
            kind: "named" as const,
            source: "./a" as FilePath,
            imports: [{ name: "fromA" as SymbolName, is_type_only: false }],
            location: { file_path: "/src/b.ts" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ],
        [
          {
            kind: "named" as const,
            symbol: "b:fromB" as SymbolId,
            symbol_name: "fromB" as SymbolName,
            exports: [{ local_name: "fromB" as SymbolName, is_type_only: false }],
            location: { file_path: "/src/b.ts" as FilePath, line: 2, column: 0, end_line: 2, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "export_statement",
          },
        ]
      );
      indices.set("/src/b.ts" as FilePath, file_b);

      const context = { indices };

      // Should not throw or enter infinite loop
      const result = resolve_imports(context);
      expect(result).toBeDefined();
    });
  });

  describe("Complex Import Scenarios", () => {
    it("should handle multiple imports from the same source", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      const main_index = create_test_index(
        "/src/main.ts" as FilePath,
        [
          {
            kind: "named" as const,
            source: "./utils" as FilePath,
            imports: [
              { name: "func1" as SymbolName, is_type_only: false },
              { name: "func2" as SymbolName, is_type_only: false },
              { name: "func3" as SymbolName, is_type_only: false },
            ],
            location: { file_path: "/src/main.ts" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ]
      );
      indices.set("/src/main.ts" as FilePath, main_index);

      const utils_index = create_test_index(
        "/src/utils.ts" as FilePath,
        [],
        [
          {
            kind: "named" as const,
            symbol: "utils:func1" as SymbolId,
            symbol_name: "func1" as SymbolName,
            exports: [{ local_name: "func1" as SymbolName, is_type_only: false }],
            location: { file_path: "/src/utils.ts" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "export_statement",
          },
          {
            kind: "named" as const,
            symbol: "utils:func2" as SymbolId,
            symbol_name: "func2" as SymbolName,
            exports: [{ local_name: "func2" as SymbolName, is_type_only: false }],
            location: { file_path: "/src/utils.ts" as FilePath, line: 2, column: 0, end_line: 2, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "export_statement",
          },
          {
            kind: "named" as const,
            symbol: "utils:func3" as SymbolId,
            symbol_name: "func3" as SymbolName,
            exports: [{ local_name: "func3" as SymbolName, is_type_only: false }],
            location: { file_path: "/src/utils.ts" as FilePath, line: 3, column: 0, end_line: 3, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "export_statement",
          },
        ]
      );
      indices.set("/src/utils.ts" as FilePath, utils_index);

      const context = { indices };
      const result = resolve_imports(context);

      const main_imports = result.imports.get("/src/main.ts" as FilePath);

      expect(main_imports?.size).toBe(3);
      expect(main_imports?.get("func1" as SymbolName)).toBe("utils:func1");
      expect(main_imports?.get("func2" as SymbolName)).toBe("utils:func2");
      expect(main_imports?.get("func3" as SymbolName)).toBe("utils:func3");
    });

    it("should handle aliased imports", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      const main_index = create_test_index(
        "/src/main.ts" as FilePath,
        [
          {
            kind: "named" as const,
            source: "./utils" as FilePath,
            imports: [
              { name: "originalName" as SymbolName, alias: "aliasedName" as SymbolName, is_type_only: false },
            ],
            location: { file_path: "/src/main.ts" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "import_statement",
          },
        ]
      );
      indices.set("/src/main.ts" as FilePath, main_index);

      const utils_index = create_test_index(
        "/src/utils.ts" as FilePath,
        [],
        [
          {
            kind: "named" as const,
            symbol: "utils:originalName" as SymbolId,
            symbol_name: "originalName" as SymbolName,
            exports: [{ local_name: "originalName" as SymbolName, is_type_only: false }],
            location: { file_path: "/src/utils.ts" as FilePath, line: 1, column: 0, end_line: 1, end_column: 0 },
            modifiers: [],
            language: "typescript" as Language,
            node_type: "export_statement",
          },
        ]
      );
      indices.set("/src/utils.ts" as FilePath, utils_index);

      const context = { indices };
      const result = resolve_imports(context);

      const main_imports = result.imports.get("/src/main.ts" as FilePath);

      // The local alias should map to the original symbol ID
      expect(main_imports?.get("aliasedName" as SymbolName)).toBe("utils:originalName");
      // The original name should not be in the map
      expect(main_imports?.get("originalName" as SymbolName)).toBeUndefined();
    });
  });

});
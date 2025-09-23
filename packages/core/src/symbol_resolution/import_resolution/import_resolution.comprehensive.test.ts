/**
 * Comprehensive Import Resolution Test Suite
 *
 * Consolidated test coverage for all import resolution functionality:
 * - Core import resolution algorithm
 * - Module path resolution
 * - Language-specific import handling
 * - Cross-language integration scenarios
 * - Edge cases and error handling
 * - Performance characteristics
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resolve_imports,
  create_import_resolution_context,
  resolve_module_path,
} from "./index";
import {
  resolve_js_module_path,
  match_js_import_to_export,
} from "./language_handlers/javascript";
import {
  resolve_python_module_path,
  match_python_import_to_export,
} from "./language_handlers/python";
import {
  resolve_rust_module_path,
  match_rust_import_to_export,
} from "./language_handlers/rust";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Import,
  Export,
  SymbolDefinition,
  Language,
  NamedImport,
  DefaultImport,
  NamespaceImport,
  NamedExport,
  DefaultExport,
  ScopeId,
} from "@ariadnejs/types";
import { SemanticIndex } from "../../semantic_index/semantic_index";
import * as fs from "fs";
import * as path from "path";

// Mock fs module for testing
vi.mock("fs");

// Import actual language handlers - don't mock them for this comprehensive test
// The fs module mocking will control their behavior

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a test location
 */
function create_location(
  file_path: FilePath,
  line: number,
  column: number
): import("@ariadnejs/types").Location {
  return {
    file_path,
    line,
    column,
    end_line: line,
    end_column: column + 10,
  };
}

/**
 * Create a test semantic index with imports and exports
 */
function create_test_index(
  file_path: FilePath,
  language: Language,
  imports: Import[] = [],
  exports: Export[] = [],
  symbols: ReadonlyMap<SymbolId, SymbolDefinition> = new Map()
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
    local_type_tracking: { annotations: [], declarations: [], assignments: [] },
    local_type_flow: {
      constructor_calls: [],
      assignments: [],
      returns: [],
      call_assignments: [],
    },
    root_scope_id: "root" as ScopeId,
    file_symbols_by_name: new Map(),
  };
}

/**
 * Create a named import for testing
 */
function create_named_import(
  name: SymbolName,
  source: FilePath,
  alias?: SymbolName
): NamedImport {
  return {
    kind: "named",
    imports: [
      {
        name,
        alias,
        is_type_only: false,
      },
    ],
    source,
    location: create_location("test.ts" as FilePath, 1, 0),
    modifiers: [],
    language: "typescript",
    node_type: "import_statement",
  };
}

/**
 * Create a default import for testing
 */
function create_default_import(
  name: SymbolName,
  source: FilePath
): DefaultImport {
  return {
    kind: "default",
    name,
    source,
    location: create_location("test.ts" as FilePath, 1, 0),
    modifiers: [],
    language: "typescript",
    node_type: "import_statement",
  };
}

/**
 * Create a named export for testing
 */
function create_named_export(
  local_name: SymbolName,
  export_name?: SymbolName,
  symbol_id?: SymbolId
): NamedExport {
  return {
    kind: "named",
    symbol: symbol_id || (`symbol:${local_name}` as SymbolId),
    symbol_name: local_name,
    location: create_location("test.ts" as FilePath, 1, 0),
    exports: [
      {
        local_name,
        export_name: export_name || local_name,
        is_type_only: false,
      },
    ],
    modifiers: [],
    language: "typescript",
    node_type: "export_statement",
  };
}

/**
 * Create a default export for testing
 */
function create_default_export(
  name: SymbolName,
  symbol_id?: SymbolId
): DefaultExport {
  return {
    kind: "default",
    symbol: symbol_id || (`symbol:${name}` as SymbolId),
    symbol_name: name,
    location: create_location("test.ts" as FilePath, 1, 0),
    is_declaration: false,
    modifiers: [],
    language: "typescript",
    node_type: "export_statement",
  };
}

// ============================================================================
// Core Import Resolution Tests
// ============================================================================

describe("Import Resolution - Comprehensive Suite", () => {
  let mock_fs: typeof fs & {
    existsSync: ReturnType<typeof vi.fn>;
    statSync: ReturnType<typeof vi.fn>;
    readFileSync: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mock_fs = vi.mocked(fs);
  });

  describe("Core Resolution Algorithm", () => {
    it("resolves simple named imports correctly", () => {
      // Create source file with exports
      const source_index = create_test_index(
        "src/utils.ts" as FilePath,
        "typescript",
        [],
        [
          create_named_export(
            "add" as SymbolName,
            "add" as SymbolName,
            "fn:add" as SymbolId
          ),
        ]
      );

      // Create importing file
      const main_index = create_test_index(
        "src/main.ts" as FilePath,
        "typescript",
        [create_named_import("add" as SymbolName, "./utils" as FilePath)]
      );

      const indices = new Map([
        [source_index.file_path, source_index],
        [main_index.file_path, main_index],
      ]);

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      expect(result.size).toBe(1);
      expect(result.has(main_index.file_path)).toBe(true);
      const imports = result.get(main_index.file_path)!;
      expect(imports.has("add" as SymbolName)).toBe(true);
      expect(imports.get("add" as SymbolName)).toBe("fn:add" as SymbolId);
    });

    it("resolves default imports correctly", () => {
      const source_index = create_test_index(
        "src/component.tsx" as FilePath,
        "typescript",
        [],
        [
          create_default_export(
            "Component" as SymbolName,
            "class:Component" as SymbolId
          ),
        ]
      );

      const main_index = create_test_index(
        "src/app.tsx" as FilePath,
        "typescript",
        [
          create_default_import(
            "Component" as SymbolName,
            "./component" as FilePath
          ),
        ]
      );

      const indices = new Map([
        [source_index.file_path, source_index],
        [main_index.file_path, main_index],
      ]);

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      expect(result.size).toBe(1);
      const imports = result.get(main_index.file_path)!;
      expect(imports.has("Component" as SymbolName)).toBe(true);
      expect(imports.get("Component" as SymbolName)).toBe(
        "class:Component" as SymbolId
      );
    });

    it("handles imports with aliases", () => {
      const source_index = create_test_index(
        "src/utils.ts" as FilePath,
        "typescript",
        [],
        [create_named_export("longFunctionName" as SymbolName)]
      );

      const main_index = create_test_index(
        "src/main.ts" as FilePath,
        "typescript",
        [
          create_named_import(
            "longFunctionName" as SymbolName,
            "./utils" as FilePath,
            "fn" as SymbolName
          ),
        ]
      );

      const indices = new Map([
        [source_index.file_path, source_index],
        [main_index.file_path, main_index],
      ]);

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      const imports = result.get(main_index.file_path)!;
      expect(imports.has("fn" as SymbolName)).toBe(true);
    });

    it("skips side-effect imports", () => {
      const side_effect_import: Import = {
        kind: "side_effect",
        source: "src/polyfill.ts" as FilePath,
        location: create_location("src/main.ts" as FilePath, 1, 0),
        modifiers: [],
        language: "typescript",
        node_type: "import_statement",
      };

      const main_index = create_test_index(
        "src/main.ts" as FilePath,
        "typescript",
        [side_effect_import]
      );

      const indices = new Map([[main_index.file_path, main_index]]);
      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      expect(result.size).toBe(0);
    });

    it("handles missing source files gracefully", () => {
      const main_index = create_test_index(
        "src/main.ts" as FilePath,
        "typescript",
        [
          create_named_import(
            "missing" as SymbolName,
            "./nonexistent" as FilePath
          ),
        ]
      );

      const indices = new Map([[main_index.file_path, main_index]]);
      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      expect(result.imports.size).toBe(0);
    });

    it("handles imports with missing source field", () => {
      const malformed_import: Import = {
        kind: "named",
        imports: [{ name: "test" as SymbolName, is_type_only: false }],
        source: undefined,
        location: create_location("src/main.ts" as FilePath, 1, 0),
        modifiers: [],
        language: "typescript",
        node_type: "import_statement",
      };

      const main_index = create_test_index(
        "src/main.ts" as FilePath,
        "typescript",
        [malformed_import]
      );

      const indices = new Map([[main_index.file_path, main_index]]);
      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      expect(result.imports.size).toBe(0);
    });
  });

  // ============================================================================
  // Module Path Resolution Tests
  // ============================================================================

  describe("Module Path Resolution", () => {
    it("resolves relative paths correctly", () => {
      mock_fs.existsSync.mockImplementation((p: any) => {
        return p === "/project/src/utils.ts";
      });

      const context = create_import_resolution_context(new Map());
      const result = resolve_module_path(
        "./utils",
        "/project/src/main.ts" as FilePath,
        "typescript",
        context
      );

      expect(result).toBe("/project/src/utils.ts");
    });

    it("tries multiple file extensions", () => {
      mock_fs.existsSync.mockImplementation((p: any) => {
        return p === "/project/src/utils.js";
      });

      const context = create_import_resolution_context(new Map());
      const result = resolve_module_path(
        "./utils",
        "/project/src/main.ts" as FilePath,
        "typescript",
        context
      );

      expect(result).toBe("/project/src/utils.js");
    });

    it("handles parent directory imports", () => {
      mock_fs.existsSync.mockImplementation((p: any) => {
        return p === "/project/shared/types.ts";
      });

      const context = create_import_resolution_context(new Map());
      const result = resolve_module_path(
        "../shared/types",
        "/project/src/main.ts" as FilePath,
        "typescript",
        context
      );

      expect(result).toBe("/project/shared/types.ts");
    });
  });

  // ============================================================================
  // Language-Specific Handler Tests
  // ============================================================================

  describe("JavaScript/TypeScript Handler", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("Path Resolution", () => {
      it("resolves .js files", () => {
        mock_fs.existsSync.mockImplementation((p: any) => {
          return p === "/project/src/utils.js";
        });
        mock_fs.statSync.mockReturnValue({
          isFile: () => true,
          isDirectory: () => false,
        });

        const result = resolve_js_module_path(
          "./utils",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/src/utils.js");
      });

      it("resolves .ts files", () => {
        mock_fs.existsSync.mockImplementation((p: any) => {
          return p === "/project/src/utils.ts";
        });

        const result = resolve_js_module_path(
          "./utils",
          "/project/src/main.ts" as FilePath
        );

        expect(result).toBe("/project/src/utils.ts");
      });

      it("handles index files", () => {
        mock_fs.existsSync.mockImplementation((p: any) => {
          return (
            p === "/project/src/components" ||
            p === "/project/src/components/index.ts"
          );
        });
        mock_fs.statSync.mockReturnValue({
          isFile: () => false,
          isDirectory: () => true,
        });

        const result = resolve_js_module_path(
          "./components",
          "/project/src/main.ts" as FilePath
        );

        expect(result).toBe("/project/src/components/index.ts");
      });
    });

    describe("Import Matching", () => {
      it("matches named imports to named exports", () => {
        const import_stmt = create_named_import(
          "add" as SymbolName,
          "utils.js" as FilePath
        );
        const exports = [
          create_named_export(
            "add" as SymbolName,
            "add" as SymbolName,
            "fn:add" as SymbolId
          ),
        ];
        const symbols = new Map();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(1);
        expect(result.has("add" as SymbolName)).toBe(true);
        expect(result.get("add" as SymbolName)).toBe("fn:add" as SymbolId);
      });

      it("matches default imports to default exports", () => {
        const import_stmt = create_default_import(
          "Component" as SymbolName,
          "component.js" as FilePath
        );
        const exports = [
          create_default_export(
            "Component" as SymbolName,
            "class:Component" as SymbolId
          ),
        ];
        const symbols = new Map();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(1);
        expect(result.has("Component" as SymbolName)).toBe(true);
        expect(result.get("Component" as SymbolName)).toBe(
          "class:Component" as SymbolId
        );
      });

      it("handles export aliases", () => {
        const import_stmt = create_named_import(
          "exported" as SymbolName,
          "utils.js" as FilePath
        );
        const exports = [
          create_named_export(
            "internal" as SymbolName,
            "exported" as SymbolName,
            "fn:internal" as SymbolId
          ),
        ];
        const symbols = new Map();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(1);
        expect(result.has("exported" as SymbolName)).toBe(true);
        expect(result.get("exported" as SymbolName)).toBe(
          "fn:internal" as SymbolId
        );
      });
    });
  });

  describe("Python Handler", () => {
    describe("Path Resolution", () => {
      it("resolves .py files", () => {
        mock_fs.existsSync.mockReturnValue(true);

        const result = resolve_python_module_path(
          ".utils",
          "/project/src/main.py" as FilePath
        );

        expect(result).toBe("/project/src/utils.py");
      });

      it("handles __init__.py files", () => {
        mock_fs.existsSync.mockImplementation((p: any) => {
          return p === "/project/src/models/__init__.py";
        });
        mock_fs.statSync.mockReturnValue({
          isFile: () => false,
          isDirectory: () => true,
        });

        const result = resolve_python_module_path(
          ".models",
          "/project/src/main.py" as FilePath
        );

        expect(result).toBe("/project/src/models/__init__.py");
      });
    });

    describe("Import Matching", () => {
      it("matches from imports", () => {
        const import_stmt = create_named_import(
          "calculate" as SymbolName,
          "math.py" as FilePath
        );
        const exports = [create_named_export("calculate" as SymbolName)];
        const symbols = new Map();

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.has("calculate" as SymbolName)).toBe(true);
      });
    });
  });

  describe("Rust Handler", () => {
    describe("Path Resolution", () => {
      it("resolves .rs files", () => {
        mock_fs.existsSync.mockReturnValue(true);

        const result = resolve_rust_module_path(
          "utils",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils.rs");
      });

      it("handles mod.rs files", () => {
        mock_fs.existsSync.mockImplementation((p: any) => {
          return p === "/project/src/models/mod.rs";
        });
        mock_fs.statSync.mockReturnValue({
          isFile: () => false,
          isDirectory: () => true,
        });

        const result = resolve_rust_module_path(
          "models",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/models/mod.rs");
      });
    });

    describe("Import Matching", () => {
      it("matches use statements", () => {
        const import_stmt = create_named_import(
          "HashMap" as SymbolName,
          "collections.rs" as FilePath
        );
        const exports = [create_named_export("HashMap" as SymbolName)];
        const symbols = new Map();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.has("HashMap" as SymbolName)).toBe(true);
      });
    });
  });

  // ============================================================================
  // Cross-Language Integration Tests
  // ============================================================================

  describe("Cross-Language Integration", () => {
    it("handles JavaScript importing TypeScript", () => {
      const ts_index = create_test_index(
        "src/types.ts" as FilePath,
        "typescript",
        [],
        [create_named_export("ApiResponse" as SymbolName)]
      );

      const js_index = create_test_index(
        "src/api.js" as FilePath,
        "javascript",
        [
          create_named_import(
            "ApiResponse" as SymbolName,
            "./types" as FilePath
          ),
        ]
      );

      const indices = new Map([
        [ts_index.file_path, ts_index],
        [js_index.file_path, js_index],
      ]);

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      expect(result.imports.size).toBe(1);
      expect(result.imports.has(js_index.file_path)).toBe(true);
    });

    it("handles TypeScript importing JavaScript", () => {
      const js_index = create_test_index(
        "src/legacy.js" as FilePath,
        "javascript",
        [],
        [create_default_export("LegacyModule" as SymbolName)]
      );

      const ts_index = create_test_index(
        "src/modern.ts" as FilePath,
        "typescript",
        [
          create_default_import(
            "LegacyModule" as SymbolName,
            "./legacy" as FilePath
          ),
        ]
      );

      const indices = new Map([
        [js_index.file_path, js_index],
        [ts_index.file_path, ts_index],
      ]);

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      expect(result.imports.size).toBe(1);
      expect(result.imports.has(ts_index.file_path)).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe("Edge Cases and Error Handling", () => {
    it("handles circular imports gracefully", () => {
      const file_a = create_test_index(
        "src/a.ts" as FilePath,
        "typescript",
        [create_named_import("B" as SymbolName, "./b" as FilePath)],
        [create_named_export("A" as SymbolName)]
      );

      const file_b = create_test_index(
        "src/b.ts" as FilePath,
        "typescript",
        [create_named_import("A" as SymbolName, "./a" as FilePath)],
        [create_named_export("B" as SymbolName)]
      );

      const indices = new Map([
        [file_a.file_path, file_a],
        [file_b.file_path, file_b],
      ]);

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      // Should resolve both imports despite circular dependency
      expect(result.imports.size).toBe(2);
    });

    it("handles export name mismatches", () => {
      const source_index = create_test_index(
        "src/utils.ts" as FilePath,
        "typescript",
        [],
        [create_named_export("actualFunction" as SymbolName)]
      );

      const main_index = create_test_index(
        "src/main.ts" as FilePath,
        "typescript",
        [
          create_named_import(
            "nonExistentFunction" as SymbolName,
            "./utils" as FilePath
          ),
        ]
      );

      const indices = new Map([
        [source_index.file_path, source_index],
        [main_index.file_path, main_index],
      ]);

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      // Import should not resolve due to name mismatch
      expect(result.imports.size).toBe(0);
    });

    it("handles files with no exports", () => {
      const source_index = create_test_index(
        "src/empty.ts" as FilePath,
        "typescript",
        [],
        [] // No exports
      );

      const main_index = create_test_index(
        "src/main.ts" as FilePath,
        "typescript",
        [create_named_import("something" as SymbolName, "./empty" as FilePath)]
      );

      const indices = new Map([
        [source_index.file_path, source_index],
        [main_index.file_path, main_index],
      ]);

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      expect(result.imports.size).toBe(0);
    });

    it("handles files with many exports", () => {
      const exports = Array.from({ length: 100 }, (_, i) =>
        create_named_export(`func${i}` as SymbolName)
      );

      const source_index = create_test_index(
        "src/utils.ts" as FilePath,
        "typescript",
        [],
        exports
      );

      const imports = Array.from({ length: 50 }, (_, i) =>
        create_named_import(`func${i}` as SymbolName, "./utils" as FilePath)
      );

      const main_index = create_test_index(
        "src/main.ts" as FilePath,
        "typescript",
        imports
      );

      const indices = new Map([
        [source_index.file_path, source_index],
        [main_index.file_path, main_index],
      ]);

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      expect(result.imports.size).toBe(1);
      const resolved_imports = result.imports.get(main_index.file_path)!;
      expect(resolved_imports.size).toBe(50); // All 50 imports should resolve
    });
  });

  // ============================================================================
  // Performance and Scalability Tests
  // ============================================================================

  describe("Performance and Scalability", () => {
    it("handles large projects efficiently", () => {
      const start_time = performance.now();

      // Create 100 files with interconnected imports
      const indices = new Map<FilePath, SemanticIndex>();

      for (let i = 0; i < 100; i++) {
        const file_path = `src/file${i}.ts` as FilePath;
        const imports =
          i > 0
            ? [
                create_named_import(
                  `func${i - 1}` as SymbolName,
                  `./file${i - 1}` as FilePath
                ),
              ]
            : [];
        const exports = [create_named_export(`func${i}` as SymbolName)];

        indices.set(
          file_path,
          create_test_index(file_path, "typescript", imports, exports)
        );
      }

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      const end_time = performance.now();
      const duration = end_time - start_time;

      // Should complete within reasonable time (under 100ms)
      expect(duration).toBeLessThan(100);

      // Should resolve 99 import relationships (files 1-99 import from previous file)
      expect(result.imports.size).toBe(99);
    });

    it("handles deep import chains", () => {
      const chain_length = 20;
      const indices = new Map<FilePath, SemanticIndex>();

      // Create a chain: file0 exports -> file1 imports and re-exports -> file2 imports and re-exports -> ...
      for (let i = 0; i < chain_length; i++) {
        const file_path = `src/chain${i}.ts` as FilePath;
        const imports =
          i > 0
            ? [
                create_named_import(
                  "chainedFunction" as SymbolName,
                  `./chain${i - 1}` as FilePath
                ),
              ]
            : [];
        const exports = [create_named_export("chainedFunction" as SymbolName)];

        indices.set(
          file_path,
          create_test_index(file_path, "typescript", imports, exports)
        );
      }

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      // Should resolve all chain links
      expect(result.imports.size).toBe(chain_length - 1);
    });

    it("handles wide import fan-out", () => {
      // One file imports from 50 different files
      const fan_out = 50;
      const indices = new Map<FilePath, SemanticIndex>();

      // Create 50 source files
      for (let i = 0; i < fan_out; i++) {
        const file_path = `src/module${i}.ts` as FilePath;
        const exports = [create_named_export(`func${i}` as SymbolName)];
        indices.set(
          file_path,
          create_test_index(file_path, "typescript", [], exports)
        );
      }

      // Create main file that imports from all 50 files
      const imports = Array.from({ length: fan_out }, (_, i) =>
        create_named_import(
          `func${i}` as SymbolName,
          `./module${i}` as FilePath
        )
      );

      const main_file = create_test_index(
        "src/main.ts" as FilePath,
        "typescript",
        imports
      );
      indices.set(main_file.file_path, main_file);

      const context = create_import_resolution_context(indices);
      const result = resolve_imports(context);

      expect(result.imports.size).toBe(1);
      const resolved_imports = result.imports.get(main_file.file_path)!;
      expect(resolved_imports.size).toBe(fan_out);
    });
  });
});

/**
 * Integration tests for language handlers with core import resolution
 *
 * Tests the complete import resolution pipeline with real language handlers
 * and multiple file scenarios.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolve_imports, create_import_resolution_context } from "../index";
import { create_standard_language_handlers } from "./index";
import { SemanticIndex } from "../../../semantic_index/semantic_index";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Import,
  Export,
  SymbolDefinition,
  NamedImport,
  DefaultImport,
  NamespaceImport,
  NamedExport,
  DefaultExport,
} from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";

// Mock fs module
vi.mock("fs");

/**
 * Helper to create a semantic index with imports and exports
 */
function create_test_index(
  file: FilePath,
  language: "javascript" | "typescript" | "python" | "rust",
  imports: Import[] = [],
  exports: Export[] = [],
  symbols: Map<SymbolId, SymbolDefinition> = new Map()
): SemanticIndex {
  return {
    file_path: file,
    language,
    imports,
    exports,
    symbols,
    scopes: [],
    references: {
      call_references: [],
      member_access_references: [],
      variable_references: [],
      type_references: [],
      return_statements: [],
      type_annotation_references: [],
      type_tracking: [],
    },
  } as SemanticIndex;
}

describe("Language Handler Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Cross-Language Import Resolution", () => {
    it("resolves TypeScript imports from JavaScript files", () => {
      const mockExists = vi.mocked(fs.existsSync);
      const mockReadFile = vi.mocked(fs.readFileSync);

      // Mock file system
      mockExists.mockImplementation((p) => {
        return p === "/project/src/utils.js" ||
               p === "/project/src/main.ts";
      });

      // Create indices
      const indices = new Map<FilePath, SemanticIndex>();

      // JavaScript file with exports
      const jsExports: Export[] = [{
        kind: "named",
        symbol: "utils#helper" as SymbolId,
        symbol_name: "helper" as SymbolName,
        exports: [{ local_name: "helper" as SymbolName, is_type_only: false }],
        location: { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
      } as NamedExport];

      indices.set(
        "/project/src/utils.js" as FilePath,
        create_test_index(
          "/project/src/utils.js" as FilePath,
          "javascript",
          [],
          jsExports
        )
      );

      // TypeScript file importing from JavaScript
      const tsImports: Import[] = [{
        kind: "named",
        imports: [{ name: "helper" as SymbolName, is_type_only: false }],
        source: "./utils" as FilePath,
        location: { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
      } as NamedImport];

      indices.set(
        "/project/src/main.ts" as FilePath,
        create_test_index(
          "/project/src/main.ts" as FilePath,
          "typescript",
          tsImports,
          []
        )
      );

      // Create context with standard handlers
      const handlers = create_standard_language_handlers();
      const context = create_import_resolution_context(indices, handlers);

      // Resolve imports
      const result = resolve_imports(context);

      // Should resolve the TypeScript import to the JavaScript export
      const mainImports = result.imports.get("/project/src/main.ts" as FilePath);
      expect(mainImports).toBeDefined();
      expect(mainImports?.get("helper" as SymbolName)).toBe("utils#helper");
    });

    it("handles mixed language projects with shared modules", () => {
      const mockExists = vi.mocked(fs.existsSync);
      const mockStats = vi.mocked(fs.statSync);

      // Mock a mixed-language project structure
      mockExists.mockImplementation((p) => {
        const validPaths = [
          "/project/shared/types.ts",
          "/project/python/analyzer.py",
          "/project/rust/src/lib.rs",
          "/project/js/app.js"
        ];
        return validPaths.includes(p as string);
      });

      const indices = new Map<FilePath, SemanticIndex>();

      // TypeScript types module
      indices.set(
        "/project/shared/types.ts" as FilePath,
        create_test_index(
          "/project/shared/types.ts" as FilePath,
          "typescript",
          [],
          [{
            kind: "named",
            symbol: "types#Config" as SymbolId,
            symbol_name: "Config" as SymbolName,
            exports: [{ local_name: "Config" as SymbolName, is_type_only: true }],
            location: { start: { line: 1, column: 0 }, end: { line: 5, column: 1 } },
          } as NamedExport]
        )
      );

      // JavaScript app importing TypeScript types
      indices.set(
        "/project/js/app.js" as FilePath,
        create_test_index(
          "/project/js/app.js" as FilePath,
          "javascript",
          [{
            kind: "named",
            imports: [{ name: "Config" as SymbolName, is_type_only: true }],
            source: "../shared/types" as FilePath,
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 40 } },
          } as NamedImport],
          []
        )
      );

      const handlers = create_standard_language_handlers();
      const context = create_import_resolution_context(indices, handlers);
      const result = resolve_imports(context);

      const jsImports = result.imports.get("/project/js/app.js" as FilePath);
      expect(jsImports?.get("Config" as SymbolName)).toBe("types#Config");
    });
  });

  describe("Complex Import Scenarios", () => {
    it("resolves re-exports through multiple files", () => {
      const mockExists = vi.mocked(fs.existsSync);

      mockExists.mockImplementation((p) => {
        return [
          "/project/src/core.js",
          "/project/src/middleware.js",
          "/project/src/index.js",
          "/project/src/app.js"
        ].includes(p as string);
      });

      const indices = new Map<FilePath, SemanticIndex>();

      // Core module with original export
      indices.set(
        "/project/src/core.js" as FilePath,
        create_test_index(
          "/project/src/core.js" as FilePath,
          "javascript",
          [],
          [{
            kind: "named",
            symbol: "core#process" as SymbolId,
            symbol_name: "process" as SymbolName,
            exports: [{ local_name: "process" as SymbolName, is_type_only: false }],
            location: { start: { line: 1, column: 0 }, end: { line: 10, column: 1 } },
          } as NamedExport]
        )
      );

      // Middleware re-exports from core
      indices.set(
        "/project/src/middleware.js" as FilePath,
        create_test_index(
          "/project/src/middleware.js" as FilePath,
          "javascript",
          [{
            kind: "named",
            imports: [{ name: "process" as SymbolName, is_type_only: false }],
            source: "./core" as FilePath,
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
          } as NamedImport],
          [{
            kind: "named",
            symbol: "middleware#process" as SymbolId,
            symbol_name: "process" as SymbolName,
            exports: [{ local_name: "process" as SymbolName, is_type_only: false }],
            location: { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
          } as NamedExport]
        )
      );

      // Index barrel export
      indices.set(
        "/project/src/index.js" as FilePath,
        create_test_index(
          "/project/src/index.js" as FilePath,
          "javascript",
          [],
          [{
            kind: "namespace",
            symbol: "index#all" as SymbolId,
            symbol_name: "*" as SymbolName,
            source: "./middleware" as FilePath,
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
          } as any] // Using namespace export
        )
      );

      const handlers = create_standard_language_handlers();
      const context = create_import_resolution_context(indices, handlers);
      const result = resolve_imports(context);

      // Check middleware resolved the import from core
      const middlewareImports = result.imports.get("/project/src/middleware.js" as FilePath);
      expect(middlewareImports?.get("process" as SymbolName)).toBe("core#process");
    });

    it("handles circular imports gracefully", () => {
      const mockExists = vi.mocked(fs.existsSync);

      mockExists.mockImplementation((p) => {
        return ["/project/a.js", "/project/b.js"].includes(p as string);
      });

      const indices = new Map<FilePath, SemanticIndex>();

      // File A imports from B
      indices.set(
        "/project/a.js" as FilePath,
        create_test_index(
          "/project/a.js" as FilePath,
          "javascript",
          [{
            kind: "named",
            imports: [{ name: "funcB" as SymbolName, is_type_only: false }],
            source: "./b" as FilePath,
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
          } as NamedImport],
          [{
            kind: "named",
            symbol: "a#funcA" as SymbolId,
            symbol_name: "funcA" as SymbolName,
            exports: [{ local_name: "funcA" as SymbolName, is_type_only: false }],
            location: { start: { line: 2, column: 0 }, end: { line: 5, column: 1 } },
          } as NamedExport]
        )
      );

      // File B imports from A (circular)
      indices.set(
        "/project/b.js" as FilePath,
        create_test_index(
          "/project/b.js" as FilePath,
          "javascript",
          [{
            kind: "named",
            imports: [{ name: "funcA" as SymbolName, is_type_only: false }],
            source: "./a" as FilePath,
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
          } as NamedImport],
          [{
            kind: "named",
            symbol: "b#funcB" as SymbolId,
            symbol_name: "funcB" as SymbolName,
            exports: [{ local_name: "funcB" as SymbolName, is_type_only: false }],
            location: { start: { line: 2, column: 0 }, end: { line: 5, column: 1 } },
          } as NamedExport]
        )
      );

      const handlers = create_standard_language_handlers();
      const context = create_import_resolution_context(indices, handlers);

      // Should not throw or infinite loop
      const result = resolve_imports(context);

      // Both imports should be resolved
      const a_imports = result.imports.get("/project/a.js" as FilePath);
      const b_imports = result.imports.get("/project/b.js" as FilePath);

      expect(a_imports?.get("funcB" as SymbolName)).toBe("b#funcB");
      expect(b_imports?.get("funcA" as SymbolName)).toBe("a#funcA");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("handles missing files gracefully", () => {
      const mockExists = vi.mocked(fs.existsSync);
      mockExists.mockReturnValue(false);

      const indices = new Map<FilePath, SemanticIndex>();

      // Import from non-existent file
      indices.set(
        "/project/main.js" as FilePath,
        create_test_index(
          "/project/main.js" as FilePath,
          "javascript",
          [{
            kind: "named",
            imports: [{ name: "missing" as SymbolName, is_type_only: false }],
            source: "./does-not-exist" as FilePath,
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 40 } },
          } as NamedImport],
          []
        )
      );

      const handlers = create_standard_language_handlers();
      const context = create_import_resolution_context(indices, handlers);
      const result = resolve_imports(context);

      // Should have empty or no imports for the file
      const mainImports = result.imports.get("/project/main.js" as FilePath);
      expect(mainImports?.size ?? 0).toBe(0);
    });

    it("handles imports from external packages", () => {
      const mockExists = vi.mocked(fs.existsSync);
      const mockReadFile = vi.mocked(fs.readFileSync);

      // Mock node_modules structure
      mockExists.mockImplementation((p) => {
        if (p === "/project/node_modules/lodash") return true;
        if (p === "/project/node_modules/lodash/package.json") return true;
        if (p === "/project/node_modules/lodash/index.js") return true;
        if (p === "/project/main.js") return true;
        return false;
      });

      mockReadFile.mockImplementation((p) => {
        if (p === "/project/node_modules/lodash/package.json") {
          return JSON.stringify({ main: "index.js" });
        }
        return "";
      });

      const indices = new Map<FilePath, SemanticIndex>();

      // External package with exports
      indices.set(
        "/project/node_modules/lodash/index.js" as FilePath,
        create_test_index(
          "/project/node_modules/lodash/index.js" as FilePath,
          "javascript",
          [],
          [{
            kind: "named",
            symbol: "lodash#debounce" as SymbolId,
            symbol_name: "debounce" as SymbolName,
            exports: [{ local_name: "debounce" as SymbolName, is_type_only: false }],
            location: { start: { line: 1, column: 0 }, end: { line: 10, column: 1 } },
          } as NamedExport]
        )
      );

      // Main file importing from package
      indices.set(
        "/project/main.js" as FilePath,
        create_test_index(
          "/project/main.js" as FilePath,
          "javascript",
          [{
            kind: "named",
            imports: [{ name: "debounce" as SymbolName, is_type_only: false }],
            source: "lodash" as FilePath,
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
          } as NamedImport],
          []
        )
      );

      const handlers = create_standard_language_handlers();
      const context = create_import_resolution_context(indices, handlers);
      const result = resolve_imports(context);

      const mainImports = result.imports.get("/project/main.js" as FilePath);
      expect(mainImports?.get("debounce" as SymbolName)).toBe("lodash#debounce");
    });

    it("handles dynamic imports", () => {
      const mockExists = vi.mocked(fs.existsSync);
      mockExists.mockImplementation((p) => {
        return ["/project/main.js", "/project/lazy.js"].includes(p as string);
      });

      const indices = new Map<FilePath, SemanticIndex>();

      // Lazy-loaded module
      indices.set(
        "/project/lazy.js" as FilePath,
        create_test_index(
          "/project/lazy.js" as FilePath,
          "javascript",
          [],
          [{
            kind: "default",
            symbol: "lazy#default" as SymbolId,
            symbol_name: "default" as SymbolName,
            is_declaration: true,
            location: { start: { line: 1, column: 0 }, end: { line: 5, column: 1 } },
          } as DefaultExport]
        )
      );

      // Main file with dynamic import
      const mainImports: Import[] = [{
        kind: "default",
        name: "LazyModule" as SymbolName,
        source: "./lazy" as FilePath,
        is_dynamic: true,
        location: { start: { line: 3, column: 0 }, end: { line: 3, column: 40 } },
      } as DefaultImport & { is_dynamic: boolean }];

      indices.set(
        "/project/main.js" as FilePath,
        create_test_index(
          "/project/main.js" as FilePath,
          "javascript",
          mainImports,
          []
        )
      );

      const handlers = create_standard_language_handlers();
      const context = create_import_resolution_context(indices, handlers);
      const result = resolve_imports(context);

      // Dynamic imports should still be resolved
      const mainImportMap = result.imports.get("/project/main.js" as FilePath);
      expect(mainImportMap?.get("LazyModule" as SymbolName)).toBe("lazy#default");
    });
  });

  describe("Performance Tests", () => {
    it("handles large number of files efficiently", () => {
      const mockExists = vi.mocked(fs.existsSync);
      const mockStats = vi.mocked(fs.statSync);

      // Mock file existence for all files
      mockExists.mockImplementation((p) => {
        const path = p.toString();
        // Check if it's one of our generated files
        for (let i = 0; i < 100; i++) {
          if (path === `/project/file${i}.js`) return true;
        }
        return false;
      });

      mockStats.mockReturnValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      const indices = new Map<FilePath, SemanticIndex>();

      // Create 100 files with imports
      const FILE_COUNT = 100;
      const start = performance.now();

      for (let i = 0; i < FILE_COUNT; i++) {
        const filePath = `/project/file${i}.js` as FilePath;

        // Each file imports from the next file (except last)
        const imports: Import[] = i < FILE_COUNT - 1 ? [{
          kind: "named",
          imports: [{ name: `func${i + 1}` as SymbolName, is_type_only: false }],
          source: `./file${i + 1}` as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
        } as NamedImport] : [];

        // Each file exports a function
        const exports: Export[] = [{
          kind: "named",
          symbol: `file${i}#func${i}` as SymbolId,
          symbol_name: `func${i}` as SymbolName,
          exports: [{ local_name: `func${i}` as SymbolName, is_type_only: false }],
          location: { start: { line: 2, column: 0 }, end: { line: 5, column: 1 } },
        } as NamedExport];

        indices.set(
          filePath,
          create_test_index(filePath, "javascript", imports, exports)
        );
      }

      const handlers = create_standard_language_handlers();
      const context = create_import_resolution_context(indices, handlers);
      const result = resolve_imports(context);

      const duration = performance.now() - start;

      // Should complete in reasonable time (< 1 second for 100 files)
      expect(duration).toBeLessThan(1000);

      // Verify imports are resolved
      for (let i = 0; i < FILE_COUNT - 1; i++) {
        const fileImports = result.imports.get(`/project/file${i}.js` as FilePath);
        expect(fileImports?.get(`func${i + 1}` as SymbolName))
          .toBe(`file${i + 1}#func${i + 1}`);
      }
    });

    it("handles deeply nested import chains", () => {
      const mockExists = vi.mocked(fs.existsSync);
      const mockStats = vi.mocked(fs.statSync);

      // Mock file existence for all letters A-T
      mockExists.mockImplementation((p) => {
        const path = p.toString();
        // Check if it matches our letter pattern
        if (path.match(/^\/project\/[A-T]\.js$/)) {
          return true;
        }
        return false;
      });

      mockStats.mockReturnValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      const indices = new Map<FilePath, SemanticIndex>();
      const DEPTH = 20;

      // Create a chain of imports A -> B -> C -> ... -> T
      for (let i = 0; i < DEPTH; i++) {
        const fileName = String.fromCharCode(65 + i); // A, B, C, ...
        const nextFileName = String.fromCharCode(66 + i); // B, C, D, ...
        const filePath = `/project/${fileName}.js` as FilePath;

        const imports: Import[] = i < DEPTH - 1 ? [{
          kind: "named",
          imports: [{ name: `func${nextFileName}` as SymbolName, is_type_only: false }],
          source: `./${nextFileName}` as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
        } as NamedImport] : [];

        const exports: Export[] = [{
          kind: "named",
          symbol: `${fileName}#func${fileName}` as SymbolId,
          symbol_name: `func${fileName}` as SymbolName,
          exports: [{ local_name: `func${fileName}` as SymbolName, is_type_only: false }],
          location: { start: { line: 2, column: 0 }, end: { line: 5, column: 1 } },
        } as NamedExport];

        indices.set(filePath, create_test_index(filePath, "javascript", imports, exports));
      }

      const handlers = create_standard_language_handlers();
      const context = create_import_resolution_context(indices, handlers);
      const result = resolve_imports(context);

      // Verify the chain is resolved correctly
      for (let i = 0; i < DEPTH - 1; i++) {
        const fileName = String.fromCharCode(65 + i);
        const nextFileName = String.fromCharCode(66 + i);
        const fileImports = result.imports.get(`/project/${fileName}.js` as FilePath);
        expect(fileImports?.get(`func${nextFileName}` as SymbolName))
          .toBe(`${nextFileName}#func${nextFileName}`);
      }
    });
  });
});
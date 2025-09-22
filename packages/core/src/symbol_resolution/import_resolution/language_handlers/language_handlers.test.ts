/**
 * Tests for language-specific import handlers
 *
 * Validates that each language handler correctly resolves
 * module paths and matches imports to exports.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolve_js_module_path, match_js_import_to_export } from "./javascript";
import { resolve_python_module_path, match_python_import_to_export } from "./python";
import { resolve_rust_module_path, match_rust_import_to_export } from "./rust";
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

// Mock fs module
vi.mock("fs");

describe("Language Import Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("JavaScript Handler", () => {
    describe("module path resolution", () => {
      it("resolves relative imports", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/src/utils.js";
        });

        const result = resolve_js_module_path(
          "./utils",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/src/utils.js");
      });

      it("resolves relative imports with parent directory", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/utils.ts";
        });

        const result = resolve_js_module_path(
          "../utils",
          "/project/src/main.ts" as FilePath
        );

        expect(result).toBe("/project/utils.ts");
      });

      it("resolves index files in directories", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_stats = vi.mocked(fs.statSync);

        mock_exists.mockImplementation((p) => {
          return p === "/project/src/components" ||
                 p === "/project/src/components/index.ts";
        });
        mock_stats.mockReturnValue({ isDirectory: () => true } as any);

        const result = resolve_js_module_path(
          "./components",
          "/project/src/main.ts" as FilePath
        );

        expect(result).toBe("/project/src/components/index.ts");
      });

      it("returns null for Node.js built-in modules", () => {
        const result = resolve_js_module_path(
          "fs",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBeNull();
      });

      it("returns null for node: prefixed modules", () => {
        const result = resolve_js_module_path(
          "node:path",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBeNull();
      });
    });

    describe("import to export matching", () => {
      it("matches default import to default export", () => {
        const import_stmt = {
          kind: "default",
          name: "myDefault" as SymbolName,
          source: "/project/utils.js" as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
        } as unknown as DefaultImport;

        const exports: Export[] = [
          {
            kind: "default",
            symbol: "utils#default" as SymbolId,
            symbol_name: "default" as SymbolName,
            is_declaration: false,
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
          } as unknown as DefaultExport,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("myDefault" as SymbolName)).toBe("utils#default");
      });

      it("matches named imports to named exports", () => {
        const import_stmt = {
          kind: "named",
          imports: [
            { name: "foo" as SymbolName, is_type_only: false },
            { name: "bar" as SymbolName, alias: "baz" as SymbolName, is_type_only: false },
          ],
          source: "/project/utils.js" as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
        } as unknown as NamedImport;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#foo" as SymbolId,
            symbol_name: "foo" as SymbolName,
            exports: [
              { local_name: "foo" as SymbolName, is_type_only: false },
            ],
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
          } as unknown as NamedExport,
          {
            kind: "named",
            symbol: "utils#bar" as SymbolId,
            symbol_name: "bar" as SymbolName,
            exports: [
              { local_name: "bar" as SymbolName, is_type_only: false },
            ],
            location: { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
          } as unknown as NamedExport,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(2);
        expect(result.get("foo" as SymbolName)).toBe("utils#foo");
        expect(result.get("baz" as SymbolName)).toBe("utils#bar"); // aliased
      });

      it("handles namespace imports", () => {
        const import_stmt = {
          kind: "namespace",
          namespace_name: "Utils" as any,
          source: "/project/utils.js" as FilePath,
          exports: new Map(),
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
        } as unknown as NamespaceImport;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#foo" as SymbolId,
            symbol_name: "foo" as SymbolName,
            exports: [
              { local_name: "foo" as SymbolName, is_type_only: false },
            ],
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
          } as unknown as NamedExport,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.has("Utils" as SymbolName)).toBe(true);
      });
    });
  });

  describe("Python Handler", () => {
    

    describe("module path resolution", () => {
      it("resolves relative imports with single dot", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/package/utils.py";
        });

        const result = resolve_python_module_path(
          ".utils",
          "/project/package/main.py" as FilePath
        );

        expect(result).toBe("/project/package/utils.py");
      });

      it("resolves relative imports with double dots", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/package/utils.py";
        });

        const result = resolve_python_module_path(
          "..utils",
          "/project/package/subpackage/main.py" as FilePath
        );

        expect(result).toBe("/project/package/utils.py");
      });

      it("resolves package imports with __init__.py", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/package/subpackage/__init__.py";
        });

        const result = resolve_python_module_path(
          ".subpackage",
          "/project/package/main.py" as FilePath
        );

        expect(result).toBe("/project/package/subpackage/__init__.py");
      });

      it("returns null for Python built-in modules", () => {
        const result = resolve_python_module_path(
          "os",
          "/project/main.py" as FilePath
        );

        expect(result).toBeNull();
      });

      it("resolves absolute imports from project root", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          // Simulate project root detection and module resolution
          return p === "/project/setup.py" ||
                 p === "/project/mypackage/utils.py";
        });

        const result = resolve_python_module_path(
          "mypackage.utils",
          "/project/tests/test_main.py" as FilePath
        );

        expect(result).toBe("/project/mypackage/utils.py");
      });
    });

    describe("import to export matching", () => {
      it("matches Python named imports", () => {
        const import_stmt = {
          kind: "named",
          imports: [
            { name: "helper" as SymbolName, is_type_only: false },
            { name: "util" as SymbolName, alias: "my_util" as SymbolName, is_type_only: false },
          ],
          source: "/project/utils.py" as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
        } as unknown as NamedImport;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#helper" as SymbolId,
            symbol_name: "helper" as SymbolName,
            exports: [
              { local_name: "helper" as SymbolName, is_type_only: false },
            ],
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
          } as unknown as NamedExport,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("utils#util" as SymbolId, {
          symbol_id: "utils#util" as SymbolId,
          name: "util" as SymbolName,
          kind: "function",
          location: { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(2);
        expect(result.get("helper" as SymbolName)).toBe("utils#helper");
        expect(result.get("my_util" as SymbolName)).toBe("utils#util");
      });

      it("handles Python module imports", () => {
        const import_stmt = {
          kind: "default",
          name: "utils" as SymbolName,
          source: "/project/utils.py" as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
        } as unknown as DefaultImport;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("utils#__init__" as SymbolId, {
          symbol_id: "utils#__init__" as SymbolId,
          name: "__init__" as SymbolName,
          kind: "function",
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("utils" as SymbolName)).toBe("utils#__init__");
      });
    });
  });

  describe("Rust Handler", () => {
    

    describe("module path resolution", () => {
      it("resolves local module files", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/src/utils.rs";
        });

        const result = resolve_rust_module_path(
          "utils",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils.rs");
      });

      it("resolves module directories with mod.rs", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/src/utils/mod.rs";
        });

        const result = resolve_rust_module_path(
          "utils",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils/mod.rs");
      });

      it("resolves self:: references", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/src/helper.rs";
        });

        const result = resolve_rust_module_path(
          "self::helper",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/helper.rs");
      });

      it("resolves super:: references", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/utils.rs";
        });

        const result = resolve_rust_module_path(
          "super::utils",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/utils.rs");
      });

      it("resolves crate:: references from lib.rs", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/src" ||
                 p === "/project/src/lib.rs" ||
                 p === "/project/src/utils.rs";
        });

        const result = resolve_rust_module_path(
          "crate::utils",
          "/project/src/module/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils.rs");
      });

      it("returns null for standard library crates", () => {
        const result = resolve_rust_module_path(
          "std::collections::HashMap",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBeNull();
      });

      it("returns null for core crate", () => {
        const result = resolve_rust_module_path(
          "core::mem",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBeNull();
      });
    });

    describe("import to export matching", () => {
      it("matches Rust use statements to pub exports", () => {
        const import_stmt = {
          kind: "named",
          imports: [
            { name: "helper" as SymbolName, is_type_only: false },
            { name: "MyStruct" as SymbolName, is_type_only: false },
          ],
          source: "/project/src/utils.rs" as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
        } as unknown as NamedImport;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#helper" as SymbolId,
            symbol_name: "helper" as SymbolName,
            exports: [
              { local_name: "helper" as SymbolName, is_type_only: false },
            ],
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
          } as unknown as NamedExport,
          {
            kind: "named",
            symbol: "utils#MyStruct" as SymbolId,
            symbol_name: "MyStruct" as SymbolName,
            exports: [
              { local_name: "MyStruct" as SymbolName, is_type_only: false },
            ],
            location: { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
          } as unknown as NamedExport,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(2);
        expect(result.get("helper" as SymbolName)).toBe("utils#helper");
        expect(result.get("MyStruct" as SymbolName)).toBe("utils#MyStruct");
      });

      it("handles aliased use statements", () => {
        const import_stmt = {
          kind: "named",
          imports: [
            {
              name: "OldName" as SymbolName,
              alias: "NewName" as SymbolName,
              is_type_only: false
            },
          ],
          source: "/project/src/utils.rs" as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
        } as unknown as NamedImport;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#OldName" as SymbolId,
            symbol_name: "OldName" as SymbolName,
            exports: [
              { local_name: "OldName" as SymbolName, is_type_only: false },
            ],
            location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
          } as unknown as NamedExport,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("NewName" as SymbolName)).toBe("utils#OldName");
      });
    });
  });

  // Standard Language Handlers tests removed since handler pattern is deprecated

  describe("Edge Cases and Error Handling", () => {
    describe("JavaScript/TypeScript Edge Cases", () => {
      

      it("handles scoped packages correctly", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_read_file = vi.mocked(fs.readFileSync);

        mock_exists.mockImplementation((p) => {
          if (p === "/project/node_modules/@babel/core") return true;
          if (p === "/project/node_modules/@babel/core/package.json") return true;
          if (p === "/project/node_modules/@babel/core/lib/index.js") return true;
          return false;
        });

        mock_read_file.mockImplementation((p) => {
          if ((p as string).includes("package.json")) {
            return JSON.stringify({ main: "lib/index.js" });
          }
          return "";
        });

        const result = resolve_js_module_path(
          "@babel/core",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/node_modules/@babel/core/lib/index.js");
      });

      it("handles package subpaths correctly", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_read_file = vi.mocked(fs.readFileSync);
        const mock_stats = vi.mocked(fs.statSync);

        mock_exists.mockImplementation((p) => {
          if (p === "/project/node_modules") return true;
          if (p === "/project/node_modules/lodash") return true;
          if (p === "/project/node_modules/lodash/package.json") return true;
          if (p === "/project/node_modules/lodash/index.js") return true;
          if (p === "/project/node_modules/lodash/debounce.js") return true;
          return false;
        });

        mock_read_file.mockImplementation((p) => {
          if ((p as string).includes("package.json")) {
            return JSON.stringify({ main: "index.js" });
          }
          return "";
        });

        mock_stats.mockImplementation((p) => ({
          isDirectory: () => p === "/project/node_modules" || p === "/project/node_modules/lodash",
          isFile: () => !p.toString().endsWith("/")
        } as any));

        const result = resolve_js_module_path(
          "lodash/debounce",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/node_modules/lodash/debounce.js");
      });

      it("handles .mjs and .cjs extensions", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/src/utils.mjs";
        });

        const result = resolve_js_module_path(
          "./utils",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/src/utils.mjs");
      });

      it("handles missing exports gracefully", () => {
        const import_stmt: NamedImport = {
          kind: "named",
          imports: [
            { name: "nonExistent" as SymbolName, is_type_only: false },
          ],
          source: "/project/utils.js" as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
        } as unknown as NamedImport;

        const exports: Export[] = [{
          kind: "named",
          symbol: "utils#other" as SymbolId,
          symbol_name: "other" as SymbolName,
          exports: [{ local_name: "other" as SymbolName, is_type_only: false }],
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        } as unknown as NamedExport];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        // Should return empty map for non-existent export
        expect(result.size).toBe(0);
      });

      it("handles side effect imports", () => {
        const import_stmt: Import = {
          kind: "side_effect",
          source: "./polyfills" as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        // Side effect imports should return empty map
        expect(result.size).toBe(0);
      });
    });

    describe("Python Edge Cases", () => {
      

      it("handles triple dot relative imports", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/package/utils.py";
        });

        const result = resolve_python_module_path(
          "...utils",
          "/project/package/subpackage/module/main.py" as FilePath
        );

        expect(result).toBe("/project/package/utils.py");
      });

      it("handles empty relative imports (from . import)", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          return p === "/project/package/__init__.py";
        });

        const result = resolve_python_module_path(
          ".",
          "/project/package/module.py" as FilePath
        );

        expect(result).toBe("/project/package/__init__.py");
      });

      it("handles package without __init__.py", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockReturnValue(false);

        const result = resolve_python_module_path(
          ".subpackage",
          "/project/package/main.py" as FilePath
        );

        expect(result).toBeNull();
      });

      it("matches imports to private symbols (starting with _)", () => {
        const import_stmt: NamedImport = {
          kind: "named",
          imports: [
            { name: "_private" as SymbolName, is_type_only: false },
          ],
          source: "/project/utils.py" as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
        } as unknown as NamedImport;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("utils#_private" as SymbolId, {
          symbol_id: "utils#_private" as SymbolId,
          name: "_private" as SymbolName,
          kind: "function",
          location: { start: { line: 1, column: 0 }, end: { line: 5, column: 1 } },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        // Private symbols should not be matched unless explicitly exported
        expect(result.size).toBe(0);
      });

      it("resolves from package root with pyproject.toml", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          if (p === "/project/pyproject.toml") return true;
          if (p === "/project/mypackage/utils.py") return true;
          return false;
        });

        const result = resolve_python_module_path(
          "mypackage.utils",
          "/project/tests/test_utils.py" as FilePath
        );

        expect(result).toBe("/project/mypackage/utils.py");
      });
    });

    describe("Rust Edge Cases", () => {
      

      it("handles nested module paths", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_stats = vi.mocked(fs.statSync);

        mock_exists.mockImplementation((p) => {
          if (p === "/project/src/utils") return true;
          if (p === "/project/src/utils/helpers") return true;
          if (p === "/project/src/utils/helpers/string.rs") return true;
          return false;
        });

        mock_stats.mockImplementation((p) => ({
          isDirectory: () => {
            return p === "/project/src/utils" || p === "/project/src/utils/helpers";
          },
          isFile: () => {
            return p === "/project/src/utils/helpers/string.rs";
          }
        } as any));

        const result = resolve_rust_module_path(
          "utils::helpers::string",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils/helpers/string.rs");
      });

      it("handles workspace member crates", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          if (p === "/workspace/Cargo.toml") return true;
          if (p === "/workspace/my_crate") return true;
          if (p === "/workspace/my_crate/src/lib.rs") return true;
          return false;
        });

        const result = resolve_rust_module_path(
          "my_crate::utils",
          "/workspace/other_crate/src/main.rs" as FilePath
        );

        expect(result).toBe("/workspace/my_crate/src/lib.rs");
      });

      it("handles main.rs as crate root", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          if (p === "/project/src") return true;
          if (p === "/project/src/main.rs") return true;
          if (p === "/project/src/utils.rs") return true;
          return false;
        });

        const result = resolve_rust_module_path(
          "crate::utils",
          "/project/src/module/submodule.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils.rs");
      });

      it("handles alloc crate as built-in", () => {
        const result = resolve_rust_module_path(
          "alloc::vec::Vec",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBeNull();
      });

      it("handles glob imports (use module::*)", () => {
        const import_stmt: Import = {
          kind: "namespace",
          namespace_name: "*" as any,
          source: "/project/utils.rs" as FilePath,
          exports: new Map(),
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        } as any;

        const exports: Export[] = [{
          kind: "named",
          symbol: "utils#helper" as SymbolId,
          symbol_name: "helper" as SymbolName,
          exports: [{ local_name: "helper" as SymbolName, is_type_only: false }],
          location: { start: { line: 1, column: 0 }, end: { line: 5, column: 1 } },
        } as unknown as NamedExport];

        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("utils#module" as SymbolId, {
          symbol_id: "utils#module" as SymbolId,
          name: "utils" as SymbolName,
          kind: "module",
          location: { start: { line: 0, column: 0 }, end: { line: 100, column: 0 } },
        } as unknown as SymbolDefinition);

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        // Should map namespace to module symbol
        expect(result.size).toBe(1);
        expect(result.has("*" as SymbolName)).toBe(true);
      });
    });

    describe("Cross-Handler Compatibility", () => {
      it("all handlers handle empty exports array", () => {
        const import_stmt: NamedImport = {
          kind: "named",
          imports: [{ name: "something" as SymbolName, is_type_only: false }],
          source: "/file" as FilePath,
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
        } as unknown as NamedImport;

        const empty_exports: Export[] = [];
        const empty_symbols = new Map<SymbolId, SymbolDefinition>();

        // Test each language's import matcher
        const js_result = match_js_import_to_export(import_stmt, empty_exports, empty_symbols);
        expect(js_result).toBeDefined();
        expect(js_result.size).toBe(0);

        const py_result = match_python_import_to_export(import_stmt, empty_exports, empty_symbols);
        expect(py_result).toBeDefined();
        expect(py_result.size).toBe(0);

        const rust_result = match_rust_import_to_export(import_stmt, empty_exports, empty_symbols);
        expect(rust_result).toBeDefined();
        expect(rust_result.size).toBe(0);
      });

      it("all handlers handle null path resolution gracefully", () => {
        // Test with a path that shouldn't resolve for any handler
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockReturnValue(false);

        const js_result = resolve_js_module_path("./non-existent-file", "/project/main" as FilePath);
        expect(js_result).toBeNull();

        const py_result = resolve_python_module_path("./non-existent-file", "/project/main" as FilePath);
        expect(py_result).toBeNull();

        const rust_result = resolve_rust_module_path("./non-existent-file", "/project/main" as FilePath);
        expect(rust_result).toBeNull();
      });
    });
  });
});
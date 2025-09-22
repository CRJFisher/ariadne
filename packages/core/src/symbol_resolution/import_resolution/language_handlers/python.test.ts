/**
 * Comprehensive tests for Python import resolution
 *
 * Tests module path resolution, import/export matching, and edge cases
 * specific to Python's import system.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolve_python_module_path, match_python_import_to_export } from "./python";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Import,
  Export,
  SymbolDefinition,
  NamedImport,
  DefaultImport,
} from "@ariadnejs/types";
import * as fs from "fs";

// Mock fs module
vi.mock("fs");

describe("Python Import Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Module Path Resolution", () => {
    describe("Relative Imports", () => {
      it("resolves single dot relative imports", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/package/utils.py");

        const result = resolve_python_module_path(
          ".utils",
          "/project/package/main.py" as FilePath
        );

        expect(result).toBe("/project/package/utils.py");
      });

      it("resolves double dot relative imports", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/package/utils.py");

        const result = resolve_python_module_path(
          "..utils",
          "/project/package/subpackage/main.py" as FilePath
        );

        expect(result).toBe("/project/package/utils.py");
      });

      it("resolves triple dot relative imports", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/package/utils.py");

        const result = resolve_python_module_path(
          "...utils",
          "/project/package/subpackage/module/main.py" as FilePath
        );

        expect(result).toBe("/project/package/utils.py");
      });

      it("resolves many-level relative imports", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/a/shared/utils.py");

        const result = resolve_python_module_path(
          "....shared.utils",
          "/project/a/b/c/d/main.py" as FilePath
        );

        expect(result).toBe("/project/a/shared/utils.py");
      });

      it("resolves package imports with __init__.py", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/package/subpackage/__init__.py"
        );

        const result = resolve_python_module_path(
          ".subpackage",
          "/project/package/main.py" as FilePath
        );

        expect(result).toBe("/project/package/subpackage/__init__.py");
      });

      it("resolves empty relative imports (from . import)", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/package/__init__.py"
        );

        const result = resolve_python_module_path(
          ".",
          "/project/package/module.py" as FilePath
        );

        expect(result).toBe("/project/package/__init__.py");
      });

      it("resolves parent package imports (from .. import)", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/package/__init__.py"
        );

        const result = resolve_python_module_path(
          "..",
          "/project/package/subpackage/module.py" as FilePath
        );

        expect(result).toBe("/project/package/__init__.py");
      });

      it("returns null for relative imports without matching files", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockReturnValue(false);

        const result = resolve_python_module_path(
          ".nonexistent",
          "/project/package/main.py" as FilePath
        );

        expect(result).toBeNull();
      });

      it("resolves nested package imports", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/package/sub1/sub2/module.py"
        );

        const result = resolve_python_module_path(
          ".sub1.sub2.module",
          "/project/package/main.py" as FilePath
        );

        expect(result).toBe("/project/package/sub1/sub2/module.py");
      });
    });

    describe("Absolute Imports", () => {
      it("resolves absolute imports from project root with setup.py", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/setup.py" ||
          p === "/project/mypackage/utils.py"
        );

        const result = resolve_python_module_path(
          "mypackage.utils",
          "/project/tests/test_main.py" as FilePath
        );

        expect(result).toBe("/project/mypackage/utils.py");
      });

      it("resolves absolute imports from project root with pyproject.toml", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/pyproject.toml" ||
          p === "/project/src/mypackage/utils.py"
        );

        const result = resolve_python_module_path(
          "src.mypackage.utils",
          "/project/tests/test_utils.py" as FilePath
        );

        expect(result).toBe("/project/src/mypackage/utils.py");
      });

      it("resolves absolute imports from project root with __init__.py", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/__init__.py" ||
          p === "/project/mypackage/module.py"
        );

        const result = resolve_python_module_path(
          "mypackage.module",
          "/project/tests/test_module.py" as FilePath
        );

        expect(result).toBe("/project/mypackage/module.py");
      });

      it("resolves package __init__.py files", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/setup.py" ||
          p === "/project/mypackage/__init__.py"
        );

        const result = resolve_python_module_path(
          "mypackage",
          "/project/main.py" as FilePath
        );

        expect(result).toBe("/project/mypackage/__init__.py");
      });

      it("walks up directory tree to find project root", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/workspace/project/setup.py" ||
          p === "/workspace/project/lib/utils.py"
        );

        const result = resolve_python_module_path(
          "lib.utils",
          "/workspace/project/src/deep/nested/module.py" as FilePath
        );

        expect(result).toBe("/workspace/project/lib/utils.py");
      });

      it("handles complex package structures", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/setup.py" ||
          p === "/project/app/api/v1/endpoints/users.py"
        );

        const result = resolve_python_module_path(
          "app.api.v1.endpoints.users",
          "/project/tests/test_api.py" as FilePath
        );

        expect(result).toBe("/project/app/api/v1/endpoints/users.py");
      });
    });

    describe("Built-in Modules", () => {
      it("returns null for Python built-in modules", () => {
        const builtins = ["os", "sys", "json", "re", "datetime", "math", "random"];

        for (const builtin of builtins) {
          const result = resolve_python_module_path(
            builtin,
            "/project/main.py" as FilePath
          );
          expect(result).toBeNull();
        }
      });

      it("returns null for standard library modules", () => {
        const stdlib = [
          "collections", "itertools", "functools",
          "typing", "pathlib", "subprocess", "threading"
        ];

        for (const module of stdlib) {
          const result = resolve_python_module_path(
            module,
            "/project/main.py" as FilePath
          );
          expect(result).toBeNull();
        }
      });

      it("returns null for nested standard library imports", () => {
        const nested = [
          "os.path", "urllib.parse", "collections.abc",
          "unittest.mock", "xml.etree.ElementTree"
        ];

        for (const module of nested) {
          const result = resolve_python_module_path(
            module,
            "/project/main.py" as FilePath
          );
          expect(result).toBeNull();
        }
      });
    });

    describe("Edge Cases", () => {
      it("handles packages without __init__.py (namespace packages)", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/namespace_pkg/module.py"
        );

        const result = resolve_python_module_path(
          ".module",
          "/project/namespace_pkg/other.py" as FilePath
        );

        expect(result).toBe("/project/namespace_pkg/module.py");
      });

      it("returns null for invalid relative import levels", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockReturnValue(false);

        const result = resolve_python_module_path(
          ".............toomany",
          "/project/main.py" as FilePath
        );

        expect(result).toBeNull();
      });

      it("handles mixed relative and absolute module paths", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/pkg/sub/deep/module.py"
        );

        const result = resolve_python_module_path(
          "..sub.deep.module",
          "/project/pkg/other/main.py" as FilePath
        );

        expect(result).toBe("/project/pkg/sub/deep/module.py");
      });

      it("handles files with .pyw extension", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          // Return false for .py and .pyi, true for .pyw
          if (p === "/project/gui_app.py") return false;
          if (p === "/project/gui_app.pyi") return false;
          if (p === "/project/gui_app.pyw") return true;
          if (p === "/project/gui_app/__init__.py") return false;
          return false;
        });

        const result = resolve_python_module_path(
          ".gui_app",
          "/project/main.py" as FilePath
        );

        expect(result).toBe("/project/gui_app.pyw");
      });

      it("handles files with .pyi stub extension", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => {
          // Return false for .py, true for .pyi
          if (p === "/project/stubs/module.py") return false;
          if (p === "/project/stubs/module.pyi") return true;
          if (p === "/project/stubs/module.pyw") return false;
          if (p === "/project/stubs/module/__init__.py") return false;
          return false;
        });

        const result = resolve_python_module_path(
          ".stubs.module",
          "/project/main.py" as FilePath
        );

        expect(result).toBe("/project/stubs/module.pyi");
      });

      it("prefers .py over .pyi when both exist", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) =>
          p === "/project/module.py" || p === "/project/module.pyi"
        );

        const result = resolve_python_module_path(
          ".module",
          "/project/main.py" as FilePath
        );

        expect(result).toBe("/project/module.py");
      });
    });
  });

  describe("Import to Export Matching", () => {
    describe("Named Imports (from module import name)", () => {
      it("matches simple named imports to exports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "function1" as SymbolName, is_type_only: false },
            { name: "Class1" as SymbolName, is_type_only: false },
          ],
          source: "/project/utils.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 40
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#function1" as SymbolId,
            name: "function1" as SymbolName,
            location: {
              file_path: "/project/utils.py" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 20
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("utils#Class1" as SymbolId, {
          symbol_id: "utils#Class1" as SymbolId,
          name: "Class1" as SymbolName,
          kind: "class",
          location: {
            file_path: "/project/utils.py" as FilePath,
            line: 5,
            column: 0,
            end_line: 10,
            end_column: 1
          },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(2);
        expect(result.get("function1" as SymbolName)).toBe("utils#function1");
        expect(result.get("Class1" as SymbolName)).toBe("utils#Class1");
      });

      it("matches aliased imports (from module import name as alias)", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            {
              name: "original_name" as SymbolName,
              alias: "new_name" as SymbolName,
              is_type_only: false
            },
          ],
          source: "/project/utils.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 40
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("utils#original_name" as SymbolId, {
          symbol_id: "utils#original_name" as SymbolId,
          name: "original_name" as SymbolName,
          kind: "function",
          location: {
            file_path: "/project/utils.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 3,
            end_column: 1
          },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("new_name" as SymbolName)).toBe("utils#original_name");
      });

      it("matches __all__ exports when available", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "public_func" as SymbolName, is_type_only: false },
          ],
          source: "/project/module.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "module#public_func" as SymbolId,
            name: "public_func" as SymbolName,
            location: {
              file_path: "/project/module.py" as FilePath,
              line: 10,
              column: 0,
              end_line: 10,
              end_column: 20
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("public_func" as SymbolName)).toBe("module#public_func");
      });

      it("does not match private symbols (starting with _)", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "_private_func" as SymbolName, is_type_only: false },
            { name: "__very_private" as SymbolName, is_type_only: false },
          ],
          source: "/project/module.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 50
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("module#_private_func" as SymbolId, {
          symbol_id: "module#_private_func" as SymbolId,
          name: "_private_func" as SymbolName,
          kind: "function",
          location: {
            file_path: "/project/module.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 3,
            end_column: 1
          },
        } as unknown as SymbolDefinition);
        symbols.set("module#__very_private" as SymbolId, {
          symbol_id: "module#__very_private" as SymbolId,
          name: "__very_private" as SymbolName,
          kind: "function",
          location: {
            file_path: "/project/module.py" as FilePath,
            line: 5,
            column: 0,
            end_line: 7,
            end_column: 1
          },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(0);
      });

      it("matches dunder methods like __init__", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "__init__" as SymbolName, is_type_only: false },
          ],
          source: "/project/module.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("module#__init__" as SymbolId, {
          symbol_id: "module#__init__" as SymbolId,
          name: "__init__" as SymbolName,
          kind: "function",
          location: {
            file_path: "/project/module.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 3,
            end_column: 1
          },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("__init__" as SymbolName)).toBe("module#__init__");
      });

      it("handles multiple imports with mix of found and not found", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "exists" as SymbolName, is_type_only: false },
            { name: "not_exists" as SymbolName, is_type_only: false },
            { name: "also_exists" as SymbolName, is_type_only: false },
          ],
          source: "/project/module.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 50
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "module#exists" as SymbolId,
            name: "exists" as SymbolName,
            location: {
              file_path: "/project/module.py" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 20
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("module#also_exists" as SymbolId, {
          symbol_id: "module#also_exists" as SymbolId,
          name: "also_exists" as SymbolName,
          kind: "variable",
          location: {
            file_path: "/project/module.py" as FilePath,
            line: 10,
            column: 0,
            end_line: 10,
            end_column: 15
          },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(2);
        expect(result.get("exists" as SymbolName)).toBe("module#exists");
        expect(result.get("also_exists" as SymbolName)).toBe("module#also_exists");
        expect(result.has("not_exists" as SymbolName)).toBe(false);
      });
    });

    describe("Module Imports (import module)", () => {
      it("handles whole module imports", () => {
        const import_stmt: Import = {
          kind: "default",
          name: "utils" as SymbolName,
          source: "/project/utils.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 20
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("utils#__init__" as SymbolId, {
          symbol_id: "utils#__init__" as SymbolId,
          name: "__init__" as SymbolName,
          kind: "function",
          location: {
            file_path: "/project/utils.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 10
          },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("utils" as SymbolName)).toBe("utils#__init__");
      });

      it("handles aliased module imports (import module as alias)", () => {
        const import_stmt: Import = {
          kind: "default",
          name: "np" as SymbolName,
          source: "/project/numpy.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 20
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("numpy#__init__" as SymbolId, {
          symbol_id: "numpy#__init__" as SymbolId,
          name: "__init__" as SymbolName,
          kind: "function",
          location: {
            file_path: "/project/numpy.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 10
          },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("np" as SymbolName)).toBe("numpy#__init__");
      });

      it("handles module imports with no __init__", () => {
        const import_stmt: Import = {
          kind: "default",
          name: "simple" as SymbolName,
          source: "/project/simple.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 20
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("simple#module" as SymbolId, {
          symbol_id: "simple#module" as SymbolId,
          name: "simple" as SymbolName,
          kind: "module",
          location: {
            file_path: "/project/simple.py" as FilePath,
            line: 0,
            column: 0,
            end_line: 100,
            end_column: 0
          },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("simple" as SymbolName)).toBe("simple#module");
      });
    });

    describe("Wildcard Imports (from module import *)", () => {
      it("handles wildcard imports with exports", () => {
        const import_stmt: Import = {
          kind: "namespace",
          name: "*" as SymbolName,
          source: "/project/module.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "module#func1" as SymbolId,
            name: "func1" as SymbolName,
            location: {
              file_path: "/project/module.py" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 20
            },
          } as unknown as Export,
          {
            kind: "named",
            symbol: "module#func2" as SymbolId,
            name: "func2" as SymbolName,
            location: {
              file_path: "/project/module.py" as FilePath,
              line: 3,
              column: 0,
              end_line: 3,
              end_column: 20
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBeGreaterThan(0);
      });

      it("handles wildcard imports without explicit exports", () => {
        const import_stmt: Import = {
          kind: "namespace",
          name: "*" as SymbolName,
          source: "/project/module.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("module#public_func" as SymbolId, {
          symbol_id: "module#public_func" as SymbolId,
          name: "public_func" as SymbolName,
          kind: "function",
          location: {
            file_path: "/project/module.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 3,
            end_column: 1
          },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBeGreaterThanOrEqual(0);
      });
    });

    describe("Edge Cases", () => {
      it("handles empty imports array", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [],
          source: "/project/module.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "module#func" as SymbolId,
            name: "func" as SymbolName,
            location: {
              file_path: "/project/module.py" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 20
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(0);
      });

      it("handles empty exports and symbols", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "something" as SymbolName, is_type_only: false },
          ],
          source: "/project/module.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(0);
      });

      it("handles unknown import kind gracefully", () => {
        const import_stmt: Import = {
          kind: "unknown" as any,
          source: "/project/module.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(0);
      });

      it("handles type annotations in imports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "List" as SymbolName, is_type_only: true },
            { name: "Dict" as SymbolName, is_type_only: true },
            { name: "Optional" as SymbolName, is_type_only: true },
          ],
          source: "/project/typing_extensions.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 50
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("typing_extensions#List" as SymbolId, {
          symbol_id: "typing_extensions#List" as SymbolId,
          name: "List" as SymbolName,
          kind: "class",
          location: {
            file_path: "/project/typing_extensions.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 20
          },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("List" as SymbolName)).toBe("typing_extensions#List");
      });

      it("respects __all__ when matching exports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "public_api" as SymbolName, is_type_only: false },
            { name: "internal_func" as SymbolName, is_type_only: false },
          ],
          source: "/project/module.py" as FilePath,
          location: {
            file_path: "/project/main.py" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 50
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "module#public_api" as SymbolId,
            name: "public_api" as SymbolName,
            location: {
              file_path: "/project/module.py" as FilePath,
              line: 10,
              column: 0,
              end_line: 10,
              end_column: 20
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set("module#internal_func" as SymbolId, {
          symbol_id: "module#internal_func" as SymbolId,
          name: "internal_func" as SymbolName,
          kind: "function",
          location: {
            file_path: "/project/module.py" as FilePath,
            line: 20,
            column: 0,
            end_line: 22,
            end_column: 1
          },
        } as unknown as SymbolDefinition);

        const result = match_python_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("public_api" as SymbolName)).toBe("module#public_api");
        expect(result.has("internal_func" as SymbolName)).toBe(false);
      });
    });
  });
});
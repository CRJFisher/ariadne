/**
 * Comprehensive tests for JavaScript/TypeScript import resolution
 *
 * Tests module path resolution, import/export matching, and edge cases
 * specific to JavaScript and TypeScript module systems.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resolve_js_module_path,
  match_js_import_to_export,
  resolve_node_modules_path,
  find_file_with_extensions,
} from "./javascript";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Import,
  Export,
  SymbolDefinition,
  NamespaceImport,
  NamedExport,
} from "@ariadnejs/types";
import * as fs from "fs";
import type { Stats } from "fs";

// Mock fs module
vi.mock("fs");

// Helper to create proper Stats mock
function createStatsMock(isDir: boolean): Stats {
  return {
    isDirectory: () => isDir,
    isFile: () => !isDir,
    atimeMs: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,
    dev: 0,
    ino: 0,
    mode: 0,
    nlink: 0,
    uid: 0,
    gid: 0,
    rdev: 0,
    size: 0,
    blksize: 0,
    blocks: 0,
    atime: new Date(),
    mtime: new Date(),
    ctime: new Date(),
    birthtime: new Date(),
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  };
}

describe("JavaScript/TypeScript Import Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Module Path Resolution", () => {
    describe("Relative Imports", () => {
      it("resolves relative imports with ./", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/src/utils.js");

        const result = resolve_js_module_path(
          "./utils",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/src/utils.js");
      });

      it("resolves relative imports with ../ (parent directory)", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/utils.ts");

        const result = resolve_js_module_path(
          "../utils",
          "/project/src/main.ts" as FilePath
        );

        expect(result).toBe("/project/utils.ts");
      });

      it("resolves multiple parent directory traversals", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/shared/utils.ts");

        const result = resolve_js_module_path(
          "../../shared/utils",
          "/project/src/components/Header.tsx" as FilePath
        );

        expect(result).toBe("/project/shared/utils.ts");
      });

      it("resolves TypeScript extensions (.ts, .tsx)", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) => p === "/project/src/Component.tsx"
        );

        const result = resolve_js_module_path(
          "./Component",
          "/project/src/App.tsx" as FilePath
        );

        expect(result).toBe("/project/src/Component.tsx");
      });

      it("resolves .mjs and .cjs extensions", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/src/utils.mjs");

        const result = resolve_js_module_path(
          "./utils",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/src/utils.mjs");
      });

      it("prefers .ts over .js when both exist", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) => p === "/project/src/utils.ts" || p === "/project/src/utils.js"
        );

        const result = resolve_js_module_path(
          "./utils",
          "/project/src/main.ts" as FilePath
        );

        expect(result).toBe("/project/src/utils.ts");
      });
    });

    describe("Directory Index Resolution", () => {
      it("resolves index.js in directories", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_stats = vi.mocked(fs.statSync);

        mock_exists.mockImplementation(
          (p) =>
            p === "/project/src/components" ||
            p === "/project/src/components/index.js"
        );
        mock_stats.mockReturnValue(createStatsMock(true));

        const result = resolve_js_module_path(
          "./components",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/src/components/index.js");
      });

      it("resolves index.ts in TypeScript projects", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_stats = vi.mocked(fs.statSync);

        mock_exists.mockImplementation(
          (p) =>
            p === "/project/src/components" ||
            p === "/project/src/components/index.ts"
        );
        mock_stats.mockReturnValue(createStatsMock(true));

        const result = resolve_js_module_path(
          "./components",
          "/project/src/main.ts" as FilePath
        );

        expect(result).toBe("/project/src/components/index.ts");
      });

      it("resolves index.tsx for React components", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_stats = vi.mocked(fs.statSync);

        mock_exists.mockImplementation(
          (p) =>
            p === "/project/src/components" ||
            p === "/project/src/components/index.tsx"
        );
        mock_stats.mockReturnValue(createStatsMock(true));

        const result = resolve_js_module_path(
          "./components",
          "/project/src/App.tsx" as FilePath
        );

        expect(result).toBe("/project/src/components/index.tsx");
      });

      it("returns null for directories without index files", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_stats = vi.mocked(fs.statSync);

        mock_exists.mockImplementation((p) => p === "/project/src/empty");
        mock_stats.mockReturnValue(createStatsMock(true));

        const result = resolve_js_module_path(
          "./empty",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBeNull();
      });
    });

    describe("Absolute Imports", () => {
      it("resolves absolute paths starting with /", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/absolute/path/utils.js");

        const result = resolve_js_module_path(
          "/absolute/path/utils.js",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/absolute/path/utils.js");
      });

      it("resolves absolute paths with extensions", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/absolute/utils.ts");

        const result = resolve_js_module_path(
          "/absolute/utils",
          "/project/src/main.ts" as FilePath
        );

        expect(result).toBe("/absolute/utils.ts");
      });
    });

    describe("Node.js Built-in Modules", () => {
      it("returns null for Node.js built-in modules", () => {
        const builtins = ["fs", "path", "http", "crypto", "stream", "util"];

        for (const builtin of builtins) {
          const result = resolve_js_module_path(
            builtin,
            "/project/src/main.js" as FilePath
          );
          expect(result).toBeNull();
        }
      });

      it("returns null for node: prefixed modules", () => {
        const prefixed = ["node:fs", "node:path", "node:test", "node:assert"];

        for (const module of prefixed) {
          const result = resolve_js_module_path(
            module,
            "/project/src/main.js" as FilePath
          );
          expect(result).toBeNull();
        }
      });
    });

    describe("Package Resolution (node_modules)", () => {
      it("resolves simple npm packages", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_read_file = vi.mocked(fs.readFileSync);

        mock_exists.mockImplementation(
          (p) =>
            p === "/project/node_modules" ||
            p === "/project/node_modules/lodash" ||
            p === "/project/node_modules/lodash/package.json" ||
            p === "/project/node_modules/lodash/index.js"
        );

        mock_read_file.mockImplementation(() =>
          JSON.stringify({ main: "index.js" })
        );

        const result = resolve_js_module_path(
          "lodash",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/node_modules/lodash/index.js");
      });

      it("resolves scoped packages (@org/package)", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_read_file = vi.mocked(fs.readFileSync);

        mock_exists.mockImplementation(
          (p) =>
            p === "/project/node_modules/@babel/core" ||
            p === "/project/node_modules/@babel/core/package.json" ||
            p === "/project/node_modules/@babel/core/lib/index.js"
        );

        mock_read_file.mockImplementation(() =>
          JSON.stringify({ main: "lib/index.js" })
        );

        const result = resolve_js_module_path(
          "@babel/core",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/node_modules/@babel/core/lib/index.js");
      });

      it("resolves package subpaths (package/subpath)", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_read_file = vi.mocked(fs.readFileSync);
        const mock_stats = vi.mocked(fs.statSync);

        mock_exists.mockImplementation(
          (p) =>
            p === "/project/node_modules/lodash" ||
            p === "/project/node_modules/lodash/package.json" ||
            p === "/project/node_modules/lodash/index.js" ||
            p === "/project/node_modules/lodash/debounce.js"
        );

        mock_read_file.mockImplementation(() =>
          JSON.stringify({ main: "index.js" })
        );

        mock_stats.mockImplementation((p) => {
          const isFile = p.toString().endsWith(".js");
          return createStatsMock(!isFile);
        });

        const result = resolve_js_module_path(
          "lodash/debounce",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/node_modules/lodash/debounce.js");
      });

      it("resolves scoped package subpaths", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_read_file = vi.mocked(fs.readFileSync);
        const mock_stats = vi.mocked(fs.statSync);

        mock_exists.mockImplementation(
          (p) =>
            p === "/project/node_modules/@babel/core" ||
            p === "/project/node_modules/@babel/core/package.json" ||
            p === "/project/node_modules/@babel/core/lib/index.js" ||
            p === "/project/node_modules/@babel/core/lib/parser" ||
            p === "/project/node_modules/@babel/core/lib/parser.js"
        );

        mock_read_file.mockImplementation(() =>
          JSON.stringify({ main: "lib/index.js" })
        );

        mock_stats.mockImplementation((p) => {
          const isFile = p.toString().endsWith(".js");
          return createStatsMock(!isFile);
        });

        const result = resolve_js_module_path(
          "@babel/core/lib/parser",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/node_modules/@babel/core/lib/parser.js");
      });

      it("walks up directory tree to find node_modules", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_read_file = vi.mocked(fs.readFileSync);

        mock_exists.mockImplementation(
          (p) =>
            p === "/project/node_modules/lodash" ||
            p === "/project/node_modules/lodash/package.json" ||
            p === "/project/node_modules/lodash/index.js"
        );

        mock_read_file.mockImplementation(() =>
          JSON.stringify({ main: "index.js" })
        );

        const result = resolve_js_module_path(
          "lodash",
          "/project/src/components/deep/nested/file.js" as FilePath
        );

        expect(result).toBe("/project/node_modules/lodash/index.js");
      });

      it("handles packages without package.json", () => {
        const mock_exists = vi.mocked(fs.existsSync);

        mock_exists.mockImplementation(
          (p) =>
            p === "/project/node_modules/simple" ||
            p === "/project/node_modules/simple/index.js"
        );

        const result = resolve_js_module_path(
          "simple",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/node_modules/simple/index.js");
      });

      it("handles packages with invalid package.json", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_read_file = vi.mocked(fs.readFileSync);

        mock_exists.mockImplementation(
          (p) =>
            p === "/project/node_modules/broken" ||
            p === "/project/node_modules/broken/package.json" ||
            p === "/project/node_modules/broken/index.ts"
        );

        mock_read_file.mockImplementation(() => "invalid json{");

        const result = resolve_js_module_path(
          "broken",
          "/project/src/main.ts" as FilePath
        );

        expect(result).toBe("/project/node_modules/broken/index.ts");
      });

      it("returns null for non-existent packages", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockReturnValue(false);

        const result = resolve_js_module_path(
          "non-existent-package",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBeNull();
      });
    });

    describe("Edge Cases", () => {
      it("handles files with explicit extensions in import", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/src/utils.js");

        const result = resolve_js_module_path(
          "./utils.js",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBe("/project/src/utils.js");
      });

      it("returns null for non-existent relative paths", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockReturnValue(false);

        const result = resolve_js_module_path(
          "./non-existent",
          "/project/src/main.js" as FilePath
        );

        expect(result).toBeNull();
      });

      it("handles complex relative paths", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/shared/utils.ts");

        const result = resolve_js_module_path(
          "../../../shared/utils",
          "/project/src/features/auth/login.ts" as FilePath
        );

        expect(result).toBe("/project/shared/utils.ts");
      });
    });
  });

  describe("Import to Export Matching", () => {
    describe("Default Imports/Exports", () => {
      it("matches default import to default export", () => {
        const import_stmt: Import = {
          kind: "default",
          name: "MyDefault" as SymbolName,
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "default",
            symbol: "utils#default" as SymbolId,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(1);
        expect(result.get("MyDefault" as SymbolName)).toBe("utils#default");
      });

      it("handles default export with no matching import", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [{ name: "foo" as SymbolName, is_type_only: false }],
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "default",
            symbol: "utils#default" as SymbolId,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(0);
      });

      it("returns empty map for default import with no default export", () => {
        const import_stmt: Import = {
          kind: "default",
          name: "MyDefault" as SymbolName,
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#foo" as SymbolId,
            name: "foo" as SymbolName,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(0);
      });
    });

    describe("Named Imports/Exports", () => {
      it("matches simple named imports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "foo" as SymbolName, is_type_only: false },
            { name: "bar" as SymbolName, is_type_only: false },
          ],
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#foo" as SymbolId,
            name: "foo" as SymbolName,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
          {
            kind: "named",
            symbol: "utils#bar" as SymbolId,
            name: "bar" as SymbolName,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 2,
        start_column: 0,
              end_line: 2,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(2);
        expect(result.get("foo" as SymbolName)).toBe("utils#foo");
        expect(result.get("bar" as SymbolName)).toBe("utils#bar");
      });

      it("matches aliased named imports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            {
              name: "originalName" as SymbolName,
              alias: "aliasedName" as SymbolName,
              is_type_only: false,
            },
          ],
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#originalName" as SymbolId,
            name: "originalName" as SymbolName,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(1);
        expect(result.get("aliasedName" as SymbolName)).toBe(
          "utils#originalName"
        );
      });

      it("handles type-only imports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "MyType" as SymbolName, is_type_only: true },
            { name: "MyInterface" as SymbolName, is_type_only: true },
          ],
          source: "/project/types.ts" as FilePath,
          location: {
            file_path: "/project/main.ts" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 40,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "types#MyType" as SymbolId,
            name: "MyType" as SymbolName,
            location: {
              file_path: "/project/types.ts" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
          {
            kind: "named",
            symbol: "types#MyInterface" as SymbolId,
            name: "MyInterface" as SymbolName,
            location: {
              file_path: "/project/types.ts" as FilePath,
        start_line: 2,
        start_column: 0,
              end_line: 2,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(2);
        expect(result.get("MyType" as SymbolName)).toBe("types#MyType");
        expect(result.get("MyInterface" as SymbolName)).toBe(
          "types#MyInterface"
        );
      });

      it("returns empty map for non-existent named exports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [{ name: "nonExistent" as SymbolName, is_type_only: false }],
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#other" as SymbolId,
            name: "other" as SymbolName,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(0);
      });

      it("handles mixed existing and non-existing imports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "exists" as SymbolName, is_type_only: false },
            { name: "notExists" as SymbolName, is_type_only: false },
          ],
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#exists" as SymbolId,
            name: "exists" as SymbolName,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(1);
        expect(result.get("exists" as SymbolName)).toBe("utils#exists");
        expect(result.has("notExists" as SymbolName)).toBe(false);
      });
    });

    describe("Namespace Imports", () => {
      it("handles namespace imports (import * as)", () => {
        const import_stmt: Import = {
          kind: "namespace",
          name: "Utils" as SymbolName,
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#foo" as SymbolId,
            name: "foo" as SymbolName,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
          {
            kind: "named",
            symbol: "utils#bar" as SymbolId,
            name: "bar" as SymbolName,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 2,
        start_column: 0,
              end_line: 2,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(1);
        expect(result.has("Utils" as SymbolName)).toBe(true);
        expect(result.get("Utils" as SymbolName)).toBe("utils#foo");
      });

      it("handles namespace import with no exports", () => {
        const import_stmt: Import = {
          kind: "namespace",
          name: "Empty" as SymbolName,
          source: "/project/empty.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(0);
      });
    });

    describe("Side Effect Imports", () => {
      it("returns empty map for side effect imports", () => {
        const import_stmt: Import = {
          kind: "side_effect",
          source: "./polyfills" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 20,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "polyfills#setup" as SymbolId,
            name: "setup" as SymbolName,
            location: {
              file_path: "/project/polyfills.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(0);
      });

      it("handles CSS/SCSS imports as side effects", () => {
        const import_stmt: Import = {
          kind: "side_effect",
          source: "./styles.css" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 20,
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(0);
      });
    });

    describe("Complex Export Patterns", () => {
      it("handles exports array in NamedExport", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [{ name: "foo" as SymbolName, is_type_only: false }],
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#foo" as SymbolId,
            exports: [
              {
                local_name: "foo" as SymbolName,
                export_name: "foo" as SymbolName,
                is_type_only: false,
              },
            ],
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as NamedExport,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(1);
        expect(result.get("foo" as SymbolName)).toBe("utils#foo");
      });

      it("handles re-exports with different names", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "exportedName" as SymbolName, is_type_only: false },
          ],
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#localName" as SymbolId,
            exports: [
              {
                local_name: "localName" as SymbolName,
                export_name: "exportedName" as SymbolName,
                is_type_only: false,
              },
            ],
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as NamedExport,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(1);
        expect(result.get("exportedName" as SymbolName)).toBe(
          "utils#localName"
        );
      });
    });

    describe("Node Modules Resolution", () => {
      it("should handle node_modules path resolution", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_read = vi.mocked(fs.readFileSync);

        mock_exists.mockImplementation((p) => {
          const path_str = p.toString();
          return (
            path_str.includes("node_modules/lodash") ||
            path_str.includes("package.json") ||
            path_str.includes("index.js")
          );
        });

        mock_read.mockImplementation((p) => {
          if (p.toString().includes("package.json")) {
            return JSON.stringify({ main: "index.js" });
          }
          return "";
        });

        const result = resolve_node_modules_path(
          "lodash",
          "/project/src/main.ts" as FilePath
        );
        expect(result).toContain("node_modules/lodash");
      });
    });

    describe("File Resolution with Extensions", () => {
      it("should find files with various extensions", () => {
        const mock_exists = vi.mocked(fs.existsSync);

        mock_exists.mockImplementation((p) => {
          return p === "/project/src/utils.tsx";
        });

        const result = find_file_with_extensions("/project/src/utils", [
          ".ts",
          ".tsx",
          ".js",
          ".jsx",
        ]);
        expect(result).toBe("/project/src/utils.tsx");
      });
    });

    describe("Edge Cases", () => {
      it("handles empty imports array", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [],
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#foo" as SymbolId,
            name: "foo" as SymbolName,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(0);
      });

      it("handles empty exports array", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [{ name: "foo" as SymbolName, is_type_only: false }],
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(0);
      });

      it("handles unknown import kind gracefully", () => {
        const import_stmt: Import = {
          kind: "unknown",
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(0);
      });

      it("handles Import type with name field for default imports", () => {
        const import_stmt: Import = {
          kind: "default",
          name: "DefaultImport" as SymbolName,
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "default",
            symbol: "utils#default" as SymbolId,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(import_stmt, exports, symbols);

        expect(result.size).toBe(1);
        expect(result.get("DefaultImport" as SymbolName)).toBe("utils#default");
      });

      it("handles NamespaceImport with namespace_name field", () => {
        const import_stmt = {
          kind: "namespace",
          namespace_name: "Utils" as SymbolName,
          source: "/project/utils.js" as FilePath,
          location: {
            file_path: "/project/main.js" as FilePath,
        start_line: 1,
        start_column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as NamespaceImport;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#foo" as SymbolId,
            name: "foo" as SymbolName,
            location: {
              file_path: "/project/utils.js" as FilePath,
        start_line: 1,
        start_column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_js_import_to_export(
          import_stmt as unknown as Import,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.has("Utils" as SymbolName)).toBe(true);
      });
    });
  });
});

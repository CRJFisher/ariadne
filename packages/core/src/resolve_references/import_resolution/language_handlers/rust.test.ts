/**
 * Comprehensive tests for Rust import resolution
 *
 * Tests module path resolution, import/export matching, and edge cases
 * specific to Rust's module system.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolve_rust_module_path, match_rust_import_to_export } from "./rust";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Import,
  Export,
  SymbolDefinition,
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

describe("Rust Import Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Module Path Resolution", () => {
    describe("Local Module Files", () => {
      it("resolves simple module files", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/src/utils.rs");

        const result = resolve_rust_module_path(
          "utils",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils.rs");
      });

      it("resolves module directories with mod.rs", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) => p === "/project/src/utils/mod.rs"
        );

        const result = resolve_rust_module_path(
          "utils",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils/mod.rs");
      });

      it("prefers .rs files over mod.rs when both exist", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) =>
            p === "/project/src/utils.rs" || p === "/project/src/utils/mod.rs"
        );

        const result = resolve_rust_module_path(
          "utils",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils.rs");
      });

      it("resolves nested module paths", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        const mock_stats = vi.mocked(fs.statSync);

        mock_exists.mockImplementation(
          (p) =>
            p === "/project/src/utils" ||
            p === "/project/src/utils/helpers" ||
            p === "/project/src/utils/helpers/string.rs"
        );

        mock_stats.mockImplementation((p) => {
          const isFile = p === "/project/src/utils/helpers/string.rs";
          const isDir = p === "/project/src/utils" || p === "/project/src/utils/helpers";
          return createStatsMock(isDir && !isFile);
        });

        const result = resolve_rust_module_path(
          "utils::helpers::string",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils/helpers/string.rs");
      });

      it("handles module paths with multiple separators", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) => p === "/project/src/api/v1/endpoints/users.rs"
        );

        const result = resolve_rust_module_path(
          "api::v1::endpoints::users",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/api/v1/endpoints/users.rs");
      });
    });

    describe("self:: References", () => {
      it("resolves self:: module references", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/src/helper.rs");

        const result = resolve_rust_module_path(
          "self::helper",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/helper.rs");
      });

      it("resolves nested self:: references", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) => p === "/project/src/utils/helpers.rs"
        );

        const result = resolve_rust_module_path(
          "self::utils::helpers",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils/helpers.rs");
      });

      it("resolves self:: from submodules", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) => p === "/project/src/utils/helper.rs"
        );

        const result = resolve_rust_module_path(
          "self::helper",
          "/project/src/utils/mod.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils/helper.rs");
      });
    });

    describe("super:: References", () => {
      it("resolves super:: to parent module", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/utils.rs");

        const result = resolve_rust_module_path(
          "super::utils",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/utils.rs");
      });

      it("resolves multiple super:: references", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/utils.rs");

        const result = resolve_rust_module_path(
          "super::super::utils",
          "/project/src/module/submodule.rs" as FilePath
        );

        expect(result).toBe("/project/utils.rs");
      });

      it("resolves super:: with nested paths", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) => p === "/project/shared/common.rs"
        );

        const result = resolve_rust_module_path(
          "super::shared::common",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/shared/common.rs");
      });

      it("handles super:: from deeply nested modules", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/src/shared.rs");

        const result = resolve_rust_module_path(
          "super::super::shared",
          "/project/src/api/v1/endpoints.rs" as FilePath
        );

        expect(result).toBe("/project/src/shared.rs");
      });
    });

    describe("crate:: References", () => {
      it("resolves crate:: from lib.rs root", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) =>
            p === "/project/src" ||
            p === "/project/src/lib.rs" ||
            p === "/project/src/utils.rs"
        );

        const result = resolve_rust_module_path(
          "crate::utils",
          "/project/src/module/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils.rs");
      });

      it("resolves crate:: from main.rs root", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) =>
            p === "/project/src" ||
            p === "/project/src/main.rs" ||
            p === "/project/src/utils.rs"
        );

        const result = resolve_rust_module_path(
          "crate::utils",
          "/project/src/module/submodule.rs" as FilePath
        );

        expect(result).toBe("/project/src/utils.rs");
      });

      it("resolves nested crate:: paths", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) =>
            p === "/project/src" ||
            p === "/project/src/lib.rs" ||
            p === "/project/src/api/handlers/auth.rs"
        );

        const result = resolve_rust_module_path(
          "crate::api::handlers::auth",
          "/project/src/utils/helper.rs" as FilePath
        );

        expect(result).toBe("/project/src/api/handlers/auth.rs");
      });

      it("handles crate:: without src directory", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) => p === "/project/lib.rs" || p === "/project/utils.rs"
        );

        const result = resolve_rust_module_path(
          "crate::utils",
          "/project/module.rs" as FilePath
        );

        expect(result).toBe("/project/utils.rs");
      });
    });

    describe("Standard Library and External Crates", () => {
      it("returns null for std:: crate", () => {
        const result = resolve_rust_module_path(
          "std::collections::HashMap",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBeNull();
      });

      it("returns null for core:: crate", () => {
        const result = resolve_rust_module_path(
          "core::mem::size_of",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBeNull();
      });

      it("returns null for alloc:: crate", () => {
        const result = resolve_rust_module_path(
          "alloc::vec::Vec",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBeNull();
      });

      it("returns null for common external crates", () => {
        const externals = [
          "serde::Serialize",
          "tokio::runtime::Runtime",
          "async_trait::async_trait",
          "futures::future::Future",
        ];

        for (const external of externals) {
          const result = resolve_rust_module_path(
            external,
            "/project/src/main.rs" as FilePath
          );
          expect(result).toBeNull();
        }
      });

      it("returns null for crate names without paths", () => {
        const result = resolve_rust_module_path(
          "external_crate",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBeNull();
      });
    });

    describe("Workspace Members", () => {
      it("resolves workspace member crates", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) =>
            p === "/workspace/Cargo.toml" ||
            p === "/workspace/my_crate" ||
            p === "/workspace/my_crate/src/lib.rs"
        );

        const result = resolve_rust_module_path(
          "my_crate::utils",
          "/workspace/other_crate/src/main.rs" as FilePath
        );

        expect(result).toBe("/workspace/my_crate/src/lib.rs");
      });

      it("handles workspace with multiple members", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) =>
            p === "/workspace/Cargo.toml" ||
            p === "/workspace/crate_a" ||
            p === "/workspace/crate_a/src/lib.rs"
        );

        const result = resolve_rust_module_path(
          "crate_a::module",
          "/workspace/crate_b/src/main.rs" as FilePath
        );

        expect(result).toBe("/workspace/crate_a/src/lib.rs");
      });

      it("handles workspace members with custom paths", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) =>
            p === "/workspace/Cargo.toml" ||
            p === "/workspace/libs/my_lib" ||
            p === "/workspace/libs/my_lib/src/lib.rs"
        );

        const result = resolve_rust_module_path(
          "my_lib::api",
          "/workspace/apps/my_app/src/main.rs" as FilePath
        );

        expect(result).toBe("/workspace/libs/my_lib/src/lib.rs");
      });
    });

    describe("Edge Cases", () => {
      it("handles files in crate root", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation((p) => p === "/project/utils.rs");

        const result = resolve_rust_module_path(
          "utils",
          "/project/main.rs" as FilePath
        );

        expect(result).toBe("/project/utils.rs");
      });

      it("returns null for non-existent modules", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockReturnValue(false);

        const result = resolve_rust_module_path(
          "nonexistent",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBeNull();
      });

      it("handles complex nested paths", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) => p === "/project/src/domain/models/user/validation.rs"
        );

        const result = resolve_rust_module_path(
          "domain::models::user::validation",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/domain/models/user/validation.rs");
      });

      it("handles paths with underscores", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) => p === "/project/src/test_utils/mock_data.rs"
        );

        const result = resolve_rust_module_path(
          "test_utils::mock_data",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/test_utils/mock_data.rs");
      });

      it("handles paths with numbers", () => {
        const mock_exists = vi.mocked(fs.existsSync);
        mock_exists.mockImplementation(
          (p) => p === "/project/src/api/v2/handlers.rs"
        );

        const result = resolve_rust_module_path(
          "api::v2::handlers",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBe("/project/src/api/v2/handlers.rs");
      });

      it("handles empty module path", () => {
        const result = resolve_rust_module_path(
          "",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBeNull();
      });

      it("handles module path with only ::", () => {
        const result = resolve_rust_module_path(
          "::",
          "/project/src/main.rs" as FilePath
        );

        expect(result).toBeNull();
      });
    });
  });

  describe("Import to Export Matching", () => {
    describe("Named Use Statements", () => {
      it("matches simple use statements", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "function" as SymbolName, is_type_only: false },
            { name: "Struct" as SymbolName, is_type_only: false },
          ],
          source: "/project/src/utils.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#function" as SymbolId,
            name: "function" as SymbolName,
            location: {
              file_path: "/project/src/utils.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
          {
            kind: "named",
            symbol: "utils#Struct" as SymbolId,
            name: "Struct" as SymbolName,
            location: {
              file_path: "/project/src/utils.rs" as FilePath,
              line: 5,
              column: 0,
              end_line: 5,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(2);
        expect(result.get("function" as SymbolName)).toBe("utils#function");
        expect(result.get("Struct" as SymbolName)).toBe("utils#Struct");
      });

      it("matches aliased use statements (use module::Item as Alias)", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            {
              name: "OldName" as SymbolName,
              alias: "NewName" as SymbolName,
              is_type_only: false,
            },
          ],
          source: "/project/src/utils.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#OldName" as SymbolId,
            name: "OldName" as SymbolName,
            location: {
              file_path: "/project/src/utils.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
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

      it("matches grouped use statements", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "Item1" as SymbolName, is_type_only: false },
            { name: "Item2" as SymbolName, is_type_only: false },
            { name: "Item3" as SymbolName, is_type_only: false },
          ],
          source: "/project/src/module.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 40,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "module#Item1" as SymbolId,
            name: "Item1" as SymbolName,
            location: {
              file_path: "/project/src/module.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
          {
            kind: "named",
            symbol: "module#Item2" as SymbolId,
            name: "Item2" as SymbolName,
            location: {
              file_path: "/project/src/module.rs" as FilePath,
              line: 2,
              column: 0,
              end_line: 2,
              end_column: 20,
            },
          } as unknown as Export,
          {
            kind: "named",
            symbol: "module#Item3" as SymbolId,
            name: "Item3" as SymbolName,
            location: {
              file_path: "/project/src/module.rs" as FilePath,
              line: 3,
              column: 0,
              end_line: 3,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(3);
        expect(result.get("Item1" as SymbolName)).toBe("module#Item1");
        expect(result.get("Item2" as SymbolName)).toBe("module#Item2");
        expect(result.get("Item3" as SymbolName)).toBe("module#Item3");
      });

      it("handles mix of found and not found items", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "Exists" as SymbolName, is_type_only: false },
            { name: "NotExists" as SymbolName, is_type_only: false },
          ],
          source: "/project/src/module.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "module#Exists" as SymbolId,
            name: "Exists" as SymbolName,
            location: {
              file_path: "/project/src/module.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("Exists" as SymbolName)).toBe("module#Exists");
        expect(result.has("NotExists" as SymbolName)).toBe(false);
      });
    });

    describe("Glob Imports (use module::*)", () => {
      it("handles glob imports", () => {
        const import_stmt: Import = {
          kind: "namespace",
          name: "*" as SymbolName,
          source: "/project/utils.rs" as FilePath,
          location: {
            file_path: "/project/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 20,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "utils#helper" as SymbolId,
            name: "helper" as SymbolName,
            location: {
              file_path: "/project/utils.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 5,
              end_column: 1,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set(
          "utils#module" as SymbolId,
          {
            symbol_id: "utils#module" as SymbolId,
            name: "utils" as SymbolName,
            kind: "module",
            location: {
              file_path: "/project/utils.rs" as FilePath,
              line: 0,
              column: 0,
              end_line: 100,
              end_column: 0,
            },
          } as unknown as SymbolDefinition
        );

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.has("*" as SymbolName)).toBe(true);
      });

      it("handles glob imports with no exports", () => {
        const import_stmt: Import = {
          kind: "namespace",
          name: "*" as SymbolName,
          source: "/project/empty.rs" as FilePath,
          location: {
            file_path: "/project/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 20,
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(0);
      });
    });

    describe("Re-exports and Visibility", () => {
      it("matches pub use re-exports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [{ name: "ReExported" as SymbolName, is_type_only: false }],
          source: "/project/src/lib.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "lib#ReExported" as SymbolId,
            name: "ReExported" as SymbolName,
            location: {
              file_path: "/project/src/lib.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 30,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("ReExported" as SymbolName)).toBe("lib#ReExported");
      });

      it("matches pub(crate) items within crate", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "CrateVisible" as SymbolName, is_type_only: false },
          ],
          source: "/project/src/internal.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "internal#CrateVisible" as SymbolId,
            name: "CrateVisible" as SymbolName,
            location: {
              file_path: "/project/src/internal.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 25,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("CrateVisible" as SymbolName)).toBe(
          "internal#CrateVisible"
        );
      });
    });

    describe("Trait and Type Imports", () => {
      it("matches trait imports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "MyTrait" as SymbolName, is_type_only: false },
            { name: "AnotherTrait" as SymbolName, is_type_only: false },
          ],
          source: "/project/src/traits.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 40,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "traits#MyTrait" as SymbolId,
            name: "MyTrait" as SymbolName,
            location: {
              file_path: "/project/src/traits.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 5,
              end_column: 1,
            },
          } as unknown as Export,
          {
            kind: "named",
            symbol: "traits#AnotherTrait" as SymbolId,
            name: "AnotherTrait" as SymbolName,
            location: {
              file_path: "/project/src/traits.rs" as FilePath,
              line: 7,
              column: 0,
              end_line: 10,
              end_column: 1,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(2);
        expect(result.get("MyTrait" as SymbolName)).toBe("traits#MyTrait");
        expect(result.get("AnotherTrait" as SymbolName)).toBe(
          "traits#AnotherTrait"
        );
      });

      it("matches type alias imports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "Result" as SymbolName, is_type_only: false },
            { name: "MyResult" as SymbolName, is_type_only: false },
          ],
          source: "/project/src/types.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "types#Result" as SymbolId,
            name: "Result" as SymbolName,
            location: {
              file_path: "/project/src/types.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 40,
            },
          } as unknown as Export,
          {
            kind: "named",
            symbol: "types#MyResult" as SymbolId,
            name: "MyResult" as SymbolName,
            location: {
              file_path: "/project/src/types.rs" as FilePath,
              line: 2,
              column: 0,
              end_line: 2,
              end_column: 40,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(2);
        expect(result.get("Result" as SymbolName)).toBe("types#Result");
        expect(result.get("MyResult" as SymbolName)).toBe("types#MyResult");
      });
    });

    describe("Edge Cases", () => {
      it("handles empty imports array", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [],
          source: "/project/src/module.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "module#Item" as SymbolId,
            name: "Item" as SymbolName,
            location: {
              file_path: "/project/src/module.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 20,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(0);
      });

      it("handles empty exports array", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [{ name: "Something" as SymbolName, is_type_only: false }],
          source: "/project/src/module.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(0);
      });

      it("handles unknown import kind gracefully", () => {
        const import_stmt: Import = {
          kind: "unknown",
          source: "/project/src/module.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(0);
      });

      it("matches module imports with module symbol", () => {
        const import_stmt: Import = {
          kind: "default",
          name: "module" as SymbolName,
          source: "/project/src/module.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 20,
          },
        } as unknown as Import;

        const exports: Export[] = [];
        const symbols = new Map<SymbolId, SymbolDefinition>();
        symbols.set(
          "module#module" as SymbolId,
          {
            symbol_id: "module#module" as SymbolId,
            name: "module" as SymbolName,
            kind: "module",
            location: {
              file_path: "/project/src/module.rs" as FilePath,
              line: 0,
              column: 0,
              end_line: 100,
              end_column: 0,
            },
          } as unknown as SymbolDefinition
        );

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("module" as SymbolName)).toBe("module#module");
      });

      it("handles macro imports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [{ name: "my_macro" as SymbolName, is_type_only: false }],
          source: "/project/src/macros.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 30,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "macros#my_macro" as SymbolId,
            name: "my_macro" as SymbolName,
            location: {
              file_path: "/project/src/macros.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 5,
              end_column: 1,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(1);
        expect(result.get("my_macro" as SymbolName)).toBe("macros#my_macro");
      });

      it("handles const and static imports", () => {
        const import_stmt: Import = {
          kind: "named",
          imports: [
            { name: "CONSTANT" as SymbolName, is_type_only: false },
            { name: "STATIC_VAR" as SymbolName, is_type_only: false },
          ],
          source: "/project/src/constants.rs" as FilePath,
          location: {
            file_path: "/project/src/main.rs" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 40,
          },
        } as unknown as Import;

        const exports: Export[] = [
          {
            kind: "named",
            symbol: "constants#CONSTANT" as SymbolId,
            name: "CONSTANT" as SymbolName,
            location: {
              file_path: "/project/src/constants.rs" as FilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 30,
            },
          } as unknown as Export,
          {
            kind: "named",
            symbol: "constants#STATIC_VAR" as SymbolId,
            name: "STATIC_VAR" as SymbolName,
            location: {
              file_path: "/project/src/constants.rs" as FilePath,
              line: 2,
              column: 0,
              end_line: 2,
              end_column: 35,
            },
          } as unknown as Export,
        ];

        const symbols = new Map<SymbolId, SymbolDefinition>();

        const result = match_rust_import_to_export(
          import_stmt,
          exports,
          symbols
        );

        expect(result.size).toBe(2);
        expect(result.get("CONSTANT" as SymbolName)).toBe("constants#CONSTANT");
        expect(result.get("STATIC_VAR" as SymbolName)).toBe(
          "constants#STATIC_VAR"
        );
      });
    });
  });
});

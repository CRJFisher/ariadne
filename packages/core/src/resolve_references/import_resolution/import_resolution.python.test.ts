/**
 * Tests for Python module resolution
 *
 * Tests the resolve_module_path_python function which handles:
 * - Simple module names (import X)
 * - Dotted module names (import X.Y.Z)
 * - Relative imports (from . import X, from .. import X)
 * - Local directory-first resolution (sys.path[0] behavior)
 * - Monorepo scenarios with duplicate module names
 */

import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { resolve_module_path_python } from "./import_resolution.python";
import type { FileSystemFolder } from "../file_folders";

/**
 * Create a mock FileSystemFolder tree from a list of file paths.
 * Files can be specified as relative paths from root or absolute paths.
 *
 * @param root_path - The root path of the tree
 * @param files - List of file paths to include
 * @returns A FileSystemFolder tree
 */
function create_file_tree(
  root_path: string,
  files: string[]
): FileSystemFolder {
  const root: FileSystemFolder = {
    path: root_path as FilePath,
    folders: new Map(),
    files: new Set(),
  };

  for (const file of files) {
    // Make path relative to root if it's absolute
    const relative_path = file.startsWith(root_path)
      ? file.slice(root_path.length + 1)
      : file;

    const parts = relative_path.split("/");
    let current = root;

    // Navigate/create folders
    for (let i = 0; i < parts.length - 1; i++) {
      const folder_name = parts[i];
      let folder = (current.folders as Map<string, FileSystemFolder>).get(
        folder_name
      );
      if (!folder) {
        const folder_path = [root_path, ...parts.slice(0, i + 1)].join("/");
        folder = {
          path: folder_path as FilePath,
          folders: new Map(),
          files: new Set(),
        };
        (current.folders as Map<string, FileSystemFolder>).set(
          folder_name,
          folder
        );
      }
      current = folder;
    }

    // Add file
    const file_name = parts[parts.length - 1];
    (current.files as Set<string>).add(file_name);
  }

  return root;
}

describe("resolve_module_path_python", () => {
  describe("simple module names (no dots)", () => {
    it("simple module name resolves to same directory first", () => {
      // Tests sys.path[0] behavior: local directory checked first
      const tree = create_file_tree("/project", [
        "package_a/weighted_mape.py",
        "package_a/caller.py",
        "package_b/weighted_mape.py",
      ]);

      const result = resolve_module_path_python(
        "weighted_mape",
        "/project/package_a/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/package_a/weighted_mape.py");
    });

    it("should resolve sibling module before project root", () => {
      // Given: file at /project/pkg/main.py, sibling /project/pkg/utils.py
      // When: resolving "utils"
      // Then: returns /project/pkg/utils.py (not /project/utils.py if it existed)
      const tree = create_file_tree("/project", [
        "pkg/main.py",
        "pkg/utils.py",
        "utils.py", // Project root also has utils.py
      ]);

      const result = resolve_module_path_python(
        "utils",
        "/project/pkg/main.py" as FilePath,
        tree
      );

      // Should resolve to sibling, not project root
      expect(result).toBe("/project/pkg/utils.py");
    });

    it("should resolve sibling package (module/__init__.py)", () => {
      // Given: file at /project/pkg/main.py, sibling package /project/pkg/utils/__init__.py
      // When: resolving "utils"
      // Then: returns /project/pkg/utils/__init__.py
      const tree = create_file_tree("/project", [
        "pkg/main.py",
        "pkg/utils/__init__.py",
      ]);

      const result = resolve_module_path_python(
        "utils",
        "/project/pkg/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/utils/__init__.py");
    });

    it("local package with __init__.py resolves correctly", () => {
      // Tests local package resolution without parent __init__.py
      const tree = create_file_tree("/project", [
        "package_a/mymodule/__init__.py",
        "package_a/mymodule/helper.py",
        "package_a/caller.py",
      ]);

      const result = resolve_module_path_python(
        "mymodule",
        "/project/package_a/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/package_a/mymodule/__init__.py");
    });

    it("should prefer .py file over package for simple modules", () => {
      // If both utils.py and utils/__init__.py exist as siblings,
      // Python prefers the .py file
      const tree = create_file_tree("/project", [
        "pkg/main.py",
        "pkg/utils.py",
        "pkg/utils/__init__.py",
      ]);

      const result = resolve_module_path_python(
        "utils",
        "/project/pkg/main.py" as FilePath,
        tree
      );

      // Should resolve to .py file first (checked before __init__.py)
      expect(result).toBe("/project/pkg/utils.py");
    });

    it("should fall back to project root if no sibling exists", () => {
      // Given: file at /project/pkg/main.py, only /project/utils.py exists
      // When: resolving "utils"
      // Then: returns /project/utils.py
      const tree = create_file_tree("/project", [
        "pkg/__init__.py", // Make pkg a package
        "pkg/main.py",
        "utils.py",
      ]);

      const result = resolve_module_path_python(
        "utils",
        "/project/pkg/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/utils.py");
    });

    it("should handle modules at project root", () => {
      const tree = create_file_tree("/project", ["main.py", "helper.py"]);

      const result = resolve_module_path_python(
        "helper",
        "/project/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/helper.py");
    });

    it("different callers resolve to their local modules", () => {
      const tree = create_file_tree("/project", [
        "package_a/utils.py",
        "package_a/caller_a.py",
        "package_b/utils.py",
        "package_b/caller_b.py",
      ]);

      const result_a = resolve_module_path_python(
        "utils",
        "/project/package_a/caller_a.py" as FilePath,
        tree
      );

      const result_b = resolve_module_path_python(
        "utils",
        "/project/package_b/caller_b.py" as FilePath,
        tree
      );

      expect(result_a).toBe("/project/package_a/utils.py");
      expect(result_b).toBe("/project/package_b/utils.py");
    });
  });

  describe("dotted module names", () => {
    it("should resolve sibling subpackage", () => {
      // Given: file at /project/pkg/main.py, /project/pkg/sub/mod.py exists
      // When: resolving "sub.mod"
      // Then: returns /project/pkg/sub/mod.py
      const tree = create_file_tree("/project", [
        "pkg/main.py",
        "pkg/sub/__init__.py",
        "pkg/sub/mod.py",
      ]);

      const result = resolve_module_path_python(
        "sub.mod",
        "/project/pkg/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/sub/mod.py");
    });

    it("should resolve deeply nested sibling subpackage", () => {
      // Given: file at /project/pkg/main.py, /project/pkg/a/b/c.py exists
      // When: resolving "a.b.c"
      // Then: returns /project/pkg/a/b/c.py
      const tree = create_file_tree("/project", [
        "pkg/main.py",
        "pkg/a/__init__.py",
        "pkg/a/b/__init__.py",
        "pkg/a/b/c.py",
      ]);

      const result = resolve_module_path_python(
        "a.b.c",
        "/project/pkg/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/a/b/c.py");
    });

    it("should fall back to project root for dotted paths", () => {
      // Given: file at /project/pkg/main.py, only /project/other/mod.py exists
      // When: resolving "other.mod"
      // Then: returns /project/other/mod.py
      const tree = create_file_tree("/project", [
        "pkg/__init__.py",
        "pkg/main.py",
        "other/__init__.py",
        "other/mod.py",
      ]);

      const result = resolve_module_path_python(
        "other.mod",
        "/project/pkg/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/other/mod.py");
    });

    it("should resolve package __init__.py for dotted import", () => {
      // When importing a package (not a module within it)
      const tree = create_file_tree("/project", [
        "pkg/main.py",
        "pkg/sub/__init__.py",
        "pkg/sub/nested/__init__.py",
      ]);

      const result = resolve_module_path_python(
        "sub.nested",
        "/project/pkg/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/sub/nested/__init__.py");
    });

    it("dotted import checks local directory first", () => {
      const tree = create_file_tree("/project", [
        "package_a/utils/helpers.py",
        "package_a/caller.py",
        "utils/helpers.py", // Different module at project root
      ]);

      const result = resolve_module_path_python(
        "utils.helpers",
        "/project/package_a/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/package_a/utils/helpers.py");
    });
  });

  describe("relative imports", () => {
    it("single dot resolves to same directory", () => {
      // Simpler test without __init__.py files
      const tree = create_file_tree("/project", [
        "package/caller.py",
        "package/helper.py",
      ]);

      const result = resolve_module_path_python(
        ".helper",
        "/project/package/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/package/helper.py");
    });

    it("double dot resolves to parent directory", () => {
      // Simpler test without __init__.py files
      const tree = create_file_tree("/project", [
        "package/subpackage/caller.py",
        "package/helper.py",
      ]);

      const result = resolve_module_path_python(
        "..helper",
        "/project/package/subpackage/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/package/helper.py");
    });

    it("should resolve single dot relative import (from .module)", () => {
      const tree = create_file_tree("/project", [
        "pkg/__init__.py",
        "pkg/main.py",
        "pkg/utils.py",
      ]);

      const result = resolve_module_path_python(
        ".utils",
        "/project/pkg/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/utils.py");
    });

    it("should resolve double dot relative import (from ..module)", () => {
      const tree = create_file_tree("/project", [
        "pkg/__init__.py",
        "pkg/sub/__init__.py",
        "pkg/sub/main.py",
        "pkg/utils.py",
      ]);

      const result = resolve_module_path_python(
        "..utils",
        "/project/pkg/sub/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/utils.py");
    });

    it("should resolve triple dot relative import", () => {
      const tree = create_file_tree("/project", [
        "pkg/__init__.py",
        "pkg/a/__init__.py",
        "pkg/a/b/__init__.py",
        "pkg/a/b/main.py",
        "pkg/utils.py",
      ]);

      const result = resolve_module_path_python(
        "...utils",
        "/project/pkg/a/b/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/utils.py");
    });

    it("should resolve relative import of sibling package", () => {
      const tree = create_file_tree("/project", [
        "pkg/__init__.py",
        "pkg/sub/__init__.py",
        "pkg/sub/main.py",
        "pkg/other/__init__.py",
        "pkg/other/helper.py",
      ]);

      const result = resolve_module_path_python(
        "..other.helper",
        "/project/pkg/sub/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/other/helper.py");
    });

    it("relative import with submodule", () => {
      const tree = create_file_tree("/project", [
        "package/subpackage/caller.py",
        "package/utils/helper.py",
      ]);

      const result = resolve_module_path_python(
        "..utils.helper",
        "/project/package/subpackage/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/package/utils/helper.py");
    });
  });

  describe("package __init__.py resolution", () => {
    it("package name resolves to __init__.py", () => {
      const tree = create_file_tree("/project", [
        "mypackage/__init__.py",
        "mypackage/module.py",
        "caller.py",
      ]);

      const result = resolve_module_path_python(
        "mypackage",
        "/project/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/mypackage/__init__.py");
    });

    it("prefers .py file over __init__.py for same name", () => {
      // When both utils.py and utils/__init__.py exist, utils.py wins
      const tree = create_file_tree("/project", [
        "utils.py",
        "utils/__init__.py",
        "caller.py",
      ]);

      const result = resolve_module_path_python(
        "utils",
        "/project/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/utils.py");
    });
  });

  describe("fallback to project root", () => {
    it("falls back to project root when local module not found", () => {
      const tree = create_file_tree("/project", [
        "shared/utils.py",
        "package_a/caller.py",
        ".git/.gitkeep", // Project root marker
      ]);

      const result = resolve_module_path_python(
        "shared.utils",
        "/project/package_a/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/shared/utils.py");
    });

    it("package imports resolve from project root", () => {
      const tree = create_file_tree("/project", [
        "mypackage/__init__.py",
        "mypackage/module.py",
        "caller.py",
      ]);

      const result = resolve_module_path_python(
        "mypackage.module",
        "/project/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/mypackage/module.py");
    });
  });

  describe("edge cases", () => {
    it("should handle module name matching directory name (path duplication prevention)", () => {
      // When in /project/nested/ and importing "nested.helper",
      // should not resolve to /project/nested/nested/helper.py
      const tree = create_file_tree("/project", [
        "nested/__init__.py",
        "nested/main.py",
        "nested/helper.py",
      ]);

      // Importing "helper" (simple) from nested/main.py
      const result = resolve_module_path_python(
        "helper",
        "/project/nested/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/nested/helper.py");
    });

    it("should handle deeply nested package structure", () => {
      const tree = create_file_tree("/project", [
        "a/__init__.py",
        "a/b/__init__.py",
        "a/b/c/__init__.py",
        "a/b/c/main.py",
        "a/b/c/helper.py",
      ]);

      const result = resolve_module_path_python(
        "helper",
        "/project/a/b/c/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/a/b/c/helper.py");
    });
  });

  describe("monorepo with duplicate module names", () => {
    it("resolves same-named modules based on import location", () => {
      // Simulates the exact scenario from the bug report
      const tree = create_file_tree("/monorepo", [
        ".git/.gitkeep",
        "package_a/weighted_mape.py",
        "package_a/caller.py",
        "package_b/weighted_mape.py",
        "package_b/caller.py",
      ]);

      // Caller in package_a imports its local weighted_mape
      const result_a = resolve_module_path_python(
        "weighted_mape",
        "/monorepo/package_a/caller.py" as FilePath,
        tree
      );

      // Caller in package_b imports its local weighted_mape
      const result_b = resolve_module_path_python(
        "weighted_mape",
        "/monorepo/package_b/caller.py" as FilePath,
        tree
      );

      expect(result_a).toBe("/monorepo/package_a/weighted_mape.py");
      expect(result_b).toBe("/monorepo/package_b/weighted_mape.py");
    });

    it("handles nested packages with same-named modules", () => {
      const tree = create_file_tree("/monorepo", [
        ".git/.gitkeep",
        "services/auth/utils.py",
        "services/auth/handler.py",
        "services/billing/utils.py",
        "services/billing/handler.py",
      ]);

      const result_auth = resolve_module_path_python(
        "utils",
        "/monorepo/services/auth/handler.py" as FilePath,
        tree
      );

      const result_billing = resolve_module_path_python(
        "utils",
        "/monorepo/services/billing/handler.py" as FilePath,
        tree
      );

      expect(result_auth).toBe("/monorepo/services/auth/utils.py");
      expect(result_billing).toBe("/monorepo/services/billing/utils.py");
    });
  });
});

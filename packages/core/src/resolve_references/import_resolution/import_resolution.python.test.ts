/**
 * Tests for Python module resolution
 *
 * Tests the resolve_module_path_python function which handles:
 * - Simple module names (import X)
 * - Dotted module names (import X.Y.Z)
 * - Relative imports (from . import X, from .. import X)
 * - Sibling module resolution (same directory first)
 */

import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { resolve_module_path_python } from "./import_resolution.python";
import type { FileSystemFolder } from "../file_folders";

/**
 * Create a mock FileSystemFolder tree from a list of file paths.
 * Files are specified as relative paths from root.
 *
 * @param root_path - The root path of the tree
 * @param files - List of relative file paths to include
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
    const parts = file.split("/");
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
  });

  describe("relative imports", () => {
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
});

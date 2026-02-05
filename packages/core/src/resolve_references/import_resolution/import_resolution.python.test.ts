/**
 * Tests for Python module resolution
 *
 * Tests the local directory-first resolution behavior that matches Python's
 * sys.path[0] semantics: the directory containing the importing script is
 * searched first for modules.
 */

import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { resolve_module_path_python } from "./import_resolution.python";
import type { FileSystemFolder } from "../file_folders";

/**
 * Helper to create a FileSystemFolder tree from a list of file paths
 */
function create_folder_tree(
  root_path: string,
  file_paths: string[]
): FileSystemFolder {
  const root: FileSystemFolder = {
    path: root_path as FilePath,
    folders: new Map(),
    files: new Set(),
  };

  for (const file_path of file_paths) {
    // Make path relative to root
    const relative_path = file_path.startsWith(root_path)
      ? file_path.slice(root_path.length + 1)
      : file_path;

    const parts = relative_path.split("/");
    const filename = parts.pop()!;

    let current = root;
    for (const part of parts) {
      if (!current.folders.has(part)) {
        const new_folder: FileSystemFolder = {
          path: `${current.path}/${part}` as FilePath,
          folders: new Map(),
          files: new Set(),
        };
        (current.folders as Map<string, FileSystemFolder>).set(part, new_folder);
      }
      current = current.folders.get(part)!;
    }
    (current.files as Set<string>).add(filename);
  }

  return root;
}

describe("resolve_module_path_python", () => {
  describe("local directory resolution (sys.path[0] behavior)", () => {
    it("simple module name resolves to same directory first", () => {
      const root = create_folder_tree("/project", [
        "/project/package_a/weighted_mape.py",
        "/project/package_a/caller.py",
        "/project/package_b/weighted_mape.py",
      ]);

      const result = resolve_module_path_python(
        "weighted_mape",
        "/project/package_a/caller.py" as FilePath,
        root
      );

      expect(result).toBe("/project/package_a/weighted_mape.py");
    });

    it("different callers resolve to their local modules", () => {
      const root = create_folder_tree("/project", [
        "/project/package_a/utils.py",
        "/project/package_a/caller_a.py",
        "/project/package_b/utils.py",
        "/project/package_b/caller_b.py",
      ]);

      const result_a = resolve_module_path_python(
        "utils",
        "/project/package_a/caller_a.py" as FilePath,
        root
      );

      const result_b = resolve_module_path_python(
        "utils",
        "/project/package_b/caller_b.py" as FilePath,
        root
      );

      expect(result_a).toBe("/project/package_a/utils.py");
      expect(result_b).toBe("/project/package_b/utils.py");
    });

    it("local package with __init__.py resolves correctly", () => {
      const root = create_folder_tree("/project", [
        "/project/package_a/mymodule/__init__.py",
        "/project/package_a/mymodule/helper.py",
        "/project/package_a/caller.py",
      ]);

      const result = resolve_module_path_python(
        "mymodule",
        "/project/package_a/caller.py" as FilePath,
        root
      );

      expect(result).toBe("/project/package_a/mymodule/__init__.py");
    });

    it("dotted import checks local directory first", () => {
      const root = create_folder_tree("/project", [
        "/project/package_a/utils/helpers.py",
        "/project/package_a/caller.py",
        "/project/utils/helpers.py", // Different module at project root
      ]);

      const result = resolve_module_path_python(
        "utils.helpers",
        "/project/package_a/caller.py" as FilePath,
        root
      );

      expect(result).toBe("/project/package_a/utils/helpers.py");
    });
  });

  describe("fallback to project root", () => {
    it("falls back to project root when local module not found", () => {
      const root = create_folder_tree("/project", [
        "/project/shared/utils.py",
        "/project/package_a/caller.py",
        "/project/.git/.gitkeep", // Project root marker
      ]);

      const result = resolve_module_path_python(
        "shared.utils",
        "/project/package_a/caller.py" as FilePath,
        root
      );

      expect(result).toBe("/project/shared/utils.py");
    });

    it("package imports resolve from project root", () => {
      const root = create_folder_tree("/project", [
        "/project/mypackage/__init__.py",
        "/project/mypackage/module.py",
        "/project/caller.py",
      ]);

      const result = resolve_module_path_python(
        "mypackage.module",
        "/project/caller.py" as FilePath,
        root
      );

      expect(result).toBe("/project/mypackage/module.py");
    });
  });

  describe("relative imports", () => {
    it("single dot resolves to same directory", () => {
      const root = create_folder_tree("/project", [
        "/project/package/caller.py",
        "/project/package/helper.py",
      ]);

      const result = resolve_module_path_python(
        ".helper",
        "/project/package/caller.py" as FilePath,
        root
      );

      expect(result).toBe("/project/package/helper.py");
    });

    it("double dot resolves to parent directory", () => {
      const root = create_folder_tree("/project", [
        "/project/package/subpackage/caller.py",
        "/project/package/helper.py",
      ]);

      const result = resolve_module_path_python(
        "..helper",
        "/project/package/subpackage/caller.py" as FilePath,
        root
      );

      expect(result).toBe("/project/package/helper.py");
    });

    it("relative import with submodule", () => {
      const root = create_folder_tree("/project", [
        "/project/package/subpackage/caller.py",
        "/project/package/utils/helper.py",
      ]);

      const result = resolve_module_path_python(
        "..utils.helper",
        "/project/package/subpackage/caller.py" as FilePath,
        root
      );

      expect(result).toBe("/project/package/utils/helper.py");
    });
  });

  describe("package __init__.py resolution", () => {
    it("package name resolves to __init__.py", () => {
      const root = create_folder_tree("/project", [
        "/project/mypackage/__init__.py",
        "/project/mypackage/module.py",
        "/project/caller.py",
      ]);

      const result = resolve_module_path_python(
        "mypackage",
        "/project/caller.py" as FilePath,
        root
      );

      expect(result).toBe("/project/mypackage/__init__.py");
    });

    it("prefers .py file over __init__.py for same name", () => {
      // When both utils.py and utils/__init__.py exist, utils.py wins
      const root = create_folder_tree("/project", [
        "/project/utils.py",
        "/project/utils/__init__.py",
        "/project/caller.py",
      ]);

      const result = resolve_module_path_python(
        "utils",
        "/project/caller.py" as FilePath,
        root
      );

      expect(result).toBe("/project/utils.py");
    });
  });

  describe("monorepo with duplicate module names", () => {
    it("resolves same-named modules based on import location", () => {
      // Simulates the exact scenario from the bug report
      const root = create_folder_tree("/monorepo", [
        "/monorepo/.git/.gitkeep",
        "/monorepo/package_a/weighted_mape.py",
        "/monorepo/package_a/caller.py",
        "/monorepo/package_b/weighted_mape.py",
        "/monorepo/package_b/caller.py",
      ]);

      // Caller in package_a imports its local weighted_mape
      const result_a = resolve_module_path_python(
        "weighted_mape",
        "/monorepo/package_a/caller.py" as FilePath,
        root
      );

      // Caller in package_b imports its local weighted_mape
      const result_b = resolve_module_path_python(
        "weighted_mape",
        "/monorepo/package_b/caller.py" as FilePath,
        root
      );

      expect(result_a).toBe("/monorepo/package_a/weighted_mape.py");
      expect(result_b).toBe("/monorepo/package_b/weighted_mape.py");
    });

    it("handles nested packages with same-named modules", () => {
      const root = create_folder_tree("/monorepo", [
        "/monorepo/.git/.gitkeep",
        "/monorepo/services/auth/utils.py",
        "/monorepo/services/auth/handler.py",
        "/monorepo/services/billing/utils.py",
        "/monorepo/services/billing/handler.py",
      ]);

      const result_auth = resolve_module_path_python(
        "utils",
        "/monorepo/services/auth/handler.py" as FilePath,
        root
      );

      const result_billing = resolve_module_path_python(
        "utils",
        "/monorepo/services/billing/handler.py" as FilePath,
        root
      );

      expect(result_auth).toBe("/monorepo/services/auth/utils.py");
      expect(result_billing).toBe("/monorepo/services/billing/utils.py");
    });
  });
});

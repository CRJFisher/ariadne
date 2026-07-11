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
import {
  resolve_module_path_python,
  resolve_submodule_path_python,
} from "./import_resolution.python";
import { create_file_tree } from "./import_resolution.test";

describe("resolve_module_path_python", () => {
  describe("simple module names (no dots)", () => {
    it("resolves simple module name to same directory first", () => {
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

    it("resolves sibling module before project root", () => {
      const tree = create_file_tree("/project", [
        "pkg/main.py",
        "pkg/utils.py",
        "utils.py",
      ]);

      const result = resolve_module_path_python(
        "utils",
        "/project/pkg/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/utils.py");
    });

    it("resolves sibling package to its __init__.py", () => {
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

    it("resolves local package with __init__.py without a parent package", () => {
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

    it("prefers .py file over package for simple modules", () => {
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

      expect(result).toBe("/project/pkg/utils.py");
    });

    it("falls back to project root when no sibling exists", () => {
      const tree = create_file_tree("/project", [
        "pkg/__init__.py",
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

    it("resolves modules at project root", () => {
      const tree = create_file_tree("/project", ["main.py", "helper.py"]);

      const result = resolve_module_path_python(
        "helper",
        "/project/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/helper.py");
    });

    it("resolves different callers to their local modules", () => {
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
    it("resolves sibling subpackage", () => {
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

    it("resolves deeply nested sibling subpackage", () => {
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

    it("falls back to project root for dotted paths", () => {
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

    it("resolves a dotted import of a package to its __init__.py", () => {
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

    it("checks local directory first for dotted imports", () => {
      const tree = create_file_tree("/project", [
        "package_a/utils/helpers.py",
        "package_a/caller.py",
        "utils/helpers.py",
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
    it("resolves single dot to same directory", () => {
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

    it("resolves double dot to parent directory", () => {
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

    it("resolves single dot relative import to a named module", () => {
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

    it("resolves double dot relative import to a named module", () => {
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

    it("resolves triple dot relative import", () => {
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

    it("resolves a bare single dot to the current package __init__.py", () => {
      const tree = create_file_tree("/project", [
        "pkg/__init__.py",
        "pkg/caller.py",
      ]);

      const result = resolve_module_path_python(
        ".",
        "/project/pkg/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/__init__.py");
    });

    it("resolves a bare double dot to the parent package __init__.py", () => {
      const tree = create_file_tree("/project", [
        "pkg/__init__.py",
        "pkg/sub/caller.py",
      ]);

      const result = resolve_module_path_python(
        "..",
        "/project/pkg/sub/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/__init__.py");
    });

    it("resolves relative import of a sibling package", () => {
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

    it("resolves relative import with a submodule", () => {
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

    it("returns the constructed .py path when a relative import is unresolvable", () => {
      const tree = create_file_tree("/project", ["pkg/caller.py"]);

      const result = resolve_module_path_python(
        ".missing",
        "/project/pkg/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/pkg/missing.py");
    });
  });

  describe("package __init__.py resolution", () => {
    it("resolves package name to its __init__.py", () => {
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

    it("prefers .py file over __init__.py for the same name", () => {
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
        ".git/.gitkeep",
      ]);

      const result = resolve_module_path_python(
        "shared.utils",
        "/project/package_a/caller.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/shared/utils.py");
    });

    it("resolves package imports from project root", () => {
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
    it("avoids path duplication when module name matches directory name", () => {
      const tree = create_file_tree("/project", [
        "nested/__init__.py",
        "nested/main.py",
        "nested/helper.py",
      ]);

      const result = resolve_module_path_python(
        "helper",
        "/project/nested/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/nested/helper.py");
    });

    it("resolves within a deeply nested package structure", () => {
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

    it("searches parent directories for a standalone script import", () => {
      const tree = create_file_tree("/project", ["scripts/run.py", "lib.py"]);

      const result = resolve_module_path_python(
        "lib",
        "/project/scripts/run.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/lib.py");
    });

    it("returns the constructed .py path when an absolute import is unresolvable", () => {
      const tree = create_file_tree("/project", ["main.py"]);

      const result = resolve_module_path_python(
        "missing",
        "/project/main.py" as FilePath,
        tree
      );

      expect(result).toBe("/project/missing.py");
    });
  });

  describe("submodule path resolution", () => {
    it("returns module file when import_name.py exists", () => {
      const tree = create_file_tree("/project", [
        "training/__init__.py",
        "training/pipeline.py",
      ]);

      const result = resolve_submodule_path_python(
        "/project/training/__init__.py" as FilePath,
        "pipeline",
        tree
      );

      expect(result).toBe("/project/training/pipeline.py");
    });

    it("returns __init__.py when import_name/ is a package", () => {
      const tree = create_file_tree("/project", [
        "training/__init__.py",
        "training/pipeline/__init__.py",
        "training/pipeline/runner.py",
      ]);

      const result = resolve_submodule_path_python(
        "/project/training/__init__.py" as FilePath,
        "pipeline",
        tree
      );

      expect(result).toBe("/project/training/pipeline/__init__.py");
    });

    it("returns undefined when no matching file exists", () => {
      const tree = create_file_tree("/project", [
        "training/__init__.py",
        "training/model.py",
      ]);

      const result = resolve_submodule_path_python(
        "/project/training/__init__.py" as FilePath,
        "nonexistent",
        tree
      );

      expect(result).toBeUndefined();
    });

    it("prefers .py file over package __init__.py", () => {
      const tree = create_file_tree("/project", [
        "training/__init__.py",
        "training/pipeline.py",
        "training/pipeline/__init__.py",
      ]);

      const result = resolve_submodule_path_python(
        "/project/training/__init__.py" as FilePath,
        "pipeline",
        tree
      );

      expect(result).toBe("/project/training/pipeline.py");
    });
  });

  describe("monorepo with duplicate module names", () => {
    it("resolves same-named modules based on import location", () => {
      const tree = create_file_tree("/monorepo", [
        ".git/.gitkeep",
        "package_a/weighted_mape.py",
        "package_a/caller.py",
        "package_b/weighted_mape.py",
        "package_b/caller.py",
      ]);

      const result_a = resolve_module_path_python(
        "weighted_mape",
        "/monorepo/package_a/caller.py" as FilePath,
        tree
      );

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

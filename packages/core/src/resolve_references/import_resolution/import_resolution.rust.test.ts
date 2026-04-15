/**
 * Tests for Rust module resolution
 */

import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { resolve_module_path_rust } from "./import_resolution.rust";
import { create_file_tree } from "./import_resolution.test";

describe("resolve_module_path_rust", () => {
  describe("crate:: prefix resolution", () => {
    it("resolves crate::module to module.rs", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/utils.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::utils",
        "/project/src/handlers.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils.rs");
    });

    it("resolves crate::module to module/mod.rs", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/utils/mod.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::utils",
        "/project/src/handlers.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils/mod.rs");
    });

    it("prefers module.rs over module/mod.rs", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/utils.rs",
        "src/utils/mod.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::utils",
        "/project/src/handlers.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils.rs");
    });

    it("resolves crate::module::submod with mod.rs style", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/module/mod.rs",
        "src/module/submod.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::module::submod",
        "/project/src/lib.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/module/submod.rs");
    });

    it("resolves crate::module::submod with module.rs style (Rust 2018+)", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/module.rs",
        "src/module/submod.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::module::submod",
        "/project/src/lib.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/module/submod.rs");
    });

    it("resolves deeply nested crate path with module.rs style", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/a.rs",
        "src/a/b.rs",
        "src/a/b/c.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::a::b::c",
        "/project/src/lib.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/a/b/c.rs");
    });

    it("resolves deeply nested crate path with mod.rs style", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/a/mod.rs",
        "src/a/b/mod.rs",
        "src/a/b/c.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::a::b::c",
        "/project/src/lib.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/a/b/c.rs");
    });

    it("resolves module.rs style when sibling file has same name as submodule", () => {
      // This tests the module.rs navigation fix: when src/a.rs (module.rs style)
      // is an intermediate module and src/b.rs also exists, crate::a::b must
      // resolve to src/a/b.rs, NOT src/b.rs.
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/a.rs",
        "src/a/b.rs",
        "src/b.rs", // decoy - should NOT be matched
      ]);
      const result = resolve_module_path_rust(
        "crate::a::b",
        "/project/src/lib.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/a/b.rs");
    });

    it("resolves mixed module.rs and mod.rs styles", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/a.rs",
        "src/a/b/mod.rs",
        "src/a/b/c.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::a::b::c",
        "/project/src/lib.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/a/b/c.rs");
    });
  });

  describe("super:: prefix resolution", () => {
    it("resolves super::sibling from regular .rs file", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/module/foo.rs",
        "src/module/bar.rs",
      ]);
      const result = resolve_module_path_rust(
        "super::bar",
        "/project/src/module/foo.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/module/bar.rs");
    });

    it("resolves super::module from mod.rs goes to parent directory", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/module/mod.rs",
        "src/sibling.rs",
      ]);
      const result = resolve_module_path_rust(
        "super::sibling",
        "/project/src/module/mod.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/sibling.rs");
    });

    it("resolves super::module::item from regular file", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/module/foo.rs",
        "src/module/bar/mod.rs",
        "src/module/bar/baz.rs",
      ]);
      const result = resolve_module_path_rust(
        "super::bar::baz",
        "/project/src/module/foo.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/module/bar/baz.rs");
    });
  });

  describe("self:: prefix resolution", () => {
    it("resolves self::submod from mod.rs", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/module/mod.rs",
        "src/module/submod.rs",
      ]);
      const result = resolve_module_path_rust(
        "self::submod",
        "/project/src/module/mod.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/module/submod.rs");
    });

    it("resolves self::sibling from regular file", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/module/foo.rs",
        "src/module/bar.rs",
      ]);
      const result = resolve_module_path_rust(
        "self::bar",
        "/project/src/module/foo.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/module/bar.rs");
    });
  });

  describe("no prefix (local module)", () => {
    it("resolves local module relative to current directory", () => {
      const tree = create_file_tree("/project", [
        "src/main.rs",
        "src/config.rs",
      ]);
      const result = resolve_module_path_rust(
        "config",
        "/project/src/main.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/config.rs");
    });

    it("resolves local module to mod.rs", () => {
      const tree = create_file_tree("/project", [
        "src/main.rs",
        "src/config/mod.rs",
      ]);
      const result = resolve_module_path_rust(
        "config",
        "/project/src/main.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/config/mod.rs");
    });

    it("returns opaque path for external crate", () => {
      const tree = create_file_tree("/project", ["src/main.rs"]);
      const result = resolve_module_path_rust(
        "serde::Deserialize",
        "/project/src/main.rs" as FilePath,
        tree
      );
      expect(result).toBe("serde::Deserialize");
    });
  });

  describe("crate root finding", () => {
    it("finds crate root with lib.rs", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/deep/nested/file.rs",
        "src/utils.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::utils",
        "/project/src/deep/nested/file.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils.rs");
    });

    it("finds crate root with main.rs", () => {
      const tree = create_file_tree("/project", [
        "src/main.rs",
        "src/deep/nested/file.rs",
        "src/utils.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::utils",
        "/project/src/deep/nested/file.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils.rs");
    });

    it("finds crate root via Cargo.toml with src/ directory", () => {
      const tree = create_file_tree("/project", [
        "Cargo.toml",
        "src/lib.rs",
        "src/module/file.rs",
        "src/utils.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::utils",
        "/project/src/module/file.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils.rs");
    });

    it("falls back to importing file directory when no root markers exist", () => {
      const tree = create_file_tree("/project", [
        "orphan/file.rs",
        "orphan/utils.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::utils",
        "/project/orphan/file.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/orphan/utils.rs");
    });
  });

  describe("mod.rs parent semantics", () => {
    it("mod.rs children live in same directory", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/module/mod.rs",
        "src/module/child.rs",
      ]);
      const result = resolve_module_path_rust(
        "self::child",
        "/project/src/module/mod.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/module/child.rs");
    });

    it("mod.rs super goes to grandparent directory", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/a/mod.rs",
        "src/b.rs",
      ]);
      const result = resolve_module_path_rust(
        "super::b",
        "/project/src/a/mod.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/b.rs");
    });
  });

  describe("fallback behavior", () => {
    it("returns inferred path when module not found", () => {
      const tree = create_file_tree("/project", ["src/lib.rs"]);
      const result = resolve_module_path_rust(
        "crate::nonexistent",
        "/project/src/lib.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/nonexistent.rs");
    });

    it("returns inferred nested path when module not found", () => {
      const tree = create_file_tree("/project", ["src/lib.rs"]);
      const result = resolve_module_path_rust(
        "crate::a::b::c",
        "/project/src/lib.rs" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/a/b/c.rs");
    });
  });
});

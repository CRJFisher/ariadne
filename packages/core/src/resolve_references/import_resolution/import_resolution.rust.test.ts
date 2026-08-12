/**
 * Tests for Rust module resolution
 */

import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { resolve_module_path_rust } from "./import_resolution.rust";
import { create_file_tree } from "./import_resolution.test";
import { create_module_resolution_context } from "../import_resolution";

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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/src/module/bar/baz.rs");
    });

    it("resolves super::super::item two levels up from a regular file", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/a/b/foo.rs",
        "src/a/target.rs",
      ]);
      const result = resolve_module_path_rust(
        "super::super::target",
        "/project/src/a/b/foo.rs" as FilePath,
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/src/a/target.rs");
    });

    it("resolves super::super::item from mod.rs climbing past its own directory", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/a/b/mod.rs",
        "src/target.rs",
      ]);
      const result = resolve_module_path_rust(
        "super::super::target",
        "/project/src/a/b/mod.rs" as FilePath,
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/src/target.rs");
    });

    it("resolves super::super::super::item three levels up from a regular file", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/a/b/foo.rs",
        "src/target.rs",
      ]);
      const result = resolve_module_path_rust(
        "super::super::super::target",
        "/project/src/a/b/foo.rs" as FilePath,
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/src/target.rs");
    });

    it("walks a multi-segment tail after a super::super climb", () => {
      const tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/a/foo.rs",
        "src/util/mod.rs",
        "src/util/helper.rs",
      ]);
      const result = resolve_module_path_rust(
        "super::super::util::helper",
        "/project/src/a/foo.rs" as FilePath,
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/src/util/helper.rs");
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/src/config/mod.rs");
    });

    it("resolves nested local module path relative to current directory", () => {
      const tree = create_file_tree("/project", [
        "src/main.rs",
        "src/handlers/mod.rs",
        "src/handlers/auth.rs",
      ]);
      const result = resolve_module_path_rust(
        "handlers::auth",
        "/project/src/main.rs" as FilePath,
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/src/handlers/auth.rs");
    });

    it("returns opaque path for external crate", () => {
      const tree = create_file_tree("/project", ["src/main.rs"]);
      const result = resolve_module_path_rust(
        "serde::Deserialize",
        "/project/src/main.rs" as FilePath,
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/src/utils.rs");
    });

    it("finds crate root via Cargo.toml without a src/ directory", () => {
      const tree = create_file_tree("/project", [
        "Cargo.toml",
        "utils.rs",
        "deep/file.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::utils",
        "/project/deep/file.rs" as FilePath,
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/utils.rs");
    });

    it("falls back to importing file directory when no root markers exist", () => {
      const tree = create_file_tree("/project", [
        "orphan/file.rs",
        "orphan/utils.rs",
      ]);
      const result = resolve_module_path_rust(
        "crate::utils",
        "/project/orphan/file.rs" as FilePath,
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
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
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/src/nonexistent.rs");
    });

    it("returns inferred nested path when module not found", () => {
      const tree = create_file_tree("/project", ["src/lib.rs"]);
      const result = resolve_module_path_rust(
        "crate::a::b::c",
        "/project/src/lib.rs" as FilePath,
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/src/a/b/c.rs");
    });
  });

  describe("2018-style module directories and crate-root items", () => {
    // The measured table: every row, not only the wrong ones.
    const tree = create_file_tree("/project", [
      "Cargo.toml",
      "src/lib.rs",
      "src/config.rs",
      "src/other.rs",
      "src/deep.rs",
      "src/deep/inner.rs",
      "src/deep/config.rs",
    ]);

    it("resolves a bare module from the crate root", () => {
      expect(
        resolve_module_path_rust("config", "/project/src/lib.rs" as FilePath, create_module_resolution_context(tree))
      ).toBe("/project/src/config.rs");
    });

    it("resolves a crate-anchored nested module from the crate root", () => {
      expect(
        resolve_module_path_rust(
          "crate::deep::inner",
          "/project/src/lib.rs" as FilePath,
          create_module_resolution_context(tree)
        )
      ).toBe("/project/src/deep/inner.rs");
    });

    it("resolves a super-anchored sibling from a nested module", () => {
      expect(
        resolve_module_path_rust(
          "super::config",
          "/project/src/deep/inner.rs" as FilePath,
          create_module_resolution_context(tree)
        )
      ).toBe("/project/src/deep/config.rs");
    });

    it("resolves a bare child of a 2018-style module file into its own directory", () => {
      expect(
        resolve_module_path_rust("inner", "/project/src/deep.rs" as FilePath, create_module_resolution_context(tree))
      ).toBe("/project/src/deep/inner.rs");
    });

    it("resolves a self-anchored child of a 2018-style module file into its own directory", () => {
      expect(
        resolve_module_path_rust(
          "self::inner",
          "/project/src/deep.rs" as FilePath,
          create_module_resolution_context(tree)
        )
      ).toBe("/project/src/deep/inner.rs");
    });

    it("resolves a crate-root item to the crate root file, never to a dotfile path", () => {
      const result = resolve_module_path_rust(
        "crate",
        "/project/src/other.rs" as FilePath,
        create_module_resolution_context(tree)
      );
      expect(result).toBe("/project/src/lib.rs");
      expect(result.endsWith("/.rs")).toBe(false);
    });

    it("resolves a self-anchored item to the importing module's own file", () => {
      expect(
        resolve_module_path_rust("self", "/project/src/deep.rs" as FilePath, create_module_resolution_context(tree))
      ).toBe("/project/src/deep.rs");
    });

    it("resolves a super-anchored item to the parent module's own file", () => {
      expect(
        resolve_module_path_rust(
          "super",
          "/project/src/deep/inner.rs" as FilePath,
          create_module_resolution_context(tree)
        )
      ).toBe("/project/src/deep.rs");
    });

    it("resolves a super-anchored item to the parent's mod.rs when that is the layout", () => {
      const mod_tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/deep/mod.rs",
        "src/deep/inner.rs",
      ]);
      expect(
        resolve_module_path_rust(
          "super",
          "/project/src/deep/inner.rs" as FilePath,
          create_module_resolution_context(mod_tree)
        )
      ).toBe("/project/src/deep/mod.rs");
    });

    it("keeps a flat sibling layout resolving when no 2018-style directory exists", () => {
      const flat_tree = create_file_tree("/project", [
        "src/lib.rs",
        "src/deep.rs",
        "src/sibling.rs",
      ]);
      expect(
        resolve_module_path_rust(
          "self::sibling",
          "/project/src/deep.rs" as FilePath,
          create_module_resolution_context(flat_tree)
        )
      ).toBe("/project/src/sibling.rs");
    });

    it("leaves an unmatched leading segment opaque", () => {
      expect(
        resolve_module_path_rust(
          "serde::de",
          "/project/src/deep.rs" as FilePath,
          create_module_resolution_context(tree)
        )
      ).toBe("serde::de");
    });
  });
});

describe("#[path] module declarations", () => {
  it("resolves a file target against the declaring file's own directory", () => {
    const tree = create_file_tree("/project", ["src/sys.rs", "src/unix.rs"]);
    expect(
      resolve_module_path_rust(
        "unix.rs",
        "/project/src/sys.rs" as FilePath,
        create_module_resolution_context(tree)
      )
    ).toBe("/project/src/unix.rs");
  });

  it("resolves a nested file target against the same directory", () => {
    const tree = create_file_tree("/project", ["src/lib.rs", "src/sys/unix.rs"]);
    expect(
      resolve_module_path_rust(
        "sys/unix.rs",
        "/project/src/lib.rs" as FilePath,
        create_module_resolution_context(tree)
      )
    ).toBe("/project/src/sys/unix.rs");
  });

  it("keeps treating a :: path as a module path", () => {
    const tree = create_file_tree("/project", [
      "src/lib.rs",
      "src/a.rs",
      "src/a/b.rs",
    ]);
    expect(
      resolve_module_path_rust(
        "crate::a::b",
        "/project/src/lib.rs" as FilePath,
        create_module_resolution_context(tree)
      )
    ).toBe("/project/src/a/b.rs");
  });
});

describe("every segment of a module path must match", () => {
  it("leaves a foreign path opaque rather than binding its tail to a local module", () => {
    // `std::fs` is not this crate's `fs`. Skipping the unmatched `std` would
    // collapse the path onto `src/fs.rs`, an edge into the crate itself.
    const tree = create_file_tree("/project", ["src/lib.rs", "src/fs.rs"]);
    expect(
      resolve_module_path_rust(
        "std::fs",
        "/project/src/lib.rs" as FilePath,
        create_module_resolution_context(tree)
      )
    ).toBe("std::fs");
  });

  it("still infers a target for an anchored path that matches nothing", () => {
    // An anchored path names a place in this crate, so callers that need a
    // stable dependency target get the inferred one.
    const tree = create_file_tree("/project", ["src/lib.rs"]);
    expect(
      resolve_module_path_rust(
        "crate::missing::deep",
        "/project/src/lib.rs" as FilePath,
        create_module_resolution_context(tree)
      )
    ).toBe("/project/src/missing/deep.rs");
  });
});

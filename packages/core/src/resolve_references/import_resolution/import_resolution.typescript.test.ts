/**
 * Tests for TypeScript module resolution
 */

import { EMPTY_MODULE_SPECIFIER_INDEX } from "../resolution_test_helpers";
import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { resolve_module_path_typescript } from "./import_resolution.typescript";
import { create_file_tree } from "./import_resolution.test";
import { create_module_resolution_context } from "../import_resolution";
import type { ModuleSpecifierIndex } from "./module_specifier_index";

/** A specifier index carrying only the config aliases a test declares. */
function specifier_index(
  config_aliases: Record<string, Record<string, string>>,
  package_roots: Record<string, string> = {}
): ModuleSpecifierIndex {
  return {
    package_roots: new Map(
      Object.entries(package_roots) as [string, FilePath][]
    ),
    config_aliases: new Map(
      Object.entries(config_aliases).map(([directory, aliases]) => [
        directory as FilePath,
        new Map(Object.entries(aliases) as [string, FilePath][]),
      ])
    ),
    crate_roots: new Map(),
  };
}

describe("resolve_module_path_typescript", () => {
  describe("relative imports", () => {
    it("resolves ./import with .ts extension probing", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/utils.ts",
      ]);
      const result = resolve_module_path_typescript(
        "./utils",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/utils.ts");
    });

    it("resolves ../import to parent directory", () => {
      const tree = create_file_tree("/project", [
        "src/components/button.ts",
        "src/utils.ts",
      ]);
      const result = resolve_module_path_typescript(
        "../utils",
        "/project/src/components/button.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/utils.ts");
    });

    it("resolves .tsx extension when .ts does not exist", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/Component.tsx",
      ]);
      const result = resolve_module_path_typescript(
        "./Component",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/Component.tsx");
    });

    it("prefers .ts over .tsx when both exist", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/utils.ts",
        "src/utils.tsx",
      ]);
      const result = resolve_module_path_typescript(
        "./utils",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/utils.ts");
    });

    it("resolves .js file when no .ts/.tsx exists", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/legacy.js",
      ]);
      const result = resolve_module_path_typescript(
        "./legacy",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/legacy.js");
    });

    it("resolves .jsx file when no .ts/.tsx/.js exists", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/Widget.jsx",
      ]);
      const result = resolve_module_path_typescript(
        "./Widget",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/Widget.jsx");
    });

    it("resolves deeply nested relative path", () => {
      const tree = create_file_tree("/project", [
        "src/a/b/c/deep.ts",
        "src/shared/utils.ts",
      ]);
      const result = resolve_module_path_typescript(
        "../../../shared/utils",
        "/project/src/a/b/c/deep.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/shared/utils.ts");
    });
  });

  describe("ESM .js → .ts mapping", () => {
    it("resolves .js import to .ts file", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/utils.ts",
      ]);
      const result = resolve_module_path_typescript(
        "./utils.js",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/utils.ts");
    });

    it("resolves .js import to .tsx file when .ts does not exist", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/Component.tsx",
      ]);
      const result = resolve_module_path_typescript(
        "./Component.js",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/Component.tsx");
    });

    it("resolves .mjs import to .ts file", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/utils.ts",
      ]);
      const result = resolve_module_path_typescript(
        "./utils.mjs",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/utils.ts");
    });

    it("resolves .jsx import to .tsx file", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/Component.tsx",
      ]);
      const result = resolve_module_path_typescript(
        "./Component.jsx",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/Component.tsx");
    });

    it("prefers .ts over .tsx for .js imports", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/utils.ts",
        "src/utils.tsx",
      ]);
      const result = resolve_module_path_typescript(
        "./utils.js",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/utils.ts");
    });

    it("falls back to actual .js file when no .ts equivalent exists", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/utils.js",
      ]);
      const result = resolve_module_path_typescript(
        "./utils.js",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/utils.js");
    });
  });

  describe("index file resolution", () => {
    it("resolves directory to index.ts", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/components/index.ts",
      ]);
      const result = resolve_module_path_typescript(
        "./components",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/components/index.ts");
    });

    it("resolves directory to index.tsx when index.ts does not exist", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/components/index.tsx",
      ]);
      const result = resolve_module_path_typescript(
        "./components",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/components/index.tsx");
    });

    it("resolves directory to index.js when no .ts index exists", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/lib/index.js",
      ]);
      const result = resolve_module_path_typescript(
        "./lib",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/lib/index.js");
    });

    it("prefers index.ts over index.tsx", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/components/index.ts",
        "src/components/index.tsx",
      ]);
      const result = resolve_module_path_typescript(
        "./components",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/components/index.ts");
    });

    it("resolves .js directory import to index.ts via ESM mapping", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/lib/index.ts",
      ]);
      const result = resolve_module_path_typescript(
        "./lib.js",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/lib/index.ts");
    });
  });

  describe("exact path with extension", () => {
    it("resolves import with explicit .ts extension", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/utils.ts",
      ]);
      const result = resolve_module_path_typescript(
        "./utils.ts",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/utils.ts");
    });

    it("resolves import with explicit .tsx extension", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/Component.tsx",
      ]);
      const result = resolve_module_path_typescript(
        "./Component.tsx",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/Component.tsx");
    });

    it("resolves import with explicit .jsx extension to the .jsx file", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/Widget.jsx",
      ]);
      const result = resolve_module_path_typescript(
        "./Widget.jsx",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/Widget.jsx");
    });
  });

  describe("bare imports", () => {
    it("returns bare import path unchanged", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "lodash",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("lodash");
    });

    it("returns scoped package import unchanged", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "@types/node",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("@types/node");
    });

    it("returns package subpath import unchanged", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "lodash/fp",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("lodash/fp");
    });
  });

  describe("tsconfig paths aliases", () => {
    const two_package_tree = () =>
      create_file_tree("/project", [
        "packages/pkg_a/src/app.ts",
        "packages/pkg_a/src/helper.ts",
        "packages/pkg_b/src/app.ts",
        "packages/pkg_b/src/helper.ts",
      ]);

    const two_package_aliases = specifier_index({
      "/project/packages/pkg_a": { "@": "/project/packages/pkg_a/src" },
      "/project/packages/pkg_b": { "@": "/project/packages/pkg_b/src" },
    });

    it("resolves the alias key both packages declare to each one's own src", () => {
      const context = create_module_resolution_context(
        two_package_tree(),
        two_package_aliases
      );

      expect(
        resolve_module_path_typescript(
          "@/helper",
          "/project/packages/pkg_a/src/app.ts" as FilePath,
          context
        )
      ).toBe("/project/packages/pkg_a/src/helper.ts");
      expect(
        resolve_module_path_typescript(
          "@/helper",
          "/project/packages/pkg_b/src/app.ts" as FilePath,
          context
        )
      ).toBe("/project/packages/pkg_b/src/helper.ts");
    });

    it("resolves the alias key both packages declare for a root-relative importing file", () => {
      const context = create_module_resolution_context(
        two_package_tree(),
        two_package_aliases
      );

      expect(
        resolve_module_path_typescript(
          "@/helper",
          "packages/pkg_b/src/app.ts" as FilePath,
          context
        )
      ).toBe("/project/packages/pkg_b/src/helper.ts");
    });

    it("prefers the alias of the nearest config over an ancestor's", () => {
      const tree = create_file_tree("/project", [
        "packages/pkg_a/src/app.ts",
        "packages/pkg_a/lib/thing.ts",
        "shared/thing.ts",
      ]);
      const context = create_module_resolution_context(
        tree,
        specifier_index({
          "/project": { "@lib": "/project/shared" },
          "/project/packages/pkg_a": { "@lib": "/project/packages/pkg_a/lib" },
        })
      );

      expect(
        resolve_module_path_typescript(
          "@lib/thing",
          "/project/packages/pkg_a/src/app.ts" as FilePath,
          context
        )
      ).toBe("/project/packages/pkg_a/lib/thing.ts");
    });

    it("takes an ancestor config's alias when no config nearer the file declares one", () => {
      // pkg_a carries no aliases of its own, so the config above governs it.
      const tree = create_file_tree("/project", [
        "packages/pkg_a/src/app.ts",
        "shared/thing.ts",
      ]);
      const context = create_module_resolution_context(
        tree,
        specifier_index({ "/project": { "@lib": "/project/shared" } })
      );

      expect(
        resolve_module_path_typescript(
          "@lib/thing",
          "/project/packages/pkg_a/src/app.ts" as FilePath,
          context
        )
      ).toBe("/project/shared/thing.ts");
    });

    it("leaves a specifier the governing config does not alias opaque, ignoring an ancestor's", () => {
      // `paths` do not merge across configs: pkg_a declares aliases, so pkg_a is
      // the project that governs app.ts, and `@lib` is not one of its keys —
      // binding it to the root's `shared/` would put a call in another package's
      // tree and leave pkg_a's own definition looking uncalled.
      const tree = create_file_tree("/project", [
        "packages/pkg_a/src/app.ts",
        "shared/thing.ts",
      ]);
      const context = create_module_resolution_context(
        tree,
        specifier_index({
          "/project": { "@lib": "/project/shared" },
          "/project/packages/pkg_a": { "@": "/project/packages/pkg_a/src" },
        })
      );

      expect(
        resolve_module_path_typescript(
          "@lib/thing",
          "/project/packages/pkg_a/src/app.ts" as FilePath,
          context
        )
      ).toBe("@lib/thing");
    });

    it("leaves a specifier that merely starts with an alias key opaque", () => {
      // `@other/…` is a scope of its own, not the `@` alias — and the file the
      // alias would land on exists, so only the key boundary decides.
      const tree = create_file_tree("/project", [
        "packages/pkg_a/src/app.ts",
        "packages/pkg_a/src/other/helper.ts",
      ]);
      const context = create_module_resolution_context(
        tree,
        specifier_index({
          "/project/packages/pkg_a": { "@": "/project/packages/pkg_a/src" },
        })
      );

      expect(
        resolve_module_path_typescript(
          "@other/helper",
          "/project/packages/pkg_a/src/app.ts" as FilePath,
          context
        )
      ).toBe("@other/helper");
    });

    it("resolves a package name declared anywhere in the project", () => {
      const tree = create_file_tree("/project", [
        "packages/pkg_a/src/app.ts",
        "packages/lib/index.ts",
      ]);
      const context = create_module_resolution_context(
        tree,
        specifier_index({}, { "@scope/lib": "/project/packages/lib" })
      );

      expect(
        resolve_module_path_typescript(
          "@scope/lib",
          "/project/packages/pkg_a/src/app.ts" as FilePath,
          context
        )
      ).toBe("/project/packages/lib/index.ts");
    });
  });

  describe("absolute vs relative importing_file path handling", () => {
    it("returns absolute path when importing_file is absolute", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/utils.ts",
      ]);
      const result = resolve_module_path_typescript(
        "./utils",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/utils.ts");
    });

    it("returns relative path when importing_file is relative", () => {
      const tree = create_file_tree("/project", [
        "src/app.ts",
        "src/utils.ts",
      ]);
      const result = resolve_module_path_typescript(
        "./utils",
        "src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("src/utils.ts");
    });
  });

  describe("fallback behavior when file not found in tree", () => {
    it("falls back to .ts when no extension and file not found", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "./nonexistent",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/nonexistent.ts");
    });

    it("falls back to .ts for .js import when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "./nonexistent.js",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/nonexistent.ts");
    });

    it("falls back to .tsx for .jsx import when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "./nonexistent.jsx",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/nonexistent.tsx");
    });

    it("falls back to .ts for .mjs import when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "./nonexistent.mjs",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/nonexistent.ts");
    });

    it("keeps existing .ts extension when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "./nonexistent.ts",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/nonexistent.ts");
    });

    it("keeps existing .tsx extension when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "./nonexistent.tsx",
        "/project/src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("/project/src/nonexistent.tsx");
    });

    it("falls back to a relative path when importing_file is relative", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "./nonexistent",
        "src/app.ts" as FilePath,
        create_module_resolution_context(tree, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      expect(result).toBe("src/nonexistent.ts");
    });
  });
});

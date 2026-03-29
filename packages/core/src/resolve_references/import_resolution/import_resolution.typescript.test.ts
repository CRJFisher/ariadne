/**
 * Tests for TypeScript module resolution
 */

import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { resolve_module_path_typescript } from "./import_resolution.typescript";
import { create_file_tree } from "./import_resolution.test";

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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
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
        tree
      );
      expect(result).toBe("/project/src/Component.tsx");
    });
  });

  describe("bare imports", () => {
    it("returns bare import path unchanged", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "lodash",
        "/project/src/app.ts" as FilePath,
        tree
      );
      expect(result).toBe("lodash");
    });

    it("returns scoped package import unchanged", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "@types/node",
        "/project/src/app.ts" as FilePath,
        tree
      );
      expect(result).toBe("@types/node");
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
        tree
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
        tree
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
        tree
      );
      expect(result).toBe("/project/src/nonexistent.ts");
    });

    it("falls back to .ts for .js import when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "./nonexistent.js",
        "/project/src/app.ts" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/nonexistent.ts");
    });

    it("falls back to .tsx for .jsx import when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "./nonexistent.jsx",
        "/project/src/app.ts" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/nonexistent.tsx");
    });

    it("falls back to .ts for .mjs import when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "./nonexistent.mjs",
        "/project/src/app.ts" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/nonexistent.ts");
    });

    it("keeps existing .ts extension when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.ts"]);
      const result = resolve_module_path_typescript(
        "./nonexistent.ts",
        "/project/src/app.ts" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/nonexistent.ts");
    });
  });
});

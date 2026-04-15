/**
 * Tests for JavaScript module resolution
 */

import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { resolve_module_path_javascript } from "./import_resolution.javascript";
import { create_file_tree } from "./import_resolution.test";

describe("resolve_module_path_javascript", () => {
  describe("relative imports", () => {
    it("resolves ./import with .js extension probing", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/utils.js",
      ]);
      const result = resolve_module_path_javascript(
        "./utils",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils.js");
    });

    it("resolves ../import to parent directory", () => {
      const tree = create_file_tree("/project", [
        "src/components/button.js",
        "src/utils.js",
      ]);
      const result = resolve_module_path_javascript(
        "../utils",
        "/project/src/components/button.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils.js");
    });

    it("resolves .jsx via extension probing", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/Component.jsx",
      ]);
      const result = resolve_module_path_javascript(
        "./Component",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/Component.jsx");
    });

    it("resolves .mjs via extension probing", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/utils.mjs",
      ]);
      const result = resolve_module_path_javascript(
        "./utils",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils.mjs");
    });

    it("resolves .cjs via extension probing", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/config.cjs",
      ]);
      const result = resolve_module_path_javascript(
        "./config",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/config.cjs");
    });

    it("prefers .js over .jsx", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/utils.js",
        "src/utils.jsx",
      ]);
      const result = resolve_module_path_javascript(
        "./utils",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils.js");
    });

    it("prefers .jsx over .mjs", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/Component.jsx",
        "src/Component.mjs",
      ]);
      const result = resolve_module_path_javascript(
        "./Component",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/Component.jsx");
    });

    it("resolves exact path with explicit extension", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/utils.js",
      ]);
      const result = resolve_module_path_javascript(
        "./utils.js",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils.js");
    });

    it("resolves deeply nested relative path", () => {
      const tree = create_file_tree("/project", [
        "src/a/b/c/deep.js",
        "src/shared/utils.js",
      ]);
      const result = resolve_module_path_javascript(
        "../../../shared/utils",
        "/project/src/a/b/c/deep.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/shared/utils.js");
    });
  });

  describe("index file resolution", () => {
    it("resolves directory to index.js", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/lib/index.js",
      ]);
      const result = resolve_module_path_javascript(
        "./lib",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/lib/index.js");
    });

    it("resolves directory to index.jsx when index.js does not exist", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/components/index.jsx",
      ]);
      const result = resolve_module_path_javascript(
        "./components",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/components/index.jsx");
    });

    it("resolves directory to index.mjs", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/lib/index.mjs",
      ]);
      const result = resolve_module_path_javascript(
        "./lib",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/lib/index.mjs");
    });

    it("resolves directory to index.cjs", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/lib/index.cjs",
      ]);
      const result = resolve_module_path_javascript(
        "./lib",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/lib/index.cjs");
    });

    it("prefers index.js over index.jsx", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/lib/index.js",
        "src/lib/index.jsx",
      ]);
      const result = resolve_module_path_javascript(
        "./lib",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/lib/index.js");
    });
  });

  describe("bare imports", () => {
    it("returns bare import path unchanged", () => {
      const tree = create_file_tree("/project", ["src/app.js"]);
      const result = resolve_module_path_javascript(
        "lodash",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("lodash");
    });

    it("returns scoped package import unchanged", () => {
      const tree = create_file_tree("/project", ["src/app.js"]);
      const result = resolve_module_path_javascript(
        "@babel/core",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("@babel/core");
    });
  });

  describe("absolute vs relative importing_file path handling", () => {
    it("returns absolute path when importing_file is absolute", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/utils.js",
      ]);
      const result = resolve_module_path_javascript(
        "./utils",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/utils.js");
    });

    it("returns relative path when importing_file is relative", () => {
      const tree = create_file_tree("/project", [
        "src/app.js",
        "src/utils.js",
      ]);
      const result = resolve_module_path_javascript(
        "./utils",
        "src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("src/utils.js");
    });
  });

  describe("fallback behavior when file not found in tree", () => {
    it("adds .js when file not found and no extension", () => {
      const tree = create_file_tree("/project", ["src/app.js"]);
      const result = resolve_module_path_javascript(
        "./nonexistent",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/nonexistent.js");
    });

    it("keeps .mjs extension when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.js"]);
      const result = resolve_module_path_javascript(
        "./nonexistent.mjs",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/nonexistent.mjs");
    });

    it("keeps .cjs extension when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.js"]);
      const result = resolve_module_path_javascript(
        "./nonexistent.cjs",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/nonexistent.cjs");
    });

    it("keeps .jsx extension when file not found", () => {
      const tree = create_file_tree("/project", ["src/app.js"]);
      const result = resolve_module_path_javascript(
        "./nonexistent.jsx",
        "/project/src/app.js" as FilePath,
        tree
      );
      expect(result).toBe("/project/src/nonexistent.jsx");
    });
  });
});

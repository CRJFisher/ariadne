import { describe, it, expect } from "vitest";
import {
  SUPPORTED_EXTENSIONS,
  IGNORED_DIRECTORIES,
  IGNORED_GLOBS,
  is_supported_file,
  should_ignore_path,
} from "./file_loading";

describe("file_loading", () => {
  describe("SUPPORTED_EXTENSIONS", () => {
    it("should match TypeScript files", () => {
      expect(SUPPORTED_EXTENSIONS.test("file.ts")).toBe(true);
      expect(SUPPORTED_EXTENSIONS.test("file.tsx")).toBe(true);
    });

    it("should match JavaScript files", () => {
      expect(SUPPORTED_EXTENSIONS.test("file.js")).toBe(true);
      expect(SUPPORTED_EXTENSIONS.test("file.jsx")).toBe(true);
    });

    it("should match Python files", () => {
      expect(SUPPORTED_EXTENSIONS.test("file.py")).toBe(true);
    });

    it("should match Rust files", () => {
      expect(SUPPORTED_EXTENSIONS.test("file.rs")).toBe(true);
    });

    it("should match Go files", () => {
      expect(SUPPORTED_EXTENSIONS.test("file.go")).toBe(true);
    });

    it("should match C/C++ files", () => {
      expect(SUPPORTED_EXTENSIONS.test("file.c")).toBe(true);
      expect(SUPPORTED_EXTENSIONS.test("file.cpp")).toBe(true);
      expect(SUPPORTED_EXTENSIONS.test("file.h")).toBe(true);
      expect(SUPPORTED_EXTENSIONS.test("file.hpp")).toBe(true);
    });

    it("should match Java files", () => {
      expect(SUPPORTED_EXTENSIONS.test("file.java")).toBe(true);
    });

    it("should not match unsupported extensions", () => {
      expect(SUPPORTED_EXTENSIONS.test("file.md")).toBe(false);
      expect(SUPPORTED_EXTENSIONS.test("file.json")).toBe(false);
      expect(SUPPORTED_EXTENSIONS.test("file.yaml")).toBe(false);
      expect(SUPPORTED_EXTENSIONS.test("file.txt")).toBe(false);
    });
  });

  describe("IGNORED_DIRECTORIES", () => {
    it("should include common ignored directories", () => {
      expect(IGNORED_DIRECTORIES).toContain("node_modules");
      expect(IGNORED_DIRECTORIES).toContain(".git");
      expect(IGNORED_DIRECTORIES).toContain("dist");
      expect(IGNORED_DIRECTORIES).toContain("build");
      expect(IGNORED_DIRECTORIES).toContain(".next");
      expect(IGNORED_DIRECTORIES).toContain("coverage");
    });
  });

  describe("IGNORED_GLOBS", () => {
    it("should have glob patterns for each ignored directory", () => {
      expect(IGNORED_GLOBS).toContain("**/node_modules/**");
      expect(IGNORED_GLOBS).toContain("**/.git/**");
      expect(IGNORED_GLOBS).toContain("**/dist/**");
    });

    it("should have same length as IGNORED_DIRECTORIES", () => {
      expect(IGNORED_GLOBS.length).toBe(IGNORED_DIRECTORIES.length);
    });
  });

  describe("is_supported_file", () => {
    it("should accept TypeScript files", () => {
      expect(is_supported_file("file.ts")).toBe(true);
      expect(is_supported_file("file.tsx")).toBe(true);
      expect(is_supported_file("src/utils/file.ts")).toBe(true);
    });

    it("should accept JavaScript files", () => {
      expect(is_supported_file("file.js")).toBe(true);
      expect(is_supported_file("file.jsx")).toBe(true);
    });

    it("should accept other supported languages", () => {
      expect(is_supported_file("file.py")).toBe(true);
      expect(is_supported_file("file.rs")).toBe(true);
      expect(is_supported_file("file.go")).toBe(true);
      expect(is_supported_file("file.java")).toBe(true);
    });

    it("should reject .d.ts declaration files", () => {
      expect(is_supported_file("file.d.ts")).toBe(false);
      expect(is_supported_file("types.d.ts")).toBe(false);
      expect(is_supported_file("src/types/index.d.ts")).toBe(false);
    });

    it("should reject unsupported extensions", () => {
      expect(is_supported_file("file.md")).toBe(false);
      expect(is_supported_file("file.json")).toBe(false);
      expect(is_supported_file("file.yaml")).toBe(false);
      expect(is_supported_file("package.json")).toBe(false);
    });
  });

  describe("should_ignore_path", () => {
    it("should ignore node_modules paths", () => {
      expect(should_ignore_path("node_modules/lodash/index.js")).toBe(true);
      expect(should_ignore_path("src/node_modules/pkg/file.ts")).toBe(true);
    });

    it("should ignore .git paths", () => {
      expect(should_ignore_path(".git/config")).toBe(true);
      expect(should_ignore_path(".git/objects/abc123")).toBe(true);
    });

    it("should ignore dist and build paths", () => {
      expect(should_ignore_path("dist/index.js")).toBe(true);
      expect(should_ignore_path("build/output.js")).toBe(true);
    });

    it("should ignore coverage paths", () => {
      expect(should_ignore_path("coverage/lcov.info")).toBe(true);
      expect(should_ignore_path(".nyc_output/data.json")).toBe(true);
    });

    it("should ignore .DS_Store", () => {
      expect(should_ignore_path(".DS_Store")).toBe(true);
      expect(should_ignore_path("src/.DS_Store")).toBe(true);
    });

    it("should not ignore regular source paths", () => {
      expect(should_ignore_path("src/index.ts")).toBe(false);
      expect(should_ignore_path("lib/utils.js")).toBe(false);
      expect(should_ignore_path("packages/core/src/main.ts")).toBe(false);
    });

    it("should respect gitignore patterns with prefix wildcards", () => {
      // The simple gitignore implementation supports trailing wildcards (prefix*)
      const gitignore_patterns = ["temp*", "debug*"];
      expect(should_ignore_path("temp_file.txt", gitignore_patterns)).toBe(true);
      expect(should_ignore_path("debug.log", gitignore_patterns)).toBe(true);
      expect(should_ignore_path("other.txt", gitignore_patterns)).toBe(false);
    });

    it("should respect gitignore patterns with exact matches", () => {
      const gitignore_patterns = ["secret.env", "local.config"];
      expect(should_ignore_path("secret.env", gitignore_patterns)).toBe(true);
      // Note: simple implementation also matches in subdirectories
      expect(should_ignore_path("src/secret.env", gitignore_patterns)).toBe(true);
    });

    it("should respect gitignore patterns with path patterns", () => {
      const gitignore_patterns = ["logs"];
      // Simple implementation matches if path includes the pattern
      expect(should_ignore_path("src/logs/app.log", gitignore_patterns)).toBe(true);
    });
  });
});

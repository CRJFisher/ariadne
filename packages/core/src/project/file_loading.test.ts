import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import {
  SUPPORTED_EXTENSIONS,
  IGNORED_DIRECTORIES,
  IGNORED_GLOBS,
  is_supported_file,
  should_ignore_path,
  find_source_files,
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

  describe("find_source_files", () => {
    let temp_dir: string;

    beforeEach(async () => {
      temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "ariadne-loading-test-"));
    });

    afterEach(async () => {
      try {
        await fs.rm(temp_dir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should find source files recursively", async () => {
      const sub_dir = path.join(temp_dir, "src");
      await fs.mkdir(sub_dir);
      await fs.writeFile(path.join(temp_dir, "root.ts"), "const x = 1;");
      await fs.writeFile(path.join(sub_dir, "nested.py"), "x = 1");

      const files = await find_source_files(temp_dir, temp_dir);

      expect(files.sort()).toEqual(
        [path.join(sub_dir, "nested.py"), path.join(temp_dir, "root.ts")].sort()
      );
    });

    it("should handle symlink cycles without infinite recursion", async () => {
      // Create: temp_dir/subdir/link -> temp_dir (cycle)
      const sub_dir = path.join(temp_dir, "subdir");
      await fs.mkdir(sub_dir);
      await fs.writeFile(path.join(sub_dir, "file.ts"), "const x = 1;");
      await fs.symlink(temp_dir, path.join(sub_dir, "parent_link"));

      const files = await find_source_files(temp_dir, temp_dir);

      // Should find the file exactly once, not loop infinitely
      expect(files).toEqual([path.join(sub_dir, "file.ts")]);
    });

    it("should handle nested symlink cycles without infinite recursion", async () => {
      // Create: temp_dir/a/b/link -> temp_dir/a (cycle)
      const dir_a = path.join(temp_dir, "a");
      const dir_b = path.join(dir_a, "b");
      await fs.mkdir(dir_a);
      await fs.mkdir(dir_b);
      await fs.writeFile(path.join(dir_a, "file_a.ts"), "const a = 1;");
      await fs.writeFile(path.join(dir_b, "file_b.ts"), "const b = 1;");
      await fs.symlink(dir_a, path.join(dir_b, "cycle_link"));

      const files = await find_source_files(temp_dir, temp_dir);

      expect(files.sort()).toEqual(
        [path.join(dir_a, "file_a.ts"), path.join(dir_b, "file_b.ts")].sort()
      );
    });
  });
});

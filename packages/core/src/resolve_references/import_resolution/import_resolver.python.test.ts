/**
 * Tests for Python module resolution
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { resolve_module_path_python } from "./import_resolver.python";
import type { FilePath } from "@ariadnejs/types";

// Temporary test directory
const TEST_DIR = path.join(process.cwd(), ".test-py-modules");

beforeEach(() => {
  // Create test directory structure
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterEach(() => {
  // Clean up test directory
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("resolve_module_path_python", () => {
  it("should resolve relative import from same directory", () => {
    const utils_file = path.join(TEST_DIR, "utils.py");
    fs.writeFileSync(utils_file, "def helper(): pass");

    const main_file = path.join(TEST_DIR, "main.py") as FilePath;

    const result = resolve_module_path_python(".utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve relative import from parent directory", () => {
    const utils_file = path.join(TEST_DIR, "utils.py");
    fs.writeFileSync(utils_file, "def helper(): pass");

    const sub_dir = path.join(TEST_DIR, "sub");
    fs.mkdirSync(sub_dir);
    const main_file = path.join(sub_dir, "main.py") as FilePath;

    const result = resolve_module_path_python("..utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve multi-level relative imports", () => {
    const utils_file = path.join(TEST_DIR, "utils.py");
    fs.writeFileSync(utils_file, "def helper(): pass");

    const deep_dir = path.join(TEST_DIR, "sub1", "sub2");
    fs.mkdirSync(deep_dir, { recursive: true });
    const main_file = path.join(deep_dir, "main.py") as FilePath;

    const result = resolve_module_path_python("...utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve relative import with module path", () => {
    const helpers_dir = path.join(TEST_DIR, "helpers");
    fs.mkdirSync(helpers_dir);
    const utils_file = path.join(helpers_dir, "utils.py");
    fs.writeFileSync(utils_file, "def helper(): pass");

    const main_file = path.join(TEST_DIR, "main.py") as FilePath;

    const result = resolve_module_path_python(".helpers.utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve package imports with __init__.py", () => {
    const package_dir = path.join(TEST_DIR, "mypackage");
    fs.mkdirSync(package_dir);
    const init_file = path.join(package_dir, "__init__.py");
    fs.writeFileSync(init_file, "");

    const main_file = path.join(TEST_DIR, "main.py") as FilePath;

    const result = resolve_module_path_python(".mypackage", main_file);

    expect(result).toBe(init_file);
  });

  it("should resolve absolute imports from project root", () => {
    // Create package structure
    const src_dir = path.join(TEST_DIR, "src");
    fs.mkdirSync(src_dir);
    fs.writeFileSync(path.join(src_dir, "__init__.py"), "");

    const utils_file = path.join(src_dir, "utils.py");
    fs.writeFileSync(utils_file, "def helper(): pass");

    // File inside the package
    const main_file = path.join(src_dir, "main.py") as FilePath;

    const result = resolve_module_path_python("src.utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve nested absolute imports", () => {
    // Create nested package structure
    const src_dir = path.join(TEST_DIR, "src");
    fs.mkdirSync(src_dir);
    fs.writeFileSync(path.join(src_dir, "__init__.py"), "");

    const helpers_dir = path.join(src_dir, "helpers");
    fs.mkdirSync(helpers_dir);
    fs.writeFileSync(path.join(helpers_dir, "__init__.py"), "");

    const utils_file = path.join(helpers_dir, "utils.py");
    fs.writeFileSync(utils_file, "def helper(): pass");

    const main_file = path.join(src_dir, "main.py") as FilePath;

    const result = resolve_module_path_python("src.helpers.utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve absolute package imports", () => {
    const src_dir = path.join(TEST_DIR, "src");
    fs.mkdirSync(src_dir);
    fs.writeFileSync(path.join(src_dir, "__init__.py"), "");

    const helpers_dir = path.join(src_dir, "helpers");
    fs.mkdirSync(helpers_dir);
    const init_file = path.join(helpers_dir, "__init__.py");
    fs.writeFileSync(init_file, "");

    const main_file = path.join(src_dir, "main.py") as FilePath;

    const result = resolve_module_path_python("src.helpers", main_file);

    expect(result).toBe(init_file);
  });

  it("should prioritize .py files over packages", () => {
    const utils_file = path.join(TEST_DIR, "utils.py");
    fs.writeFileSync(utils_file, "def helper(): pass");

    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    fs.writeFileSync(path.join(utils_dir, "__init__.py"), "");

    const main_file = path.join(TEST_DIR, "main.py") as FilePath;

    const result = resolve_module_path_python(".utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should return .py path for non-existent modules", () => {
    const main_file = path.join(TEST_DIR, "main.py") as FilePath;
    const expected = path.join(TEST_DIR, "nonexistent.py");

    const result = resolve_module_path_python(".nonexistent", main_file);

    expect(result).toBe(expected);
  });

  it("should handle complex relative imports", () => {
    const package_dir = path.join(TEST_DIR, "mypackage");
    fs.mkdirSync(package_dir);
    fs.writeFileSync(path.join(package_dir, "__init__.py"), "");

    const sub_dir = path.join(package_dir, "sub");
    fs.mkdirSync(sub_dir);
    fs.writeFileSync(path.join(sub_dir, "__init__.py"), "");

    const utils_file = path.join(package_dir, "utils.py");
    fs.writeFileSync(utils_file, "def helper(): pass");

    const main_file = path.join(sub_dir, "main.py") as FilePath;

    const result = resolve_module_path_python("..utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should find project root correctly", () => {
    // Create multi-level package
    const root_dir = path.join(TEST_DIR, "project");
    fs.mkdirSync(root_dir);
    fs.writeFileSync(path.join(root_dir, "__init__.py"), "");

    const src_dir = path.join(root_dir, "src");
    fs.mkdirSync(src_dir);
    fs.writeFileSync(path.join(src_dir, "__init__.py"), "");

    const utils_file = path.join(root_dir, "utils.py");
    fs.writeFileSync(utils_file, "def helper(): pass");

    const main_file = path.join(src_dir, "main.py") as FilePath;

    const result = resolve_module_path_python("project.utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should handle single dot imports correctly", () => {
    const sibling_file = path.join(TEST_DIR, "sibling.py");
    fs.writeFileSync(sibling_file, "def helper(): pass");

    const main_file = path.join(TEST_DIR, "main.py") as FilePath;

    const result = resolve_module_path_python(".sibling", main_file);

    expect(result).toBe(sibling_file);
  });
});

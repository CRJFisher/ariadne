/**
 * Tests for JavaScript module resolution
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { resolve_module_path_javascript } from "./import_resolver.javascript";
import type { FilePath } from "@ariadnejs/types";

// Temporary test directory
const TEST_DIR = path.join(process.cwd(), ".test-js-modules");

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

describe("resolve_module_path_javascript", () => {
  it("should resolve relative import with explicit .js extension", () => {
    const utils_file = path.join(TEST_DIR, "utils.js");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils.js", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve relative import without extension (tries .js)", () => {
    const utils_file = path.join(TEST_DIR, "utils.js");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve .mjs files", () => {
    const utils_file = path.join(TEST_DIR, "utils.mjs");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve .cjs files", () => {
    const utils_file = path.join(TEST_DIR, "utils.cjs");
    fs.writeFileSync(utils_file, "module.exports = {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve index.js in directories", () => {
    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    const index_file = path.join(utils_dir, "index.js");
    fs.writeFileSync(index_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(index_file);
  });

  it("should resolve index.mjs in directories", () => {
    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    const index_file = path.join(utils_dir, "index.mjs");
    fs.writeFileSync(index_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(index_file);
  });

  it("should resolve parent directory imports", () => {
    const utils_file = path.join(TEST_DIR, "utils.js");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const sub_dir = path.join(TEST_DIR, "sub");
    fs.mkdirSync(sub_dir);
    const main_file = path.join(sub_dir, "main.js") as FilePath;

    const result = resolve_module_path_javascript("../utils.js", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve nested relative imports", () => {
    const helpers_dir = path.join(TEST_DIR, "helpers");
    fs.mkdirSync(helpers_dir);
    const utils_file = path.join(helpers_dir, "utils.js");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./helpers/utils.js", main_file);

    expect(result).toBe(utils_file);
  });

  it("should return resolved path for non-existent files", () => {
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const expected = path.join(TEST_DIR, "nonexistent");

    const result = resolve_module_path_javascript("./nonexistent", main_file);

    expect(result).toBe(expected);
  });

  it("should prioritize exact match over extensions", () => {
    // Create a file named 'utils' (no extension)
    const utils_no_ext = path.join(TEST_DIR, "utils");
    fs.writeFileSync(utils_no_ext, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(utils_no_ext);
  });

  it("should return bare imports as-is (node_modules not implemented)", () => {
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("lodash", main_file);

    expect(result).toBe("lodash");
  });

  it("should prioritize .js over .mjs and .cjs", () => {
    const utils_js = path.join(TEST_DIR, "utils.js");
    const utils_mjs = path.join(TEST_DIR, "utils.mjs");

    fs.writeFileSync(utils_js, "export function helper() {}");
    fs.writeFileSync(utils_mjs, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(utils_js);
  });
});

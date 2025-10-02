/**
 * Tests for Rust module resolution
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { resolve_module_path_rust } from "./import_resolver.rust";
import type { FilePath } from "@ariadnejs/types";

// Temporary test directory
const TEST_DIR = path.join(process.cwd(), ".test-rust-modules");

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

describe("resolve_module_path_rust", () => {
  it("should resolve crate-relative path with lib.rs", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve crate-relative path with Cargo.toml and src/", () => {
    const cargo_file = path.join(TEST_DIR, "Cargo.toml");
    fs.writeFileSync(cargo_file, "[package]\nname = \"test\"");

    const src_dir = path.join(TEST_DIR, "src");
    fs.mkdirSync(src_dir);

    const lib_file = path.join(src_dir, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_file = path.join(src_dir, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = path.join(src_dir, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve super-relative path", () => {
    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const sub_dir = path.join(TEST_DIR, "sub");
    fs.mkdirSync(sub_dir);
    const main_file = path.join(sub_dir, "mod.rs") as FilePath;

    const result = resolve_module_path_rust("super::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve self-relative path", () => {
    const module_dir = path.join(TEST_DIR, "mymod");
    fs.mkdirSync(module_dir);

    const utils_file = path.join(module_dir, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = path.join(module_dir, "mod.rs") as FilePath;

    const result = resolve_module_path_rust("self::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve module file (utils.rs)", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve module directory (utils/mod.rs)", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    const mod_file = path.join(utils_dir, "mod.rs");
    fs.writeFileSync(mod_file, "pub fn helper() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(mod_file);
  });

  it("should prioritize module file over module directory", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    const mod_file = path.join(utils_dir, "mod.rs");
    fs.writeFileSync(mod_file, "pub fn other() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve nested modules", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    fs.writeFileSync(path.join(utils_dir, "mod.rs"), "pub mod helpers;");

    const helpers_file = path.join(utils_dir, "helpers.rs");
    fs.writeFileSync(helpers_file, "pub fn helper() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils::helpers", main_file);

    expect(result).toBe(helpers_file);
  });

  it("should resolve deeply nested modules", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod a;");

    const a_dir = path.join(TEST_DIR, "a");
    fs.mkdirSync(a_dir);
    fs.writeFileSync(path.join(a_dir, "mod.rs"), "pub mod b;");

    const b_dir = path.join(a_dir, "b");
    fs.mkdirSync(b_dir);
    fs.writeFileSync(path.join(b_dir, "mod.rs"), "pub mod c;");

    const c_file = path.join(b_dir, "c.rs");
    fs.writeFileSync(c_file, "pub fn helper() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::a::b::c", main_file);

    expect(result).toBe(c_file);
  });

  it("should return external crate paths as-is", () => {
    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("std::collections", main_file);

    expect(result).toBe("std::collections");
  });

  it("should find crate root with main.rs", () => {
    const main_file_path = path.join(TEST_DIR, "main.rs");
    fs.writeFileSync(main_file_path, "pub mod utils;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = main_file_path as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should handle super paths in nested modules", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils; pub mod helpers;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn util() {}");

    const helpers_file = path.join(TEST_DIR, "helpers.rs");
    fs.writeFileSync(helpers_file, "use super::utils;");

    const main_file = helpers_file as FilePath;

    const result = resolve_module_path_rust("super::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should return fallback path for non-existent modules", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "");

    const main_file = lib_file as FilePath;
    const expected = path.join(TEST_DIR, "nonexistent.rs");

    const result = resolve_module_path_rust("crate::nonexistent", main_file);

    expect(result).toBe(expected);
  });

  it("should handle Cargo.toml without src/ directory", () => {
    const cargo_file = path.join(TEST_DIR, "Cargo.toml");
    fs.writeFileSync(cargo_file, "[package]\nname = \"test\"");

    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = lib_file as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });
});

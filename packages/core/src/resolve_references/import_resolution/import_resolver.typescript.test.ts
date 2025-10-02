/**
 * Tests for TypeScript module resolution
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { resolve_module_path_typescript } from "./import_resolver.typescript";
import type { FilePath } from "@ariadnejs/types";

// Temporary test directory
const TEST_DIR = path.join(process.cwd(), ".test-ts-modules");

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

describe("resolve_module_path_typescript", () => {
  it("should resolve relative import with explicit .ts extension", () => {
    const utils_file = path.join(TEST_DIR, "utils.ts");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;

    const result = resolve_module_path_typescript("./utils.ts", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve relative import without extension (tries .ts)", () => {
    const utils_file = path.join(TEST_DIR, "utils.ts");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;

    const result = resolve_module_path_typescript("./utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve .tsx files", () => {
    const component_file = path.join(TEST_DIR, "Component.tsx");
    fs.writeFileSync(component_file, "export function Component() {}");

    const main_file = path.join(TEST_DIR, "main.tsx") as FilePath;

    const result = resolve_module_path_typescript("./Component", main_file);

    expect(result).toBe(component_file);
  });

  it("should resolve .js files in TypeScript projects", () => {
    const utils_file = path.join(TEST_DIR, "utils.js");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;

    const result = resolve_module_path_typescript("./utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve .jsx files in TypeScript projects", () => {
    const component_file = path.join(TEST_DIR, "Component.jsx");
    fs.writeFileSync(component_file, "export function Component() {}");

    const main_file = path.join(TEST_DIR, "main.tsx") as FilePath;

    const result = resolve_module_path_typescript("./Component", main_file);

    expect(result).toBe(component_file);
  });

  it("should prioritize TypeScript extensions over JavaScript", () => {
    const utils_ts = path.join(TEST_DIR, "utils.ts");
    const utils_js = path.join(TEST_DIR, "utils.js");

    fs.writeFileSync(utils_ts, "export function helper() {}");
    fs.writeFileSync(utils_js, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;

    const result = resolve_module_path_typescript("./utils", main_file);

    expect(result).toBe(utils_ts);
  });

  it("should resolve index.ts in directories", () => {
    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    const index_file = path.join(utils_dir, "index.ts");
    fs.writeFileSync(index_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;

    const result = resolve_module_path_typescript("./utils", main_file);

    expect(result).toBe(index_file);
  });

  it("should resolve index.tsx in directories", () => {
    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    const index_file = path.join(utils_dir, "index.tsx");
    fs.writeFileSync(index_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.tsx") as FilePath;

    const result = resolve_module_path_typescript("./utils", main_file);

    expect(result).toBe(index_file);
  });

  it("should resolve index.js in directories when no .ts/.tsx exists", () => {
    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    const index_file = path.join(utils_dir, "index.js");
    fs.writeFileSync(index_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;

    const result = resolve_module_path_typescript("./utils", main_file);

    expect(result).toBe(index_file);
  });

  it("should resolve parent directory imports", () => {
    const utils_file = path.join(TEST_DIR, "utils.ts");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const sub_dir = path.join(TEST_DIR, "sub");
    fs.mkdirSync(sub_dir);
    const main_file = path.join(sub_dir, "main.ts") as FilePath;

    const result = resolve_module_path_typescript("../utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve nested relative imports", () => {
    const helpers_dir = path.join(TEST_DIR, "helpers");
    fs.mkdirSync(helpers_dir);
    const utils_file = path.join(helpers_dir, "utils.ts");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;

    const result = resolve_module_path_typescript("./helpers/utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should return resolved path for non-existent files", () => {
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;
    const expected = path.join(TEST_DIR, "nonexistent");

    const result = resolve_module_path_typescript("./nonexistent", main_file);

    expect(result).toBe(expected);
  });

  it("should return bare imports as-is (node_modules not implemented)", () => {
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;

    const result = resolve_module_path_typescript("react", main_file);

    expect(result).toBe("react");
  });

  it("should prioritize exact match over extensions", () => {
    // Create a file named 'utils' (no extension)
    const utils_no_ext = path.join(TEST_DIR, "utils");
    fs.writeFileSync(utils_no_ext, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;

    const result = resolve_module_path_typescript("./utils", main_file);

    expect(result).toBe(utils_no_ext);
  });

  it("should handle complex nested paths", () => {
    const deep_dir = path.join(TEST_DIR, "src", "components", "ui");
    fs.mkdirSync(deep_dir, { recursive: true });
    const button_file = path.join(deep_dir, "Button.tsx");
    fs.writeFileSync(button_file, "export function Button() {}");

    const main_file = path.join(TEST_DIR, "src", "App.tsx") as FilePath;

    const result = resolve_module_path_typescript("./components/ui/Button", main_file);

    expect(result).toBe(button_file);
  });
});

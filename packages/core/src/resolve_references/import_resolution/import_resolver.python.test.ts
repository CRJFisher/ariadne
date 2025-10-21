/**
 * Tests for Python module resolution
 */

import { describe, it, expect } from "vitest";
import * as path from "path";
import { resolve_module_path_python } from "./import_resolver.python";
import type { FilePath } from "@ariadnejs/types";
import { build_file_tree } from "../file_folders_test_helper";

// Temporary test directory
const TEST_DIR = path.join(process.cwd(), ".test-py-modules");

describe("resolve_module_path_python", () => {
  it("should resolve relative import from same directory", () => {
    const utils_file = path.join(TEST_DIR, "utils.py");
    const main_file = path.join(TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_python(".utils", main_file, root_folder);

    expect(result).toBe(utils_file);
  });

  it("should resolve relative import from parent directory", () => {
    const utils_file = path.join(TEST_DIR, "utils.py");
    const sub_dir = path.join(TEST_DIR, "sub");
    const main_file = path.join(sub_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "..utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should resolve multi-level relative imports", () => {
    const utils_file = path.join(TEST_DIR, "utils.py");
    const deep_dir = path.join(TEST_DIR, "sub1", "sub2");
    const main_file = path.join(deep_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "...utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should resolve relative import with module path", () => {
    const helpers_dir = path.join(TEST_DIR, "helpers");
    const utils_file = path.join(helpers_dir, "utils.py");
    const main_file = path.join(TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      ".helpers.utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should resolve package imports with __init__.py", () => {
    const package_dir = path.join(TEST_DIR, "mypackage");
    const init_file = path.join(package_dir, "__init__.py");
    const main_file = path.join(TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([init_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      ".mypackage",
      main_file,
      root_folder
    );

    expect(result).toBe(init_file);
  });

  it("should resolve absolute imports from project root", () => {
    // Create package structure
    const src_dir = path.join(TEST_DIR, "src");
    const src_init = path.join(src_dir, "__init__.py");
    const utils_file = path.join(src_dir, "utils.py");
    // File inside the package
    const main_file = path.join(src_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([
      src_init as FilePath,
      utils_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python(
      "src.utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should resolve nested absolute imports", () => {
    // Create nested package structure
    const src_dir = path.join(TEST_DIR, "src");
    const src_init = path.join(src_dir, "__init__.py");
    const helpers_dir = path.join(src_dir, "helpers");
    const helpers_init = path.join(helpers_dir, "__init__.py");
    const utils_file = path.join(helpers_dir, "utils.py");
    const main_file = path.join(src_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([
      src_init as FilePath,
      helpers_init as FilePath,
      utils_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python(
      "src.helpers.utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should resolve absolute package imports", () => {
    const src_dir = path.join(TEST_DIR, "src");
    const src_init = path.join(src_dir, "__init__.py");
    const helpers_dir = path.join(src_dir, "helpers");
    const init_file = path.join(helpers_dir, "__init__.py");
    const main_file = path.join(src_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([
      src_init as FilePath,
      init_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python(
      "src.helpers",
      main_file,
      root_folder
    );

    expect(result).toBe(init_file);
  });

  it("should prioritize .py files over packages", () => {
    const utils_file = path.join(TEST_DIR, "utils.py");
    const utils_dir = path.join(TEST_DIR, "utils");
    const utils_init = path.join(utils_dir, "__init__.py");
    const main_file = path.join(TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([
      utils_file as FilePath,
      utils_init as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python(".utils", main_file, root_folder);

    expect(result).toBe(utils_file);
  });

  it("should return .py path for non-existent modules", () => {
    const main_file = path.join(TEST_DIR, "main.py") as FilePath;
    const expected = path.join(TEST_DIR, "nonexistent.py");

    const root_folder = build_file_tree([main_file]);

    const result = resolve_module_path_python(
      ".nonexistent",
      main_file,
      root_folder
    );

    expect(result).toBe(expected);
  });

  it("should handle complex relative imports", () => {
    const package_dir = path.join(TEST_DIR, "mypackage");
    const package_init = path.join(package_dir, "__init__.py");
    const sub_dir = path.join(package_dir, "sub");
    const sub_init = path.join(sub_dir, "__init__.py");
    const utils_file = path.join(package_dir, "utils.py");
    const main_file = path.join(sub_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([
      package_init as FilePath,
      sub_init as FilePath,
      utils_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python(
      "..utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should find project root correctly", () => {
    // Create multi-level package
    const root_dir = path.join(TEST_DIR, "project");
    const root_init = path.join(root_dir, "__init__.py");
    const src_dir = path.join(root_dir, "src");
    const src_init = path.join(src_dir, "__init__.py");
    const utils_file = path.join(root_dir, "utils.py");
    const main_file = path.join(src_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([
      root_init as FilePath,
      src_init as FilePath,
      utils_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python(
      "project.utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should handle single dot imports correctly", () => {
    const sibling_file = path.join(TEST_DIR, "sibling.py");
    const main_file = path.join(TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([sibling_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      ".sibling",
      main_file,
      root_folder
    );

    expect(result).toBe(sibling_file);
  });
});

describe("resolve_module_path_python - bare module imports", () => {
  // Use /tmp/ariadne-test/python/ for realism (matches integration test paths)
  const BARE_TEST_DIR = "/tmp/ariadne-test/python";

  it("should resolve bare import from same directory", () => {
    // Test case: from helper import process
    const helper_file = path.join(BARE_TEST_DIR, "helper.py");
    const main_file = path.join(BARE_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python("helper", main_file, root_folder);

    expect(result).toBe(helper_file);
  });

  it("should resolve nested bare module import", () => {
    // Test case: from utils.helper import process
    const utils_dir = path.join(BARE_TEST_DIR, "utils");
    const helper_file = path.join(utils_dir, "helper.py");
    const main_file = path.join(BARE_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "utils.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should resolve bare import from subdirectory to parent", () => {
    // Test case: file in subdir importing from parent directory
    const helper_file = path.join(BARE_TEST_DIR, "helper.py");
    const sub_dir = path.join(BARE_TEST_DIR, "subdir");
    const main_file = path.join(sub_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python("helper", main_file, root_folder);

    expect(result).toBe(helper_file);
  });

  it("should resolve bare import from deeply nested directory", () => {
    // Test case: file in deep/nested/dir importing from root
    const helper_file = path.join(BARE_TEST_DIR, "helper.py");
    const deep_dir = path.join(BARE_TEST_DIR, "deep", "nested", "dir");
    const main_file = path.join(deep_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python("helper", main_file, root_folder);

    expect(result).toBe(helper_file);
  });

  it("should resolve bare import without any __init__.py files", () => {
    // Test case: bare import in directory structure with NO __init__.py files
    const utils_dir = path.join(BARE_TEST_DIR, "utils");
    const helper_file = path.join(utils_dir, "helper.py");
    const main_file = path.join(BARE_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    // Note: NO __init__.py files created anywhere
    const result = resolve_module_path_python(
      "utils.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should resolve bare package import to __init__.py", () => {
    // Test case: from utils import something
    const utils_dir = path.join(BARE_TEST_DIR, "utils");
    const init_file = path.join(utils_dir, "__init__.py");
    const main_file = path.join(BARE_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([init_file as FilePath, main_file]);

    const result = resolve_module_path_python("utils", main_file, root_folder);

    expect(result).toBe(init_file);
  });

  it("should resolve multi-level bare import", () => {
    // Test case: from a.b.c import something
    const a_dir = path.join(BARE_TEST_DIR, "a");
    const b_dir = path.join(a_dir, "b");
    const c_file = path.join(b_dir, "c.py");
    const main_file = path.join(BARE_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([c_file as FilePath, main_file]);

    const result = resolve_module_path_python("a.b.c", main_file, root_folder);

    expect(result).toBe(c_file);
  });

  it("should resolve bare import with sibling modules", () => {
    // Test case: multiple modules in same directory, import specific one
    const helper_file = path.join(BARE_TEST_DIR, "helper.py");
    const utils_file = path.join(BARE_TEST_DIR, "utils.py");
    const config_file = path.join(BARE_TEST_DIR, "config.py");
    const main_file = path.join(BARE_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([
      helper_file as FilePath,
      utils_file as FilePath,
      config_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python("helper", main_file, root_folder);

    expect(result).toBe(helper_file);
  });

  it("should resolve bare import from nested file to sibling module", () => {
    // Test case: nested/worker.py importing from nested/helper.py
    const nested_dir = path.join(BARE_TEST_DIR, "nested");
    const helper_file = path.join(nested_dir, "helper.py");
    const worker_file = path.join(nested_dir, "worker.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, worker_file]);

    const result = resolve_module_path_python(
      "nested.helper",
      worker_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should resolve bare import with mixed depths", () => {
    // Test case: utils/helpers/processor.py
    const utils_dir = path.join(BARE_TEST_DIR, "utils");
    const helpers_dir = path.join(utils_dir, "helpers");
    const processor_file = path.join(helpers_dir, "processor.py");
    const main_file = path.join(BARE_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([
      processor_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python(
      "utils.helpers.processor",
      main_file,
      root_folder
    );

    expect(result).toBe(processor_file);
  });

  it("should prioritize .py file over package for bare imports", () => {
    // Test case: both utils.py and utils/__init__.py exist
    const utils_file = path.join(BARE_TEST_DIR, "utils.py");
    const utils_dir = path.join(BARE_TEST_DIR, "utils");
    const utils_init = path.join(utils_dir, "__init__.py");
    const main_file = path.join(BARE_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([
      utils_file as FilePath,
      utils_init as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python("utils", main_file, root_folder);

    // Should prefer .py file over package
    expect(result).toBe(utils_file);
  });

  it("should return .py path for non-existent bare imports", () => {
    // Test case: import nonexistent (file doesn't exist)
    const main_file = path.join(BARE_TEST_DIR, "main.py") as FilePath;
    const expected = path.join(BARE_TEST_DIR, "nonexistent.py");

    const root_folder = build_file_tree([main_file]);

    const result = resolve_module_path_python(
      "nonexistent",
      main_file,
      root_folder
    );

    expect(result).toBe(expected);
  });

  it("should resolve bare import from project subdirectory without __init__.py", () => {
    // Test case: realistic scenario - no __init__.py, file in subdirectory
    const src_dir = path.join(BARE_TEST_DIR, "src");
    const helper_file = path.join(src_dir, "helper.py");
    const main_file = path.join(src_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    // Note: NO __init__.py in src/
    const result = resolve_module_path_python(
      "src.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });
});

describe("resolve_module_path_python - comprehensive relative imports", () => {
  // Use /tmp/ariadne-test/python/ for realism
  const REL_TEST_DIR = "/tmp/ariadne-test/python";

  // ===== Single-dot imports =====

  it("should resolve single-dot import to sibling file", () => {
    // Test: from .helper import process
    const helper_file = path.join(REL_TEST_DIR, "helper.py");
    const main_file = path.join(REL_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      ".helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should resolve single-dot import to submodule in same directory", () => {
    // Test: from .utils.helpers import process
    const utils_dir = path.join(REL_TEST_DIR, "utils");
    const helpers_file = path.join(utils_dir, "helpers.py");
    const main_file = path.join(REL_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([helpers_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      ".utils.helpers",
      main_file,
      root_folder
    );

    expect(result).toBe(helpers_file);
  });

  it("should resolve single-dot import from nested file to sibling", () => {
    // Test: pkg/worker.py importing from .helper (pkg/helper.py)
    const pkg_dir = path.join(REL_TEST_DIR, "pkg");
    const helper_file = path.join(pkg_dir, "helper.py");
    const worker_file = path.join(pkg_dir, "worker.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, worker_file]);

    const result = resolve_module_path_python(
      ".helper",
      worker_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should resolve single-dot import to package __init__.py", () => {
    // Test: from .utils import something
    const utils_dir = path.join(REL_TEST_DIR, "utils");
    const init_file = path.join(utils_dir, "__init__.py");
    const main_file = path.join(REL_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([init_file as FilePath, main_file]);

    const result = resolve_module_path_python(".utils", main_file, root_folder);

    expect(result).toBe(init_file);
  });

  // ===== Double-dot imports =====

  it("should resolve double-dot import to parent directory module", () => {
    // Test: pkg/main.py importing from ..helper (helper.py in parent)
    const helper_file = path.join(REL_TEST_DIR, "helper.py") as FilePath;
    const pkg_dir = path.join(REL_TEST_DIR, "pkg");
    const main_file = path.join(pkg_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file, main_file]);

    const result = resolve_module_path_python(
      "..helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should resolve double-dot import to parent's submodule", () => {
    // Test: pkg/main.py importing from ..utils.helper
    const utils_dir = path.join(REL_TEST_DIR, "utils");
    const helper_file = path.join(utils_dir, "helper.py");
    const pkg_dir = path.join(REL_TEST_DIR, "pkg");
    const main_file = path.join(pkg_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "..utils.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should resolve double-dot import from deeply nested file", () => {
    // Test: a/b/c/main.py importing from ..helper (a/b/helper.py)
    const a_dir = path.join(REL_TEST_DIR, "a");
    const b_dir = path.join(a_dir, "b");
    const helper_file = path.join(b_dir, "helper.py") as FilePath;
    const c_dir = path.join(b_dir, "c");
    const main_file = path.join(c_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file, main_file]);

    const result = resolve_module_path_python(
      "..helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  // ===== Triple-dot and deeper imports =====

  it("should resolve triple-dot import to grandparent directory", () => {
    // Test: a/b/c/main.py importing from ...helper (a/helper.py)
    const a_dir = path.join(REL_TEST_DIR, "a");
    const helper_file = path.join(a_dir, "helper.py");
    const b_dir = path.join(a_dir, "b");
    const c_dir = path.join(b_dir, "c");
    const main_file = path.join(c_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "...helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should resolve quadruple-dot import to great-grandparent", () => {
    // Test: a/b/c/d/main.py importing from ....helper (a/helper.py)
    const a_dir = path.join(REL_TEST_DIR, "a");
    const helper_file = path.join(a_dir, "helper.py");
    const deep_dir = path.join(a_dir, "b", "c", "d");
    const main_file = path.join(deep_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "....helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should resolve multi-level relative import with submodules", () => {
    // Test: a/b/c/main.py importing from ...utils.helpers.processor
    const a_dir = path.join(REL_TEST_DIR, "a");
    const utils_dir = path.join(a_dir, "utils");
    const helpers_dir = path.join(utils_dir, "helpers");
    const processor_file = path.join(helpers_dir, "processor.py");
    const deep_dir = path.join(a_dir, "b", "c");
    const main_file = path.join(deep_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([
      processor_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python(
      "...utils.helpers.processor",
      main_file,
      root_folder
    );

    expect(result).toBe(processor_file);
  });

  // ===== Sibling directory imports =====

  it("should resolve import to sibling directory module", () => {
    // Test: pkg1/main.py importing from ..pkg2.helper
    const pkg1_dir = path.join(REL_TEST_DIR, "pkg1");
    const main_file = path.join(pkg1_dir, "main.py") as FilePath;

    const pkg2_dir = path.join(REL_TEST_DIR, "pkg2");
    const helper_file = path.join(pkg2_dir, "helper.py");

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "..pkg2.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should resolve import to sibling's submodule", () => {
    // Test: pkg1/main.py importing from ..pkg2.utils.helper
    const pkg1_dir = path.join(REL_TEST_DIR, "pkg1");
    const main_file = path.join(pkg1_dir, "main.py") as FilePath;

    const pkg2_dir = path.join(REL_TEST_DIR, "pkg2");
    const utils_dir = path.join(pkg2_dir, "utils");
    const helper_file = path.join(utils_dir, "helper.py");

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "..pkg2.utils.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  // ===== Cousin directory imports =====

  it("should resolve import to cousin directory (uncle's child)", () => {
    // Test: a/b/main.py importing from ..c.helper (a/c/helper.py)
    const a_dir = path.join(REL_TEST_DIR, "a");
    const b_dir = path.join(a_dir, "b");
    const main_file = path.join(b_dir, "main.py") as FilePath;

    const c_dir = path.join(a_dir, "c");
    const helper_file = path.join(c_dir, "helper.py");

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "..c.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should resolve import from deep cousin directory", () => {
    // Test: root/pkg1/sub1/main.py importing from ...pkg2.sub2.helper
    const pkg1_dir = path.join(REL_TEST_DIR, "pkg1");
    const sub1_dir = path.join(pkg1_dir, "sub1");
    const main_file = path.join(sub1_dir, "main.py") as FilePath;

    const pkg2_dir = path.join(REL_TEST_DIR, "pkg2");
    const sub2_dir = path.join(pkg2_dir, "sub2");
    const helper_file = path.join(sub2_dir, "helper.py");

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "...pkg2.sub2.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  // ===== Path normalization tests =====

  it("should normalize paths without double slashes", () => {
    // Ensure no // in resolved paths
    const helper_file = path.join(REL_TEST_DIR, "helper.py");
    const main_file = path.join(REL_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      ".helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
    expect(result).not.toMatch(/\/\//);
  });

  it("should use correct path separators for platform", () => {
    // Ensure path uses native separators
    const utils_dir = path.join(REL_TEST_DIR, "utils");
    const helper_file = path.join(utils_dir, "helper.py");
    const pkg_dir = path.join(REL_TEST_DIR, "pkg");
    const main_file = path.join(pkg_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "..utils.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
    // Result should match path.join format (native separators)
    expect(result.split(path.sep).length).toBeGreaterThan(1);
  });

  it("should resolve relative import with trailing dots correctly", () => {
    // Test: ..utils (not ...utils)
    const utils_dir = path.join(REL_TEST_DIR, "utils");
    const init_file = path.join(utils_dir, "__init__.py");
    const pkg_dir = path.join(REL_TEST_DIR, "pkg");
    const main_file = path.join(pkg_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([init_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "..utils",
      main_file,
      root_folder
    );

    expect(result).toBe(init_file);
  });

  // ===== Complex multi-level relative imports =====

  it("should resolve complex relative path with multiple segments", () => {
    // Test: pkg/sub/main.py importing from ...lib.utils.helpers.processor
    const lib_dir = path.join(REL_TEST_DIR, "lib");
    const utils_dir = path.join(lib_dir, "utils");
    const helpers_dir = path.join(utils_dir, "helpers");
    const processor_file = path.join(helpers_dir, "processor.py");
    const pkg_dir = path.join(REL_TEST_DIR, "pkg");
    const sub_dir = path.join(pkg_dir, "sub");
    const main_file = path.join(sub_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([
      processor_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python(
      "...lib.utils.helpers.processor",
      main_file,
      root_folder
    );

    expect(result).toBe(processor_file);
  });

  it("should resolve relative import without __init__.py files", () => {
    // Test: relative imports work even without __init__.py
    const utils_dir = path.join(REL_TEST_DIR, "utils");
    const helper_file = path.join(utils_dir, "helper.py");
    const pkg_dir = path.join(REL_TEST_DIR, "pkg");
    const main_file = path.join(pkg_dir, "main.py") as FilePath;

    // No __init__.py files anywhere

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "..utils.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should prioritize .py file over package in relative imports", () => {
    // Test: .utils when both utils.py and utils/__init__.py exist
    const utils_file = path.join(REL_TEST_DIR, "utils.py");
    const utils_dir = path.join(REL_TEST_DIR, "utils");
    const main_file = path.join(REL_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_python(".utils", main_file, root_folder);

    expect(result).toBe(utils_file);
  });

  it("should return correct path for non-existent relative imports", () => {
    // Test: .nonexistent returns expected .py path
    const main_file = path.join(REL_TEST_DIR, "main.py") as FilePath;
    const expected = path.join(REL_TEST_DIR, "nonexistent.py");

    const root_folder = build_file_tree([main_file]);

    const result = resolve_module_path_python(
      ".nonexistent",
      main_file,
      root_folder
    );

    expect(result).toBe(expected);
  });

  it("should handle relative import from file in subdirectory to root level module", () => {
    // Test: deep/nested/main.py importing from ...helper (root level)
    const helper_file = path.join(REL_TEST_DIR, "helper.py");
    const deep_dir = path.join(REL_TEST_DIR, "deep", "nested");
    const main_file = path.join(deep_dir, "main.py") as FilePath;

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "...helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });
});

describe("resolve_module_path_python - project root detection", () => {
  // Use /tmp/ariadne-test/python/ for realism
  const ROOT_TEST_DIR = "/tmp/ariadne-test/python";

  // ===== Projects with __init__.py markers =====

  it("should detect project root for single package with __init__.py", () => {
    /**
     * Structure:
     *   /project/
     *     pkg/
     *       __init__.py
     *       main.py
     *       helper.py
     *
     * Expected: Project root = /project/
     * Test: pkg/main.py importing "pkg.helper" should resolve to pkg/helper.py
     */
    const project_dir = path.join(ROOT_TEST_DIR, "project");
    const pkg_dir = path.join(project_dir, "pkg");
    const helper_file = path.join(pkg_dir, "helper.py");
    const main_file = path.join(pkg_dir, "main.py") as FilePath;

    // Bare import "pkg.helper" should resolve from project root

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "pkg.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should detect project root for nested packages", () => {
    /**
     * Structure:
     *   /project/
     *     myapp/
     *       __init__.py
     *       utils/
     *         __init__.py
     *         main.py
     *         helper.py
     *
     * Expected: Project root = /project/ (parent of topmost package)
     * Test: utils/main.py importing "myapp.utils.helper" resolves correctly
     */
    const project_dir = path.join(ROOT_TEST_DIR, "project");
    const myapp_dir = path.join(project_dir, "myapp");
    const utils_dir = path.join(myapp_dir, "utils");
    const helper_file = path.join(utils_dir, "helper.py");
    const main_file = path.join(utils_dir, "main.py") as FilePath;

    // Should resolve from project root (/project/)

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "myapp.utils.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  it("should detect project root stops at topmost __init__.py", () => {
    /**
     * Structure:
     *   /outer/
     *     __init__.py  (this is a package too!)
     *     project/
     *       myapp/
     *         __init__.py
     *         main.py
     *
     * Expected: Project root = /outer/ (walks up to topmost __init__.py)
     * Test: Imports resolve from /outer/, not /outer/project/
     */
    const outer_dir = path.join(ROOT_TEST_DIR, "outer");
    const outer_init = path.join(outer_dir, "__init__.py");
    const project_dir = path.join(outer_dir, "project");
    const project_init = path.join(project_dir, "__init__.py");
    const myapp_dir = path.join(project_dir, "myapp");
    const myapp_init = path.join(myapp_dir, "__init__.py");
    const main_file = path.join(myapp_dir, "main.py") as FilePath;

    // Should resolve "outer" package from /ROOT_TEST_DIR/ (parent of topmost)
    const root_folder = build_file_tree([
      outer_init as FilePath,
      project_init as FilePath,
      myapp_init as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python("outer", main_file, root_folder);

    expect(result).toBe(outer_init);
  });

  it("should handle sibling packages in same project", () => {
    /**
     * Structure:
     *   /project/
     *     pkg1/
     *       __init__.py
     *       main.py
     *     pkg2/
     *       __init__.py
     *       helper.py
     *
     * Expected: Both packages share project root = /project/
     * Test: pkg1/main.py can import "pkg2.helper"
     */
    const project_dir = path.join(ROOT_TEST_DIR, "project");
    const pkg1_dir = path.join(project_dir, "pkg1");
    const pkg2_dir = path.join(project_dir, "pkg2");
    const helper_file = path.join(pkg2_dir, "helper.py");
    const main_file = path.join(pkg1_dir, "main.py") as FilePath;

    // Cross-package import

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "pkg2.helper",
      main_file,
      root_folder
    );

    expect(result).toBe(helper_file);
  });

  // ===== Standalone scripts without __init__.py =====

  it("should use directory as project root for standalone scripts", () => {
    /**
     * Structure:
     *   /scripts/
     *     main.py
     *     helper.py
     *
     * Expected: Project root = /scripts/ (no __init__.py found)
     * Test: main.py importing "helper" resolves to helper.py in same dir
     */
    const scripts_dir = path.join(ROOT_TEST_DIR, "scripts");
    const helper_file = path.join(scripts_dir, "helper.py");
    const main_file = path.join(scripts_dir, "main.py") as FilePath;

    // No __init__.py, so project root = scripts_dir

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python("helper", main_file, root_folder);

    expect(result).toBe(helper_file);
  });

  it("should use file's directory as root for nested standalone scripts", () => {
    /**
     * Structure:
     *   /project/
     *     tools/
     *       scripts/
     *         main.py
     *         helper.py
     *
     * Expected: Project root = /project/tools/scripts/ (no __init__.py anywhere)
     * Test: main.py importing "helper" resolves to same directory
     */
    const project_dir = path.join(ROOT_TEST_DIR, "project");
    const tools_dir = path.join(project_dir, "tools");
    const scripts_dir = path.join(tools_dir, "scripts");
    const helper_file = path.join(scripts_dir, "helper.py");
    const main_file = path.join(scripts_dir, "main.py") as FilePath;

    // No __init__.py anywhere, so root = scripts_dir

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python("helper", main_file, root_folder);

    expect(result).toBe(helper_file);
  });

  it("should handle mixed: package with standalone script outside", () => {
    /**
     * Structure:
     *   /project/
     *     myapp/
     *       __init__.py
     *       core.py
     *     standalone.py
     *     helper.py
     *
     * Expected:
     *   - Files in myapp/ → project root = /project/
     *   - standalone.py → project root = /project/ (same dir, no __init__.py)
     * Test: Both can import from project root
     */
    const project_dir = path.join(ROOT_TEST_DIR, "project");
    const myapp_dir = path.join(project_dir, "myapp");
    const myapp_init = path.join(myapp_dir, "__init__.py");
    const helper_file = path.join(project_dir, "helper.py");
    // Test from inside package
    const core_file = path.join(myapp_dir, "core.py") as FilePath;
    // Test from standalone script
    const standalone_file = path.join(project_dir, "standalone.py") as FilePath;

    const root_folder = build_file_tree([
      myapp_init as FilePath,
      helper_file as FilePath,
      core_file,
      standalone_file,
    ]);

    const result1 = resolve_module_path_python(
      "helper",
      core_file,
      root_folder
    );
    expect(result1).toBe(helper_file);

    const result2 = resolve_module_path_python(
      "helper",
      standalone_file,
      root_folder
    );
    expect(result2).toBe(helper_file);
  });

  // ===== Nested directory structures =====

  it("should handle deeply nested packages", () => {
    /**
     * Structure:
     *   /project/
     *     app/
     *       __init__.py
     *       core/
     *         __init__.py
     *         services/
     *           __init__.py
     *           db/
     *             __init__.py
     *             models.py
     *             main.py
     *
     * Expected: Project root = /project/ (parent of topmost package "app")
     * Test: Deep imports resolve correctly from root
     */
    const project_dir = path.join(ROOT_TEST_DIR, "project");
    const app_dir = path.join(project_dir, "app");
    const app_init = path.join(app_dir, "__init__.py");
    const core_dir = path.join(app_dir, "core");
    const core_init = path.join(core_dir, "__init__.py");
    const services_dir = path.join(core_dir, "services");
    const services_init = path.join(services_dir, "__init__.py");
    const db_dir = path.join(services_dir, "db");
    const db_init = path.join(db_dir, "__init__.py");
    const models_file = path.join(db_dir, "models.py");
    const main_file = path.join(db_dir, "main.py") as FilePath;

    // Import from deeply nested location
    const root_folder = build_file_tree([
      app_init as FilePath,
      core_init as FilePath,
      services_init as FilePath,
      db_init as FilePath,
      models_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python(
      "app.core.services.db.models",
      main_file,
      root_folder
    );

    expect(result).toBe(models_file);
  });

  it("should handle deeply nested standalone scripts", () => {
    /**
     * Structure:
     *   /project/
     *     scripts/
     *       automation/
     *         daily/
     *           main.py
     *           helper.py
     *
     * Expected: Project root = /project/scripts/automation/daily/ (no __init__.py)
     * Test: Imports resolve from deepest directory
     */
    const deep_dir = path.join(
      ROOT_TEST_DIR,
      "project",
      "scripts",
      "automation",
      "daily"
    );
    const helper_file = path.join(deep_dir, "helper.py");
    const main_file = path.join(deep_dir, "main.py") as FilePath;

    // No packages, so root = deep_dir

    const root_folder = build_file_tree([helper_file as FilePath, main_file]);

    const result = resolve_module_path_python("helper", main_file, root_folder);

    expect(result).toBe(helper_file);
  });

  it("should handle partial package hierarchy", () => {
    /**
     * Structure:
     *   /project/
     *     src/
     *       myapp/
     *         __init__.py
     *         utils/
     *           (no __init__.py)
     *           main.py
     *           helper.py
     *
     * Expected: Project root = /project/src/ (parent of "myapp" package)
     * Test: utils/main.py can import both ways
     */
    const project_dir = path.join(ROOT_TEST_DIR, "project");
    const src_dir = path.join(project_dir, "src");
    const myapp_dir = path.join(src_dir, "myapp");
    const myapp_init = path.join(myapp_dir, "__init__.py");
    const utils_dir = path.join(myapp_dir, "utils");
    // NO __init__.py in utils/

    const helper_file = path.join(utils_dir, "helper.py");
    const main_file = path.join(utils_dir, "main.py") as FilePath;

    // Parent "myapp" has __init__.py, so root should be src_dir
    // Import "myapp" package to verify
    const root_folder = build_file_tree([
      myapp_init as FilePath,
      helper_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_python("myapp", main_file, root_folder);

    expect(result).toBe(myapp_init);
  });

  // ===== Edge cases =====

  it("should handle file in temporary directory (no parent packages)", () => {
    /**
     * Structure:
     *   /tmp/test.py
     *
     * Expected: Project root = /tmp/
     * Test: Bare import resolves relative to /tmp/
     */
    const temp_file = path.join(ROOT_TEST_DIR, "test.py") as FilePath;
    const helper_file = path.join(ROOT_TEST_DIR, "helper.py");

    const root_folder = build_file_tree([helper_file as FilePath, temp_file]);

    const result = resolve_module_path_python("helper", temp_file, root_folder);

    expect(result).toBe(helper_file);
  });

  it("should handle non-existent import from project root", () => {
    /**
     * Structure:
     *   /project/
     *     pkg/
     *       __init__.py
     *       main.py
     *
     * Expected: Returns expected path even if file doesn't exist
     * Test: Import "pkg.nonexistent" returns /project/pkg/nonexistent.py
     */
    const project_dir = path.join(ROOT_TEST_DIR, "project");
    const pkg_dir = path.join(project_dir, "pkg");
    const main_file = path.join(pkg_dir, "main.py") as FilePath;

    const expected = path.join(pkg_dir, "nonexistent.py");

    const root_folder = build_file_tree([main_file]);

    const result = resolve_module_path_python(
      "pkg.nonexistent",
      main_file,
      root_folder
    );

    expect(result).toBe(expected);
  });

  it("should handle src layout pattern (common Python project structure)", () => {
    /**
     * Structure:
     *   /project/
     *     src/
     *       mypackage/
     *         __init__.py
     *         module.py
     *         main.py
     *
     * Expected: Project root = /project/src/ (parent of package)
     * Test: Imports resolve from src/ directory
     */
    const project_dir = path.join(ROOT_TEST_DIR, "project");
    const src_dir = path.join(project_dir, "src");
    const pkg_dir = path.join(src_dir, "mypackage");
    const module_file = path.join(pkg_dir, "module.py");
    const main_file = path.join(pkg_dir, "main.py") as FilePath;

    // Should resolve from src/ directory

    const root_folder = build_file_tree([module_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "mypackage.module",
      main_file,
      root_folder
    );

    expect(result).toBe(module_file);
  });

  it("should handle tests directory alongside src", () => {
    /**
     * Structure:
     *   /project/
     *     src/
     *       myapp/
     *         __init__.py
     *         core.py
     *     tests/
     *       test_core.py
     *
     * Expected:
     *   - src/myapp files → project root = /project/src/
     *   - tests/ files → project root = /project/tests/ (no packages)
     * Test: Different roots for different parts of project
     */
    const project_dir = path.join(ROOT_TEST_DIR, "project");
    const src_dir = path.join(project_dir, "src");
    const myapp_dir = path.join(src_dir, "myapp");
    const myapp_init = path.join(myapp_dir, "__init__.py");
    const core_file = path.join(myapp_dir, "core.py");
    const tests_dir = path.join(project_dir, "tests");
    const test_file = path.join(tests_dir, "test_core.py") as FilePath;

    // From src/myapp: import myapp.core
    const main_file = path.join(myapp_dir, "main.py") as FilePath;
    const helper_file = path.join(tests_dir, "helper.py");

    const root_folder1 = build_file_tree([
      myapp_init as FilePath,
      core_file as FilePath,
      main_file,
    ]);

    const result1 = resolve_module_path_python(
      "myapp.core",
      main_file,
      root_folder1
    );
    expect(result1).toBe(core_file);

    // From tests/: no packages, different root
    const root_folder2 = build_file_tree([helper_file as FilePath, test_file]);

    const result2 = resolve_module_path_python(
      "helper",
      test_file,
      root_folder2
    );
    expect(result2).toBe(helper_file);
  });

  it("should handle empty __init__.py vs missing __init__.py", () => {
    /**
     * Behavior: Both empty and missing __init__.py are treated differently
     * - Empty __init__.py → directory is a package
     * - Missing __init__.py → directory is NOT a package
     *
     * Structure:
     *   /project/
     *     with_init/
     *       __init__.py (empty)
     *       main.py
     *     without_init/
     *       main.py
     *
     * Test: Verify different project roots are detected
     */
    const project_dir = path.join(ROOT_TEST_DIR, "project");
    // With __init__.py
    const with_init_dir = path.join(project_dir, "with_init");
    const init_file = path.join(with_init_dir, "__init__.py");
    const main1_file = path.join(with_init_dir, "main.py") as FilePath;

    const root_folder1 = build_file_tree([init_file as FilePath, main1_file]);

    // Import the package itself - should resolve from project_dir
    const result1 = resolve_module_path_python(
      "with_init",
      main1_file,
      root_folder1
    );
    expect(result1).toBe(init_file);

    // Without __init__.py
    const without_init_dir = path.join(project_dir, "without_init");
    const helper_file = path.join(without_init_dir, "helper.py");
    const main2_file = path.join(without_init_dir, "main.py") as FilePath;

    const root_folder2 = build_file_tree([helper_file as FilePath, main2_file]);

    // No package, so root = without_init_dir
    const result2 = resolve_module_path_python(
      "helper",
      main2_file,
      root_folder2
    );
    expect(result2).toBe(helper_file);
  });
});

describe("resolve_module_path_python - body-based scope verification", () => {
  // Use /tmp/ariadne-test/python/ for realism
  const SCOPE_TEST_DIR = "/tmp/ariadne-test/python";

  it("should resolve imports correctly with body-based class scopes", () => {
    /**
     * Verify that import resolution works when classes use body-based scopes
     * (class scope starts after ':', not at 'class' keyword)
     */
    const module_file = path.join(SCOPE_TEST_DIR, "mymodule.py");
    const main_file = path.join(SCOPE_TEST_DIR, "main.py") as FilePath;

    // Import resolution should work regardless of scope structure

    const root_folder = build_file_tree([module_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "mymodule",
      main_file,
      root_folder
    );
    expect(result).toBe(module_file);
  });

  it("should resolve imports from modules with nested classes", () => {
    /**
     * Verify import resolution works with nested classes
     * In body-based scopes:
     * - Outer class name is in module scope
     * - Inner class name is in outer class body scope
     * Import resolution is unaffected because we import the module, not individual classes
     */
    const module_file = path.join(SCOPE_TEST_DIR, "nested.py");
    const main_file = path.join(SCOPE_TEST_DIR, "main.py") as FilePath;

    // Import the module containing nested classes

    const root_folder = build_file_tree([module_file as FilePath, main_file]);

    const result = resolve_module_path_python("nested", main_file, root_folder);
    expect(result).toBe(module_file);
  });

  it("should resolve relative imports with body-based scopes", () => {
    /**
     * Verify relative imports work with body-based class scopes
     * Test: from .utils import MyClass
     */
    const utils_file = path.join(SCOPE_TEST_DIR, "utils.py");
    const main_file = path.join(SCOPE_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_python(".utils", main_file, root_folder);
    expect(result).toBe(utils_file);
  });

  it("should resolve package imports with nested classes in __init__.py", () => {
    /**
     * Verify package imports work when __init__.py contains nested classes
     */
    const pkg_dir = path.join(SCOPE_TEST_DIR, "mypkg");
    const init_file = path.join(pkg_dir, "__init__.py");
    const main_file = path.join(SCOPE_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([init_file as FilePath, main_file]);

    const result = resolve_module_path_python("mypkg", main_file, root_folder);
    expect(result).toBe(init_file);
  });

  it("should resolve cross-directory imports with body-based scopes", () => {
    /**
     * Verify imports between directories work with body-based class scopes
     * Test: services/worker.py importing from ../models/user.py
     */
    const models_dir = path.join(SCOPE_TEST_DIR, "models");
    const user_file = path.join(models_dir, "user.py");
    const services_dir = path.join(SCOPE_TEST_DIR, "services");
    const worker_file = path.join(services_dir, "worker.py") as FilePath;

    // Import from sibling directory

    const root_folder = build_file_tree([user_file as FilePath, worker_file]);

    const result = resolve_module_path_python(
      "..models.user",
      worker_file,
      root_folder
    );
    expect(result).toBe(user_file);
  });

  it("should resolve imports with deeply nested class hierarchies", () => {
    /**
     * Verify import resolution with multiple levels of nested classes
     */
    const module_file = path.join(SCOPE_TEST_DIR, "hierarchy.py");
    const main_file = path.join(SCOPE_TEST_DIR, "main.py") as FilePath;

    const root_folder = build_file_tree([module_file as FilePath, main_file]);

    const result = resolve_module_path_python(
      "hierarchy",
      main_file,
      root_folder
    );
    expect(result).toBe(module_file);
  });
});

/**
 * Tests for import resolution dispatcher + shared test helpers
 */

import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { resolve_module_path } from "./import_resolution";
import type { FileSystemFolder } from "../file_folders";

/**
 * Create a mock FileSystemFolder tree from a list of file paths.
 *
 * @param root_path - The root path of the tree
 * @param files - List of file paths relative to root_path
 * @returns A FileSystemFolder tree
 */
export function create_file_tree(
  root_path: string,
  files: string[]
): FileSystemFolder {
  const root: FileSystemFolder = {
    path: root_path as FilePath,
    folders: new Map(),
    files: new Set(),
  };

  for (const file of files) {
    const relative_path = file.startsWith(root_path)
      ? file.slice(root_path.length + 1)
      : file;

    const parts = relative_path.split("/");
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const folder_name = parts[i];
      let folder = (current.folders as Map<string, FileSystemFolder>).get(
        folder_name
      );
      if (!folder) {
        const folder_path = [root_path, ...parts.slice(0, i + 1)].join("/");
        folder = {
          path: folder_path as FilePath,
          folders: new Map(),
          files: new Set(),
        };
        (current.folders as Map<string, FileSystemFolder>).set(
          folder_name,
          folder
        );
      }
      current = folder;
    }

    const file_name = parts[parts.length - 1];
    (current.files as Set<string>).add(file_name);
  }

  return root;
}

describe("resolve_module_path dispatcher", () => {
  it("dispatches to TypeScript resolver", () => {
    const tree = create_file_tree("/project", ["src/app.ts", "src/utils.ts"]);
    const result = resolve_module_path(
      "./utils",
      "/project/src/app.ts" as FilePath,
      "typescript",
      tree
    );
    expect(result).toBe("/project/src/utils.ts");
  });

  it("dispatches to JavaScript resolver", () => {
    const tree = create_file_tree("/project", ["src/app.js", "src/utils.js"]);
    const result = resolve_module_path(
      "./utils",
      "/project/src/app.js" as FilePath,
      "javascript",
      tree
    );
    expect(result).toBe("/project/src/utils.js");
  });

  it("dispatches to Python resolver", () => {
    const tree = create_file_tree("/project", [
      "pkg/main.py",
      "pkg/utils.py",
    ]);
    const result = resolve_module_path(
      "utils",
      "/project/pkg/main.py" as FilePath,
      "python",
      tree
    );
    expect(result).toBe("/project/pkg/utils.py");
  });

  it("dispatches to Rust resolver", () => {
    const tree = create_file_tree("/project", [
      "src/lib.rs",
      "src/utils.rs",
    ]);
    const result = resolve_module_path(
      "crate::utils",
      "/project/src/lib.rs" as FilePath,
      "rust",
      tree
    );
    expect(result).toBe("/project/src/utils.rs");
  });

  it("throws for unsupported language", () => {
    const tree = create_file_tree("/project", []);
    expect(() =>
      resolve_module_path(
        "./utils",
        "/project/src/app.rb" as FilePath,
        "ruby" as "typescript",
        tree
      )
    ).toThrow("Unsupported language");
  });
});

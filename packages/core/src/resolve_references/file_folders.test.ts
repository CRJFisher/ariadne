import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { has_file_in_tree, type FileSystemFolder } from "./file_folders";

function folder(
  path: string,
  files: string[],
  folders: Record<string, FileSystemFolder> = {}
): FileSystemFolder {
  return {
    path: path as FilePath,
    files: new Set(files),
    folders: new Map(Object.entries(folders)),
  };
}

const TREE: FileSystemFolder = folder("/", ["root.ts"], {
  src: folder("/src", ["utils.ts", "app.ts"], {
    nested: folder("/src/nested", ["helper.ts"], {
      deep: folder("/src/nested/deep", ["leaf.ts"]),
    }),
  }),
});

const EMPTY_TREE: FileSystemFolder = folder("/", []);

describe("has_file_in_tree", () => {
  it("finds a file directly in the root folder", () => {
    expect(has_file_in_tree("/root.ts" as FilePath, TREE)).toBe(true);
  });

  it("finds a file inside a nested folder", () => {
    expect(has_file_in_tree("/src/utils.ts" as FilePath, TREE)).toBe(true);
  });

  it("finds a file inside a deeply nested folder", () => {
    expect(
      has_file_in_tree("/src/nested/deep/leaf.ts" as FilePath, TREE)
    ).toBe(true);
  });

  it("resolves an absolute path against a tree rooted below /", () => {
    const project_tree = folder("/project", [], {
      src: folder("/project/src", ["lib.rs", "utils.rs"]),
    });
    expect(
      has_file_in_tree("/project/src/utils.rs" as FilePath, project_tree)
    ).toBe(true);
  });

  it("resolves a root-relative path against a tree rooted below /", () => {
    const project_tree = folder("/project", [], {
      src: folder("/project/src", ["lib.rs", "utils.rs"]),
    });
    expect(has_file_in_tree("src/utils.rs" as FilePath, project_tree)).toBe(
      true
    );
  });

  it("returns false for an absolute path outside the tree root", () => {
    const project_tree = folder("/project", [], {
      src: folder("/project/src", ["lib.rs"]),
    });
    expect(
      has_file_in_tree("/elsewhere/src/lib.rs" as FilePath, project_tree)
    ).toBe(false);
  });

  it("returns false when an intermediate folder is absent", () => {
    expect(has_file_in_tree("/src/missing/leaf.ts" as FilePath, TREE)).toBe(
      false
    );
  });

  it("returns false when the folder exists but the file does not", () => {
    expect(has_file_in_tree("/src/ghost.ts" as FilePath, TREE)).toBe(false);
  });

  it("returns false when the filename exists only in a different folder", () => {
    expect(has_file_in_tree("/helper.ts" as FilePath, TREE)).toBe(false);
  });

  it("returns false for any path against an empty tree", () => {
    expect(has_file_in_tree("/src/utils.ts" as FilePath, EMPTY_TREE)).toBe(
      false
    );
  });

  it("normalizes '.' segments before walking the tree", () => {
    expect(has_file_in_tree("/src/./utils.ts" as FilePath, TREE)).toBe(true);
  });

  it("normalizes '..' segments before walking the tree", () => {
    expect(
      has_file_in_tree("/src/nested/../utils.ts" as FilePath, TREE)
    ).toBe(true);
  });

  it("collapses duplicate separators", () => {
    expect(has_file_in_tree("/src//utils.ts" as FilePath, TREE)).toBe(true);
  });

  it("tolerates a trailing separator on the path", () => {
    expect(has_file_in_tree("/src/nested/" as FilePath, TREE)).toBe(false);
  });
});

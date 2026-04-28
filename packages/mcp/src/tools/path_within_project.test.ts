import { describe, it, expect } from "vitest";
import path from "path";
import { path_within_project } from "./path_within_project";

describe("path_within_project", () => {
  const root = "/Users/chuck/project";

  it("returns true for the root itself", () => {
    expect(path_within_project(root, root)).toBe(true);
  });

  it("returns true for a descendant absolute path", () => {
    expect(path_within_project("/Users/chuck/project/src/foo.ts", root)).toBe(true);
  });

  it("returns true for a descendant relative path", () => {
    expect(path_within_project("src/foo.ts", root)).toBe(true);
  });

  it("returns true for a deeply nested descendant", () => {
    expect(path_within_project("src/a/b/c/d.ts", root)).toBe(true);
  });

  it("returns false for a sibling absolute path", () => {
    expect(path_within_project("/Users/chuck/other/foo.ts", root)).toBe(false);
  });

  it("returns false for the parent directory", () => {
    expect(path_within_project("/Users/chuck", root)).toBe(false);
  });

  it("returns false for a relative path that escapes via ..", () => {
    expect(path_within_project("../escape", root)).toBe(false);
  });

  it("returns false for a relative path that escapes after entering", () => {
    expect(path_within_project("src/../../escape", root)).toBe(false);
  });

  it("returns false for an absolute path on a completely different tree", () => {
    expect(path_within_project("/tmp/elsewhere", root)).toBe(false);
  });

  it("treats trailing slash on root as equivalent", () => {
    expect(path_within_project("/Users/chuck/project/src/foo.ts", root + "/")).toBe(true);
  });

  it("does not confuse a directory that starts with '..' for an escape", () => {
    expect(path_within_project("..foo/bar.ts", root)).toBe(true);
  });

  it("normalizes mid-path '..' that stays inside the root", () => {
    expect(path_within_project("src/sub/../foo.ts", root)).toBe(true);
  });

  it("returns true for '.' (current directory) relative path", () => {
    expect(path_within_project(".", root)).toBe(true);
  });

  it("works when root is a relative path (resolved against cwd)", () => {
    const abs_cwd_child = path.join(process.cwd(), "src/foo.ts");
    expect(path_within_project(abs_cwd_child, ".")).toBe(true);
  });
});

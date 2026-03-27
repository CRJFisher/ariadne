import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve_cache_dir, slugify_project_path } from "./resolve_cache_dir";
import { homedir } from "os";
import * as path from "path";

describe("slugify_project_path", () => {
  it("produces <basename>-<hash> format", () => {
    const slug = slugify_project_path("/Users/chuck/workspace/ariadne");
    expect(slug).toMatch(/^ariadne-[0-9a-f]{8}$/);
  });

  it("is deterministic", () => {
    const a = slugify_project_path("/some/path");
    const b = slugify_project_path("/some/path");
    expect(a).toEqual(b);
  });

  it("produces different slugs for different paths", () => {
    const a = slugify_project_path("/path/a");
    const b = slugify_project_path("/path/b");
    expect(a).not.toEqual(b);
  });

  it("handles paths with special characters", () => {
    const slug = slugify_project_path("/home/user/my project (v2)");
    expect(slug).toMatch(/^my-project-v2-[0-9a-f]{8}$/);
  });

  it("handles root path", () => {
    const slug = slugify_project_path("/");
    expect(slug).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("resolve_cache_dir", () => {
  const original_env = process.env.ARIADNE_CACHE_DIR;

  afterEach(() => {
    if (original_env === undefined) {
      delete process.env.ARIADNE_CACHE_DIR;
    } else {
      process.env.ARIADNE_CACHE_DIR = original_env;
    }
  });

  it("returns default ~/.ariadne/cache/<slug>/ when no env var", () => {
    delete process.env.ARIADNE_CACHE_DIR;
    const result = resolve_cache_dir("/Users/chuck/workspace/ariadne");
    const slug = slugify_project_path("/Users/chuck/workspace/ariadne");
    expect(result).toEqual(
      path.join(homedir(), ".ariadne", "cache", slug),
    );
  });

  it("uses ARIADNE_CACHE_DIR env var when set to a path", () => {
    process.env.ARIADNE_CACHE_DIR = "/custom/cache";
    expect(resolve_cache_dir("/any/project")).toEqual("/custom/cache");
  });

  it("returns null when ARIADNE_CACHE_DIR is 'off'", () => {
    process.env.ARIADNE_CACHE_DIR = "off";
    expect(resolve_cache_dir("/any/project")).toBeNull();
  });

  it("returns null when ARIADNE_CACHE_DIR is 'none'", () => {
    process.env.ARIADNE_CACHE_DIR = "none";
    expect(resolve_cache_dir("/any/project")).toBeNull();
  });

  it("returns null when ARIADNE_CACHE_DIR is 'false'", () => {
    process.env.ARIADNE_CACHE_DIR = "false";
    expect(resolve_cache_dir("/any/project")).toBeNull();
  });

  it("returns null when ARIADNE_CACHE_DIR is empty string", () => {
    process.env.ARIADNE_CACHE_DIR = "";
    expect(resolve_cache_dir("/any/project")).toBeNull();
  });

  it("resolves relative ARIADNE_CACHE_DIR to absolute", () => {
    process.env.ARIADNE_CACHE_DIR = "relative/path";
    const result = resolve_cache_dir("/any/project");
    expect(path.isAbsolute(result!)).toBe(true);
  });
});

/**
 * Tests for scope_tree module index file
 */

import { describe, it, expect } from "vitest";

describe("Scope Tree Module Index", () => {
  it("should export build_scope_tree function", async () => {
    const module = await import("./index");

    expect(module.build_scope_tree).toBeDefined();
    expect(typeof module.build_scope_tree).toBe("function");
  });

  it("should export find_containing_scope function", async () => {
    const module = await import("./index");

    expect(module.find_containing_scope).toBeDefined();
    expect(typeof module.find_containing_scope).toBe("function");
  });

  it("should re-export from scope_tree module", async () => {
    const indexModule = await import("./index");
    const scopeTreeModule = await import("./scope_tree");

    // Should be the same function references
    expect(indexModule.build_scope_tree).toBe(scopeTreeModule.build_scope_tree);
    expect(indexModule.find_containing_scope).toBe(scopeTreeModule.find_containing_scope);
  });

  it("should only export expected functions", async () => {
    const module = await import("./index");
    const exportedKeys = Object.keys(module);

    expect(exportedKeys).toEqual(["build_scope_tree", "find_containing_scope"]);
  });
});
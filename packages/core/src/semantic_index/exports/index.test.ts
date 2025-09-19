/**
 * Tests for exports module index file
 */

import { describe, it, expect } from "vitest";

describe("Exports Module Index", () => {
  it("should export process_exports function", async () => {
    const module = await import("./index");

    expect(module.process_exports).toBeDefined();
    expect(typeof module.process_exports).toBe("function");
  });

  it("should re-export from exports module", async () => {
    const indexModule = await import("./index");
    const exportsModule = await import("./exports");

    // Should be the same function reference
    expect(indexModule.process_exports).toBe(exportsModule.process_exports);
  });

  it("should only export expected functions", async () => {
    const module = await import("./index");
    const exportedKeys = Object.keys(module);

    expect(exportedKeys).toEqual(["process_exports"]);
  });
});
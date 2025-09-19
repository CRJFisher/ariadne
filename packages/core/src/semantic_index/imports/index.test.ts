/**
 * Tests for imports module index file
 */

import { describe, it, expect } from "vitest";

describe("Imports Module Index", () => {
  it("should export process_imports function", async () => {
    const module = await import("./index");

    expect(module.process_imports).toBeDefined();
    expect(typeof module.process_imports).toBe("function");
  });

  it("should re-export from imports module", async () => {
    const indexModule = await import("./index");
    const importsModule = await import("./imports");

    // Should be the same function reference
    expect(indexModule.process_imports).toBe(importsModule.process_imports);
  });

  it("should only export expected functions", async () => {
    const module = await import("./index");
    const exportedKeys = Object.keys(module);

    expect(exportedKeys).toEqual(["process_imports"]);
  });
});
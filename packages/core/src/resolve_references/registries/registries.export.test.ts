/**
 * Tests for export registry
 */

import { describe, it, expect } from "vitest";
import { ExportRegistry } from "./registries.export";

describe("ExportRegistry", () => {
  it("should be a class", () => {
    expect(typeof ExportRegistry).toBe("function");
    expect(ExportRegistry.prototype.constructor).toBe(ExportRegistry);
  });

  it("should be instantiable", () => {
    const registry = new ExportRegistry();
    expect(registry).toBeInstanceOf(ExportRegistry);
  });
});

/**
 * Tests for symbol definition utilities
 */

import { describe, it, expect } from "vitest";
import { is_reexport, is_exportable } from "./symbol_definitions";

describe("is_reexport", () => {
  it("should return false for definitions without export info", () => {
    const def = {
      symbol_id: "test" as any,
      name: "test" as any,
      location: {} as any,
      scope_id: "test" as any,
    };
    expect(is_reexport(def as any)).toBe(false);
  });

  it("should return false for definitions with is_reexport false", () => {
    const def = {
      symbol_id: "test" as any,
      name: "test" as any,
      location: {} as any,
      scope_id: "test" as any,
      export: { is_exported: true, is_reexport: false },
    };
    expect(is_reexport(def as any)).toBe(false);
  });
});

describe("is_exportable", () => {
  it("should return false for definitions with non-exportable kind", () => {
    const def = {
      kind: "parameter" as const,
      symbol_id: "test" as any,
      name: "test" as any,
      location: {} as any,
      defining_scope_id: "test" as any,
    };
    expect(is_exportable(def as any)).toBe(false);
  });

  it("should return true for definitions with exportable kind", () => {
    const def = {
      kind: "function" as const,
      symbol_id: "test" as any,
      name: "test" as any,
      location: {} as any,
      defining_scope_id: "test" as any,
      is_exported: true,
      signature: { parameters: [] },
    };
    expect(is_exportable(def as any)).toBe(true);
  });
});

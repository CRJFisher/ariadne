/**
 * Tests for fixture helper functions
 */

import { describe, it, expect } from "vitest";
import { load_fixture, load_fixtures } from "./fixture_helpers";

describe("Fixture Helpers", () => {
  it("should load a fixture by relative path", () => {
    const index = load_fixture(
      "typescript/index_single_file/classes/basic_class.json"
    );

    expect(index).toBeDefined();
    expect(index.file_path).toContain("basic_class.ts");
    expect(index.language).toBe("typescript");
    expect(index.classes.size).toBeGreaterThan(0);
  });

  it("should load multiple fixtures", () => {
    const [index1] = load_fixtures(
      "typescript/index_single_file/classes/basic_class.json"
    );

    expect(index1).toBeDefined();
    expect(index1.file_path).toContain("basic_class.ts");
  });

  it("should preserve semantic index structure after loading", () => {
    const index = load_fixture(
      "typescript/index_single_file/classes/basic_class.json"
    );

    // Verify Maps are reconstructed
    expect(index.scopes instanceof Map).toBe(true);
    expect(index.functions instanceof Map).toBe(true);
    expect(index.classes instanceof Map).toBe(true);
    expect(index.variables instanceof Map).toBe(true);
    expect(index.interfaces instanceof Map).toBe(true);
    expect(index.enums instanceof Map).toBe(true);
    expect(index.namespaces instanceof Map).toBe(true);
    expect(index.types instanceof Map).toBe(true);
    expect(index.imported_symbols instanceof Map).toBe(true);

    // Verify references is an array
    expect(Array.isArray(index.references)).toBe(true);
  });
});

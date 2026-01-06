/**
 * Tests for import/export utilities
 */

import { describe, it, expect } from "vitest";
import { create_module_path, create_namespace_name } from "./import_export";

describe("create_module_path", () => {
  it("should create a module path from a string", () => {
    const path = create_module_path("./utils");
    expect(path).toBe("./utils");
  });
});

describe("create_namespace_name", () => {
  it("should create a namespace name from a string", () => {
    const name = create_namespace_name("MyNamespace");
    expect(name).toBe("MyNamespace");
  });
});

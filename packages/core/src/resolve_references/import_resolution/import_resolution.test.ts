/**
 * Tests for import resolution
 */

import { describe, it, expect } from "vitest";
import { resolve_module_path } from "./import_resolution";

describe("resolve_module_path", () => {
  it("should be a function", () => {
    expect(typeof resolve_module_path).toBe("function");
  });
});

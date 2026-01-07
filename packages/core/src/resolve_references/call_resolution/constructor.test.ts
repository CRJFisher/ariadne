/**
 * Tests for constructor call resolution
 */

import { describe, it, expect } from "vitest";
import { resolve_constructor_call } from "./constructor";

describe("resolve_constructor_call", () => {
  it("should be a function", () => {
    expect(typeof resolve_constructor_call).toBe("function");
  });
});

/**
 * Tests for Rust callback detection
 */

import { describe, it, expect } from "vitest";
import { detect_callback_context } from "./symbol_factories.rust_callback";

describe("Rust Callback Detection Exports", () => {
  it("should export detect_callback_context", () => {
    expect(typeof detect_callback_context).toBe("function");
  });
});

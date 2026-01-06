/**
 * Tests for Rust method capture handlers
 */

import { describe, it, expect } from "vitest";
import {
  handle_definition_method,
  handle_definition_method_associated,
  handle_definition_method_default,
  handle_definition_method_async,
  handle_definition_constructor,
} from "./capture_handlers.rust.methods";

describe("Rust Method Handlers Exports", () => {
  it("should export handle_definition_method", () => {
    expect(typeof handle_definition_method).toBe("function");
  });

  it("should export handle_definition_method_associated", () => {
    expect(typeof handle_definition_method_associated).toBe("function");
  });

  it("should export handle_definition_method_default", () => {
    expect(typeof handle_definition_method_default).toBe("function");
  });

  it("should export handle_definition_method_async", () => {
    expect(typeof handle_definition_method_async).toBe("function");
  });

  it("should export handle_definition_constructor", () => {
    expect(typeof handle_definition_constructor).toBe("function");
  });
});

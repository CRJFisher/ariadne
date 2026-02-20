/**
 * Tests for Python import capture handlers
 */

import { describe, it, expect } from "vitest";
import {
  handle_definition_import,
  handle_import_named,
  handle_import_named_source,
  handle_import_named_alias,
  handle_import_module,
  handle_import_module_source,
  handle_import_module_alias,
  handle_import_star,
} from "./imports.python";

describe("Python Import Handlers Exports", () => {
  it("should export handle_definition_import", () => {
    expect(typeof handle_definition_import).toBe("function");
  });

  it("should export handle_import_named", () => {
    expect(typeof handle_import_named).toBe("function");
  });

  it("should export handle_import_named_source", () => {
    expect(typeof handle_import_named_source).toBe("function");
  });

  it("should export handle_import_named_alias", () => {
    expect(typeof handle_import_named_alias).toBe("function");
  });

  it("should export handle_import_module", () => {
    expect(typeof handle_import_module).toBe("function");
  });

  it("should export handle_import_module_source", () => {
    expect(typeof handle_import_module_source).toBe("function");
  });

  it("should export handle_import_module_alias", () => {
    expect(typeof handle_import_module_alias).toBe("function");
  });

  it("should export handle_import_star", () => {
    expect(typeof handle_import_star).toBe("function");
  });
});

describe("No-op Handlers", () => {
  it("handle_import_named_alias should be a no-op", () => {
    // This handler returns immediately as aliases are handled elsewhere
    expect(() => {
      handle_import_named_alias(
        {} as any,
        {} as any,
        {} as any
      );
    }).not.toThrow();
  });

  it("handle_import_module_alias should be a no-op", () => {
    // This handler returns immediately as aliases are handled elsewhere
    expect(() => {
      handle_import_module_alias(
        {} as any,
        {} as any,
        {} as any
      );
    }).not.toThrow();
  });
});

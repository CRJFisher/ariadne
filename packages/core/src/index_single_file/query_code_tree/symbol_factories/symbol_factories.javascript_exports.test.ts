/**
 * Tests for JavaScript export utilities
 */

import { describe, it, expect } from "vitest";
import {
  find_export_specifiers,
  extract_export_specifier_info,
  analyze_export_statement,
  extract_export_info,
} from "./symbol_factories.javascript_exports";

describe("JavaScript Export Utilities Exports", () => {
  it("should export find_export_specifiers", () => {
    expect(typeof find_export_specifiers).toBe("function");
  });

  it("should export extract_export_specifier_info", () => {
    expect(typeof extract_export_specifier_info).toBe("function");
  });

  it("should export analyze_export_statement", () => {
    expect(typeof analyze_export_statement).toBe("function");
  });

  it("should export extract_export_info", () => {
    expect(typeof extract_export_info).toBe("function");
  });
});

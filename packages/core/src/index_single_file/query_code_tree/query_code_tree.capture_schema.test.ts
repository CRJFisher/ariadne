/**
 * Tests for query_code_tree.capture_schema.ts
 */

import { describe, it, expect } from "vitest";
import {
  CANONICAL_CAPTURE_SCHEMA,
  is_valid_capture,
  get_capture_errors,
} from "./query_code_tree.capture_schema";

describe("CANONICAL_CAPTURE_SCHEMA", () => {
  it("should have required captures array", () => {
    expect(Array.isArray(CANONICAL_CAPTURE_SCHEMA.required)).toBe(true);
    expect(CANONICAL_CAPTURE_SCHEMA.required.length).toBeGreaterThan(0);
  });

  it("should have optional captures array", () => {
    expect(Array.isArray(CANONICAL_CAPTURE_SCHEMA.optional)).toBe(true);
    expect(CANONICAL_CAPTURE_SCHEMA.optional.length).toBeGreaterThan(0);
  });

  it("should have rules object with pattern and max_depth", () => {
    expect(CANONICAL_CAPTURE_SCHEMA.rules).toBeDefined();
    expect(CANONICAL_CAPTURE_SCHEMA.rules.pattern).toBeInstanceOf(RegExp);
    expect(typeof CANONICAL_CAPTURE_SCHEMA.rules.max_depth).toBe("number");
  });

  it("should include core scope captures in required", () => {
    const required_patterns = CANONICAL_CAPTURE_SCHEMA.required.map((c) =>
      c.pattern.source
    );
    expect(required_patterns).toContain("^@scope\\.module$");
    expect(required_patterns).toContain("^@scope\\.function$");
    expect(required_patterns).toContain("^@scope\\.class$");
  });

  it("should include core definition captures in required", () => {
    const required_patterns = CANONICAL_CAPTURE_SCHEMA.required.map((c) =>
      c.pattern.source
    );
    expect(required_patterns).toContain("^@definition\\.function$");
    expect(required_patterns).toContain("^@definition\\.class$");
    expect(required_patterns).toContain("^@definition\\.method$");
  });

  it("should include reference.call in required", () => {
    const required_patterns = CANONICAL_CAPTURE_SCHEMA.required.map((c) =>
      c.pattern.source
    );
    expect(required_patterns).toContain("^@reference\\.call$");
  });
});

describe("is_valid_capture", () => {
  describe("Valid Captures", () => {
    it("should return true for required captures", () => {
      expect(is_valid_capture("@scope.module")).toBe(true);
      expect(is_valid_capture("@scope.function")).toBe(true);
      expect(is_valid_capture("@scope.class")).toBe(true);
      expect(is_valid_capture("@definition.function")).toBe(true);
      expect(is_valid_capture("@definition.class")).toBe(true);
      expect(is_valid_capture("@definition.method")).toBe(true);
      expect(is_valid_capture("@reference.call")).toBe(true);
    });

    it("should return true for optional captures", () => {
      expect(is_valid_capture("@definition.interface")).toBe(true);
      expect(is_valid_capture("@definition.enum")).toBe(true);
      expect(is_valid_capture("@definition.trait")).toBe(true);
      expect(is_valid_capture("@reference.constructor")).toBe(true);
    });

    it("should return true for captures with qualifiers", () => {
      expect(is_valid_capture("@reference.variable.base")).toBe(true);
      expect(is_valid_capture("@reference.variable.source")).toBe(true);
      expect(is_valid_capture("@definition.method.async")).toBe(true);
    });
  });

  describe("Invalid Captures", () => {
    it("should return false for non-existent captures", () => {
      expect(is_valid_capture("@invalid.capture")).toBe(false);
      expect(is_valid_capture("@random.thing")).toBe(false);
      expect(is_valid_capture("@foo.bar")).toBe(false);
    });

    it("should return false for malformed captures", () => {
      expect(is_valid_capture("scope.function")).toBe(false); // Missing @
      expect(is_valid_capture("@")).toBe(false);
      expect(is_valid_capture("@scope")).toBe(false); // Missing entity
    });

    it("should return false for captures exceeding max depth", () => {
      expect(is_valid_capture("@a.b.c.d.e")).toBe(false);
    });
  });
});

describe("get_capture_errors", () => {
  describe("Valid Captures", () => {
    it("should return empty array for valid captures", () => {
      expect(get_capture_errors("@scope.module")).toEqual([]);
      expect(get_capture_errors("@definition.function")).toEqual([]);
      expect(get_capture_errors("@reference.call")).toEqual([]);
    });
  });

  describe("Invalid Captures", () => {
    it("should return errors for malformed naming", () => {
      const errors = get_capture_errors("scope.function");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("format");
    });

    it("should return errors for captures not in schema", () => {
      const errors = get_capture_errors("@invalid.capture");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("not in required or optional"))).toBe(
        true
      );
    });

    it("should return errors for excessive depth", () => {
      const errors = get_capture_errors("@a.b.c.d.e");
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("Error Messages", () => {
    it("should provide descriptive error messages", () => {
      const errors = get_capture_errors("@foo.bar");
      expect(errors.length).toBeGreaterThan(0);
      expect(typeof errors[0]).toBe("string");
      expect(errors[0].length).toBeGreaterThan(10);
    });
  });
});

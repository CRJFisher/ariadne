/**
 * Tests for symbol reference type guards.
 */

import { describe, it, expect } from "vitest";
import {
  is_self_reference_call,
  is_method_call,
  is_function_call,
  is_constructor_call,
  is_variable_reference,
  is_property_access,
  is_type_reference,
  is_assignment,
  self_reference_is_bindable,
  self_reference_keyword,
} from "./symbol_references";
import type { Language } from "./location";

describe("self_reference_keyword", () => {
  const HEADS = ["this", "self", "super", "cls", "Self", "toString"] as const;

  function keywords_of(language: Language) {
    return HEADS.map((head) => self_reference_keyword(language, head));
  }

  it("spells a TypeScript or JavaScript self receiver `this` or `super`, never `self`", () => {
    expect([keywords_of("typescript"), keywords_of("javascript")]).toEqual([
      ["this", null, "super", null, null, null],
      ["this", null, "super", null, null, null],
    ]);
  });

  it("spells a Python self receiver `self`, `cls` or `super`", () => {
    expect(keywords_of("python")).toEqual([null, "self", "super", "cls", null, null]);
  });

  it("spells a Rust self receiver `self` only: Rust has no `this`", () => {
    expect(keywords_of("rust")).toEqual([null, "self", null, null, null, null]);
  });
});

describe("self_reference_is_bindable", () => {
  it("lets a scope rebind Python's self-reference words and no other language's", () => {
    const languages: Language[] = ["typescript", "javascript", "python", "rust"];
    expect(languages.map(self_reference_is_bindable)).toEqual([false, false, true, false]);
  });
});

describe("Symbol Reference Type Guards", () => {
  const base_ref = {
    name: "test" as any,
    location: {} as any,
    scope_id: "scope:test" as any,
  };

  describe("is_self_reference_call", () => {
    it("should return true for self reference calls", () => {
      const ref = { ...base_ref, kind: "self_reference_call" as const };
      expect(is_self_reference_call(ref as any)).toBe(true);
    });

    it("should return false for other types", () => {
      const ref = { ...base_ref, kind: "method_call" as const };
      expect(is_self_reference_call(ref as any)).toBe(false);
    });
  });

  describe("is_method_call", () => {
    it("should return true for method calls", () => {
      const ref = { ...base_ref, kind: "method_call" as const };
      expect(is_method_call(ref as any)).toBe(true);
    });

    it("should return false for other types", () => {
      const ref = { ...base_ref, kind: "function_call" as const };
      expect(is_method_call(ref as any)).toBe(false);
    });
  });

  describe("is_function_call", () => {
    it("should return true for function calls", () => {
      const ref = { ...base_ref, kind: "function_call" as const };
      expect(is_function_call(ref as any)).toBe(true);
    });

    it("should return false for other types", () => {
      const ref = { ...base_ref, kind: "method_call" as const };
      expect(is_function_call(ref as any)).toBe(false);
    });
  });

  describe("is_constructor_call", () => {
    it("should return true for constructor calls", () => {
      const ref = { ...base_ref, kind: "constructor_call" as const };
      expect(is_constructor_call(ref as any)).toBe(true);
    });

    it("should return false for other types", () => {
      const ref = { ...base_ref, kind: "function_call" as const };
      expect(is_constructor_call(ref as any)).toBe(false);
    });
  });

  describe("is_variable_reference", () => {
    it("should return true for variable references", () => {
      const ref = { ...base_ref, kind: "variable_reference" as const };
      expect(is_variable_reference(ref as any)).toBe(true);
    });

    it("should return false for other types", () => {
      const ref = { ...base_ref, kind: "function_call" as const };
      expect(is_variable_reference(ref as any)).toBe(false);
    });
  });

  describe("is_property_access", () => {
    it("should return true for property access references", () => {
      const ref = { ...base_ref, kind: "property_access" as const };
      expect(is_property_access(ref as any)).toBe(true);
    });

    it("should return false for other types", () => {
      const ref = { ...base_ref, kind: "variable_reference" as const };
      expect(is_property_access(ref as any)).toBe(false);
    });
  });

  describe("is_type_reference", () => {
    it("should return true for type references", () => {
      const ref = { ...base_ref, kind: "type_reference" as const };
      expect(is_type_reference(ref as any)).toBe(true);
    });

    it("should return false for other types", () => {
      const ref = { ...base_ref, kind: "variable_reference" as const };
      expect(is_type_reference(ref as any)).toBe(false);
    });
  });

  describe("is_assignment", () => {
    it("should return true for assignment references", () => {
      const ref = { ...base_ref, kind: "assignment" as const };
      expect(is_assignment(ref as any)).toBe(true);
    });

    it("should return false for other types", () => {
      const ref = { ...base_ref, kind: "variable_reference" as const };
      expect(is_assignment(ref as any)).toBe(false);
    });
  });
});


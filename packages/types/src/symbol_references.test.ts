/**
 * Tests for symbol reference type guards and Resolution metadata.
 */

import { describe, it, test, expect } from "vitest";
import {
  is_self_reference_call,
  is_method_call,
  is_function_call,
  is_constructor_call,
  is_variable_reference,
  is_property_access,
  is_type_reference,
  is_assignment,
} from "./symbol_references";
import type {
  Resolution,
  ResolutionConfidence,
  ResolutionReason,
} from "./symbol_references";
import type { SymbolId } from "./symbol";

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

describe("Resolution metadata", () => {
  test("Resolution structure", () => {
    const resolution: Resolution = {
      symbol_id: "test_symbol" as SymbolId,
      confidence: "certain",
      reason: { type: "direct" },
    };

    expect(resolution.symbol_id).toBe("test_symbol");
    expect(resolution.confidence).toBe("certain");
    expect(resolution.reason.type).toBe("direct");
  });

  test("ResolutionReason variants", () => {
    const direct: ResolutionReason = { type: "direct" };
    const interface_impl: ResolutionReason = {
      type: "interface_implementation",
      interface_id: "Handler" as SymbolId,
    };
    const collection: ResolutionReason = {
      type: "collection_member",
      collection_id: "CONFIG" as SymbolId,
      access_pattern: "Map.get",
    };
    const heuristic: ResolutionReason = {
      type: "heuristic_match",
      score: 0.85,
    };

    expect(direct.type).toBe("direct");
    expect(interface_impl.type).toBe("interface_implementation");
    expect(collection.type).toBe("collection_member");
    expect(heuristic.type).toBe("heuristic_match");
  });

  test("All confidence levels valid", () => {
    const levels: ResolutionConfidence[] = ["certain", "probable", "possible"];
    expect(levels).toHaveLength(3);
  });
});

describe("ResolutionReason discrimination", () => {
  test("discriminate by type field", () => {
    function analyze_reason(reason: ResolutionReason): string {
      switch (reason.type) {
        case "direct":
          return "Direct resolution";
        case "interface_implementation":
          return `Implements ${reason.interface_id}`;
        case "collection_member":
          return `From collection ${reason.collection_id}`;
        case "heuristic_match":
          return `Score: ${reason.score}`;
      }
    }

    const direct: ResolutionReason = { type: "direct" };
    expect(analyze_reason(direct)).toBe("Direct resolution");

    const interface_impl: ResolutionReason = {
      type: "interface_implementation",
      interface_id: "Handler" as SymbolId,
    };
    expect(analyze_reason(interface_impl)).toBe("Implements Handler");

    const collection: ResolutionReason = {
      type: "collection_member",
      collection_id: "CONFIG" as SymbolId,
    };
    expect(analyze_reason(collection)).toBe("From collection CONFIG");

    const heuristic: ResolutionReason = {
      type: "heuristic_match",
      score: 0.92,
    };
    expect(analyze_reason(heuristic)).toBe("Score: 0.92");
  });

  test("filter by reason type", () => {
    const resolutions: ResolutionReason[] = [
      { type: "direct" },
      { type: "interface_implementation", interface_id: "I" as SymbolId },
      { type: "collection_member", collection_id: "C" as SymbolId },
      { type: "heuristic_match", score: 0.8 },
    ];

    const interface_only = resolutions.filter(
      (r) => r.type === "interface_implementation"
    );
    expect(interface_only).toHaveLength(1);

    const direct_only = resolutions.filter((r) => r.type === "direct");
    expect(direct_only).toHaveLength(1);
  });
});

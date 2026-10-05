/**
 * Tests for Resolution metadata types.
 */

import { describe, test, expect } from "vitest";
import type {
  Resolution,
  ResolutionConfidence,
  ResolutionReason,
} from "./resolution";
import type { SymbolId } from "./symbol";

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

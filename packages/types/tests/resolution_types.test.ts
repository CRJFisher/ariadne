import { describe, test, expect } from "vitest";
import type {
  ResolutionConfidence,
  ResolutionReason,
  Resolution,
  CallReference,
  Location,
  SymbolName,
  ScopeId,
} from "../src";

describe("Resolution types", () => {
  test("Resolution structure", () => {
    const resolution: Resolution = {
      symbol_id: "test_symbol" as any,
      confidence: "certain",
      reason: { type: "direct" },
    };

    expect(resolution.symbol_id).toBeDefined();
    expect(resolution.confidence).toBe("certain");
    expect(resolution.reason.type).toBe("direct");
  });

  test("ResolutionReason variants", () => {
    const direct: ResolutionReason = { type: "direct" };
    const interface_impl: ResolutionReason = {
      type: "interface_implementation",
      interface_id: "Handler" as any,
    };
    const collection: ResolutionReason = {
      type: "collection_member",
      collection_id: "CONFIG" as any,
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

  test("CallReference with empty resolutions (failed)", () => {
    const call: CallReference = {
      location: { file_path: "test.ts" as any, start_line: 5, end_line: 5 } as Location,
      name: "unknownFunc" as SymbolName,
      scope_id: "scope_1" as ScopeId,
      call_type: "function",
      resolutions: [],
    };

    expect(call.resolutions).toHaveLength(0);
  });

  test("CallReference with single resolution", () => {
    const call: CallReference = {
      location: { file_path: "test.ts" as any, start_line: 10, end_line: 10 } as Location,
      name: "getName" as SymbolName,
      scope_id: "scope_2" as ScopeId,
      call_type: "method",
      resolutions: [
        {
          symbol_id: "User.getName" as any,
          confidence: "certain",
          reason: { type: "direct" },
        },
      ],
    };

    expect(call.resolutions).toHaveLength(1);
    expect(call.resolutions[0].symbol_id).toBe("User.getName");
  });

  test("CallReference with multiple resolutions (polymorphic)", () => {
    const call: CallReference = {
      location: { file_path: "test.ts" as any, start_line: 15, end_line: 15 } as Location,
      name: "handle" as SymbolName,
      scope_id: "scope_3" as ScopeId,
      call_type: "method",
      resolutions: [
        {
          symbol_id: "HandlerA.handle" as any,
          confidence: "certain",
          reason: {
            type: "interface_implementation",
            interface_id: "Handler" as any,
          },
        },
        {
          symbol_id: "HandlerB.handle" as any,
          confidence: "certain",
          reason: {
            type: "interface_implementation",
            interface_id: "Handler" as any,
          },
        },
      ],
    };

    expect(call.resolutions).toHaveLength(2);
    expect(call.resolutions.every((r) => r.confidence === "certain")).toBe(true);
    expect(
      call.resolutions.every((r) => r.reason.type === "interface_implementation")
    ).toBe(true);
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
      interface_id: "Handler" as any,
    };
    expect(analyze_reason(interface_impl)).toBe("Implements Handler");

    const collection: ResolutionReason = {
      type: "collection_member",
      collection_id: "CONFIG" as any,
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
      { type: "interface_implementation", interface_id: "I" as any },
      { type: "collection_member", collection_id: "C" as any },
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

/**
 * Tests for trace_call_graph
 */

import { describe, it, expect } from "vitest";
import { trace_call_graph } from "./trace_call_graph";

describe("trace_call_graph", () => {
  it("should be a function", () => {
    expect(typeof trace_call_graph).toBe("function");
  });
});

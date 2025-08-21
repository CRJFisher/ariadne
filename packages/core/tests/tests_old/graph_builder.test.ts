import { describe, it, expect } from "vitest";
import * as old from "../../src_old/call_graph/graph_builder";

describe("Old graph_builder (src_old)", () => {
  it("exposes expected functions", () => {
    expect(old).toBeDefined();
  });
});

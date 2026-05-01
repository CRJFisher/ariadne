import { describe, expect, it } from "vitest";

import { create_core_tool_group } from "./tool_group";

describe("create_core_tool_group", () => {
  const group = create_core_tool_group({
    list_entrypoints: { show_suppressed: false },
  });

  it("returns the `core` group with both core tools wired in declared order", () => {
    expect(group.group_name).toBe("core");
    expect(group.description).toBe(
      "Core entry point detection and call graph analysis tools",
    );
    expect(group.tools.map((t) => t.name)).toEqual([
      "list_entrypoints",
      "show_call_graph_neighborhood",
    ]);
  });

  it("attaches a function handler and an input schema parser to every tool", () => {
    for (const tool of group.tools) {
      expect(typeof tool.handler).toBe("function");
      expect(typeof tool.input_schema.parse).toBe("function");
    }
  });
});

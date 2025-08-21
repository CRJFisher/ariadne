import { describe, test, expect } from "vitest";
import {
  Project,
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
} from "../../src/index";

describe("CallGraph API Contract", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  describe("CallGraphNode structure", () => {
    test("nodes have correct property names and types", () => {
      const code = `
function greet(name: string) {
  return "Hello " + name;
}

function main() {
  greet("World");
}
`;
      project.add_or_update_file("test.ts", code);
      const callGraph = project.get_call_graph();

      expect(callGraph.nodes).toBeInstanceOf(Map);
      const mainNode = callGraph.nodes.get("test#main");
      expect(mainNode).toBeDefined();
      expect(mainNode).toHaveProperty("symbol");
      expect(mainNode).toHaveProperty("definition");
      expect(mainNode).toHaveProperty("calls");
      expect(mainNode).toHaveProperty("is_exported");
    });
  });
});

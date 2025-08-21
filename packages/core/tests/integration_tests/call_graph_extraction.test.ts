/**
 * Call Graph Extraction Tests (Integration)
 */

import { describe, it, expect } from "vitest";
import { Project } from "../../src/index";

describe("Call Graph Extraction", () => {
  it("should extract simple function calls", () => {
    const project = new Project();
    const code = `
function helper() {
  return 42;
}

function main() {
  helper();
  helper();
}

main();
`;
    project.add_or_update_file("test.js", code);

    const mainDef = project
      .get_definitions("test.js")
      .find((d) => d.name === "main");
    expect(mainDef).toBeDefined();
    if (!mainDef) return;

    const calls = project.get_calls_from_definition(mainDef);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.called_def.name === "helper")).toBe(true);
  });
});

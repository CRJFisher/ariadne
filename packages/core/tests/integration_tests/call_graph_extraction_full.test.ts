import { describe, it, expect } from "vitest";
import { Project } from "../../src/index";

describe("Call Graph Extraction - Additional Integration", () => {
  it("tracks recursive calls and different scopes", () => {
    const project = new Project();
    const code = `
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

function outer() {
  function inner() { return 'nested'; }
  return inner();
}
`;
    project.add_or_update_file("test.js", code);

    const factorialDef = project
      .get_definitions("test.js")
      .find((d) => d.name === "factorial");
    expect(factorialDef).toBeDefined();
    if (!factorialDef) return;
    const calls = project.get_calls_from_definition(factorialDef);
    expect(calls.some((c) => c.called_def.name === "factorial")).toBe(true);

    const outerDef = project
      .get_definitions("test.js")
      .find((d) => d.name === "outer");
    expect(outerDef).toBeDefined();
    if (!outerDef) return;
    const outerCalls = project.get_calls_from_definition(outerDef);
    expect(outerCalls.some((c) => c.called_def.name === "inner")).toBe(true);
  });
});

import { Project } from "../../src/index";
import { describe, test, expect } from "vitest";

describe("Method call detection", () => {
  test("detects method calls on built-in types", () => {
    const project = new Project();

    const code = `
function arrayOperations() {
  const arr = [1, 2, 3];
  arr.push(4);
  arr.pop();
  return arr;
}

function stringOperations() {
  const str = "hello";
  const upper = str.toUpperCase();
  const lower = str.toLowerCase();
  return upper + lower;
}`;

    project.add_or_update_file("test.js", code);

    const funcs = project.get_functions_in_file("test.js");
    const arrayFunc = funcs.find((f) => f.name === "arrayOperations");
    const stringFunc = funcs.find((f) => f.name === "stringOperations");

    expect(arrayFunc).toBeDefined();
    expect(stringFunc).toBeDefined();

    const arrayCalls = project.get_calls_from_definition(arrayFunc!);
    expect(arrayCalls.length).toBeGreaterThan(0);
    expect(arrayCalls.some((c) => c.called_def.name === "push")).toBe(true);
    expect(arrayCalls.some((c) => c.called_def.name === "pop")).toBe(true);

    const stringCalls = project.get_calls_from_definition(stringFunc!);
    expect(stringCalls.length).toBeGreaterThan(0);
    expect(stringCalls.some((c) => c.called_def.name === "toUpperCase")).toBe(
      true
    );
    expect(stringCalls.some((c) => c.called_def.name === "toLowerCase")).toBe(
      true
    );
  });
});

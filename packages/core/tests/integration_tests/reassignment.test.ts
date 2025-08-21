import { describe, test, expect } from "vitest";
import { Project } from "../../src/index";

describe("Variable reassignment type tracking", () => {
  test("should track type changes on reassignment", () => {
    const code = `
// Test file for variable reassignment
class Foo {
  fooMethod() {
    console.log("Foo method");
  }
}

class Bar {
  barMethod() {
    console.log("Bar method");
  }
}

function test() {
  // Initial assignment
  let obj = new Foo();
  obj.fooMethod(); // Should resolve to Foo.fooMethod

  // Reassignment
  obj = new Bar();
  obj.barMethod(); // Should resolve to Bar.barMethod
  obj.fooMethod(); // Should NOT resolve (Bar doesn't have fooMethod)
}
    `;

    const project = new Project();
    project.add_or_update_file("test.js", code);

    const functions = project.get_functions_in_file("test.js");
    const testFunc = functions.find((f) => f.name === "test");
    expect(testFunc).toBeDefined();

    const calls = project.get_function_calls(testFunc!);

    const fooMethodCalls = calls.filter(
      (c) =>
        c.called_def.name === "fooMethod" &&
        !c.called_def.symbol_id.startsWith("<builtin>")
    );
    const barMethodCalls = calls.filter(
      (c) =>
        c.called_def.name === "barMethod" &&
        !c.called_def.symbol_id.startsWith("<builtin>")
    );

    expect(fooMethodCalls.length).toBe(1);
    expect(barMethodCalls.length).toBe(1);
  });
});

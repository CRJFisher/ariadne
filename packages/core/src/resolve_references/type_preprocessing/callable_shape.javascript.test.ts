import { describe, it, expect } from "vitest";
import { callable_parameters_javascript } from "./callable_shape.javascript";

describe("callable_parameters_javascript", () => {
  it("reads Closure's function type, and the arrow type, inside JSDoc braces and modifiers", () => {
    expect(callable_parameters_javascript("function(Foo, number): void")).toEqual(["Foo", "number"]);
    expect(callable_parameters_javascript("{?function(this:Ctx, Foo=)}")).toEqual(["Foo"]);
    expect(callable_parameters_javascript("(f: Foo) => void")).toEqual(["Foo"]);
  });
});

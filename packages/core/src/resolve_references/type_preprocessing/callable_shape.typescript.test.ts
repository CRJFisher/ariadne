import { describe, it, expect } from "vitest";
import { callable_parameters_typescript } from "./callable_shape.typescript";

describe("callable_parameters_typescript", () => {
  it("reads an arrow type's positions, through parentheses and nullish unions", () => {
    expect(callable_parameters_typescript("(item: Foo, i: number) => void")).toEqual(["Foo", "number"]);
    expect(callable_parameters_typescript("((e: Event<T>) => any) | undefined")).toEqual(["Event<T>"]);
    expect(callable_parameters_typescript("(this: Ctx, a?: A, b) => void")).toEqual(["A", null]);
    expect(callable_parameters_typescript("(a: A) => (b: B) => C")).toEqual(["A"]);
    expect(callable_parameters_typescript("(a: A, ...rest: B[]) => void")).toEqual(["A"]);
  });

  it("answers null for what is not an arrow type", () => {
    for (const text of ["Foo", "Foo | Bar", "Array<(a: A) => void>", "(...rest: B[], a: A) => void"]) {
      expect(callable_parameters_typescript(text)).toEqual(null);
    }
  });
});

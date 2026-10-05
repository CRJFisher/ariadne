import { describe, it, expect } from "vitest";
import { callable_parameters_python } from "./callable_shape.python";

describe("callable_parameters_python", () => {
  it("reads Callable's parameter list by its last segment, inside Optional and None unions", () => {
    expect(callable_parameters_python("Callable[[Foo, int], None]")).toEqual(["Foo", "int"]);
    expect(callable_parameters_python("typing.Callable[[], None]")).toEqual([]);
    expect(callable_parameters_python("Optional[Callable[[Foo], Bar]]")).toEqual(["Foo"]);
    expect(callable_parameters_python("Callable[[Foo], None] | None")).toEqual(["Foo"]);
    expect(callable_parameters_python("'Callable[[Foo], None]'")).toEqual(["Foo"]);
  });

  it("answers null where the positions cannot be counted, or there is no Callable", () => {
    for (const text of ["Callable[..., None]", "Callable", "list[Foo]"]) {
      expect(callable_parameters_python(text)).toEqual(null);
    }
  });
});

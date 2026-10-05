import { describe, it, expect } from "vitest";
import { callable_parameter_annotations } from "./callable_shape";

describe("callable_parameter_annotations", () => {
  it("reads each annotation under its own language's grammar", () => {
    expect(callable_parameter_annotations("impl FnOnce(&mut Self) -> T", "rust")).toEqual(["&mut Self"]);
    expect(callable_parameter_annotations("(item: Foo) => void", "typescript")).toEqual(["Foo"]);
    expect(callable_parameter_annotations("function(Foo): void", "javascript")).toEqual(["Foo"]);
    expect(callable_parameter_annotations("Callable[[Foo], None]", "python")).toEqual(["Foo"]);
    expect(callable_parameter_annotations("Callable[[Foo], None]", "rust")).toEqual(null);
  });
});

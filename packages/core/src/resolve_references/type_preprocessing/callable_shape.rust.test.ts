import { describe, it, expect } from "vitest";
import { callable_parameters_rust } from "./callable_shape.rust";

describe("callable_parameters_rust", () => {
  it("reads the Fn traits as impl and dyn bounds, bare, behind references and pointers", () => {
    const cases: Record<string, readonly (string | null)[]> = {
      "impl FnOnce(&mut Self) -> T": ["&mut Self"],
      "impl FnOnce(&mut Self, AttrVec) -> PResult<'a, (R, Trailing)>": ["&mut Self", "AttrVec"],
      "FnMut(&mut Self)": ["&mut Self"],
      "&mut dyn FnMut(&Node, usize)": ["&Node", "usize"],
      "Box<dyn Fn(Event) + Send + 'static>": ["Event"],
      "impl Send + Fn(u8)": ["u8"],
      "std::ops::Fn()": [],
      "&dyn for<'a> Fn(&'a Item) -> bool": ["&'a Item"],
    };
    for (const [text, parameters] of Object.entries(cases)) {
      expect(callable_parameters_rust(text)).toEqual(parameters);
    }
  });

  it("answers null for what is not a function type", () => {
    for (const text of ["Vec<T>", "impl Iterator<Item = u8>", "F", "Option<u8>"]) {
      expect(callable_parameters_rust(text)).toEqual(null);
    }
  });
});

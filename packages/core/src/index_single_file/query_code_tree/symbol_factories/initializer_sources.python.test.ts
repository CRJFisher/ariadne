import { describe, it, expect } from "vitest";
import type { IterationSource } from "@ariadnejs/types";
import { parse_python, find_node_by_type } from "./test_utils";
import { extract_collection_source, extract_iteration_source } from "./initializer_sources.python";

// ============================================================================

describe("extract_iteration_source", () => {
  /** The iteration source of the `occurrence`th identifier spelled `name` in `code`. */
  function iteration_source(code: string, name: string, occurrence = 0): IterationSource | undefined {
    const binding = parse_python(code)
      .descendantsOfType("identifier")
      .filter((node) => node.text === name)[occurrence];
    return extract_iteration_source(binding);
  }

  it("binds each item a for loop or comprehension iterates, through an attribute chain", () => {
    expect(iteration_source("for s in suites:\n    pass", "s")).toEqual({
      container: ["suites"],
      yields: "item",
    });
    expect(iteration_source("for s in self.suites:\n    pass", "s")).toEqual({
      container: ["self", "suites"],
      yields: "item",
    });
    expect(iteration_source("names = [s.title for s in suites]", "s", 1)).toEqual({
      container: ["suites"],
      yields: "item",
    });
  });

  it("binds a value when the loop iterates values(), and the value half of an items() pair", () => {
    expect(iteration_source("for v in d.values():\n    pass", "v")).toEqual({
      container: ["d"],
      yields: "value",
    });
    expect(iteration_source("for k, v in d.items():\n    pass", "v")).toEqual({
      container: ["d"],
      yields: "entry_value",
    });
    expect(iteration_source("for (k, v) in d.items():\n    pass", "v")).toEqual({
      container: ["d"],
      yields: "entry_value",
    });
  });

  it("binds what iterating the counted iterable yields to the second name of an enumerate() pair", () => {
    expect(iteration_source("for i, s in enumerate(suites):\n    pass", "s")).toEqual({
      container: ["suites"],
      yields: "item",
    });
    expect(iteration_source("for i, v in enumerate(self.named.values()):\n    pass", "v")).toEqual({
      container: ["self", "named"],
      yields: "value",
    });
    expect(iteration_source("for i, s in enumerate(suites, 1):\n    pass", "s")).toEqual({
      container: ["suites"],
      yields: "item",
    });
  });

  it("binds each name tuple unpacking takes from a container", () => {
    expect(iteration_source("first, second = suites", "second")).toEqual({
      container: ["suites"],
      yields: "item",
    });
  });

  it("has no source for a key, a pair unpacked straight off the container, or an iterable that is not a name chain", () => {
    expect(iteration_source("for k, v in d.items():\n    pass", "k")).toEqual(undefined);
    expect(iteration_source("for k, v in d:\n    pass", "v")).toEqual(undefined);
    expect(iteration_source("for x in d.items():\n    pass", "x")).toEqual(undefined);
    expect(iteration_source("for x in make():\n    pass", "x")).toEqual(undefined);
    expect(iteration_source("for i, s in enumerate(suites):\n    pass", "i")).toEqual(undefined);
    expect(iteration_source("for s in enumerate(suites):\n    pass", "s")).toEqual(undefined);
    expect(iteration_source("for i, p in enumerate(d.items()):\n    pass", "p")).toEqual(undefined);
  });
});

describe("extract_collection_source", () => {
  it("should extract derived variable from method call", () => {
    const code = "handler = config.get('key')";
    const root = parse_python(code);
    const identifier = find_node_by_type(root, "identifier")!;

    const derived = extract_collection_source(identifier);
    expect(derived).toBe("config");
  });

  it("should extract derived variable from subscript", () => {
    const code = "handler = config['key']";
    const root = parse_python(code);
    const identifier = find_node_by_type(root, "identifier")!;

    const derived = extract_collection_source(identifier);
    expect(derived).toBe("config");
  });

  it("should return undefined for plain assignment", () => {
    const code = "handler = some_func";
    const root = parse_python(code);
    const identifier = find_node_by_type(root, "identifier")!;

    const derived = extract_collection_source(identifier);
    expect(derived).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import type { FilePath, Language, Location } from "@ariadnejs/types";
import { reset_documentation_state } from "./documentation_state";
import {
  store_documentation as store_js,
  consume_documentation as consume_js,
} from "./documentation_state.javascript";
import {
  store_documentation as store_rust,
  consume_documentation as consume_rust,
} from "./documentation_state.rust";
import {
  store_python_docstring,
  consume_python_docstring,
} from "./documentation_state.python";
import { parse_python, make_capture, find_string_node } from "./test_utils";

function location_at(file_path: FilePath, line: number): Location {
  return {
    file_path,
    start_line: line,
    start_column: 1,
    end_line: line,
    end_column: 10,
  };
}

const js_location = location_at("/test.js" as FilePath, 6);
const rust_location = location_at("/test.rs" as FilePath, 6);

describe("reset_documentation_state dispatcher", () => {
  beforeEach(() => {
    reset_documentation_state("javascript" as Language);
    reset_documentation_state("python" as Language);
    reset_documentation_state("rust" as Language);
  });

  it("clears only the given language's pending documentation", () => {
    store_js("/** js doc */", 5);
    store_rust("/// rust doc", 5);

    reset_documentation_state("rust" as Language);

    expect(consume_rust(rust_location)).toEqual(undefined);
    expect(consume_js(js_location)).toEqual("/** js doc */");
  });

  it("clears the shared JavaScript store for the typescript arm", () => {
    store_js("/** ts doc */", 5);

    reset_documentation_state("typescript" as Language);

    expect(consume_js(js_location)).toEqual(undefined);
  });

  it("clears the javascript store for the javascript arm", () => {
    store_js("/** js doc */", 5);

    reset_documentation_state("javascript" as Language);

    expect(consume_js(js_location)).toEqual(undefined);
  });

  it("clears only the python store for the python arm", () => {
    const root = parse_python(`def f():
    """Doc."""
    return 1
`);
    const string_node = find_string_node(root)!;
    store_python_docstring(make_capture(string_node));
    store_js("/** js doc */", 5);

    reset_documentation_state("python" as Language);

    expect(consume_python_docstring(1)).toEqual(undefined);
    expect(consume_js(js_location)).toEqual("/** js doc */");
  });
});

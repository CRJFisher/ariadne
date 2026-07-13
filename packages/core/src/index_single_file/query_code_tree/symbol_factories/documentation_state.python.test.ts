import { describe, it, expect, beforeEach } from "vitest";
import {
  store_python_docstring,
  consume_python_docstring,
  clean_python_docstring,
  reset_documentation_state,
} from "./documentation_state.python";
import { SemanticEntity } from "../../capture_types";
import {
  parse_python,
  make_capture,
  find_string_node,
} from "./test_utils";

describe("clean_python_docstring", () => {
  it("should strip triple double quotes from single-line docstring", () => {
    expect(clean_python_docstring("\"\"\"Hello\"\"\"")).toBe("Hello");
  });

  it("should strip triple single quotes from single-line docstring", () => {
    expect(clean_python_docstring("'''Hello'''")).toBe("Hello");
  });

  it("should strip and dedent multi-line docstring", () => {
    const raw = "\"\"\"\n  Hello\n  World\n\"\"\"";
    expect(clean_python_docstring(raw)).toBe("Hello\nWorld");
  });

  it("should handle empty docstring", () => {
    expect(clean_python_docstring("\"\"\"\"\"\"")).toBe("");
  });

  it("should handle docstring with varying indentation", () => {
    const raw = "\"\"\"\n    First line\n      Indented\n    Back\n\"\"\"";
    expect(clean_python_docstring(raw)).toBe("First line\n  Indented\nBack");
  });
});

describe("store_python_docstring / consume_python_docstring / reset_documentation_state", () => {
  beforeEach(() => {
    reset_documentation_state();
  });

  it("should store and consume a docstring keyed by definition start line", () => {
    const code = "def foo():\n  \"\"\"A docstring.\"\"\"\n  pass";
    const root = parse_python(code);

    // Find the string node (the docstring)
    const string_node = find_string_node(root)!;
    expect(string_node).not.toBeNull();

    const capture = make_capture(string_node, {
      name: "definition.documentation",
      entity: SemanticEntity.DOCUMENTATION,
    });

    store_python_docstring(capture);

    // The function_definition starts at line 1
    const consumed = consume_python_docstring(1);
    expect(consumed).toBe("A docstring.");
  });

  it("should return undefined when consuming a non-existent docstring", () => {
    const result = consume_python_docstring(999);
    expect(result).toBeUndefined();
  });

  it("should consume only once (second call returns undefined)", () => {
    const code = "def bar():\n  \"\"\"Doc.\"\"\"\n  pass";
    const root = parse_python(code);
    const string_node = find_string_node(root)!;
    const capture = make_capture(string_node, {
      name: "definition.documentation",
      entity: SemanticEntity.DOCUMENTATION,
    });

    store_python_docstring(capture);

    const first = consume_python_docstring(1);
    expect(first).toBe("Doc.");

    const second = consume_python_docstring(1);
    expect(second).toBeUndefined();
  });

  it("should clear all stored docstrings on reset", () => {
    const code = "def baz():\n  \"\"\"Baz doc.\"\"\"\n  pass";
    const root = parse_python(code);
    const string_node = find_string_node(root)!;
    const capture = make_capture(string_node, {
      name: "definition.documentation",
      entity: SemanticEntity.DOCUMENTATION,
    });

    store_python_docstring(capture);
    reset_documentation_state();

    const result = consume_python_docstring(1);
    expect(result).toBeUndefined();
  });
});

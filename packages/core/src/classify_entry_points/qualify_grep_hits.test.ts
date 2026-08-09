import { describe, it, expect } from "vitest";
import {
  build_callable_declaration_keys,
  build_code_ranges,
  declaration_key,
  is_code_column,
} from "./qualify_grep_hits";
import { function_symbol } from "@ariadnejs/types";
import type {
  CallableDefinition,
  FilePath,
  FunctionDefinition,
  Language,
  ScopeId,
  SymbolName,
} from "@ariadnejs/types";

/**
 * Columns of `needle` in each line that count as code. A grep hit is kept only
 * when the identifier's own column is code, so this is exactly the question
 * `build_grep_index` asks.
 */
function code_occurrences(
  source: string,
  language: Language,
  needle: string,
): { line: number; column: number }[] {
  const lines = source.split("\n");
  const ranges = build_code_ranges(lines, language);
  const found: { line: number; column: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    let from = 0;
    for (;;) {
      const column = lines[i].indexOf(needle, from);
      if (column === -1) break;
      if (is_code_column(ranges[i], column)) found.push({ line: i + 1, column });
      from = column + 1;
    }
  }
  return found;
}

describe("build_code_ranges keeps code and drops comments", () => {
  it("keeps a Rust deref that opens the line", () => {
    const source = ["pub fn bump(c: &mut u32) {", "    *c.borrow_mut() += 1;", "}"].join("\n");

    expect(code_occurrences(source, "rust", "borrow_mut")).toEqual([
      { line: 2, column: 7 },
    ]);
  });

  it("keeps a JavaScript multiplication continuation", () => {
    const source = ["const total = base", "    * scale_factor();"].join("\n");

    expect(code_occurrences(source, "javascript", "scale_factor")).toEqual([
      { line: 2, column: 6 },
    ]);
  });

  it("drops a Rust doc comment and an inner doc comment", () => {
    const source = [
      "/// let unfilled = buf.initialize_unfilled();",
      "//! initialize_unfilled() is module prose",
      "pub fn documented() -> u32 { 1 }",
    ].join("\n");

    expect(code_occurrences(source, "rust", "initialize_unfilled")).toEqual([]);
  });

  it("drops a block-comment interior line that carries no marker", () => {
    const source = [
      "/*",
      "  render_widget() is documented here",
      "*/",
      "export const NOTE = 1;",
    ].join("\n");

    expect(code_occurrences(source, "typescript", "render_widget")).toEqual([]);
  });

  it("drops a JSDoc continuation line", () => {
    const source = ["/**", " * render_widget() draws it", " */", "export const N = 1;"].join("\n");

    expect(code_occurrences(source, "typescript", "render_widget")).toEqual([]);
  });

  it("keeps code that follows a closed block comment on the same line", () => {
    const source = "/* istanbul ignore next */ return w.render_widget();";

    expect(code_occurrences(source, "typescript", "render_widget")).toEqual([
      { line: 1, column: 36 },
    ]);
  });

  it("drops a trailing line comment while keeping the code before it", () => {
    const source = "export const NOTE = compute(); // remember render_widget() here";

    expect(code_occurrences(source, "typescript", "render_widget")).toEqual([]);
    expect(code_occurrences(source, "typescript", "compute")).toEqual([
      { line: 1, column: 20 },
    ]);
  });

  it("drops occurrences inside a string literal, including a URL that looks like a comment", () => {
    const source = "const url = \"http://example.com/y(\";\nconst x = fetch(url);";

    expect(code_occurrences(source, "typescript", "y(")).toEqual([]);
    expect(code_occurrences(source, "typescript", "fetch")).toEqual([
      { line: 2, column: 10 },
    ]);
  });

  it("drops a single-line Python docstring", () => {
    const source = ["def beat():", "    \"\"\"Schedules run_task() from the beat.\"\"\"", "    return 1"].join(
      "\n",
    );

    expect(code_occurrences(source, "python", "run_task")).toEqual([]);
  });

  it("drops a doctest line inside a multi-line Python docstring", () => {
    const source = [
      "def panel():",
      "    \"\"\"Control panel.",
      "",
      "    >>> add_consumer('queue-name')",
      "    \"\"\"",
      "    return 1",
    ].join("\n");

    expect(code_occurrences(source, "python", "add_consumer")).toEqual([]);
  });

  it("drops a Python comment but keeps a hash inside a string", () => {
    const source = ["path = \"a#b(c)\"", "# run_task() is scheduled by the beat", "value = compute()"].join(
      "\n",
    );

    expect(code_occurrences(source, "python", "run_task")).toEqual([]);
    expect(code_occurrences(source, "python", "b(")).toEqual([]);
    expect(code_occurrences(source, "python", "compute")).toEqual([
      { line: 3, column: 8 },
    ]);
  });

  it("keeps code after a nested Rust block comment closes", () => {
    const source = "/* outer /* inner */ */ let x = make_id();";

    expect(code_occurrences(source, "rust", "make_id")).toEqual([
      { line: 1, column: 32 },
    ]);
  });

  it("treats a Rust lifetime as code, not as an unterminated string", () => {
    const source = "fn run<'a>(w: &'a Widget) -> u32 { w.render_widget() }";

    expect(code_occurrences(source, "rust", "render_widget")).toEqual([
      { line: 1, column: 37 },
    ]);
  });
});

describe("build_callable_declaration_keys", () => {
  function callable(name: string, file_path: string, start_line: number): CallableDefinition {
    const location = {
      file_path: file_path as FilePath,
      start_line,
      start_column: 0,
      end_line: start_line + 2,
      end_column: 1,
    };
    const definition: FunctionDefinition = {
      kind: "function",
      symbol_id: function_symbol(name as SymbolName, location),
      name: name as SymbolName,
      defining_scope_id: `scope:${file_path}:module` as ScopeId,
      location,
      is_exported: true,
      signature: { parameters: [] },
      body_scope_id: `scope:${file_path}:function:${name}:${start_line}:0` as ScopeId,
    };
    return definition;
  }

  it("keys every declaration by file, line and name", () => {
    const keys = build_callable_declaration_keys([
      callable("dropSchema", "a.ts", 12),
      callable("dropSchema", "b.ts", 12),
    ]);

    expect([...keys].sort()).toEqual(["a.ts:12:dropSchema", "b.ts:12:dropSchema"]);
  });

  it("does not claim a line for a name declared elsewhere on it", () => {
    const keys = build_callable_declaration_keys([callable("wrap", "caller.ts", 1)]);

    expect(keys.has(declaration_key("caller.ts", 1, "wrap"))).toBe(true);
    expect(keys.has(declaration_key("caller.ts", 1, "make_id"))).toBe(false);
  });
});

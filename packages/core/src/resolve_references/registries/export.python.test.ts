import { describe, it, expect } from "vitest";
import type { FilePath, SymbolId } from "@ariadnejs/types";
import {
  is_python_file,
  should_replace_python_variable,
  is_variable_or_constant_symbol,
} from "./export.python";

describe("is_python_file", () => {
  it("recognizes a .py file", () => {
    expect(is_python_file("/pkg/main.py" as FilePath)).toBe(true);
  });

  it("recognizes a .pyw file", () => {
    expect(is_python_file("/pkg/gui.pyw" as FilePath)).toBe(true);
  });

  it("rejects a .ts file", () => {
    expect(is_python_file("/src/app.ts" as FilePath)).toBe(false);
  });

  it("rejects a .pyc compiled file", () => {
    expect(is_python_file("/pkg/main.pyc" as FilePath)).toBe(false);
  });

  it("rejects a path with no extension", () => {
    expect(is_python_file("/pkg/README" as FilePath)).toBe(false);
  });
});

describe("should_replace_python_variable", () => {
  it("replaces when the current definition is on a later line", () => {
    const existing = "variable:test.py:10:0:10:5:x" as SymbolId;
    expect(should_replace_python_variable(existing, 20)).toBe(true);
  });

  it("keeps the existing definition when the current one is on an earlier line", () => {
    const existing = "variable:test.py:100:0:100:5:x" as SymbolId;
    expect(should_replace_python_variable(existing, 50)).toBe(false);
  });

  it("keeps the existing definition when both are on the same line", () => {
    const existing = "variable:test.py:10:0:10:5:x" as SymbolId;
    expect(should_replace_python_variable(existing, 10)).toBe(false);
  });

  it("reads the start line past a multi-digit column", () => {
    const existing =
      "variable:chatgpt_projections.py:190:5:190:15:predictions" as SymbolId;
    expect(should_replace_python_variable(existing, 197)).toBe(true);
  });

  it("reads single-digit start lines", () => {
    const existing = "variable:test.py:1:0:1:5:x" as SymbolId;
    expect(should_replace_python_variable(existing, 2)).toBe(true);
    expect(should_replace_python_variable(existing, 1)).toBe(false);
  });

  it("reads large start lines", () => {
    const existing = "variable:test.py:9999:0:9999:10:large_file_var" as SymbolId;
    expect(should_replace_python_variable(existing, 10000)).toBe(true);
    expect(should_replace_python_variable(existing, 9998)).toBe(false);
  });

  it("compares by line for constant reassignment", () => {
    const existing = "constant:test.py:25:4:25:20:CONFIG_VALUE" as SymbolId;
    expect(should_replace_python_variable(existing, 40)).toBe(true);
  });
});

describe("is_variable_or_constant_symbol", () => {
  it("returns true for variable symbols", () => {
    const symbol_id = "variable:test.py:10:0:10:5:x" as SymbolId;
    expect(is_variable_or_constant_symbol(symbol_id)).toBe(true);
  });

  it("returns true for constant symbols", () => {
    const symbol_id = "constant:test.py:10:0:10:10:MAX_SIZE" as SymbolId;
    expect(is_variable_or_constant_symbol(symbol_id)).toBe(true);
  });

  it("returns false for function symbols", () => {
    const symbol_id = "function:test.py:10:0:15:5:do_something" as SymbolId;
    expect(is_variable_or_constant_symbol(symbol_id)).toBe(false);
  });

  it("returns false for class symbols", () => {
    const symbol_id = "class:test.py:10:0:50:5:MyClass" as SymbolId;
    expect(is_variable_or_constant_symbol(symbol_id)).toBe(false);
  });

  it("returns false for method symbols", () => {
    const symbol_id = "method:test.py:10:0:15:5:get_value" as SymbolId;
    expect(is_variable_or_constant_symbol(symbol_id)).toBe(false);
  });
});

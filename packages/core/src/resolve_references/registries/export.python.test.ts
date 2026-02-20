/**
 * Tests for Python-specific export handling
 */

import { describe, it, expect } from "vitest";
import type { SymbolId } from "@ariadnejs/types";
import {
  extract_line_from_symbol_id,
  should_replace_python_variable,
  is_variable_or_constant_symbol,
} from "./export.python";

describe("extract_line_from_symbol_id", () => {
  it("extracts line number from variable SymbolId", () => {
    const symbol_id =
      "variable:test.py:10:0:10:15:predictions" as SymbolId;
    expect(extract_line_from_symbol_id(symbol_id)).toBe(10);
  });

  it("extracts line number from constant SymbolId", () => {
    const symbol_id =
      "constant:test.py:25:4:25:20:CONFIG_VALUE" as SymbolId;
    expect(extract_line_from_symbol_id(symbol_id)).toBe(25);
  });

  it("extracts line number from function SymbolId", () => {
    const symbol_id =
      "function:test.py:100:0:105:10:process_data" as SymbolId;
    expect(extract_line_from_symbol_id(symbol_id)).toBe(100);
  });

  it("handles single-digit line numbers", () => {
    const symbol_id = "variable:test.py:1:0:1:5:x" as SymbolId;
    expect(extract_line_from_symbol_id(symbol_id)).toBe(1);
  });

  it("handles large line numbers", () => {
    const symbol_id =
      "variable:test.py:9999:0:9999:10:large_file_var" as SymbolId;
    expect(extract_line_from_symbol_id(symbol_id)).toBe(9999);
  });
});

describe("should_replace_python_variable", () => {
  it("returns true when current definition is on a later line", () => {
    const existing = "variable:test.py:10:0:10:5:x" as SymbolId;
    const current_line = 20;
    expect(should_replace_python_variable(existing, current_line)).toBe(true);
  });

  it("returns false when current definition is on an earlier line", () => {
    const existing = "variable:test.py:100:0:100:5:x" as SymbolId;
    const current_line = 50;
    expect(should_replace_python_variable(existing, current_line)).toBe(false);
  });

  it("returns false when definitions are on the same line", () => {
    const existing = "variable:test.py:10:0:10:5:x" as SymbolId;
    const current_line = 10;
    expect(should_replace_python_variable(existing, current_line)).toBe(false);
  });

  it("handles typical Python variable reassignment scenario", () => {
    // Simulating: predictions = []; predictions = calculate()
    const first_assignment =
      "variable:chatgpt_projections.py:190:5:190:15:predictions" as SymbolId;
    const second_assignment_line = 197;

    expect(
      should_replace_python_variable(first_assignment, second_assignment_line)
    ).toBe(true);
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

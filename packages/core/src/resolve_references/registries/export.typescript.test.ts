import { describe, it, expect } from "vitest";
import type { SymbolId } from "@ariadnejs/types";
import { resolve_arrow_function_export } from "./export.typescript";

describe("resolve_arrow_function_export", () => {
  it("replaces an existing function with an incoming variable binding", () => {
    const existing = "function:test.ts:5:13:5:30:handler" as SymbolId;
    expect(resolve_arrow_function_export(existing, "variable")).toBe(
      "replace_existing"
    );
  });

  it("replaces an existing function with an incoming constant binding", () => {
    const existing = "function:test.ts:5:13:5:30:handler" as SymbolId;
    expect(resolve_arrow_function_export(existing, "constant")).toBe(
      "replace_existing"
    );
  });

  it("keeps an existing variable binding over an incoming function", () => {
    const existing = "variable:test.ts:5:6:5:13:handler" as SymbolId;
    expect(resolve_arrow_function_export(existing, "function")).toBe(
      "keep_existing"
    );
  });

  it("keeps an existing constant binding over an incoming function", () => {
    const existing = "constant:test.ts:5:6:5:13:handler" as SymbolId;
    expect(resolve_arrow_function_export(existing, "function")).toBe(
      "keep_existing"
    );
  });

  it("does not apply to a function/class collision", () => {
    const existing = "function:test.ts:5:13:5:30:handler" as SymbolId;
    expect(resolve_arrow_function_export(existing, "class")).toBe(
      "not_applicable"
    );
  });

  it("does not apply to a variable/variable collision", () => {
    const existing = "variable:test.ts:5:6:5:13:x" as SymbolId;
    expect(resolve_arrow_function_export(existing, "variable")).toBe(
      "not_applicable"
    );
  });
});

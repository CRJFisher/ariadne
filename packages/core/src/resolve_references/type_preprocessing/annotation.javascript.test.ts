import { describe, it, expect } from "vitest";
import type { SymbolName } from "@ariadnejs/types";
import type { ParsedTypeAnnotation } from "./annotation";
import { parse_javascript_annotation } from "./annotation.javascript";

function type_named(
  head: string,
  type_arguments: readonly ParsedTypeAnnotation[] = []
): ParsedTypeAnnotation {
  return { head: [head as SymbolName], arguments: type_arguments };
}

describe("parse_javascript_annotation", () => {
  it.each<readonly [string, ParsedTypeAnnotation | null]>([
    ["{X}", type_named("X")],
    ["X", type_named("X")],
    ["{X=}", type_named("X")],
    ["X=", type_named("X")],
    ["{X|null}", type_named("X")],
    ["X|undefined", type_named("X")],
    ["{?X}", type_named("X")],
    ["{!X}", type_named("X")],
    ["{Array<X>}", type_named("Array", [type_named("X")])],
    ["{Array.<X>}", type_named("Array", [type_named("X")])],
    ["{X[]}", type_named("Array", [type_named("X")])],
    [
      "{import(\"./a\").X}",
      { head: ["X" as SymbolName], arguments: [], module_specifier: "./a" },
    ],
    ["{X|Y}", null],
    ["{...X}", null],
    ["{*}", null],
    ["{function(X): Y}", null],
  ])("%s", (text, expected) => {
    expect(parse_javascript_annotation(text)).toEqual(expected);
  });
});

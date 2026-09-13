import { describe, it, expect } from "vitest";
import type { SymbolName } from "@ariadnejs/types";
import type { ParsedTypeAnnotation } from "./annotation";
import { parse_typescript_annotation } from "./annotation.typescript";

function type_named(
  head: string,
  type_arguments: readonly ParsedTypeAnnotation[] = []
): ParsedTypeAnnotation {
  return { head: [head as SymbolName], arguments: type_arguments };
}

function qualified(
  segments: readonly string[],
  type_arguments: readonly ParsedTypeAnnotation[] = []
): ParsedTypeAnnotation {
  return { head: segments as SymbolName[], arguments: type_arguments };
}

describe("parse_typescript_annotation", () => {
  it.each<readonly [string, ParsedTypeAnnotation | null]>([
    ["F", type_named("F")],
    ["F | null", type_named("F")],
    ["F | undefined", type_named("F")],
    ["null | F | undefined", type_named("F")],
    ["| F", type_named("F")],
    ["(F)", type_named("F")],
    ["F?", type_named("F")],
    ["readonly F[]", type_named("Array", [type_named("F")])],
    ["F[]", type_named("Array", [type_named("F")])],
    ["F[][]", type_named("Array", [type_named("Array", [type_named("F")])])],
    ["Promise<F>", type_named("Promise", [type_named("F")])],
    ["Map<K, V>", type_named("Map", [type_named("K"), type_named("V")])],
    ["vfs.FileSystem", qualified(["vfs", "FileSystem"])],
    ["Provider<Foo<Bar>>", type_named("Provider", [type_named("Foo", [type_named("Bar")])])],
    ["ns.Box<F | null>", qualified(["ns", "Box"], [type_named("F")])],
    [
      "import(\"./a\").X",
      { head: ["X" as SymbolName], arguments: [], module_specifier: "./a" },
    ],
    [
      "import('./a').ns.X<F>",
      {
        head: ["ns", "X"] as SymbolName[],
        arguments: [type_named("F")],
        module_specifier: "./a",
      },
    ],
    ["F | G", null],
    ["F & G", null],
    ["(a: F) => G", null],
    ["Map<() => void, F>", null],
    ["{ a: F }", null],
    ["[F, G]", null],
    ["typeof F", null],
    ["keyof F", null],
    ["'literal'", null],
    ["", null],
  ])("%s", (text, expected) => {
    expect(parse_typescript_annotation(text)).toEqual(expected);
  });
});

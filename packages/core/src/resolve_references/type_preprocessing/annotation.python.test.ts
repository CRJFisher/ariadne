import { describe, it, expect } from "vitest";
import type { SymbolName } from "@ariadnejs/types";
import type { ParsedTypeAnnotation } from "./annotation";
import { parse_python_annotation } from "./annotation.python";

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

describe("parse_python_annotation", () => {
  it.each<readonly [string, ParsedTypeAnnotation | null]>([
    ["C", type_named("C")],
    ["Optional[C]", type_named("C")],
    ["typing.Optional[C]", type_named("C")],
    ["Union[C, None]", type_named("C")],
    ["Union[None, C]", type_named("C")],
    ["C | None", type_named("C")],
    ["\"C\"", type_named("C")],
    ["'C'", type_named("C")],
    ["Optional[\"C\"]", type_named("C")],
    ["List[C]", type_named("List", [type_named("C")])],
    ["Dict[str, C]", type_named("Dict", [type_named("str"), type_named("C")])],
    ["Mapper[_T]", type_named("Mapper", [type_named("_T")])],
    ["type[C]", type_named("type", [type_named("C")])],
    ["mod.C", qualified(["mod", "C"])],
    ["compiler.DDLCompiler", qualified(["compiler", "DDLCompiler"])],
    ["Union[C, D]", null],
    ["C | D", null],
    ["Optional[C, D]", null],
    ["Callable[[C], D]", null],
    ["Tuple[C, ...]", null],
  ])("%s", (text, expected) => {
    expect(parse_python_annotation(text)).toEqual(expected);
  });
});

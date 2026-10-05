import { describe, it, expect } from "vitest";
import type { Language, SymbolName } from "@ariadnejs/types";
import { parse_type_annotation, type ParsedTypeAnnotation } from "./annotation";

const S: ParsedTypeAnnotation = { head: ["S" as SymbolName], arguments: [] };

/**
 * Texts whose reading differs per grammar, so each row proves the marshaller
 * handed the text to its own language's leaf.
 */
describe("parse_type_annotation", () => {
  it.each<readonly [Language, string, ParsedTypeAnnotation | null]>([
    ["typescript", "S | null", S],
    ["javascript", "{S=}", S],
    ["python", "Optional[S]", S],
    ["rust", "&mut S", S],
    ["typescript", "Optional[S]", null],
    ["python", "&mut S", null],
    ["rust", "S | null", null],
  ])("%s reads %s", (language, text, expected) => {
    expect(parse_type_annotation(text, language)).toEqual(expected);
  });
});

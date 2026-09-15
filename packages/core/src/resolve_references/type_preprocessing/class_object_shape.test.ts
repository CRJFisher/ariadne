import { describe, it, expect } from "vitest";
import type { Language, SymbolName } from "@ariadnejs/types";
import { parse_type_annotation, type ParsedTypeAnnotation } from "./annotation";
import { class_object_annotation } from "./class_object_shape";

const PARSER: ParsedTypeAnnotation = { head: ["Parser" as SymbolName], arguments: [] };

describe("class_object_annotation", () => {
  it.each<readonly [Language, string]>([
    ["python", "type[Parser]"],
    ["python", "Type[Parser]"],
    ["python", "typing.Type[Parser]"],
    ["python", "Optional[type[Parser]]"],
    ["typescript", "typeof Parser"],
    ["typescript", "typeof Parser | undefined"],
    ["javascript", "{typeof Parser}"],
  ])("%s %s denotes the Parser class object", (language, text) => {
    const annotation = parse_type_annotation(text, language);

    expect(annotation && class_object_annotation(annotation, language)).toEqual(PARSER);
  });

  it.each<readonly [Language, string]>([
    ["python", "Parser"],
    ["python", "list[Parser]"],
    ["python", "type[Parser, Lexer]"],
    ["typescript", "Type<Parser>"],
    ["typescript", "Parser"],
    ["rust", "Box<Parser>"],
  ])("%s %s denotes no class object", (language, text) => {
    const annotation = parse_type_annotation(text, language);

    expect(annotation && class_object_annotation(annotation, language)).toEqual(null);
  });
});

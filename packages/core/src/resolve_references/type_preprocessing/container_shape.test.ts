import { describe, it, expect } from "vitest";
import type { Language, SymbolName } from "@ariadnejs/types";
import { parse_type_annotation, type ParsedTypeAnnotation } from "./annotation";
import { container_element_annotation, type ContainerShape } from "./container_shape";

const SUITE: ParsedTypeAnnotation = { head: ["Suite" as SymbolName], arguments: [] };

describe("container_element_annotation", () => {
  it.each<readonly [Language, string, ContainerShape]>([
    ["typescript", "Suite[]", "sequence"],
    ["typescript", "Array<Suite>", "sequence"],
    ["typescript", "Set<Suite>", "sequence"],
    ["javascript", "{Suite[]}", "sequence"],
    ["python", "list[Suite]", "sequence"],
    ["rust", "Vec<Suite>", "sequence"],
    ["typescript", "Map<string, Suite>", "keyed"],
    ["typescript", "DisposableMap<string, Suite>", "keyed"],
    ["python", "dict[str, Suite]", "keyed"],
    ["rust", "HashMap<String, Suite>", "keyed"],
  ])("%s %s holds Suite elements in a %s", (language, text, shape) => {
    const annotation = parse_type_annotation(text, language);

    expect(annotation && container_element_annotation(annotation)).toEqual({ shape, element: SUITE });
  });

  it.each<readonly [Language, string]>([
    ["typescript", "Promise<Suite>"],
    ["typescript", "Map<Suite>"],
    ["typescript", "Suite"],
    ["python", "List[Suite]"],
    ["rust", "std::collections::HashMap<String, Suite>"],
  ])("%s %s says nothing about an element", (language, text) => {
    const annotation = parse_type_annotation(text, language);

    expect(annotation && container_element_annotation(annotation)).toEqual(null);
  });
});

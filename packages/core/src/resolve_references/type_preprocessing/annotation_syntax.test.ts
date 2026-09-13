import { describe, it, expect } from "vitest";
import type { SymbolName } from "@ariadnejs/types";
import {
  parse_qualified_head,
  split_at_top_level,
  split_type_application,
  unwrap_enclosing,
  type TypeApplicationText,
} from "./annotation_syntax";

describe("split_at_top_level", () => {
  it.each<readonly [string, string, readonly string[]]>([
    ["A | B", "|", ["A", "B"]],
    ["| A", "|", ["", "A"]],
    ["Map<K, V>, W", ",", ["Map<K, V>", "W"]],
    ["(a: A, b: B) => C, D", ",", ["(a: A, b: B) => C", "D"]],
    ["Fn(A) -> B, C", ",", ["Fn(A) -> B", "C"]],
    ["'a, S", ",", ["'a", "S"]],
    ["\"x, y\", z", ",", ["\"x, y\"", "z"]],
    ["crate::a::S", "::", ["crate", "a", "S"]],
    ["A", "|", ["A"]],
  ])("splits %j on %j", (text, separator, expected) => {
    expect(split_at_top_level(text, separator)).toEqual(expected);
  });
});

describe("split_type_application", () => {
  it.each<readonly [string, "<" | "[", TypeApplicationText | null]>([
    ["F", "<", { head_text: "F", argument_texts: [] }],
    ["Map<K, V>", "<", { head_text: "Map", argument_texts: ["K", "V"] }],
    ["P<Foo<Bar>>", "<", { head_text: "P", argument_texts: ["Foo<Bar>"] }],
    ["F<>", "<", { head_text: "F", argument_texts: [] }],
    ["Dict[str, C]", "[", { head_text: "Dict", argument_texts: ["str", "C"] }],
    ["A<B>[]", "<", null],
    ["Foo<T>::Assoc", "<", null],
    ["F<A", "<", null],
    ["Record<\"a>\", B>", "<", { head_text: "Record", argument_texts: ["\"a>\"", "B"] }],
    ["Foo<']', Bar>", "<", { head_text: "Foo", argument_texts: ["']'", "Bar"] }],
  ])("reads %j with %j", (text, open, expected) => {
    expect(split_type_application(text, open)).toEqual(expected);
  });
});

describe("parse_qualified_head", () => {
  it.each<readonly [string, "." | "::", readonly SymbolName[] | null]>([
    ["F", ".", ["F" as SymbolName]],
    ["vfs.FileSystem", ".", ["vfs", "FileSystem"] as SymbolName[]],
    ["crate::a::State", "::", ["crate", "a", "State"] as SymbolName[]],
    ["$scope._x", ".", ["$scope", "_x"] as SymbolName[]],
    ["typeof F", ".", null],
    ["a..b", ".", null],
    ["", ".", null],
    ["1x", ".", null],
  ])("reads %j with %j", (head_text, separator, expected) => {
    expect(parse_qualified_head(head_text, separator)).toEqual(expected);
  });
});

describe("unwrap_enclosing", () => {
  it.each<readonly [string, "(" | "{", string | null]>([
    ["(A)", "(", "A"],
    ["( A | B )", "(", "A | B"],
    ["{X=}", "{", "X="],
    ["(A) => B", "(", null],
    ["(A)[]", "(", null],
    ["A", "(", null],
    ["(A", "(", null],
    ["(\")\" | A)", "(", "\")\" | A"],
  ])("unwraps %j with %j", (text, open, expected) => {
    expect(unwrap_enclosing(text, open)).toEqual(expected);
  });
});

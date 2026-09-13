import { describe, it, expect } from "vitest";
import type { SymbolName } from "@ariadnejs/types";
import type { ParsedTypeAnnotation } from "./annotation";
import { parse_rust_annotation } from "./annotation.rust";

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

describe("parse_rust_annotation", () => {
  it.each<readonly [string, ParsedTypeAnnotation | null]>([
    ["S", type_named("S")],
    ["&S", type_named("S")],
    ["&mut S", type_named("S")],
    ["&'a S", type_named("S")],
    ["&'a mut S", type_named("S")],
    ["&&S", type_named("S")],
    ["Option<Enc>", type_named("Enc")],
    ["Box<dyn Emit>", type_named("Emit")],
    ["Rc<S>", type_named("S")],
    ["Arc<S>", type_named("S")],
    ["std::sync::Arc<S>", type_named("S")],
    ["alloc::boxed::Box<S>", type_named("S")],
    ["widgets::Option<S>", qualified(["widgets", "Option"], [type_named("S")])],
    ["crate::rc::Rc<S>", qualified(["crate", "rc", "Rc"], [type_named("S")])],
    ["Option<&'a S>", type_named("S")],
    ["Box<dyn Emit + Send + 'static>", type_named("Emit")],
    ["&(dyn Emit + Sync)", type_named("Emit")],
    ["impl Emit", type_named("Emit")],
    ["impl ?Sized + Emit", type_named("Emit")],
    ["dyn Emit", type_named("Emit")],
    ["Vec<Enc>", type_named("Vec", [type_named("Enc")])],
    ["HashMap<K, V>", type_named("HashMap", [type_named("K"), type_named("V")])],
    ["Cow<'a, S>", type_named("Cow", [type_named("S")])],
    ["crate::a::State", qualified(["crate", "a", "State"])],
    ["::std::fmt::Formatter", qualified(["std", "fmt", "Formatter"])],
    ["Option<Vec<Enc>>", type_named("Vec", [type_named("Enc")])],
    ["Result<S, E>", type_named("Result", [type_named("S"), type_named("E")])],
    ["(S, T)", null],
    ["()", null],
    ["[S]", null],
    ["[S; 4]", null],
    ["dyn Fn(S) -> T", null],
    ["impl Iterator<Item = S>", null],
    ["<T as Trait>::Out", null],
  ])("%s", (text, expected) => {
    expect(parse_rust_annotation(text)).toEqual(expected);
  });
});

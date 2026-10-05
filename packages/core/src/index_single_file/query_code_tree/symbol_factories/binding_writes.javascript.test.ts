import { describe, it, expect } from "vitest";
import { parse_js } from "./test_utils";
import { written_values } from "./binding_writes.javascript";

/** The source text of every value written into the first declarator of `name` in `code`. */
function values_of(code: string, name: string): string[] {
  const declarator = parse_js(code)
    .descendantsOfType("variable_declarator")
    .find((node) => node.childForFieldName("name")?.text === name)!;
  return written_values(declarator).map((value) => value.text);
}

describe("written_values", () => {
  it("is the initialiser alone for a declarator written with one", () => {
    expect(values_of("let p = new Parser(); p = other;", "p")).toEqual(["new Parser()"]);
  });

  it("is every plain assignment in the declaring function for one declared without a value", () => {
    expect(values_of("function f(c) { var self; self = this; if (c) { self = this; } }", "self")).toEqual([
      "this",
      "this",
    ]);
  });

  it("searches a `var`'s whole function and a `let`'s own block", () => {
    expect(values_of("function f() { if (a) { var p; } p = make(); }", "p")).toEqual(["make()"]);
    expect(values_of("function f() { if (a) { let p; p = one(); } p = two(); }", "p")).toEqual(["one()"]);
  });

  it("is nothing when a nested function, a compound assignment, an increment or a loop target writes it", () => {
    expect(values_of("var p; p = a; function g() { p = b; }", "p")).toEqual([]);
    expect(values_of("var p; p = a; const g = () => { p = b; };", "p")).toEqual([]);
    expect(values_of("let p; p = a; p += b;", "p")).toEqual([]);
    expect(values_of("let p; p = a; p++;", "p")).toEqual([]);
    expect(values_of("let p; for (p of xs) {}", "p")).toEqual([]);
  });

  it("skips scopes that bind the name again", () => {
    expect(
      values_of(
        [
          "let p;",
          "p = kept;",
          "function a(p) { p = x; }",
          "function b({ p }) { p = x; }",
          "function c() { var p; p = x; }",
          "const d = (p) => { p = x; };",
          "{ let p; p = x; }",
          "for (let p of xs) { p = x; }",
          "try {} catch (p) { p = x; }",
        ].join("\n"),
        "p"
      )
    ).toEqual(["kept"]);
  });

  it("reads a parameter's default value as an expression, not as a binding of the name", () => {
    expect(values_of("let p; p = kept; function a(q = p) { p = x; }", "p")).toEqual([]);
  });
});

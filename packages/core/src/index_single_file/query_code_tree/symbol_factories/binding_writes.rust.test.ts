import { describe, it, expect } from "vitest";
import { parse_rust } from "./test_utils";
import { declaration_written_by, written_values } from "./binding_writes.rust";

/** The source text of every value written into the first `let` of `name` in `fn f() { <body> }`. */
function values_of(body: string, name: string): string[] {
  const declaration = parse_rust(`fn f() { ${body} }`)
    .descendantsOfType("let_declaration")
    .find((node) => node.childForFieldName("pattern")?.text === name)!;
  return written_values(declaration).map((value) => value.text);
}

/** The line and column of the `let` the `index`th plain assignment to `name` writes, or null. */
function declaration_of(body: string, name: string, index: number): string | null {
  const left = parse_rust(`fn f() {\n${body}\n}`)
    .descendantsOfType("assignment_expression")
    .map((assignment) => assignment.childForFieldName("left")!)
    .filter((node) => node.text === name)[index];
  const declared = declaration_written_by(left);
  return declared ? `${declared.startPosition.row}:${declared.startPosition.column}` : null;
}

describe("written_values", () => {
  it("is the initialiser alone for a `let` written with one", () => {
    expect(values_of("let p = Foo::new(); p = other;", "p")).toEqual(["Foo::new()"]);
  });

  it("is every plain assignment after a `let` declared without a value, typed or not", () => {
    expect(values_of("let this; if c { this = Foo::new(); } else { this = Foo::new(); }", "this")).toEqual([
      "Foo::new()",
      "Foo::new()",
    ]);
    expect(values_of("let mut p: Foo; p = make();", "p")).toEqual(["make()"]);
  });

  it("is nothing when a closure or a compound assignment writes it", () => {
    expect(values_of("let p; p = a; let g = || { p = b; };", "p")).toEqual([]);
    expect(values_of("let mut p; p = a; p += b;", "p")).toEqual([]);
  });

  it("stops at a later `let` of the name and skips scopes and items that bind it again", () => {
    expect(
      values_of(
        [
          "let p;",
          "p = kept;",
          "{ p = also_kept; let p; p = x; }",
          "for p in xs { p = x; }",
          "match v { Some(p) => { p = x; } _ => {} }",
          "if let Some(p) = v { p = x; }",
          "let g = |p| { p = x; };",
          "fn inner() { let p; p = x; }",
          "let p = 1;",
          "p = x;",
        ].join("\n"),
        "p"
      )
    ).toEqual(["kept", "also_kept"]);
  });
});

describe("declaration_written_by", () => {
  it("is the nearest preceding `let` of the name in an enclosing block", () => {
    expect(declaration_of("let p;\nif c { p = Foo::new(); }", "p", 0)).toEqual("1:4");
    expect(declaration_of("let p;\n{ let p;\np = Foo::new(); }", "p", 0)).toEqual("2:6");
  });

  it("is nothing across a closure, or where a scope between binds the name again", () => {
    expect(declaration_of("let p;\nlet g = || { p = Foo::new(); };", "p", 0)).toEqual(null);
    expect(declaration_of("let p;\nfor p in xs { p = Foo::new(); }", "p", 0)).toEqual(null);
    expect(declaration_of("p = Foo::new();", "p", 0)).toEqual(null);
  });
});

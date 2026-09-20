/**
 * What one call site's argument list reads as, across the grammars that spell a
 * call the same way.
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import TypeScript from "tree-sitter-typescript";
import type { SyntaxNode } from "tree-sitter";
import { extract_call_arguments } from "./call_arguments";

function parse(language: unknown, source: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(language as never);
  return parser.parse(source).rootNode;
}

/** The first identifier in `source` whose text is `name`. */
function identifier(root: SyntaxNode, name: string): SyntaxNode {
  const pending: SyntaxNode[] = [root];
  while (pending.length > 0) {
    const node = pending.shift() as SyntaxNode;
    if (node.type === "identifier" && node.text === name) {
      return node;
    }
    pending.push(...node.namedChildren);
  }
  throw new Error(`no identifier ${name}`);
}

const python = (source: string) => parse(Python, source);
const typescript = (source: string) => parse(TypeScript.typescript, source);

describe("extract_call_arguments", () => {
  it("names each bare identifier argument of a python call", () => {
    const root = python("build(MyForm, options)\n");

    expect(extract_call_arguments(identifier(root, "build"))).toEqual(["MyForm", "options"]);
  });

  it("names each bare identifier argument of a typescript call", () => {
    const root = typescript("build(MyForm, options);\n");

    expect(extract_call_arguments(identifier(root, "build"))).toEqual(["MyForm", "options"]);
  });

  it("holds a null for an argument that is not a bare identifier, keeping later positions", () => {
    const root = python("build(1, MyForm, **kw)\n");

    expect(extract_call_arguments(identifier(root, "build"))).toEqual([null, "MyForm", null]);
  });

  it("passes over a comment, which binds no parameter and would move every argument after it", () => {
    const root = python("build(  # a note\n    MyForm, options)\n");

    expect(extract_call_arguments(identifier(root, "build"))).toEqual(["MyForm", "options"]);
  });

  it("ends the list at a python splat, which stands for an unknown number of positions", () => {
    const root = python("build(MyForm, *rest, Other)\n");

    expect(extract_call_arguments(identifier(root, "build"))).toEqual(["MyForm"]);
  });

  it("ends the list at a typescript spread", () => {
    const root = typescript("build(MyForm, ...rest, Other);\n");

    expect(extract_call_arguments(identifier(root, "build"))).toEqual(["MyForm"]);
  });

  it("reads an empty list for a call taking no arguments", () => {
    const root = python("build()\n");

    expect(extract_call_arguments(identifier(root, "build"))).toEqual([]);
  });

  it("reads the arguments of the call an identifier is the callee of, not the one enclosing it", () => {
    const root = python("outer(inner(MyForm), other)\n");

    expect(extract_call_arguments(identifier(root, "inner"))).toEqual(["MyForm"]);
  });

  it("reads nothing for an identifier that is an argument rather than a callee", () => {
    const root = python("outer(MyForm)\n");

    expect(extract_call_arguments(identifier(root, "MyForm"))).toBe(undefined);
  });

  it("reads nothing for an identifier in no call at all", () => {
    const root = python("x = MyForm\n");

    expect(extract_call_arguments(identifier(root, "MyForm"))).toBe(undefined);
  });
});

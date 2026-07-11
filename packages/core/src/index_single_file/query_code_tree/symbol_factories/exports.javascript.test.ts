import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import type { SyntaxNode } from "tree-sitter";
import type { SymbolName } from "@ariadnejs/types";
import {
  analyze_export_statement,
  extract_export_info,
} from "./exports.javascript";

let parser: Parser;

beforeAll(() => {
  parser = new Parser();
  parser.setLanguage(JavaScript);
});

function parse(code: string): SyntaxNode {
  return parser.parse(code).rootNode;
}

function first_of_type(node: SyntaxNode, type: string): SyntaxNode {
  if (node.type === type) return node;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const found = maybe_first_of_type(child, type);
      if (found) return found;
    }
  }
  throw new Error(`no ${type} node found`);
}

function maybe_first_of_type(
  node: SyntaxNode,
  type: string
): SyntaxNode | undefined {
  if (node.type === type) return node;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const found = maybe_first_of_type(child, type);
      if (found) return found;
    }
  }
  return undefined;
}

const DECLARATION_PARENTS = new Set([
  "function_declaration",
  "generator_function_declaration",
  "class_declaration",
  "variable_declarator",
  "method_definition",
]);

/**
 * Locate the identifier node at a definition's declaration site, matching the
 * `capture.node` the definition capture handlers hand to `extract_export_info`.
 * Identifiers appearing in export specifiers or object literals are skipped so
 * the cache-lookup path is exercised rather than the direct parent walk.
 */
function def_name_node(root: SyntaxNode, name: string): SyntaxNode {
  function search(node: SyntaxNode): SyntaxNode | undefined {
    if (
      node.type === "identifier" &&
      node.text === name &&
      node.parent &&
      DECLARATION_PARENTS.has(node.parent.type)
    ) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const found = search(child);
        if (found) return found;
      }
    }
    return undefined;
  }
  const found = search(root);
  if (!found) throw new Error(`no declaration named ${name} found`);
  return found;
}

function info(code: string, name: string) {
  return extract_export_info(def_name_node(parse(code), name), name as SymbolName);
}

describe("extract_export_info direct exports", () => {
  it("marks an exported function declaration as exported with no extra metadata", () => {
    expect(info("export function greet() {}", "greet")).toEqual({
      is_exported: true,
      export: undefined,
    });
  });

  it("marks an exported const as exported with no extra metadata", () => {
    expect(info("export const answer = 42;", "answer")).toEqual({
      is_exported: true,
      export: undefined,
    });
  });

  it("marks a non-exported function declaration as not exported", () => {
    expect(info("function hidden() {}", "hidden")).toEqual({
      is_exported: false,
    });
  });

  it("marks a non-exported const as not exported", () => {
    expect(info("const secret = 1;", "secret")).toEqual({
      is_exported: false,
    });
  });
});

describe("extract_export_info default exports", () => {
  it("flags a default exported function", () => {
    expect(info("export default function main() {}", "main")).toEqual({
      is_exported: true,
      export: { is_default: true },
    });
  });

  it("flags a default exported class", () => {
    expect(info("export default class App {}", "App")).toEqual({
      is_exported: true,
      export: { is_default: true },
    });
  });
});

describe("extract_export_info export lists", () => {
  it("marks every symbol in an export list as exported", () => {
    const code = "const a = 1;\nconst b = 2;\nexport { a, b };";
    expect(info(code, "a")).toEqual({
      is_exported: true,
      export: { export_name: undefined, is_reexport: false },
    });
    expect(info(code, "b")).toEqual({
      is_exported: true,
      export: { export_name: undefined, is_reexport: false },
    });
  });

  it("records the public name for an aliased export", () => {
    const code = "const value = 1;\nexport { value as publicValue };";
    expect(info(code, "value")).toEqual({
      is_exported: true,
      export: { export_name: "publicValue" as SymbolName, is_reexport: false },
    });
  });

  it("does not mark a locally defined symbol absent from the export list", () => {
    const code = "const a = 1;\nconst b = 2;\nexport { a };";
    expect(info(code, "b")).toEqual({ is_exported: false });
  });
});

describe("extract_export_info CommonJS module.exports object", () => {
  it("marks a shorthand-exported symbol as exported", () => {
    const code = "function foo() {}\nmodule.exports = { foo };";
    expect(info(code, "foo")).toEqual({ is_exported: true, export: {} });
  });

  it("records the public name for a renamed pair export", () => {
    const code = "function foo() {}\nmodule.exports = { renamed: foo };";
    expect(info(code, "foo")).toEqual({
      is_exported: true,
      export: { export_name: "renamed" as SymbolName },
    });
  });

  it("adds no alias metadata when pair key matches the value", () => {
    const code = "function foo() {}\nmodule.exports = { foo: foo };";
    expect(info(code, "foo")).toEqual({ is_exported: true, export: {} });
  });

  it("does not treat exports.name property assignment as an export", () => {
    const code = "function foo() {}\nexports.foo = foo;";
    expect(info(code, "foo")).toEqual({ is_exported: false });
  });

  it("does not treat module.exports.name property assignment as an export", () => {
    const code = "function foo() {}\nmodule.exports.foo = foo;";
    expect(info(code, "foo")).toEqual({ is_exported: false });
  });
});

describe("extract_export_info nested-scope boundary", () => {
  it("keeps a variable inside an exported function unexported", () => {
    const code = "export function outer() {\n  const inner = 1;\n}";
    expect(info(code, "inner")).toEqual({ is_exported: false });
  });

  it("still marks the enclosing exported function as exported", () => {
    const code = "export function outer() {\n  const inner = 1;\n}";
    expect(info(code, "outer")).toEqual({
      is_exported: true,
      export: undefined,
    });
  });
});

describe("analyze_export_statement", () => {
  function statement(code: string): SyntaxNode {
    return first_of_type(parse(code), "export_statement");
  }

  it("flags default exports regardless of symbol name", () => {
    const node = statement("export default function foo() {}");
    expect(analyze_export_statement(node, "foo" as SymbolName)).toEqual({
      is_default: true,
    });
  });

  it("returns a re-export flag with no symbol name", () => {
    const node = statement("export { foo } from './other';");
    expect(analyze_export_statement(node)).toEqual({ is_reexport: true });
  });

  it("returns re-export metadata with the alias for a matched symbol", () => {
    const node = statement("export { foo as bar } from './other';");
    expect(analyze_export_statement(node, "foo" as SymbolName)).toEqual({
      is_reexport: true,
      export_name: "bar" as SymbolName,
    });
  });

  it("returns undefined when the symbol is absent from a re-export", () => {
    const node = statement("export { foo } from './other';");
    expect(
      analyze_export_statement(node, "missing" as SymbolName)
    ).toBeUndefined();
  });

  it("returns the alias for a local aliased export", () => {
    const node = statement("export { foo as bar };");
    expect(analyze_export_statement(node, "foo" as SymbolName)).toEqual({
      export_name: "bar" as SymbolName,
    });
  });

  it("returns undefined for a local export without an alias", () => {
    const node = statement("export { foo };");
    expect(
      analyze_export_statement(node, "foo" as SymbolName)
    ).toBeUndefined();
  });

  it("returns undefined for a direct export declaration", () => {
    const node = statement("export function foo() {}");
    expect(
      analyze_export_statement(node, "foo" as SymbolName)
    ).toBeUndefined();
  });
});

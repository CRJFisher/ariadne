import { describe, it, expect } from "vitest";
import type { Language, SyntaxNode } from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";
import { Parser } from "../../native";
import {
  LANGUAGE_TO_TREESITTER_LANG,
  SUPPORTED_LANGUAGES,
  is_tsx_file,
  grammar_for_dialect,
  parser_for,
} from "./parsers";

/** The type name straight from the binding, whatever the node class carries. */
function type_from_binding(node: SyntaxNode): string {
  const accessor: unknown = Reflect.get(Parser, "SyntaxNode");
  if (typeof accessor !== "function") {
    throw new Error("tree-sitter exports no SyntaxNode class");
  }
  const descriptor = Object.getOwnPropertyDescriptor(accessor.prototype, "type");
  if (!descriptor?.get) {
    throw new Error("tree-sitter's SyntaxNode has no type accessor");
  }
  return descriptor.get.call(node);
}

function every_node(root: SyntaxNode): SyntaxNode[] {
  const all: SyntaxNode[] = [];
  const pending: SyntaxNode[] = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;
    all.push(node);
    pending.push(...node.children);
  }
  return all;
}

describe("parsers", () => {
  describe("LANGUAGE_TO_TREESITTER_LANG", () => {
    it("maps each supported language to its tree-sitter grammar", () => {
      expect([...LANGUAGE_TO_TREESITTER_LANG.keys()]).toEqual([
        "javascript",
        "typescript",
        "python",
        "rust",
      ]);
      expect(LANGUAGE_TO_TREESITTER_LANG.get("javascript")).toBe(JavaScript);
      expect(LANGUAGE_TO_TREESITTER_LANG.get("typescript")).toBe(
        TypeScript.typescript
      );
      expect(LANGUAGE_TO_TREESITTER_LANG.get("python")).toBe(Python);
      expect(LANGUAGE_TO_TREESITTER_LANG.get("rust")).toBe(Rust);
    });
  });

  describe("grammar_for_dialect", () => {
    it("selects the tsx grammar for the tsx dialect and typescript otherwise", () => {
      expect(grammar_for_dialect("typescript", true)).toBe(TypeScript.tsx);
      expect(grammar_for_dialect("typescript", false)).toBe(
        TypeScript.typescript
      );
    });

    it("uses the default grammar for non-typescript languages in either dialect", () => {
      expect(grammar_for_dialect("javascript", true)).toBe(JavaScript);
      expect(grammar_for_dialect("python", false)).toBe(Python);
    });
  });

  describe("is_tsx_file", () => {
    it("is true only for a .tsx TypeScript file", () => {
      expect(is_tsx_file("typescript", "/x/Component.tsx")).toBe(true);
      expect(is_tsx_file("typescript", "/x/module.ts")).toBe(false);
      // A `.tsx` path under a non-typescript language is never the tsx dialect.
      expect(is_tsx_file("javascript", "/x/weird.tsx")).toBe(false);
    });
  });

  describe("parser_for", () => {
    const sources: Readonly<Record<string, { path: string; code: string }>> = {
      typescript: {
        path: "/x/module.ts",
        code: "export class A { m(x: number): string { return `${x}`; } }\nconst a = new A();\na.m(1);\n",
      },
      tsx: {
        path: "/x/Component.tsx",
        code: "const C = () => <div className='a'>{[1, 2].map((n) => n)}</div>;\nexport default C;\n",
      },
      javascript: {
        path: "/x/module.js",
        code: "/** @type {number} */\nconst n = 1;\nmodule.exports = { n };\nasync function* g() { yield await Promise.resolve(n); }\n",
      },
      python: {
        path: "/x/mod.py",
        code: "class A:\n    def m(self, x: int) -> str:\n        return f'{x}'\n\na = A()\na.m(1)\n",
      },
      rust: {
        path: "/x/lib.rs",
        code: "pub struct A { n: u32 }\nimpl A {\n    pub fn new(n: u32) -> Self { Self { n } }\n}\nfn main() { let a = A::new(1); }\n",
      },
    };

    it.each([
      ["typescript" as const, "typescript"],
      ["typescript" as const, "tsx"],
      ["javascript" as const, "javascript"],
      ["python" as const, "python"],
      ["rust" as const, "rust"],
    ])(
      "reports the binding's own type name for every %s node (%s)",
      (language, dialect) => {
        const { path, code } = sources[dialect];
        const tree = parser_for(language, path).parse(code);
        const nodes = every_node(tree.rootNode);

        const disagreements = nodes.filter(
          (node) => node.type !== type_from_binding(node)
        );

        expect(disagreements).toEqual([]);
        expect(nodes.length).toBeGreaterThan(20);
      }
    );

    it("gives a node type carried by the class the same name on every node of that type", () => {
      const tree = parser_for("typescript", "/x/module.ts").parse(
        "const a = 1; const b = 2; const c = 3;\n"
      );
      const declarators = every_node(tree.rootNode).filter(
        (node) => node.type === "variable_declarator"
      );

      expect(declarators).toHaveLength(3);
      expect(declarators.map((node) => node.type)).toEqual([
        "variable_declarator",
        "variable_declarator",
        "variable_declarator",
      ]);
    });

    it("binds the grammar the file's dialect selects", () => {
      const tsx_parser = parser_for("typescript", "/x/Component.tsx");
      const ts_parser = parser_for("typescript", "/x/module.ts");

      const tsx_grammar: Language | null = tsx_parser.getLanguage();
      const ts_grammar: Language | null = ts_parser.getLanguage();

      expect(tsx_grammar).toBe(TypeScript.tsx);
      expect(ts_grammar).toBe(TypeScript.typescript);
    });
  });

  describe("SUPPORTED_LANGUAGES", () => {
    it("lists exactly the languages with a tree-sitter grammar", () => {
      expect(SUPPORTED_LANGUAGES).toEqual([
        "javascript",
        "typescript",
        "python",
        "rust",
      ]);
      expect([...LANGUAGE_TO_TREESITTER_LANG.keys()]).toEqual([
        ...SUPPORTED_LANGUAGES,
      ]);
    });
  });
});

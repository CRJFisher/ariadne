import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import { PythonScopeBoundaryExtractor } from "./python_scope_boundary_extractor";
import type { FilePath, ScopeType, SymbolName } from "@ariadnejs/types";
import type { ScopeBoundaries } from "../boundary_base";
import { SemanticCategory, SemanticEntity, type CaptureNode } from "../../capture_types";

const FP = "test.py" as FilePath;

describe("PythonScopeBoundaryExtractor", () => {
  let parser: Parser;
  let extractor: PythonScopeBoundaryExtractor;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
    extractor = new PythonScopeBoundaryExtractor();
  });

  // Mirrors the pipeline: the scope processor passes the exact node the .scm query
  // captures (a body `block` for classes, the inner `function_definition` for most
  // defs, the outer `decorated_definition` for classmethods, the `lambda` node itself).
  function boundaries_for(
    code: string,
    scope_type: ScopeType,
    pick: (root: Parser.SyntaxNode) => Parser.SyntaxNode
  ): ScopeBoundaries {
    const tree = parser.parse(code);
    return extractor.extract_boundaries(pick(tree.rootNode), scope_type, FP);
  }

  const class_body = (root: Parser.SyntaxNode) =>
    root.firstChild!.childForFieldName("body")!;
  const first_def_in_class = (root: Parser.SyntaxNode) =>
    root.firstChild!.childForFieldName("body")!.firstNamedChild!;

  describe("module scope", () => {
    it("spans the whole file with symbol and scope coinciding", () => {
      const boundaries = boundaries_for(
        "x = 1\ndef f():\n    return x",
        "module",
        (root) => root
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 1,
          end_line: 3,
          end_column: 12,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 1,
          end_line: 3,
          end_column: 12,
        },
      });
    });
  });

  describe("class scope", () => {
    it("names the class in the parent scope and opens the body after the colon", () => {
      const boundaries = boundaries_for(
        "class Calculator:\n    def add(self, x):\n        return x + 1",
        "class",
        class_body
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 7,
          end_line: 1,
          end_column: 16,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 18,
          end_line: 3,
          end_column: 20,
        },
      });
    });

    it("opens the body after the base-class list and colon", () => {
      const boundaries = boundaries_for(
        "class Child(Parent, Mixin):\n    pass",
        "class",
        class_body
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 7,
          end_line: 1,
          end_column: 11,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 28,
          end_line: 2,
          end_column: 8,
        },
      });
    });

    it("extends the scope to the end of the last method", () => {
      const boundaries = boundaries_for(
        "class Calculator:\n    def add(self, x, y):\n        return x + y\n\n    def subtract(self, x, y):\n        return x - y",
        "class",
        class_body
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 7,
          end_line: 1,
          end_column: 16,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 18,
          end_line: 6,
          end_column: 20,
        },
      });
    });

    it("handles a class whose only body is pass", () => {
      const boundaries = boundaries_for(
        "class Empty:\n    pass",
        "class",
        class_body
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 7,
          end_line: 1,
          end_column: 11,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 13,
          end_line: 2,
          end_column: 8,
        },
      });
    });

    it("reads the name from the class_definition of a decorated class", () => {
      const boundaries = boundaries_for(
        "@dataclass\nclass Person:\n    name: str",
        "class",
        (root) =>
          root.firstChild!.childForFieldName("definition")!.childForFieldName(
            "body"
          )!
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 2,
          start_column: 7,
          end_line: 2,
          end_column: 12,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 2,
          start_column: 14,
          end_line: 3,
          end_column: 13,
        },
      });
    });

    it("resolves the nearest enclosing class for a nested class", () => {
      const boundaries = boundaries_for(
        "class Outer:\n    class Inner:\n        def method(self):\n            pass",
        "class",
        class_body
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 7,
          end_line: 1,
          end_column: 11,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 13,
          end_line: 4,
          end_column: 16,
        },
      });
    });

    it("opens the body after the colon on the last line of a multi-line base list", () => {
      const boundaries = boundaries_for(
        "class Complex(\n    BaseClass,\n    MixinOne,\n    MixinTwo\n):\n    def method(self):\n        pass",
        "class",
        class_body
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 7,
          end_line: 1,
          end_column: 13,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 5,
          start_column: 3,
          end_line: 7,
          end_column: 12,
        },
      });
    });

    it("finds the colon despite extra spacing before it", () => {
      const boundaries = boundaries_for(
        "class TestClass   :\n    pass",
        "class",
        class_body
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 7,
          end_line: 1,
          end_column: 15,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 20,
          end_line: 2,
          end_column: 8,
        },
      });
    });

    it("handles a single-line class definition", () => {
      const boundaries = boundaries_for("class Point: pass", "class", class_body);

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 7,
          end_line: 1,
          end_column: 11,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 13,
          end_line: 1,
          end_column: 17,
        },
      });
    });

    it("rejects a non-block node for a class scope", () => {
      const tree = parser.parse("class Calculator:\n    pass");
      const class_definition = tree.rootNode.firstChild!;

      expect(() =>
        extractor.extract_boundaries(class_definition, "class", FP)
      ).toThrow("Expected block node for class scope, got class_definition");
    });
  });

  describe("function scope", () => {
    it("names the function in the parent scope and opens the scope at the parameters", () => {
      const boundaries = boundaries_for(
        "def calculate(x, y):\n    return x + y",
        "function",
        (root) => root.firstChild!
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 5,
          end_line: 1,
          end_column: 13,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 14,
          end_line: 2,
          end_column: 16,
        },
      });
    });

    it("opens the scope at the parameters for a function with type hints", () => {
      const boundaries = boundaries_for(
        "def typed_func(x: int, y: str) -> bool:\n    return True",
        "function",
        (root) => root.firstChild!
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 5,
          end_line: 1,
          end_column: 14,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 15,
          end_line: 2,
          end_column: 15,
        },
      });
    });

    it("skips the async keyword when placing the function name", () => {
      const boundaries = boundaries_for(
        "async def fetch_data():\n    return await api_call()",
        "function",
        (root) => root.firstChild!
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 11,
          end_line: 1,
          end_column: 20,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 21,
          end_line: 2,
          end_column: 27,
        },
      });
    });

    it("takes the name and body from the inner function of a decorated def", () => {
      const boundaries = boundaries_for(
        "@staticmethod\n@cache\ndef expensive_func():\n    return calc()",
        "function",
        (root) => root.firstChild!.childForFieldName("definition")!
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 3,
          start_column: 5,
          end_line: 3,
          end_column: 18,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 3,
          start_column: 19,
          end_line: 4,
          end_column: 17,
        },
      });
    });

    it("scopes a function nested inside another function", () => {
      const boundaries = boundaries_for(
        "def outer():\n    def inner(a):\n        return a\n    return inner",
        "function",
        first_def_in_class
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 2,
          start_column: 9,
          end_line: 2,
          end_column: 13,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 2,
          start_column: 14,
          end_line: 3,
          end_column: 16,
        },
      });
    });

    it("scopes an empty function body", () => {
      const boundaries = boundaries_for(
        "def empty_func():\n    ...",
        "function",
        (root) => root.firstChild!
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 5,
          end_line: 1,
          end_column: 14,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 15,
          end_line: 2,
          end_column: 7,
        },
      });
    });

    it("opens the scope at the opening parenthesis for complex parameter types", () => {
      const boundaries = boundaries_for(
        "def complex_method(self, data: Dict[str, Any], callback: Optional[Callable[[str], None]] = None):\n    return data",
        "function",
        (root) => root.firstChild!
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 5,
          end_line: 1,
          end_column: 18,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 19,
          end_line: 2,
          end_column: 15,
        },
      });
    });

    it("rejects an unexpected node type for a function scope", () => {
      const tree = parser.parse("x = 1");
      const statement = tree.rootNode.firstChild!;

      expect(() =>
        extractor.extract_boundaries(statement, "function", FP)
      ).toThrow(
        "Expected function_definition, lambda, or decorated_definition node, got expression_statement"
      );
    });
  });

  describe("method scope", () => {
    it("scopes a method captured as a function_definition inside a class", () => {
      const boundaries = boundaries_for(
        "class Calc:\n    def add(self, x):\n        return x",
        "method",
        first_def_in_class
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 2,
          start_column: 9,
          end_line: 2,
          end_column: 11,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 2,
          start_column: 12,
          end_line: 3,
          end_column: 16,
        },
      });
    });

    it("unwraps the decorated_definition captured for a classmethod", () => {
      const boundaries = boundaries_for(
        "class C:\n    @classmethod\n    def make(cls, x):\n        return x",
        "method",
        first_def_in_class
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 3,
          start_column: 9,
          end_line: 3,
          end_column: 12,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 3,
          start_column: 13,
          end_line: 4,
          end_column: 16,
        },
      });
    });
  });

  describe("constructor scope", () => {
    it("treats __init__ as a regular method scope", () => {
      const boundaries = boundaries_for(
        "class Person:\n    def __init__(self, name):\n        self.name = name",
        "constructor",
        first_def_in_class
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 2,
          start_column: 9,
          end_line: 2,
          end_column: 16,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 2,
          start_column: 17,
          end_line: 3,
          end_column: 24,
        },
      });
    });
  });

  describe("lambda scope", () => {
    it("treats the lambda expression as both symbol and scope", () => {
      const boundaries = boundaries_for(
        "cb = lambda x: x * 2",
        "function",
        (root) => root.firstChild!.firstChild!.childForFieldName("right")!
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 6,
          end_line: 1,
          end_column: 20,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 6,
          end_line: 1,
          end_column: 20,
        },
      });
    });
  });

  describe("block scope", () => {
    it("treats an if statement as both symbol and scope", () => {
      const boundaries = boundaries_for(
        "if condition:\n    do_something()",
        "block",
        (root) => root.firstChild!
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 1,
          end_line: 2,
          end_column: 18,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 1,
          end_line: 2,
          end_column: 18,
        },
      });
    });

    it("treats a for loop as both symbol and scope", () => {
      const boundaries = boundaries_for(
        "for i in range(10):\n    print(i)",
        "block",
        (root) => root.firstChild!
      );

      expect(boundaries).toEqual({
        symbol_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 1,
          end_line: 2,
          end_column: 12,
        },
        scope_location: {
          file_path: "test.py",
          start_line: 1,
          start_column: 1,
          end_line: 2,
          end_column: 12,
        },
      });
    });
  });

  it("rejects an unsupported scope type", () => {
    const tree = parser.parse("x = 1");

    expect(() =>
      extractor.extract_boundaries(
        tree.rootNode,
        "parameter" as ScopeType,
        FP
      )
    ).toThrow("Unsupported scope type: parameter");
  });
});

describe("PythonScopeBoundaryExtractor.sort_captures", () => {
  const extractor = new PythonScopeBoundaryExtractor();

  function scope_capture(
    entity: SemanticEntity,
    start_line: number,
    start_column: number,
    end_line: number,
    end_column: number
  ): CaptureNode {
    return {
      category: SemanticCategory.SCOPE,
      entity,
      name: `scope.${entity}`,
      text: "" as SymbolName,
      location: { file_path: FP, start_line, start_column, end_line, end_column },
      node: {} as Parser.SyntaxNode,
    };
  }

  it("orders a containing class scope before the method scope it contains", () => {
    // Same start position: plain location order would put the method (earlier
    // end) first; only containment decides parent-before-child here.
    const method = scope_capture(SemanticEntity.METHOD, 1, 10, 3, 20);
    const cls = scope_capture(SemanticEntity.CLASS, 1, 10, 5, 1);

    expect(extractor.sort_captures([method, cls])).toEqual([cls, method]);
  });

  it("orders disjoint scopes by area, larger first", () => {
    const small = scope_capture(SemanticEntity.FUNCTION, 1, 1, 1, 20);
    const large = scope_capture(SemanticEntity.FUNCTION, 10, 1, 20, 1);

    expect(extractor.sort_captures([small, large])).toEqual([large, small]);
  });

  it("breaks an identical-location tie by scope-type priority", () => {
    const block = scope_capture(SemanticEntity.BLOCK, 1, 1, 5, 1);
    const cls = scope_capture(SemanticEntity.CLASS, 1, 1, 5, 1);

    expect(extractor.sort_captures([block, cls])).toEqual([cls, block]);
  });

  it("falls back to location order for equal-area, equal-priority scopes", () => {
    const later = scope_capture(SemanticEntity.FUNCTION, 10, 1, 10, 21);
    const earlier = scope_capture(SemanticEntity.FUNCTION, 1, 1, 1, 21);

    expect(extractor.sort_captures([later, earlier])).toEqual([
      earlier,
      later,
    ]);
  });
});

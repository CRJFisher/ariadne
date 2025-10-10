import { describe, it, expect, beforeAll, vi } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import { PythonScopeBoundaryExtractor } from "./python_scope_boundary_extractor";
import type { FilePath } from "@ariadnejs/types";

describe("PythonScopeBoundaryExtractor", () => {
  let parser: Parser;
  let extractor: PythonScopeBoundaryExtractor;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
    extractor = new PythonScopeBoundaryExtractor();
  });

  describe("Class boundaries", () => {
    it("should extract class name and body boundaries correctly", () => {
      const code = `class Calculator:
    def add(self, x):
        return x + 1`;

      const tree = parser.parse(code);
      const class_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        class_node,
        "class",
        "test.py" as FilePath
      );

      // Symbol location: just "Calculator"
      expect(boundaries.symbol_location).toEqual({
        file_path: "test.py",
        start_line: 1,
        start_column: 7,
        end_line: 1,
        end_column: 16,
      });

      // Scope location: starts AFTER ":", not at "def"
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_column).toBeGreaterThan(17); // After name
      expect(boundaries.scope_location.end_line).toBe(3); // End of class body
    });

    it("should handle class with base classes", () => {
      const code = `class Child(Parent, Mixin):
    pass`;

      const tree = parser.parse(code);
      const class_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        class_node,
        "class",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_column).toBe(7); // "Child"
      expect(boundaries.symbol_location.end_column).toBe(11); // "Child"
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_column).toBeGreaterThan(27); // After "(Parent, Mixin):"
    });

    it("should handle class with multiple methods", () => {
      const code = `class Calculator:
    def add(self, x, y):
        return x + y

    def subtract(self, x, y):
        return x - y`;

      const tree = parser.parse(code);
      const class_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        class_node,
        "class",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.end_line).toBe(6); // End of class with multiple methods
    });

    it("should handle class with no body (just pass)", () => {
      const code = `class Empty:
    pass`;

      const tree = parser.parse(code);
      const class_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        class_node,
        "class",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.end_line).toBe(2);
    });

    it("should handle decorated class", () => {
      const code = `@dataclass
class Person:
    name: str`;

      const tree = parser.parse(code);
      // Decorated class is wrapped in decorated_definition
      const decorated_node = tree.rootNode.firstChild!;
      const class_node = decorated_node.childForFieldName("definition")!;

      const boundaries = extractor.extract_boundaries(
        class_node,
        "class",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(2); // Class is on line 2
      expect(boundaries.scope_location.start_line).toBe(2);
    });

    it("should handle nested classes", () => {
      const code = `class Outer:
    class Inner:
        def method(self):
            pass`;

      const tree = parser.parse(code);
      const outer_class = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        outer_class,
        "class",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.end_line).toBe(4);
    });
  });

  describe("Function boundaries", () => {
    it("should extract function name and scope correctly", () => {
      const code = `def calculate(x, y):
    return x + y`;

      const tree = parser.parse(code);
      const func_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        func_node,
        "function",
        "test.py" as FilePath
      );

      // Symbol: just the name
      expect(boundaries.symbol_location).toEqual({
        file_path: "test.py",
        start_line: 1,
        start_column: 5,
        end_line: 1,
        end_column: 13,
      });

      // Scope: starts at parameters
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_column).toBe(14); // At "("
    });

    it("should extract method boundaries inside class", () => {
      const code = `class Calc:
    def add(self, x):
        return x`;

      const tree = parser.parse(code);
      const class_node = tree.rootNode.firstChild!;
      const body_node = class_node.childForFieldName("body")!;
      const method_node = body_node.firstNamedChild!;

      const boundaries = extractor.extract_boundaries(
        method_node,
        "method",
        "test.py" as FilePath
      );

      // Symbol: "add"
      expect(boundaries.symbol_location.start_line).toBe(2);
      expect(boundaries.symbol_location.start_column).toBe(9); // "add"

      // Scope: starts at parameters
      expect(boundaries.scope_location.start_line).toBe(2);
      expect(boundaries.scope_location.start_column).toBe(12); // At "("
    });

    it("should handle function with type hints", () => {
      const code = `def typed_func(x: int, y: str) -> bool:
    return True`;

      const tree = parser.parse(code);
      const func_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        func_node,
        "function",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(1);
      expect(boundaries.symbol_location.start_column).toBe(5); // "typed_func"
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_column).toBe(15); // At "("
    });

    it("should handle async function", () => {
      const code = `async def fetch_data():
    return await api_call()`;

      const tree = parser.parse(code);
      const func_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        func_node,
        "function",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(1);
      expect(boundaries.symbol_location.start_column).toBe(11); // "fetch_data"
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_column).toBe(21); // At "("
    });
  });

  describe("Constructor boundaries", () => {
    it("should handle __init__ method as regular function", () => {
      const code = `class Person:
    def __init__(self, name):
        self.name = name`;

      const tree = parser.parse(code);
      const class_node = tree.rootNode.firstChild!;
      const body_node = class_node.childForFieldName("body")!;
      const init_node = body_node.firstNamedChild!;

      const boundaries = extractor.extract_boundaries(
        init_node,
        "constructor",
        "test.py" as FilePath
      );

      // Constructor should be treated like a regular method
      expect(boundaries.symbol_location.start_line).toBe(2);
      expect(boundaries.symbol_location.start_column).toBe(9); // "__init__"
      expect(boundaries.scope_location.start_line).toBe(2);
      expect(boundaries.scope_location.start_column).toBe(17); // At "("
    });
  });

  describe("Block boundaries", () => {
    it("should handle if block", () => {
      const code = `if condition:
    do_something()`;

      const tree = parser.parse(code);
      const if_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        if_node,
        "block",
        "test.py" as FilePath
      );

      // For blocks, symbol and scope locations are the same
      expect(boundaries.symbol_location).toEqual(boundaries.scope_location);
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.end_line).toBe(2);
    });

    it("should handle for loop block", () => {
      const code = `for i in range(10):
    print(i)`;

      const tree = parser.parse(code);
      const for_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        for_node,
        "block",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location).toEqual(boundaries.scope_location);
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.end_line).toBe(2);
    });

    it("should handle while loop block", () => {
      const code = `while True:
    continue`;

      const tree = parser.parse(code);
      const while_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        while_node,
        "block",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location).toEqual(boundaries.scope_location);
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.end_line).toBe(2);
    });
  });

  describe("Edge cases", () => {
    it("should handle complex class inheritance", () => {
      const code = `class Complex(
    BaseClass,
    MixinOne,
    MixinTwo
):
    def method(self):
        pass`;

      const tree = parser.parse(code);
      const class_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        class_node,
        "class",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(1);
      expect(boundaries.symbol_location.start_column).toBe(7); // "Complex"
      expect(boundaries.scope_location.start_line).toBe(5); // After the colon
    });

    it("should handle function with decorators", () => {
      const code = `@staticmethod
@cache
def expensive_func():
    return calculation()`;

      const tree = parser.parse(code);
      // Decorated function is wrapped in decorated_definition
      const decorated_node = tree.rootNode.firstChild!;
      const func_node = decorated_node.childForFieldName("definition")!;

      const boundaries = extractor.extract_boundaries(
        func_node,
        "function",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(3); // Function is on line 3
      expect(boundaries.scope_location.start_line).toBe(3);
    });

    it("should handle class with unusual spacing around colon", () => {
      // This test creates a case where the colon might be harder to find
      // to potentially trigger the alternative colon detection branch
      const code = `class TestClass   :
    pass`;

      const tree = parser.parse(code);
      const class_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        class_node,
        "class",
        "test.py" as FilePath
      );

      // Should still work correctly even with unusual spacing
      expect(boundaries.symbol_location.start_line).toBe(1);
      expect(boundaries.symbol_location.start_column).toBe(7); // "TestClass"
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_column).toBeGreaterThan(17); // After colon
    });

    it("should handle empty function body", () => {
      const code = `def empty_func():
    ...`;

      const tree = parser.parse(code);
      const func_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        func_node,
        "function",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(1);
      expect(boundaries.symbol_location.start_column).toBe(5); // "empty_func"
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.end_line).toBe(2);
    });

    it("should handle single-line class definition", () => {
      const code = `class Point: pass`;

      const tree = parser.parse(code);
      const class_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        class_node,
        "class",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(1);
      expect(boundaries.symbol_location.start_column).toBe(7); // "Point"
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_column).toBeGreaterThan(12); // After "Point:"
    });

    it("should handle lambda expressions via block boundaries", () => {
      const code = `lambda_func = lambda x: x * 2`;

      const tree = parser.parse(code);
      const assignment_node = tree.rootNode.firstChild!;

      // Test that we can extract boundaries from assignment statements too
      const boundaries = extractor.extract_boundaries(
        assignment_node,
        "block",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_line).toBe(1);
    });

    it("should handle method with complex parameter types", () => {
      const code = `def complex_method(self, data: Dict[str, Any], callback: Optional[Callable[[str], None]] = None):
    return data`;

      const tree = parser.parse(code);
      const func_node = tree.rootNode.firstChild!;

      const boundaries = extractor.extract_boundaries(
        func_node,
        "function",
        "test.py" as FilePath
      );

      expect(boundaries.symbol_location.start_line).toBe(1);
      expect(boundaries.symbol_location.start_column).toBe(5); // "complex_method"
      expect(boundaries.scope_location.start_line).toBe(1);
      // Scope should start at the opening parenthesis of parameters
      expect(boundaries.scope_location.start_column).toBe(19); // At "("
    });
  });
});
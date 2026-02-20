# Task: Implement Python Scope Boundary Extractor

**Status**: Not Started
**Parent**: task-epic-11.141-Fix-Python-Class-Body-Scope-Boundaries
**Dependencies**: task-epic-11.141.1 (Infrastructure)
**Estimated Effort**: 4-6 hours

## Objective

Implement Python-specific scope boundary extraction that correctly handles class body positions, fixing the issue where class and method scopes end up as siblings at the same depth.

## The Python Problem

Tree-sitter's Python grammar reports a class's `(block)` node as starting at the **first child statement**, not at the colon:

```python
class Calculator:       # line 1, col 0
    def add(self, x):   # line 2, col 4
        return x + 1
```

Tree-sitter reports:
- Class `body` block: starts at line 2, col 4 (where `def` is) ❌
- Method: starts at line 2, col 4 (same position!) ❌

We need:
- Class scope: starts after `:` at line 1, col 18 ✅
- Method scope: starts at parameters at line 2, col 12 ✅

## Implementation

### File: `packages/core/src/index_single_file/scopes/extractors/python_scope_boundary_extractor.ts`

```typescript
import type { FilePath, Location } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import {
  BaseScopeBoundaryExtractor,
  ScopeBoundaries,
  node_to_location,
  position_to_location,
} from "../scope_boundary_extractor";

export class PythonScopeBoundaryExtractor extends BaseScopeBoundaryExtractor {

  protected extract_class_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Node should be class_definition
    if (node.type !== "class_definition") {
      throw new Error(
        `Expected class_definition node, got ${node.type}`
      );
    }

    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error("Class definition has no name field");
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      throw new Error("Class definition has no body field");
    }

    // Symbol location: just the name (belongs to parent scope)
    const symbol_location = node_to_location(name_node, file_path);

    // Scope location: THE TRICKY PART
    // We need to find the ":" token that starts the class body
    const colon_position = this.find_colon_after_name(node, name_node);

    // Scope starts right after the colon
    const scope_location: Location = {
      file_path,
      start_line: colon_position.row + 1,
      start_column: colon_position.column + 2, // After ":"
      end_line: body_node.endPosition.row + 1,
      end_column: body_node.endPosition.column,
    };

    return { symbol_location, scope_location };
  }

  protected extract_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Node should be function_definition
    if (node.type !== "function_definition") {
      throw new Error(
        `Expected function_definition node, got ${node.type}`
      );
    }

    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error("Function definition has no name field");
    }

    const params_node = node.childForFieldName("parameters");
    if (!params_node) {
      throw new Error("Function definition has no parameters field");
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      throw new Error("Function definition has no body field");
    }

    // Symbol location: just the name
    const symbol_location = node_to_location(name_node, file_path);

    // Scope starts at parameters (excludes "def" and name)
    // This is correct for Python - the scope includes parameters and body
    const scope_location: Location = {
      file_path,
      start_line: params_node.startPosition.row + 1,
      start_column: params_node.startPosition.column + 1,
      end_line: body_node.endPosition.row + 1,
      end_column: body_node.endPosition.column,
    };

    return { symbol_location, scope_location };
  }

  protected extract_constructor_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Python doesn't have special constructor syntax - __init__ is a regular method
    return this.extract_function_boundaries(node, file_path);
  }

  protected extract_block_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // For block scopes (if, for, while, etc.), the entire node is the scope
    // There's no separate "name" for blocks
    const location = node_to_location(node, file_path);
    return {
      symbol_location: location, // Blocks don't have names, use same location
      scope_location: location,
    };
  }

  /**
   * Find the ":" token that starts a class body.
   *
   * In Python AST, class_definition has children like:
   * [class_keyword, name, superclasses?, ":", body]
   *
   * We need to find the ":" token position.
   */
  private find_colon_after_name(
    class_node: Parser.SyntaxNode,
    name_node: Parser.SyntaxNode
  ): Parser.Point {
    // Strategy: Search for ":" in class_node's children after the name
    let found_name = false;

    for (let i = 0; i < class_node.childCount; i++) {
      const child = class_node.child(i);
      if (!child) continue;

      // Track when we've passed the name node
      if (child.equals(name_node)) {
        found_name = true;
        continue;
      }

      // After name, look for ":" token
      if (found_name && child.text === ":") {
        return child.startPosition;
      }

      // Also check if this is a ":" node by type
      if (found_name && child.type === ":") {
        return child.startPosition;
      }
    }

    // Fallback: If we can't find the colon (shouldn't happen for valid Python),
    // use the position right after the name
    console.warn(
      `Could not find colon in class definition at line ${name_node.startPosition.row + 1}`
    );
    return {
      row: name_node.endPosition.row,
      column: name_node.endPosition.column + 1,
    };
  }
}
```

## Testing Strategy

Create comprehensive unit tests that can run WITHOUT integrating with scope_processor:

### File: `packages/core/src/index_single_file/scopes/extractors/python_scope_boundary_extractor.test.ts`

```typescript
import { describe, it, expect, beforeAll } from "vitest";
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
        start_column: 6,
        end_line: 1,
        end_column: 16,
      });

      // Scope location: starts AFTER ":", not at "def"
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_column).toBeGreaterThan(16); // After name
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

      expect(boundaries.symbol_location.start_column).toBe(6); // "Child"
      expect(boundaries.scope_location.start_line).toBe(1);
      expect(boundaries.scope_location.start_column).toBeGreaterThan(27); // After "(Parent, Mixin):"
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
        end_column: 14,
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
  });

  describe("Edge cases", () => {
    it("should handle class with no body", () => {
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
  });
});
```

## Success Criteria

- [ ] `PythonScopeBoundaryExtractor` class implemented
- [ ] `extract_class_boundaries()` correctly finds colon position
- [ ] `extract_function_boundaries()` starts scope at parameters
- [ ] `find_colon_after_name()` helper handles all class syntax variations
- [ ] All unit tests pass (12+ test cases covering edge cases)
- [ ] Factory function returns Python extractor: `get_scope_boundary_extractor("python")`
- [ ] No integration with scope_processor yet (that's task 11.141.3)
- [ ] TypeScript compilation succeeds

## Test Coverage

Tests should cover:
- ✅ Simple class with methods
- ✅ Class with base classes
- ✅ Class with multiple methods
- ✅ Decorated classes
- ✅ Functions at module level
- ✅ Methods inside classes
- ✅ Nested classes
- ✅ Functions with type hints
- ✅ Classes with no body (just `pass`)
- ✅ Async functions

## Non-Goals

- Integrating with scope_processor (task 11.141.3)
- Fixing the actual Python tests (task 11.141.4)
- Implementing other language extractors

## Notes

- Can test in complete isolation using tree-sitter directly
- No need to wait for integration - all tests can pass before task 11.141.3
- The `find_colon_after_name()` helper is the critical piece
- Consider adding debug logging for when colon can't be found

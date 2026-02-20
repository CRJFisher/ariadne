# Task: Migrate TypeScript/JavaScript Scope Boundary Extractors

**Status**: Not Started
**Parent**: task-epic-11.141-Fix-Python-Class-Body-Scope-Boundaries
**Dependencies**: task-epic-11.141.4 (Python verification complete)
**Estimated Effort**: 4-5 hours

## Objective

Extract the existing TypeScript/JavaScript scope boundary adjustment logic from `scope_processor.ts` into dedicated extractor classes, following the pattern established for Python.

## Why Combine TypeScript and JavaScript?

TypeScript and JavaScript share nearly identical scope boundary semantics:
- Both use `{ }` for scope delimiters
- Both have class bodies explicitly available
- Function scope handling is identical
- Main difference: TypeScript has interfaces, enums with slightly different structure

We can use a shared base class with minor language-specific overrides.

## Implementation

### File 1: `extractors/javascript_typescript_scope_boundary_extractor.ts`

Shared base class for both languages:

```typescript
import type { FilePath, Location } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import {
  BaseScopeBoundaryExtractor,
  ScopeBoundaries,
  node_to_location,
} from "../scope_boundary_extractor";

/**
 * Shared scope boundary extraction for JavaScript and TypeScript.
 * Both languages use braces for scoping and have similar AST structures.
 */
export abstract class JavaScriptTypeScriptScopeBoundaryExtractor
  extends BaseScopeBoundaryExtractor
{
  protected extract_class_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Node could be: class_declaration, class (TS), interface_declaration, enum_declaration

    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error(`${node.type} has no name field`);
    }

    const body_node =
      node.childForFieldName("body") ||
      node.childForFieldName("object"); // For interface_declaration

    if (!body_node) {
      throw new Error(`${node.type} has no body field`);
    }

    // Symbol: just the name
    const symbol_location = node_to_location(name_node, file_path);

    // Scope: the body node (starts at "{", which is what we want)
    const scope_location = node_to_location(body_node, file_path);

    return { symbol_location, scope_location };
  }

  protected extract_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Handle both regular functions and named function expressions
    const name_node = node.childForFieldName("name");

    // Check if this is a named function expression
    const is_named_function_expr =
      node.type === "function_expression" && name_node !== null;

    if (is_named_function_expr) {
      // Named function expression: scope starts AFTER "function" keyword
      // The name itself is IN the function's scope (for self-reference)
      const function_keyword = node.child(0); // First child is "function" keyword

      if (!function_keyword) {
        throw new Error("Function expression has no function keyword");
      }

      const body_node = node.childForFieldName("body");
      if (!body_node) {
        throw new Error("Function has no body");
      }

      // Symbol: the function name (belongs to function's OWN scope)
      const symbol_location = node_to_location(name_node!, file_path);

      // Scope: starts after "function" keyword
      const scope_location: Location = {
        file_path,
        start_line: function_keyword.endPosition.row + 1,
        start_column: function_keyword.endPosition.column + 2,
        end_line: body_node.endPosition.row + 1,
        end_column: body_node.endPosition.column,
      };

      return { symbol_location, scope_location };
    } else {
      // Regular function declaration or anonymous function expression
      const params_node = node.childForFieldName("parameters");
      if (!params_node) {
        throw new Error("Function has no parameters field");
      }

      const body_node = node.childForFieldName("body");
      if (!body_node) {
        throw new Error("Function has no body");
      }

      const symbol_location = name_node
        ? node_to_location(name_node, file_path)
        : node_to_location(params_node, file_path); // Anonymous: no name

      // Scope starts at parameters
      const scope_location: Location = {
        file_path,
        start_line: params_node.startPosition.row + 1,
        start_column: params_node.startPosition.column + 1,
        end_line: body_node.endPosition.row + 1,
        end_column: body_node.endPosition.column,
      };

      return { symbol_location, scope_location };
    }
  }

  protected extract_constructor_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Constructors are like methods - scope starts at parameters
    return this.extract_function_boundaries(node, file_path);
  }

  protected extract_block_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Block scopes: entire node is the scope
    const location = node_to_location(node, file_path);
    return {
      symbol_location: location,
      scope_location: location,
    };
  }
}
```

### File 2: `extractors/typescript_scope_boundary_extractor.ts`

```typescript
import { JavaScriptTypeScriptScopeBoundaryExtractor } from "./javascript_typescript_scope_boundary_extractor";

/**
 * TypeScript-specific scope boundary extraction.
 * Inherits most logic from shared JS/TS base, with TS-specific adjustments.
 */
export class TypeScriptScopeBoundaryExtractor extends JavaScriptTypeScriptScopeBoundaryExtractor {
  // Most logic inherited from base class
  // Override only if TypeScript needs special handling

  // Currently no TypeScript-specific overrides needed
  // Interfaces, enums, classes all handled by base class
}
```

### File 3: `extractors/javascript_scope_boundary_extractor.ts`

```typescript
import { JavaScriptTypeScriptScopeBoundaryExtractor } from "./javascript_typescript_scope_boundary_extractor";

/**
 * JavaScript-specific scope boundary extraction.
 * Inherits all logic from shared JS/TS base.
 */
export class JavaScriptScopeBoundaryExtractor extends JavaScriptTypeScriptScopeBoundaryExtractor {
  // All logic inherited from base class
  // JavaScript and TypeScript scope boundaries are identical
}
```

### Update Factory

In `scope_boundary_extractor.ts`:

```typescript
export function get_scope_boundary_extractor(
  language: Language
): ScopeBoundaryExtractor {
  switch (language) {
    case "python":
      return new PythonScopeBoundaryExtractor();
    case "typescript":
      return new TypeScriptScopeBoundaryExtractor();
    case "javascript":
      return new JavaScriptScopeBoundaryExtractor();
    case "rust":
      throw new Error("Rust scope boundary extractor not yet implemented");
    default:
      throw new Error(`No scope boundary extractor for language: ${language}`);
  }
}
```

## Testing Strategy

### Extract Existing Tests

Find all TypeScript/JavaScript scope boundary tests and convert them:

```typescript
// typescript_scope_boundary_extractor.test.ts
describe("TypeScriptScopeBoundaryExtractor", () => {
  let parser: Parser;
  let extractor: TypeScriptScopeBoundaryExtractor;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
    extractor = new TypeScriptScopeBoundaryExtractor();
  });

  it("should extract class body boundaries", () => {
    const code = `class MyClass {
  method() {}
}`;

    const tree = parser.parse(code);
    const class_node = tree.rootNode.firstChild!;

    const boundaries = extractor.extract_boundaries(
      class_node,
      "class",
      "test.ts" as FilePath
    );

    expect(boundaries.symbol_location).toMatchObject({
      start_line: 1,
      start_column: 7, // "MyClass"
      end_line: 1,
      end_column: 14,
    });

    expect(boundaries.scope_location).toMatchObject({
      start_line: 1,
      start_column: 16, // "{"
    });
  });

  it("should handle named function expressions", () => {
    const code = `const factorial = function fact(n) {
  return n * fact(n - 1);
};`;

    const tree = parser.parse(code);
    const func_expr = tree.rootNode.descendantsOfType("function_expression")[0];

    const boundaries = extractor.extract_boundaries(
      func_expr,
      "function",
      "test.ts" as FilePath
    );

    // Name "fact" should be in function's own scope
    expect(boundaries.symbol_location.start_column).toBe(28); // "fact"

    // Scope starts after "function" keyword
    expect(boundaries.scope_location.start_column).toBeGreaterThan(18);
    expect(boundaries.scope_location.start_column).toBeLessThan(28);
  });

  // More tests for interfaces, enums, arrow functions, etc.
});
```

## Integration

Update `scope_processor.ts`:

```typescript
// Change from:
if (file.lang === "python") {
  const boundaries = extractor.extract_boundaries(...);
  location = boundaries.scope_location;
} else {
  // Old logic
}

// To:
if (["python", "typescript", "javascript"].includes(file.lang)) {
  const boundaries = extractor.extract_boundaries(...);
  location = boundaries.scope_location;
} else {
  // Old logic (only for Rust now)
}
```

## Success Criteria

- [ ] `JavaScriptTypeScriptScopeBoundaryExtractor` base class created
- [ ] `TypeScriptScopeBoundaryExtractor` implemented
- [ ] `JavaScriptScopeBoundaryExtractor` implemented
- [ ] Factory updated to return TS/JS extractors
- [ ] All existing TypeScript tests pass (no regressions)
- [ ] All existing JavaScript tests pass (no regressions)
- [ ] Named function expression handling preserved
- [ ] Class body boundaries correct
- [ ] Interface and enum boundaries correct

## Verification

```bash
# TypeScript tests
npm test -- semantic_index.typescript.test.ts

# JavaScript tests
npm test -- semantic_index.javascript.test.ts

# Scope processor tests
npm test -- scope_processor.test.ts
```

All should pass with no regressions.

## Notes

- TypeScript and JavaScript extractors are nearly identical
- Shared base class reduces duplication
- Named function expression handling is the trickiest part (preserved from existing code)
- This migrates existing working logic, not fixing bugs

# Task: Create Scope Boundary Extractor Infrastructure

**Status**: Not Started
**Parent**: task-epic-11.141-Fix-Python-Class-Body-Scope-Boundaries
**Dependencies**: None
**Estimated Effort**: 2-3 hours

## Objective

Create the foundational infrastructure for language-specific scope boundary extraction, separating the semantic question ("where should scopes be?") from the mechanical question ("what did tree-sitter give us?").

## Key Insight

A scope-creating construct has **three critical positions**:
1. **Symbol location**: Where the name is declared (belongs to parent scope)
2. **Scope start**: Where the new scope begins (after declaration syntax)
3. **Scope end**: Where the new scope ends

Tree-sitter grammars report these inconsistently across languages. We need a semantic transformation layer.

## Implementation

### 1. Create Interface

File: `packages/core/src/index_single_file/scopes/scope_boundary_extractor.ts`

```typescript
import type { FilePath, Location, Language } from "@ariadnejs/types";
import type Parser from "tree-sitter";

/**
 * Extracted boundary information for a scope-creating construct.
 *
 * The symbol_location belongs to the parent scope (where the name is declared).
 * The scope_location defines the new child scope being created.
 */
export interface ScopeBoundaries {
  // Where the symbol name is declared (e.g., class name, function name)
  // This location belongs to the PARENT scope
  symbol_location: Location;

  // Where the scope that symbol creates begins and ends
  // This location defines the NEW CHILD scope
  scope_location: Location;
}

export type ScopeType = "module" | "class" | "function" | "method" | "constructor" | "block";

/**
 * Language-specific extractor for scope boundaries.
 *
 * Different tree-sitter grammars report node positions differently.
 * This interface provides a semantic transformation from raw tree-sitter
 * positions to our scope boundary model.
 */
export interface ScopeBoundaryExtractor {
  /**
   * Extract semantic scope boundaries from a tree-sitter node.
   *
   * @param node - Tree-sitter node captured as a scope
   * @param scope_type - Type of scope being created
   * @param file_path - File path for location construction
   * @returns Symbol location (for parent scope) and scope location (for new scope)
   */
  extract_boundaries(
    node: Parser.SyntaxNode,
    scope_type: ScopeType,
    file_path: FilePath
  ): ScopeBoundaries;
}
```

### 2. Create Factory Function

In same file:

```typescript
import { PythonScopeBoundaryExtractor } from "./extractors/python_scope_boundary_extractor";
// Import other extractors as they're implemented

/**
 * Get the scope boundary extractor for a given language.
 */
export function get_scope_boundary_extractor(
  language: Language
): ScopeBoundaryExtractor {
  switch (language) {
    case "python":
      return new PythonScopeBoundaryExtractor();
    case "typescript":
      // TODO: Implement in task 11.141.5
      throw new Error("TypeScript scope boundary extractor not yet implemented");
    case "javascript":
      // TODO: Implement in task 11.141.6
      throw new Error("JavaScript scope boundary extractor not yet implemented");
    case "rust":
      // TODO: Implement in task 11.141.7
      throw new Error("Rust scope boundary extractor not yet implemented");
    default:
      throw new Error(`No scope boundary extractor for language: ${language}`);
  }
}
```

### 3. Add position_to_location to node_utils.ts

**IMPORTANT**: `node_to_location` already exists in `packages/core/src/index_single_file/node_utils.ts`!

We only need to **ADD** `position_to_location` to that existing file for cases where we have explicit start/end positions (like Python's colon finding).

**File to modify**: `packages/core/src/index_single_file/node_utils.ts`

Add this new function:

```typescript
/**
 * Create a location from explicit start and end positions.
 *
 * Use this when you have Parser.Point objects but not a SyntaxNode.
 * Example: When manually finding delimiter positions (Python's colon).
 *
 * Tree-sitter positions are 0-indexed, we convert to 1-indexed.
 */
export function position_to_location(
  start: Parser.Point,
  end: Parser.Point,
  file_path: FilePath
): Location {
  return {
    file_path,
    start_line: start.row + 1,
    start_column: start.column + 1,
    end_line: end.row + 1,
    end_column: end.column,
  };
}
```

**Then in scope_boundary_extractor.ts**, re-export from node_utils:

```typescript
// Re-export node utilities for convenience
export { node_to_location, position_to_location } from "../node_utils";
```

### 4. Create Common Extractor Base Class

Provides **default implementations that work for MOST languages**.
Language-specific extractors only override what's different.

```typescript
/**
 * Common scope boundary extraction logic.
 *
 * This class provides default implementations that work for TypeScript,
 * JavaScript, Rust, and most other languages. Language-specific extractors
 * only need to override methods for special cases.
 *
 * Common patterns:
 * - Class scope = `body` field node (works for TS, JS, Rust)
 * - Function scope = parameters to end (works for most)
 * - Block scope = entire node (works for all)
 *
 * Special cases requiring overrides:
 * - Python: class body needs colon finding (body field is wrong position)
 * - TS/JS: named function expressions need special handling
 */
export class CommonScopeBoundaryExtractor implements ScopeBoundaryExtractor {

  extract_boundaries(
    node: Parser.SyntaxNode,
    scope_type: ScopeType,
    file_path: FilePath
  ): ScopeBoundaries {
    switch (scope_type) {
      case "class":
        return this.extract_class_boundaries(node, file_path);
      case "function":
      case "method":
        return this.extract_function_boundaries(node, file_path);
      case "constructor":
        return this.extract_constructor_boundaries(node, file_path);
      case "block":
        return this.extract_block_boundaries(node, file_path);
      default:
        throw new Error(`Unsupported scope type: ${scope_type}`);
    }
  }

  /**
   * Default class boundary extraction.
   *
   * Uses the `body` field directly - works for most languages where
   * tree-sitter reports the body position correctly.
   *
   * Works for: TypeScript, JavaScript, Rust
   * Override for: Python (body starts at first child, not at delimiter)
   */
  protected extract_class_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error(`${node.type} has no name field`);
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      throw new Error(`${node.type} has no body field`);
    }

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location: node_to_location(body_node, file_path),
    };
  }

  /**
   * Default function boundary extraction.
   *
   * Scope starts at parameters node (excludes function name from scope).
   * This works for most languages.
   *
   * Works for: Python, Rust, most function declarations
   * Override for: JS/TS named function expressions (special case)
   */
  protected extract_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const name_node = node.childForFieldName("name");
    const params_node = node.childForFieldName("parameters");
    const body_node = node.childForFieldName("body");

    if (!params_node || !body_node) {
      throw new Error(`${node.type} missing parameters or body`);
    }

    return {
      symbol_location: name_node
        ? node_to_location(name_node, file_path)
        : node_to_location(params_node, file_path),
      scope_location: {
        file_path,
        start_line: params_node.startPosition.row + 1,
        start_column: params_node.startPosition.column + 1,
        end_line: body_node.endPosition.row + 1,
        end_column: body_node.endPosition.column,
      },
    };
  }

  /**
   * Default constructor boundary extraction.
   * Same as function boundaries for most languages.
   */
  protected extract_constructor_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    return this.extract_function_boundaries(node, file_path);
  }

  /**
   * Default block boundary extraction.
   * The entire node is the scope (no separate name).
   * This works for ALL languages.
   */
  protected extract_block_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const location = node_to_location(node, file_path);
    return {
      symbol_location: location,
      scope_location: location,
    };
  }
}
```

## Directory Structure

```
packages/core/src/index_single_file/scopes/
├── scope_boundary_extractor.ts          (NEW - interface, factory, helpers)
└── extractors/                          (NEW - directory)
    ├── python_scope_boundary_extractor.ts    (task 11.141.2)
    ├── typescript_scope_boundary_extractor.ts (task 11.141.5)
    ├── javascript_scope_boundary_extractor.ts (task 11.141.6)
    └── rust_scope_boundary_extractor.ts       (task 11.141.7)
```

## Testing Strategy

Since no extractors are implemented yet, test the infrastructure with mocks:

```typescript
// scope_boundary_extractor.test.ts
describe("scope_boundary_extractor infrastructure", () => {
  it("should convert tree-sitter node to location correctly", () => {
    const mock_node = {
      startPosition: { row: 0, column: 5 },
      endPosition: { row: 2, column: 10 },
    } as Parser.SyntaxNode;

    const location = node_to_location(mock_node, "test.py" as FilePath);

    expect(location).toEqual({
      file_path: "test.py",
      start_line: 1,      // 0-indexed → 1-indexed
      start_column: 6,    // 0-indexed → 1-indexed
      end_line: 3,
      end_column: 10,
    });
  });

  it("should throw error for unimplemented language", () => {
    expect(() => {
      get_scope_boundary_extractor("typescript" as Language);
    }).toThrow(/not yet implemented/);
  });

  it("should return Python extractor when implemented", () => {
    // This will fail until task 11.141.2 is complete
    const extractor = get_scope_boundary_extractor("python" as Language);
    expect(extractor).toBeDefined();
    expect(extractor.extract_boundaries).toBeDefined();
  });
});
```

## Success Criteria

- [ ] Interface `ScopeBoundaryExtractor` defined with `extract_boundaries()` method
- [ ] Factory function `get_scope_boundary_extractor()` created
- [ ] Helper `position_to_location()` added to `node_utils.ts` (note: `node_to_location` already exists!)
- [ ] Helpers re-exported from `scope_boundary_extractor.ts` for convenience
- [ ] Base class `CommonScopeBoundaryExtractor` created with default implementations
- [ ] Directory `scopes/extractors/` created
- [ ] Tests pass for `position_to_location()` helper
- [ ] Factory throws appropriate errors for unimplemented languages
- [ ] TypeScript compilation succeeds
- [ ] No breaking changes to existing code (only additions)

## Non-Goals

- Implementing any language-specific extractors (that's task 11.141.2+)
- Integrating with scope_processor (that's task 11.141.3)
- Changing existing scope processing logic

## Notes

- Use pythonic naming: `extract_boundaries`, `node_to_location`, `get_scope_boundary_extractor`
- Keep interface minimal - only what's needed for scope boundary extraction
- Document the three critical positions (symbol, scope start, scope end)
- Make factory extensible for future languages

# Task Epic-11.156.2.2: Unit Tests for detect_callback_context() Functions

**Status**: TODO
**Priority**: P1 (High - Core functionality untested)
**Estimated Effort**: 1 day
**Parent Task**: task-epic-11.156.2 (Callback Invocation Detection)
**Depends On**: task-epic-11.156.2.1 (Migrate orphan test files first)
**Epic**: epic-11-codebase-restructuring

## Problem

The `detect_callback_context()` helper functions have NO unit tests in any language:
- `typescript_builder.ts:726-761` - No tests
- `javascript_builder.ts:834-869` - No tests
- `python_builder.ts:623-657` - No tests
- `rust_builder_helpers.ts:1071-1111` - No tests

These functions perform critical AST traversal logic to detect callback patterns. Without unit tests:
- Refactoring is risky (no safety net)
- Edge cases are undocumented
- Regressions can't be caught early
- Language-specific behavior is unclear

## Scope

Create unit test files for each language's detect_callback_context() function:

1. `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.test.ts`
2. `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.test.ts`
3. `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.test.ts`
4. `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.test.ts`

## Test Coverage Requirements

Each test file should cover:

### Core Functionality
1. **Callback detection**: Function in call arguments returns `is_callback: true`
2. **Non-callback detection**: Standalone function returns `is_callback: false`
3. **Receiver location capture**: `receiver_location` points to call expression

### AST Traversal Edge Cases
4. **Maximum depth**: Traversal stops at MAX_DEPTH (5 levels)
5. **Null parent handling**: Handles tree-sitter null parents gracefully
6. **Wrong parent type**: Non-call parent doesn't trigger callback detection

### Language-Specific Patterns
7. **Array method callbacks**: `array.forEach(fn)`, `array.map(fn)`, `array.filter(fn)`
8. **Nested callbacks**: Callback inside callback (2 levels deep)
9. **Multiple arguments**: Callback as second or third argument
10. **Method call callbacks**: `obj.method(fn)` vs `standalone(fn)`

### Negative Cases
11. **Variable assignment**: `const fn = () => {}` - NOT a callback
12. **Function return**: `return () => {}` - NOT a callback
13. **Object literal**: `{ handler: () => {} }` - NOT a callback
14. **Default parameter**: `function foo(cb = () => {})` - NOT a callback

## Implementation Plan

### Test Structure Template

```typescript
import { describe, it, expect } from "vitest";
import { detect_callback_context } from "./typescript_builder";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";

describe("detect_callback_context", () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  describe("callback detection", () => {
    it("should detect callback in array.forEach()", () => {
      const code = `items.forEach((item) => { console.log(item); });`;
      const tree = parser.parse(code);
      const arrow_function = findNodeByType(tree.rootNode, "arrow_function");

      const result = detect_callback_context(arrow_function, "test.ts");

      expect(result.is_callback).toBe(true);
      expect(result.receiver_is_external).toBe(null);
      expect(result.receiver_location).not.toBe(null);
      expect(result.receiver_location?.start_line).toBe(1);
    });

    it("should detect callback in array.map()", () => {
      const code = `items.map((x) => x * 2);`;
      const tree = parser.parse(code);
      const arrow_function = findNodeByType(tree.rootNode, "arrow_function");

      const result = detect_callback_context(arrow_function, "test.ts");

      expect(result.is_callback).toBe(true);
    });

    it("should detect callback in array.filter()", () => {
      const code = `items.filter((x) => x > 0);`;
      const tree = parser.parse(code);
      const arrow_function = findNodeByType(tree.rootNode, "arrow_function");

      const result = detect_callback_context(arrow_function, "test.ts");

      expect(result.is_callback).toBe(true);
    });

    it("should detect nested callbacks", () => {
      const code = `
        items.map((x) => {
          return [x].filter((y) => y > 0);
        });
      `;
      const tree = parser.parse(code);
      const arrow_functions = findAllNodesByType(tree.rootNode, "arrow_function");

      // Outer callback
      const outer_result = detect_callback_context(arrow_functions[0], "test.ts");
      expect(outer_result.is_callback).toBe(true);

      // Inner callback
      const inner_result = detect_callback_context(arrow_functions[1], "test.ts");
      expect(inner_result.is_callback).toBe(true);
    });
  });

  describe("non-callback detection", () => {
    it("should NOT detect callback for variable assignment", () => {
      const code = `const handler = () => { console.log("hi"); };`;
      const tree = parser.parse(code);
      const arrow_function = findNodeByType(tree.rootNode, "arrow_function");

      const result = detect_callback_context(arrow_function, "test.ts");

      expect(result.is_callback).toBe(false);
      expect(result.receiver_location).toBe(null);
    });

    it("should NOT detect callback for return statement", () => {
      const code = `function factory() { return () => {}; }`;
      const tree = parser.parse(code);
      const arrow_function = findNodeByType(tree.rootNode, "arrow_function");

      const result = detect_callback_context(arrow_function, "test.ts");

      expect(result.is_callback).toBe(false);
    });

    it("should NOT detect callback for object literal", () => {
      const code = `const obj = { handler: () => {} };`;
      const tree = parser.parse(code);
      const arrow_function = findNodeByType(tree.rootNode, "arrow_function");

      const result = detect_callback_context(arrow_function, "test.ts");

      expect(result.is_callback).toBe(false);
    });

    it("should NOT detect callback for default parameter", () => {
      const code = `function foo(cb = () => {}) {}`;
      const tree = parser.parse(code);
      const arrow_function = findNodeByType(tree.rootNode, "arrow_function");

      const result = detect_callback_context(arrow_function, "test.ts");

      expect(result.is_callback).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle deeply nested function (> MAX_DEPTH)", () => {
      // Create code with function nested more than 5 levels deep
      const code = `
        outer1(outer2(outer3(outer4(outer5(outer6(() => {}))))));
      `;
      const tree = parser.parse(code);
      const arrow_function = findNodeByType(tree.rootNode, "arrow_function");

      // Should still detect callback (depth counting starts from function node)
      const result = detect_callback_context(arrow_function, "test.ts");

      // The immediate parent chain should be within MAX_DEPTH
      expect(result.is_callback).toBe(true);
    });

    it("should handle callback as second argument", () => {
      const code = `setTimeout(() => {}, 1000);`;
      const tree = parser.parse(code);
      const arrow_function = findNodeByType(tree.rootNode, "arrow_function");

      const result = detect_callback_context(arrow_function, "test.ts");

      expect(result.is_callback).toBe(true);
    });
  });

  describe("receiver location", () => {
    it("should capture correct location for call expression", () => {
      const code = `items.forEach((item) => {});`;
      const tree = parser.parse(code);
      const arrow_function = findNodeByType(tree.rootNode, "arrow_function");

      const result = detect_callback_context(arrow_function, "test.ts");

      expect(result.receiver_location).not.toBe(null);
      expect(result.receiver_location?.file_path).toBe("test.ts");
      expect(result.receiver_location?.start_line).toBe(1);
      expect(result.receiver_location?.start_column).toBeGreaterThan(0);
      expect(result.receiver_location?.end_line).toBe(1);
    });
  });
});

// Helper functions
function findNodeByType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
  if (node.type === type) {
    return node;
  }
  for (let i = 0; i < node.childCount; i++) {
    const found = findNodeByType(node.child(i)!, type);
    if (found) return found;
  }
  return null;
}

function findAllNodesByType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
  const results: Parser.SyntaxNode[] = [];
  if (node.type === type) {
    results.push(node);
  }
  for (let i = 0; i < node.childCount; i++) {
    results.push(...findAllNodesByType(node.child(i)!, type));
  }
  return results;
}
```

### Language-Specific Adaptations

**JavaScript**: Same as TypeScript, but use `tree-sitter-javascript`

**Python**: Adapt for lambda expressions
```typescript
it("should detect callback in map(lambda)", () => {
  const code = `list(map(lambda x: x * 2, items))`;
  const tree = parser.parse(code);
  const lambda = findNodeByType(tree.rootNode, "lambda");

  const result = detect_callback_context(lambda, "test.py");

  expect(result.is_callback).toBe(true);
});
```

**Rust**: Adapt for closure expressions
```typescript
it("should detect callback in iter().map()", () => {
  const code = `items.iter().map(|x| x * 2)`;
  const tree = parser.parse(code);
  const closure = findNodeByType(tree.rootNode, "closure_expression");

  const result = detect_callback_context(closure, "test.rs");

  expect(result.is_callback).toBe(true);
});
```

## Success Criteria

- [ ] All 4 test files created
- [ ] Each file has at least 10 tests
- [ ] All tests pass: `npm test`
- [ ] Coverage includes:
  - [ ] Callback detection (array methods)
  - [ ] Non-callback detection (variable assignment, return, object literal)
  - [ ] Nested callbacks
  - [ ] Edge cases (depth limit, multiple arguments)
  - [ ] Receiver location capture
- [ ] Language-specific patterns tested

## Execution Steps

1. Create `typescript_builder.test.ts`
   - Implement full test suite
   - Run: `npm test typescript_builder.test.ts`
   - Fix any failures

2. Create `javascript_builder.test.ts`
   - Copy TypeScript tests, adapt for JavaScript
   - Run: `npm test javascript_builder.test.ts`
   - Fix any failures

3. Create `python_builder.test.ts`
   - Adapt tests for lambda expressions
   - Test Python-specific patterns (map, filter, reduce with lambda)
   - Run: `npm test python_builder.test.ts`
   - Fix any failures

4. Create `rust_builder_helpers.test.ts`
   - Adapt tests for closure expressions
   - Test Rust-specific patterns (iter().map, iter().filter)
   - Run: `npm test rust_builder_helpers.test.ts`
   - Fix any failures

5. Run full test suite
   - `npm test`
   - Verify no regressions

6. Commit
   - `test(builders): Add unit tests for detect_callback_context() in all languages`

## Related Tasks

- **task-epic-11.156.2.1**: Migrate orphan tests (MUST complete first)
- **task-epic-11.156.2.3**: Add semantic index callback tests (builds on this)
- **task-epic-11.156.2.4**: Add project integration callback tests (builds on this)

## Notes

- **Export function if needed**: If `detect_callback_context()` is not exported, add export
- **Test helper utilities**: Create shared helper functions for parsing and node finding
- **Consider test fixtures**: For complex cases, use fixture files instead of inline code
- **Document language differences**: Note any significant differences in AST structure between languages

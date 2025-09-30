# Task 104.3.2: Test JavaScript Metadata Extractors

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1.5 hours
**Parent:** task-epic-11.104
**Dependencies:** task-epic-11.104.3.1

## Objective

Create comprehensive unit tests for JavaScript/TypeScript metadata extractors to verify correct AST traversal and metadata extraction.

## File to Create

`packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.test.ts`

## Testing Strategy

Test each extractor function in isolation using minimal code snippets parsed with tree-sitter.

## Implementation Details

### 1. Test Setup

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./javascript_metadata";
import type { FilePath } from "@ariadnejs/types";

describe("javascript_metadata", () => {
  let js_parser: Parser;
  let ts_parser: Parser;
  const test_file: FilePath = "/test/file.ts" as FilePath;

  beforeAll(() => {
    js_parser = new Parser();
    js_parser.setLanguage(JavaScript);

    ts_parser = new Parser();
    ts_parser.setLanguage(TypeScript.typescript);
  });

  /**
   * Helper: Parse code and find first node of given type
   */
  function parse_and_find(
    code: string,
    node_type: string,
    use_typescript = false
  ): any {
    const parser = use_typescript ? ts_parser : js_parser;
    const tree = parser.parse(code);

    // Recursively find node
    function find_node(node: any): any {
      if (node.type === node_type) return node;
      for (const child of node.children) {
        const found = find_node(child);
        if (found) return found;
      }
      return null;
    }

    return find_node(tree.rootNode);
  }

  // ... tests below
});
```

### 2. Test Cases for extract_call_receiver()

```typescript
describe("extract_call_receiver", () => {
  it("should extract receiver from simple method call", () => {
    const code = "obj.method()";
    const call_node = parse_and_find(code, "call_expression");

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(
      call_node,
      test_file
    );

    expect(result).toBeDefined();
    expect(result?.start_line).toBe(1);
    expect(result?.start_column).toBeLessThan(code.indexOf("."));
  });

  it("should extract receiver from chained method call", () => {
    const code = "obj.first().second()";
    const call_nodes = [];
    // Find all call_expression nodes
    // Test both calls extract correct receivers
  });

  it("should return undefined for function call", () => {
    const code = "doSomething()";
    const call_node = parse_and_find(code, "call_expression");

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(
      call_node,
      test_file
    );

    expect(result).toBeUndefined();
  });

  it("should handle optional chaining", () => {
    const code = "obj?.method()";
    // Test optional call handling
  });
});
```

### 3. Test Cases for extract_property_chain()

```typescript
describe("extract_property_chain", () => {
  it("should extract single property", () => {
    const code = "obj.prop";
    const member_node = parse_and_find(code, "member_expression");

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(
      member_node
    );

    expect(result).toEqual(["obj", "prop"]);
  });

  it("should extract chained properties", () => {
    const code = "a.b.c.d";
    const member_node = parse_and_find(code, "member_expression");

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(
      member_node
    );

    expect(result).toEqual(["a", "b", "c", "d"]);
  });

  it("should return undefined for computed properties", () => {
    const code = "obj[key]";
    const subscript_node = parse_and_find(code, "subscript_expression");

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(
      subscript_node
    );

    expect(result).toBeUndefined();
  });

  it("should handle method calls in chain", () => {
    const code = "obj.method().prop";
    // Test property chain with method call in middle
  });
});
```

### 4. Test Cases for extract_type_from_annotation()

```typescript
describe("extract_type_from_annotation", () => {
  it("should extract simple type annotation", () => {
    const code = "const x: string = 'hello'";
    const type_node = parse_and_find(code, "type_annotation", true);

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(
      type_node,
      test_file
    );

    expect(result).toBeDefined();
    expect(result?.type_name).toBe("string");
    expect(result?.certainty).toBe("declared");
  });

  it("should extract generic type", () => {
    const code = "const arr: Array<string> = []";
    const type_node = parse_and_find(code, "type_annotation", true);

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(
      type_node,
      test_file
    );

    expect(result?.type_name).toContain("Array");
  });

  it("should handle union types", () => {
    const code = "const x: string | number = 5";
    // Test union type extraction
  });

  it("should return undefined for no type annotation", () => {
    const code = "const x = 'hello'";
    const var_node = parse_and_find(code, "variable_declarator");

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(
      var_node,
      test_file
    );

    expect(result).toBeUndefined();
  });

  it("should handle function return type", () => {
    const code = "function foo(): string { return 'hi'; }";
    // Test function return type extraction
  });
});
```

### 5. Test Cases for extract_assignment_parts()

```typescript
describe("extract_assignment_parts", () => {
  it("should extract variable declaration parts", () => {
    const code = "const target = source";
    const declarator = parse_and_find(code, "variable_declarator");

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(
      declarator,
      test_file
    );

    expect(result.target).toBeDefined();
    expect(result.source).toBeDefined();
    expect(result.target?.start_column).toBeLessThan(
      result.source!.start_column
    );
  });

  it("should extract assignment expression parts", () => {
    const code = "target = source";
    const assignment = parse_and_find(code, "assignment_expression");

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts(
      assignment,
      test_file
    );

    expect(result.target).toBeDefined();
    expect(result.source).toBeDefined();
  });

  it("should handle function call as source", () => {
    const code = "const result = getData()";
    // Test with function call on right side
  });

  it("should handle destructuring", () => {
    const code = "const { x, y } = obj";
    // Test destructuring pattern - may return undefined for complex cases
  });
});
```

### 6. Test Cases for extract_construct_target()

```typescript
describe("extract_construct_target", () => {
  it("should extract target from constructor call", () => {
    const code = "const obj = new MyClass()";
    const new_node = parse_and_find(code, "new_expression");

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(
      new_node,
      test_file
    );

    expect(result).toBeDefined();
    // Verify location points to 'obj'
  });

  it("should handle constructor call without assignment", () => {
    const code = "new MyClass()";
    const new_node = parse_and_find(code, "new_expression");

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target(
      new_node,
      test_file
    );

    expect(result).toBeUndefined();
  });

  it("should handle nested constructor calls", () => {
    const code = "const outer = new Outer(new Inner())";
    // Test extraction of outer target
  });
});
```

### 7. Test Cases for extract_type_arguments()

```typescript
describe("extract_type_arguments", () => {
  it("should extract single type argument", () => {
    const code = "const arr: Array<string> = []";
    const generic_node = parse_and_find(code, "generic_type", true);

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(
      generic_node
    );

    expect(result).toEqual(["string"]);
  });

  it("should extract multiple type arguments", () => {
    const code = "const map: Map<string, number> = new Map()";
    const generic_node = parse_and_find(code, "generic_type", true);

    const result = JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments(
      generic_node
    );

    expect(result).toEqual(["string", "number"]);
  });

  it("should handle nested generics", () => {
    const code = "const nested: Array<Array<string>> = []";
    // Test nested generic extraction
  });

  it("should return undefined for no generics", () => {
    const code = "const arr: Array = []";
    // Test non-generic type
  });
});
```

### 8. Edge Cases and Integration Tests

```typescript
describe("edge cases", () => {
  it("should handle null nodes gracefully", () => {
    // Test all functions with null/undefined nodes
    expect(() => {
      JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver(null as any, test_file);
    }).not.toThrow();
  });

  it("should handle malformed AST", () => {
    // Test with incomplete or invalid AST structures
  });

  it("should handle complex nested structures", () => {
    const code = "obj.method().prop.another()";
    // Test combined patterns
  });
});
```

## Implementation Steps

1. Create test file with vitest imports
2. Set up parser configuration for JS and TS
3. Implement test helpers (`parse_and_find`, etc.)
4. Write tests for `extract_call_receiver()`
5. Write tests for `extract_property_chain()`
6. Write tests for `extract_type_from_annotation()`
7. Write tests for `extract_assignment_parts()`
8. Write tests for `extract_construct_target()`
9. Write tests for `extract_type_arguments()`
10. Add edge case tests
11. Run tests and fix any failures
12. Verify 100% code coverage of extractors

## Running Tests

```bash
cd packages/core
npx vitest run src/index_single_file/query_code_tree/language_configs/javascript_metadata.test.ts
```

## Success Criteria

- ✅ All extractor functions have unit tests
- ✅ Tests cover happy path cases
- ✅ Tests cover edge cases (null, undefined, malformed)
- ✅ Tests verify correct AST traversal
- ✅ Tests verify correct location extraction
- ✅ All tests pass
- ✅ Code coverage >95% for javascript_metadata.ts

## Notes

- Use minimal code snippets for fast test execution
- Focus on AST structure verification, not full semantic analysis
- Test both JavaScript and TypeScript where applicable
- Document any AST structure surprises in comments
- Keep tests readable and well-organized

## Related Files

- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/metadata_types.ts`

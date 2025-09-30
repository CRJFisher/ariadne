# Task 104.1: Create Metadata Extractor Interface and Types

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 30 minutes
**Parent:** task-epic-11.104
**Dependencies:** None

## Objective

Create the shared interface and types for language-specific metadata extractors that will be implemented for JavaScript, Python, and Rust.

## File to Create

`packages/core/src/index_single_file/query_code_tree/language_configs/metadata_types.ts`

## Implementation Details

### 1. Create MetadataExtractors Interface

Define the interface that all language-specific metadata extractors must implement:

```typescript
import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName, TypeInfo, FilePath } from "@ariadnejs/types";

/**
 * Language-specific metadata extraction functions
 *
 * Each language implements these functions to extract rich metadata
 * from tree-sitter SyntaxNode structures. AST structures differ by
 * language, requiring language-specific implementations.
 */
export interface MetadataExtractors {
  /**
   * Extract type information from type annotation nodes
   *
   * Examples:
   * - TypeScript: `const x: string` → extract "string"
   * - Python: `def foo() -> int:` → extract "int"
   * - Rust: `let x: i32` → extract "i32"
   */
  extract_type_from_annotation(
    node: SyntaxNode,
    file_path: FilePath
  ): TypeInfo | undefined;

  /**
   * Extract receiver/object location from method call
   *
   * For `obj.method()`, extract the location of `obj`
   * Enables tracing the receiver to determine method resolution
   */
  extract_call_receiver(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined;

  /**
   * Extract property access chain
   *
   * For `a.b.c.d`, extract ["a", "b", "c", "d"]
   * Enables tracking chained method calls
   */
  extract_property_chain(
    node: SyntaxNode
  ): readonly SymbolName[] | undefined;

  /**
   * Extract assignment source and target locations
   *
   * For `target = source`, extract locations of both
   * Enables type flow analysis
   */
  extract_assignment_parts(
    node: SyntaxNode,
    file_path: FilePath
  ): {
    source: Location | undefined;
    target: Location | undefined;
  };

  /**
   * Extract constructor call target variable location
   *
   * For `const obj = new Class()`, extract location of `obj`
   * Enables tracking constructed objects
   */
  extract_construct_target(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined;

  /**
   * Extract generic type arguments
   *
   * Examples:
   * - TypeScript: `Array<string>` → ["string"]
   * - Rust: `Vec<i32>` → ["i32"]
   */
  extract_type_arguments(
    node: SyntaxNode
  ): readonly SymbolName[] | undefined;
}
```

### 2. Export Helper Types

Add any shared helper types needed across implementations:

```typescript
/**
 * Result of attempting to extract metadata
 */
export type ExtractionResult<T> = T | undefined;

/**
 * AST node traversal result
 */
export interface NodeTraversal {
  node: SyntaxNode;
  path: string[];
}
```

## Implementation Steps

1. Create `metadata_types.ts` file
2. Add imports from tree-sitter and @ariadnejs/types
3. Define `MetadataExtractors` interface with all 6 methods
4. Add JSDoc comments explaining purpose and examples
5. Export any helper types
6. Ensure file compiles with TypeScript

## Testing

No tests needed for this task - it only defines types. Validation happens when:
- Language-specific implementations are created
- TypeScript compilation succeeds

## Success Criteria

- ✅ `metadata_types.ts` file created
- ✅ `MetadataExtractors` interface defined with 6 methods
- ✅ All methods have clear JSDoc documentation
- ✅ File compiles without TypeScript errors
- ✅ Exports are properly typed

## Notes

- Keep interface minimal - only include methods needed for current use cases
- All methods should return `undefined` for nodes that don't match expected structure
- `file_path` parameter needed for creating `Location` objects
- Avoid language-specific logic in this file - it's the shared contract

## Related Files

- `packages/core/src/index_single_file/query_code_tree/reference_builder.ts` (will consume this)
- `packages/types/src/semantic_index.ts` (TypeInfo, Location types)

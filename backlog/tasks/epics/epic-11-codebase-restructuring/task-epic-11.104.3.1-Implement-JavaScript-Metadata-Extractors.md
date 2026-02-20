# Task 104.3.1: Implement JavaScript Metadata Extractors

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 2 hours
**Parent:** task-epic-11.104
**Dependencies:** task-epic-11.104.1

## Objective

Implement language-specific metadata extractors for JavaScript and TypeScript. These extractors parse tree-sitter AST structures to extract rich metadata about method calls, type annotations, property chains, and assignments.

## File to Create

`packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.ts`

## Implementation Details

### 1. AST Structure Reference

JavaScript/TypeScript tree-sitter AST patterns:

**Method Call:**
```
call_expression {
  function: member_expression {
    object: identifier "obj"
    property: property_identifier "method"
  }
}
```

**Property Chain:**
```
member_expression {
  object: member_expression {
    object: identifier "a"
    property: property_identifier "b"
  }
  property: property_identifier "c"
}
// Represents: a.b.c
```

**Type Annotation (TypeScript):**
```
type_annotation {
  type_identifier "string"
}
// OR
type_annotation {
  generic_type {
    name: type_identifier "Array"
    type_arguments {
      type_identifier "string"
    }
  }
}
```

**Assignment:**
```
assignment_expression {
  left: identifier "target"
  right: call_expression { ... }
}
// OR
variable_declarator {
  name: identifier "target"
  value: call_expression { ... }
}
```

### 2. Implementation Skeleton

```typescript
import type { SyntaxNode } from "tree-sitter";
import type {
  Location,
  SymbolName,
  TypeInfo,
  FilePath,
  TypeId,
} from "@ariadnejs/types";
import { defined_type_id, TypeCategory } from "@ariadnejs/types";
import type { MetadataExtractors } from "./metadata_types";

/**
 * JavaScript/TypeScript metadata extractors
 *
 * Handles both JavaScript and TypeScript AST structures.
 * TypeScript-specific nodes (type annotations) are checked first.
 */

function node_to_location(node: SyntaxNode, file_path: FilePath): Location {
  return {
    file_path,
    start_line: node.startPosition.row + 1,
    start_column: node.startPosition.column,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column,
  };
}

function extract_type_from_annotation(
  node: SyntaxNode,
  file_path: FilePath
): TypeInfo | undefined {
  // Implementation here
}

function extract_call_receiver(
  node: SyntaxNode,
  file_path: FilePath
): Location | undefined {
  // Implementation here
}

function extract_property_chain(
  node: SyntaxNode
): readonly SymbolName[] | undefined {
  // Implementation here
}

function extract_assignment_parts(
  node: SyntaxNode,
  file_path: FilePath
): {
  source: Location | undefined;
  target: Location | undefined;
} {
  // Implementation here
}

function extract_construct_target(
  node: SyntaxNode,
  file_path: FilePath
): Location | undefined {
  // Implementation here
}

function extract_type_arguments(
  node: SyntaxNode
): readonly SymbolName[] | undefined {
  // Implementation here
}

export const JAVASCRIPT_METADATA_EXTRACTORS: MetadataExtractors = {
  extract_type_from_annotation,
  extract_call_receiver,
  extract_property_chain,
  extract_assignment_parts,
  extract_construct_target,
  extract_type_arguments,
};
```

### 3. Detailed Implementation Notes

#### extract_type_from_annotation()

1. Check if node or parent has `type_annotation` child
2. Navigate to type identifier node
3. Handle simple types: `string`, `number`, `boolean`, etc.
4. Handle generic types: `Array<T>`, `Promise<T>`
5. Handle union types: `string | number`
6. Return `TypeInfo` with appropriate `TypeId` and certainty

Certainty levels:
- "declared" - explicit type annotation present
- "inferred" - type inferred from context
- "ambiguous" - multiple possible types

#### extract_call_receiver()

1. Check if node is `call_expression`
2. Get `function` child
3. If `function` is `member_expression`, get `object` child
4. Return location of object node
5. Handle chained calls: `a.b().c()` - extract location of `a.b()`

#### extract_property_chain()

1. Check if node is `member_expression`
2. Recursively traverse object nodes building chain
3. Collect property identifiers in order
4. Return array: `["a", "b", "c"]` for `a.b.c`
5. Handle computed properties: `obj[key]` - skip dynamic access

#### extract_assignment_parts()

1. Check for `assignment_expression` or `variable_declarator`
2. Extract `left`/`name` for target
3. Extract `right`/`value` for source
4. Return locations of both
5. Handle destructuring: `const { x } = obj` - extract relevant parts

#### extract_construct_target()

1. Look for parent `variable_declarator` or `assignment_expression`
2. Check if value/right is `new_expression`
3. Extract target identifier location
4. Handle: `const obj = new Class()`

#### extract_type_arguments()

1. Check for `type_arguments` or `generic_type`
2. Extract child type identifiers
3. Return array of type names
4. Handle nested generics: `Map<string, Array<number>>`

### 4. Helper Functions

Add any helper functions needed:

```typescript
/**
 * Find child node by type
 */
function find_child_by_type(
  node: SyntaxNode,
  type: string
): SyntaxNode | undefined {
  return node.children.find((child) => child.type === type);
}

/**
 * Recursively collect property chain
 */
function collect_property_chain(
  node: SyntaxNode,
  chain: SymbolName[] = []
): SymbolName[] {
  // Recursive implementation
}

/**
 * Extract type name from type node
 */
function extract_type_name(node: SyntaxNode): SymbolName | undefined {
  // Handle different type node structures
}
```

## Implementation Steps

1. Create file with imports and helper functions
2. Implement `extract_type_from_annotation()`
3. Implement `extract_call_receiver()`
4. Implement `extract_property_chain()`
5. Implement `extract_assignment_parts()`
6. Implement `extract_construct_target()`
7. Implement `extract_type_arguments()`
8. Export `JAVASCRIPT_METADATA_EXTRACTORS` constant
9. Add JSDoc comments
10. Verify TypeScript compilation

## Testing

Tests will be added in task 104.3.2. For now, ensure:
- TypeScript compiles
- All functions return correct types
- All functions handle `undefined` gracefully

## Success Criteria

- ✅ `javascript_metadata.ts` file created
- ✅ All 6 extractor functions implemented
- ✅ Functions handle JavaScript AST structures
- ✅ Functions handle TypeScript AST structures
- ✅ `JAVASCRIPT_METADATA_EXTRACTORS` constant exported
- ✅ TypeScript compiles without errors
- ✅ JSDoc comments added to all functions

## Notes

### AST Exploration Tips

Use tree-sitter CLI to explore AST:
```bash
npx tree-sitter parse --scope source.js "obj.method()"
npx tree-sitter parse --scope source.ts "const x: string = 'hello'"
```

### Common Gotchas

1. **Optional chaining**: `obj?.method()` has different AST structure
2. **Computed properties**: `obj[key]` - can't extract static chain
3. **Spread in assignments**: `const { ...rest } = obj` - complex destructuring
4. **Generic type nesting**: `Map<string, Array<T>>` - recursive traversal needed

### TypeScript vs JavaScript

- Both languages share most AST node types
- TypeScript adds: `type_annotation`, `type_arguments`, `generic_type`
- Check for TypeScript nodes first, fall back to JavaScript patterns
- Some JavaScript code may have TypeScript type nodes (JSDoc types)

## Related Files

- `packages/core/src/index_single_file/query_code_tree/language_configs/metadata_types.ts`
- `packages/core/src/index_single_file/node_utils.ts` (existing location helper)

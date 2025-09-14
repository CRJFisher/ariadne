# Task 11.100.0.5.29: Remove Language-Specific Implementations

## Status

Status: Not Started
Priority: High
Created: 2025-09-14
Epic: epic-11-codebase-restructuring

## Summary

Delete all language-specific implementation files that contain manual AST traversal code. These files typically follow the pattern `*.javascript.ts`, `*.typescript.ts`, `*.python.ts`, `*.rust.ts` and contain specialized AST processing logic that will be replaced by tree-sitter queries.

## Example files to Delete

### call_graph/method_calls/

- `method_calls.javascript.ts`
- `method_calls.rust.ts`

### call_graph/constructor_calls/

- Keep test files for now (will update in task 31)

### inheritance/class_detection/

- `class_detection.javascript.ts`
- `class_detection.python.ts`
- `class_detection.rust.ts`
- `language_configs.ts`

-> Find all instances of these types of files and delete them

## Files to Keep

### Enhancement Modules e.g

- `method_hierarchy_resolver.ts`
- `constructor_type_resolver.ts`
- Any cross-file resolution modules

## Implementation Steps

1. Delete language-specific implementation files
2. Update index.ts files to remove imports of deleted files
3. Update main implementation files to remove language-specific function calls
4. Ensure type definitions remain intact

## Example Update

```typescript
// Before: method_calls.ts
import { find_javascript_method_calls } from "./method_calls.javascript";

export function find_method_calls(
  tree: Parser.Tree,
  source: string,
  language: Language
): MethodCall[] {
  switch (language) {
    case "javascript":
      return find_javascript_method_calls(tree, source);
    // ...
  }
}

// After: method_calls.ts (stub)
export function find_method_calls(
  tree: Parser.Tree,
  source: string,
  language: Language
): MethodCall[] {
  // TODO: Implement using tree-sitter queries
  return [];
}
```

## Success Criteria

- All language-specific AST processing files are deleted
- Main implementation files are simplified to stubs
- Type system still compiles
- No import errors for deleted files

## Dependencies

- Task 27: Stub implementations must be ready

## Follow-up Tasks

- Task 30: Update file_analyzer to work with stubs
- Task 31: Delete internal helper functions

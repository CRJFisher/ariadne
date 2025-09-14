# Task 11.100.0.5.30: Delete Internal AST Helper Functions

## Status

Status: Not Started
Priority: High
Created: 2025-09-14
Epic: epic-11-codebase-restructuring

## Summary

Remove all internal helper functions that support manual AST traversal. These are utility functions that process AST nodes, extract node properties, traverse child nodes, etc. They will no longer be needed once modules are stubbed.
This requires _deletion_, not deprecation or marking as legacy etc. Delete all of them.

## Types of Helper Functions to Delete

### 1. Node Processing Helpers

Functions that extract data from AST nodes:

- `get_node_text()`
- `extract_identifier()`
- `get_field_name()`
- `find_child_of_type()`
- `get_node_range()`

### 2. Traversal Helpers

Functions that walk the AST:

- `traverse_tree()`
- `visit_nodes()`
- `find_all_nodes()`
- `walk_ancestors()`
- `collect_descendants()`

### 3. Language-Specific Helpers

Utility functions for specific language constructs:

- `is_async_function()`
- `extract_decorator()`
- `get_generic_params()`
- `parse_type_annotation()`
- `is_class_method()`

### 4. Pattern Matching Helpers

Functions that match AST patterns:

- `matches_pattern()`
- `is_call_expression()`
- `is_member_access()`
- `find_matching_nodes()`

## Modules to Clean

### Primary Targets

1. **scope_analysis/scope_tree/**

   - Remove all helper functions except the main export

2. **call_graph/function_calls/**

   - Keep only `find_function_calls()` stub

3. **call_graph/method_calls/**

   - Keep only `find_method_calls()` stub
   - Preserve `method_hierarchy_resolver.ts`

4. **call_graph/constructor_calls/**

   - Keep only `find_constructor_calls()` stub
   - Preserve `constructor_type_resolver.ts`

5. **inheritance/class_detection/**

   - Keep only `find_class_definitions()` stub

6. **type_analysis/type_tracking/**

   - Keep only `process_file_for_types()` stub

7. **import_export/import_resolution/**

   - Keep only `extract_imports()` stub

8. **import_export/export_detection/**
   - Keep only `extract_exports()` stub

### Other Modules

- Search for other instances of AST traversal (maybe search for tree-sitter types such as SyntaxNode) and then delete _all_ the helper functions

## Implementation Pattern

```typescript
// Before: function_calls.ts
function extract_function_name(node: SyntaxNode): string {
  const name_node = node.childForFieldName("name");
  return name_node?.text || "anonymous";
}

function is_function_call(node: SyntaxNode): boolean {
  return node.type === "call_expression";
}

export function find_function_calls(
  tree: Parser.Tree,
  source: string,
  language: Language
): FunctionCall[] {
  const calls: FunctionCall[] = [];
  traverse_tree(tree.rootNode, (node) => {
    if (is_function_call(node)) {
      // ... complex extraction logic
    }
  });
  return calls;
}

// After: function_calls.ts (stub only)
export function find_function_calls(
  tree: Parser.Tree,
  source: string,
  language: Language
): FunctionCall[] {
  // TODO: Implement using tree-sitter queries from queries/calls/${language}.scm
  return [];
}
```

## Files to Preserve

### Keep These Files

- Type definitions and interfaces
- Cross-file resolution modules
- Enhancement modules
- Query files (.scm)
- Index files with type exports

## Success Criteria

- Each AST processing module contains only its main export stub
- No internal helper functions remain
- Type definitions are preserved
- Enhancement modules still compile
- Significant reduction in code size

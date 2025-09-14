# Task 11.100.0.5.27: Replace AST Processing Modules with Stubs

## Status
Status: Not Started
Priority: High
Created: 2025-09-14
Epic: epic-11-codebase-restructuring

## Summary
Replace all manual AST traversal modules with stub implementations that return empty results. This will clear the way for implementing tree-sitter query-based extraction while preserving the cross-file enhancement logic.

## Modules to Replace with Stubs

### Direct AST Processing (to stub):
1. **scope_analysis/scope_tree**
   - `build_scope_tree()` - manual AST traversal
   - `extract_variables_from_scopes()` - processes AST nodes
   
2. **call_graph/function_calls**
   - `find_function_calls()` - manual AST traversal
   
3. **call_graph/method_calls**  
   - `find_method_calls()` - manual AST traversal
   - Keep: `method_hierarchy_resolver.ts` (enhancement)
   
4. **call_graph/constructor_calls**
   - `find_constructor_calls()` - manual AST traversal
   - Keep: `constructor_type_resolver.ts` (enhancement)
   
5. **inheritance/class_detection**
   - `find_class_definitions()` - manual AST traversal
   
6. **type_analysis/type_tracking**
   - `process_file_for_types()` - manual AST traversal
   
7. **type_analysis/return_type_inference**
   - `infer_all_return_types()` - manual AST traversal
   
8. **type_analysis/parameter_type_inference**
   - `infer_all_parameter_types()` - manual AST traversal
   
9. **import_export/import_resolution**
   - `extract_imports()` - manual AST traversal
   
10. **import_export/export_detection**
    - `extract_exports()` - manual AST traversal

### Other Modules

- Search for other instances of AST traversal (maybe search for tree-sitter types such as SyntaxNode) and then make the stubs there too.

## Implementation Approach

For each module:
1. Create a stub function that returns empty/minimal data structure
2. Remove all internal implementation functions
3. Delete language-specific implementations (*.javascript.ts, *.python.ts, etc.)
4. Keep the exported type definitions
5. Add TODO comment referencing future tree-sitter query implementation

## Example Stub Implementation

```typescript
// scope_analysis/scope_tree/scope_tree.ts
export function build_scope_tree(
  root: SyntaxNode,
  source: string,
  language: Language
): ScopeTree {
  // TODO: Implement using tree-sitter queries from scope_queries/*.scm
  return {
    root: {
      id: "root",
      type: "global",
      range: { start: 0, end: source.length },
      children: [],
      symbols: new Map()
    }
  };
}
```

## Success Criteria
- All AST processing functions return minimal valid structures
- Cross-file enhancement modules continue to work (with empty data)
- Type system compiles without errors
- Tests are updated to expect stub behavior

## Dependencies
- None - this is cleanup work

## Follow-up Tasks
- Task 28: Preserve tree-sitter query files
- Task 29: Implement query-based extraction for each module
# Task 11.100.0.5.30: Update file_analyzer for Stub Modules

## Status
Status: Not Started
Priority: High  
Created: 2025-09-14
Epic: epic-11-codebase-restructuring

## Summary
Update `file_analyzer.ts` to work with the stubbed AST processing modules. The file_analyzer orchestrates all the extraction functions, so it needs to continue functioning even when the underlying extractors return empty results.

## Current file_analyzer Flow

The file_analyzer currently calls these AST processing functions:
1. `build_scope_tree()` - from scope_tree
2. `extract_imports()` - from import_resolution  
3. `extract_exports()` - from export_detection
4. `find_class_definitions()` - from class_detection
5. `process_file_for_types()` - from type_tracking
6. `find_function_calls()` - from function_calls
7. `find_method_calls()` - from method_calls
8. `find_constructor_calls()` - from constructor_calls
9. `infer_all_return_types()` - from return_type_inference
10. `infer_all_parameter_types()` - from parameter_type_inference

## Required Updates

### 1. Ensure Stub Compatibility
- Verify all extraction functions return valid empty structures
- Handle empty results gracefully in post-processing
- Maintain the FileAnalysis structure integrity

### 2. Add Development Comments
```typescript
// file_analyzer.ts
export async function analyze_file(file: CodeFile): Promise<{ analysis: FileAnalysis; tree: Parser.Tree }> {
  // ... existing setup ...
  
  // TODO: These extractors currently return stubs
  // Will be replaced with tree-sitter query-based extraction
  
  const scope_tree = build_scope_tree(tree.rootNode, source_code, file.language);
  // Returns: { root: minimal scope node }
  
  const imports = extract_imports(tree, source_code, file.language);
  // Returns: []
  
  // ... etc
}
```

### 3. Ensure Enhancement Functions Still Work
Functions that depend on extracted data should handle empty inputs:
- `build_scope_entity_connections()` 
- `build_symbol_registry()`
- `extract_variables_from_scopes()`

### 4. Minimal Valid FileAnalysis
Ensure the returned FileAnalysis has all required fields:
```typescript
const analysis: FileAnalysis = {
  file_path: file.file_path,
  language: file.language,
  imports: [],
  exports: [],
  functions: [],
  classes: [],
  methods: [],
  properties: [],
  variables: [],
  function_calls: [],
  method_calls: [],
  constructor_calls: [],
  scopes: [],
  types: [],
  symbols: new Map(),
  namespaces: []
};
```

## Testing Approach

1. Run file_analyzer with stub modules
2. Verify it returns valid FileAnalysis structure
3. Ensure no null/undefined errors
4. Check that enhancement modules handle empty data

## Success Criteria
- file_analyzer runs without errors with stub modules
- Returns valid FileAnalysis with empty/minimal data
- code_graph.ts can process the analysis results
- No runtime errors from missing data

## Dependencies
- Task 27: Stub modules must be implemented
- Task 29: Language-specific files must be removed

## Follow-up Tasks
- Task 31: Delete internal helper functions
- Task 32: Update tests for stub behavior
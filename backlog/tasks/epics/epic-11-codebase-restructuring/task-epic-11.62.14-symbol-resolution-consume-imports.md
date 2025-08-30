---
id: task-epic-11.62.14
title: Update Symbol Resolution to Consume Imports Instead of Extracting
status: To Do
assignee: []
created_date: "2025-08-30"
labels: [epic-11, sub-task, cleanup, layer-dependency]
dependencies: [task-epic-11.62.8]
parent_task_id: task-epic-11.62
---

## Description

Complete the cleanup of symbol_resolution by removing all import extraction code and updating it to consume ImportInfo[] as a parameter. This is the second half of the work started in task 11.62.8.

## Context from 11.62.8

Task 11.62.8 successfully MOVED the extract_imports functionality from symbol_resolution to import_resolution (architecturally correct - Layer 2 extracts, Layer 8 consumes). However, symbol_resolution still contains duplicate extraction code that needs to be removed, and its APIs need updating to accept imports as parameters.

## Current State

### What Was Done in 11.62.8
- ✅ Created `/packages/core/src/import_export/import_resolution/import_extraction.ts`
- ✅ Updated code_graph.ts to import `extract_imports` from import_resolution
- ✅ Fixed type compatibility between ExtractedImport and ImportInfo

### What Still Exists (Needs Removal)
- `extract_imports()` function in symbol_resolution/index.ts
- `extract_es6_imports()` in symbol_resolution.javascript.ts
- `extract_commonjs_imports()` in symbol_resolution.javascript.ts
- `extract_typescript_imports()` in symbol_resolution.typescript.ts
- `extract_python_imports()` in symbol_resolution.python.ts
- `extract_rust_use_statements()` in symbol_resolution.rust.ts
- Similar extraction functions in other language files

## Acceptance Criteria

### 1. Remove All Import Extraction from Symbol Resolution

- [ ] Remove `extract_imports()` from symbol_resolution/index.ts
- [ ] Remove `extract_es6_imports()` from symbol_resolution.javascript.ts
- [ ] Remove `extract_commonjs_imports()` from symbol_resolution.javascript.ts
- [ ] Remove `extract_es6_exports()` from symbol_resolution.javascript.ts (if export extraction should also move)
- [ ] Remove `extract_commonjs_exports()` from symbol_resolution.javascript.ts
- [ ] Remove `extract_typescript_imports()` from symbol_resolution.typescript.ts
- [ ] Remove `extract_typescript_exports()` from symbol_resolution.typescript.ts
- [ ] Remove `extract_python_imports()` from symbol_resolution.python.ts
- [ ] Remove `extract_python_exports()` from symbol_resolution.python.ts
- [ ] Remove `extract_rust_use_statements()` from symbol_resolution.rust.ts
- [ ] Remove `extract_rust_exports()` from symbol_resolution.rust.ts

### 2. Update ResolutionContext to Accept Imports

- [ ] Update ResolutionContext interface:
```typescript
export interface ResolutionContext {
  scope_tree: ScopeTree;
  file_path?: string;
  imports: ImportInfo[];      // Required, not optional
  exports?: ExportInfo[];     // Keep optional for now
  type_context?: Map<string, string>;
  cross_file_graphs?: Map<string, ScopeTree>;
}
```

### 3. Update create_resolution_context

- [ ] Remove AST-based extraction:
```typescript
export function create_resolution_context(
  scope_tree: ScopeTree,
  imports: ImportInfo[],        // NEW: Required parameter
  exports: ExportInfo[],         // NEW: Required parameter
  language: Language,
  file_path?: string,
  module_graph?: any
): ResolutionContext {
  const base_context: ResolutionContext = {
    scope_tree,
    imports,      // Use provided imports
    exports,      // Use provided exports
    file_path
  };
  
  // Add language-specific context WITHOUT extraction
  switch (language) {
    case 'javascript':
      const js_context: JavaScriptResolutionContext = {
        ...base_context,
        hoisted_symbols: new Map(),
        closure_scopes: new Map(),
        prototype_chains: new Map(),
        this_bindings: new Map()
      };
      return js_context;
    
    // Similar for other languages...
  }
}
```

### 4. Update High-Level APIs

- [ ] Update all high-level functions to require imports:
```typescript
export function resolve_at_cursor(
  position: Position,
  scope_tree: ScopeTree,
  imports: ImportInfo[],      // NEW: Required
  exports: ExportInfo[],      // NEW: Required
  language: Language,
  file_path: string,
  module_graph?: any
): ResolvedSymbol | undefined {
  const context = create_resolution_context(
    scope_tree,
    imports,
    exports,
    language,
    file_path
  );
  
  return resolve_symbol_at_position(position, context);
}
```

### 5. Update Tests

- [ ] Update all tests to provide ImportInfo[] instead of relying on extraction:
```typescript
// OLD TEST:
it('should resolve imported symbols', () => {
  const source = `import { foo } from './foo';`;
  const result = resolve_symbols(scope_tree, source, 'javascript');
  // Test relied on internal import extraction
});

// NEW TEST:
it('should resolve imported symbols', () => {
  const imports: ImportInfo[] = [{
    name: 'foo',
    source: './foo',
    kind: 'named',
    location: { line: 0, column: 0 }
  }];
  const exports: ExportInfo[] = [];
  
  const result = resolve_symbols(
    scope_tree,
    imports,
    exports,
    'javascript'
  );
  // Test with provided imports
});
```

### 6. Handle Export Extraction Decision

- [ ] Decide if export extraction should also move to export_detection module
- [ ] If yes, move extract_exports similarly to how extract_imports was moved
- [ ] If no, document why exports stay in symbol_resolution

## Implementation Strategy

### Phase 1: Add New Parameters (Backward Compatible)
1. Add imports/exports as optional parameters to all functions
2. Update implementation to prefer provided data over extraction
3. Verify nothing breaks

### Phase 2: Update All Callers
1. Update code_graph.ts to pass imports/exports to symbol_resolution
2. Update any other callers to provide required data
3. Run all tests to ensure compatibility

### Phase 3: Remove Extraction Code
1. Remove all import extraction functions
2. Remove all export extraction functions (if decided)
3. Make imports/exports parameters required
4. Clean up unused imports and types

### Phase 4: Update Tests
1. Update all test files to provide imports/exports
2. Remove tests that specifically tested extraction
3. Add tests for proper consumption of provided data

## Testing Requirements

- [ ] All existing symbol resolution tests pass with provided imports
- [ ] Test that symbol resolution correctly uses provided ImportInfo[]
- [ ] Test that no import extraction occurs internally
- [ ] Verify proper error handling when imports are missing
- [ ] Integration test with import_resolution providing data

## Success Metrics

- [ ] No duplicate import extraction code remains
- [ ] Symbol resolution accepts ImportInfo[] as required parameter
- [ ] Clear separation of concerns (Layer 2 extracts, Layer 8 consumes)
- [ ] All tests pass with new signature
- [ ] Reduced code complexity and size

## Risks and Mitigation

### Risk: Breaking Existing Integrations
**Mitigation**: Use phased approach with backward compatibility first

### Risk: Missing Edge Cases in Tests
**Mitigation**: Carefully review all test files before removing extraction

### Risk: Export Extraction Complications
**Mitigation**: Can be done as separate task if too complex

## Notes

- This completes the architectural correction started in 11.62.8
- Enforces proper layer dependencies per PROCESSING_PIPELINE.md
- Symbol resolution (Layer 8) should consume, not extract
- Import extraction belongs in import_resolution (Layer 2)
- Consider same pattern for export extraction

## References

- Parent task: task-epic-11.62
- Previous task: task-epic-11.62.8 (partial implementation)
- Symbol resolution: `/packages/core/src/scope_analysis/symbol_resolution/`
- Import resolution: `/packages/core/src/import_export/import_resolution/`
- Import extraction: `/packages/core/src/import_export/import_resolution/import_extraction.ts`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md`
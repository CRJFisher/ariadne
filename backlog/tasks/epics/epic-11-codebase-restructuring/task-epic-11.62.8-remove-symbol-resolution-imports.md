---
id: task-epic-11.62.8
title: Remove Import Extraction from Symbol Resolution
status: Partially Complete
assignee: []
created_date: "2025-08-29"
completed_date: "2025-08-30"
labels: [epic-11, sub-task, cleanup, deduplication]
dependencies: [task-epic-11.62.1]
parent_task_id: task-epic-11.62
---

## Description

Remove the duplicate import extraction logic from symbol_resolution module and wire it to consume ImportInfo[] from import_resolution instead. This eliminates code duplication and ensures consistent import handling.

## Current Problem

The symbol_resolution module currently:
- Extracts imports itself (duplicating import_resolution)
- May have inconsistent import parsing logic
- Increases maintenance burden with duplicate code
- Violates single responsibility principle

## Acceptance Criteria

### Remove Duplicate Code

- [ ] Identify and remove `extract_imports()` function from symbol_resolution
- [ ] Remove any AST traversal for import detection
- [ ] Remove import-related helper functions that duplicate import_resolution

### Update Function Signature

- [ ] Update resolve_symbols to accept imports:
```typescript
// OLD:
export function resolve_symbols(
  scope_tree: ScopeTree,
  source: string,
  language: Language
): ResolvedSymbols {
  // Internally calls extract_imports()
}

// NEW:
export function resolve_symbols(
  scope_tree: ScopeTree,
  imports: ImportInfo[],        // Provided externally
  module_graph?: ModuleGraph,    // For cross-file resolution
  source: string,
  language: Language
): ResolvedSymbols {
  // Uses provided imports
}
```

### Use Provided Imports

- [ ] Modify symbol resolution logic to use ImportInfo[]:
```typescript
function resolve_identifier(
  identifier: string,
  scope: Scope,
  imports: ImportInfo[]  // Use this instead of extracting
): ResolvedSymbol | undefined {
  // Check local scope first
  const local = scope.find_symbol(identifier);
  if (local) {
    return local;
  }
  
  // Check imports (no longer extracted internally)
  const imported = imports.find(i => 
    i.name === identifier || i.alias === identifier
  );
  
  if (imported) {
    return {
      name: identifier,
      source: imported.source,
      kind: 'imported',
      location: imported.location
    };
  }
  
  return undefined;
}
```

### Update Tests

- [ ] Modify tests to provide ImportInfo[] instead of relying on extraction:
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
    location: { start: 0, end: 28 }
  }];
  const result = resolve_symbols(
    scope_tree,
    imports,  // Provide imports explicitly
    undefined,
    source,
    'javascript'
  );
  // Test with provided imports
});
```

### Clean Up Language-Specific Files

- [ ] Remove import extraction from symbol_resolution.javascript.ts
- [ ] Remove import extraction from symbol_resolution.typescript.ts
- [ ] Remove import extraction from symbol_resolution.python.ts
- [ ] Remove import extraction from symbol_resolution.rust.ts

## Implementation Notes

### What to Keep

- Symbol resolution logic for local variables
- Scope traversal for identifier lookup
- Cross-reference resolution within file
- Symbol categorization (variable, function, class, etc.)

### What to Remove

- Any code that parses import statements
- AST traversal specifically for imports
- Import-related node type checks
- Import path resolution (handled by import_resolution)

### Migration Path

1. Add imports parameter as optional first
2. Update implementation to prefer provided imports
3. Update all callers to provide imports
4. Remove internal extraction code
5. Make imports parameter required

## Testing Requirements

- [ ] All existing symbol resolution tests still pass
- [ ] Test that provided imports are used correctly
- [ ] Test that no import extraction occurs internally
- [ ] Verify performance improvement (less AST traversal)
- [ ] Integration test with import_resolution providing data

## Success Metrics

- [ ] No duplicate import extraction code
- [ ] Symbol resolution uses provided ImportInfo[]
- [ ] Reduced code complexity
- [ ] All tests pass with new signature
- [ ] Clear separation of concerns

## Notes

- This is a cleanup task that improves maintainability
- Should reduce total codebase size
- Makes the data flow more explicit
- Sets precedent for avoiding duplication in other modules

## Implementation Notes - PARTIALLY COMPLETE

### What Was Done

This task was **partially completed**. The original task assumed that import_resolution already had extraction capability and symbol_resolution just needed to stop duplicating it. However, the reality was more complex:

1. **MOVED** `extract_imports()` from symbol_resolution to import_resolution
   - Created `/packages/core/src/import_export/import_resolution/import_extraction.ts`
   - This is architecturally correct - Layer 2 should extract, Layer 8 should consume

2. **UPDATED** code_graph.ts to import from the correct location
   - Now imports `extract_imports` from import_resolution instead of symbol_resolution

3. **FIXED** type compatibility issues
   - Aligned ExtractedImport with ImportInfo from @ariadnejs/types
   - Added required `kind` field to all extraction functions
   - Fixed field naming (module_path → source, etc.)

### What Still Needs to Be Done

**Created follow-up task 11.62.14** for the remaining work:

1. **REMOVE** the duplicate extract_imports from symbol_resolution/index.ts
2. **UPDATE** symbol_resolution to accept ImportInfo[] as parameter
3. **REMOVE** language-specific extraction functions from symbol_resolution files
4. **UPDATE** all symbol_resolution tests to provide imports instead of extracting

### Why This Approach

The original task underestimated the scope. The extraction logic wasn't duplicated - it was in the WRONG LAYER. Moving it to import_resolution (Layer 2) is architecturally correct per PROCESSING_PIPELINE.md.

The remaining work (updating symbol_resolution to consume imports) is significant enough to warrant a separate task to avoid mixing too many changes.

## References

- Parent task: task-epic-11.62
- Symbol resolution: `/packages/core/src/scope_analysis/symbol_resolution/`
- Import resolution: `/packages/core/src/import_export/import_resolution/`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 8 depends on Layer 2)
- Follow-up task: task-epic-11.62.14
---
id: task-epic-11.62.8
title: Remove Import Extraction from Symbol Resolution
status: To Do
assignee: []
created_date: "2025-08-29"
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

## References

- Parent task: task-epic-11.62
- Symbol resolution: `/packages/core/src/scope_analysis/symbol_resolution/`
- Import resolution: `/packages/core/src/import_export/import_resolution/`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 8 depends on Layer 2)
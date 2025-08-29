---
id: task-epic-11.63
title: Remove Import Extraction Duplication
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, refactoring, cleanup, duplication]
dependencies: []
parent_task_id: epic-11
---

## Description

Remove duplicate import extraction logic from `symbol_resolution` module. Currently, both `import_resolution` and `symbol_resolution` extract imports independently, violating the single responsibility principle and creating maintenance burden.

## Context

From PROCESSING_PIPELINE.md:
- Layer 2 (import_resolution) should be the single source of truth for imports
- Layer 8 (symbol_resolution) should consume imports, not re-extract them

From ARCHITECTURE_ISSUES.md (Issue #1):
- `scope_analysis/symbol_resolution/` has `extract_imports()` functions
- `import_export/import_resolution/` should be the canonical place
- This violates single responsibility principle
- Creates potential inconsistencies in import handling

## Current State

### Duplicate Functions in symbol_resolution:
```typescript
// These should be removed:
extract_imports()
extract_es6_imports()
extract_commonjs_imports()
extract_typescript_imports()
extract_python_imports()
```

### Canonical Functions in import_resolution:
```typescript
// These should be the only import extractors:
find_imports()
find_imports_javascript()
find_imports_typescript()
find_imports_python()
find_imports_rust()
```

## Acceptance Criteria

### Remove Duplicate Code
- [ ] Delete `extract_imports()` from `/scope_analysis/symbol_resolution/index.ts`
- [ ] Delete `extract_es6_imports()` from `/scope_analysis/symbol_resolution/symbol_resolution.javascript.ts`
- [ ] Delete `extract_commonjs_imports()` from `/scope_analysis/symbol_resolution/symbol_resolution.javascript.ts`
- [ ] Delete `extract_typescript_imports()` from `/scope_analysis/symbol_resolution/symbol_resolution.typescript.ts`
- [ ] Delete `extract_python_imports()` from `/scope_analysis/symbol_resolution/symbol_resolution.python.ts`
- [ ] Remove any other import extraction logic from symbol_resolution

### Update Symbol Resolution
- [ ] Modify `resolve_symbols()` to accept ImportInfo[] as input:
  ```typescript
  export function resolve_symbols(
    scope_tree: ScopeTree,
    imports: ImportInfo[],  // Now provided, not extracted
    source_code: string,
    language: Language
  ): ResolvedSymbols
  ```
- [ ] Update all language-specific symbol resolution functions similarly
- [ ] Use provided imports for symbol lookup instead of extracting

### Update Integration Points
- [ ] Update `code_graph.ts` to:
  1. Call import_resolution first
  2. Pass ImportInfo[] to symbol_resolution
- [ ] Ensure proper data flow between layers:
  ```typescript
  // In code_graph.ts or orchestrator
  const imports = find_imports(context);
  const symbols = resolve_symbols(scope_tree, imports, source, language);
  ```

### Fix Tests
- [ ] Update symbol_resolution tests to provide ImportInfo[] instead of raw code
- [ ] Remove tests for deleted extract_imports functions
- [ ] Add integration tests ensuring import_resolution → symbol_resolution flow
- [ ] Verify no functionality is lost

### Documentation
- [ ] Update module documentation to clarify responsibilities
- [ ] Document that import_resolution is the sole import extractor
- [ ] Document that symbol_resolution consumes imports

## Implementation Notes

### Migration Strategy
1. First add ImportInfo[] parameter to resolve_symbols (backward compatible)
2. Update callers to pass imports
3. Remove internal import extraction
4. Clean up tests
5. Remove old functions

### Data Flow After Change
```
Layer 2 (Per-File):
  import_resolution.find_imports() → ImportInfo[]
  ↓
Layer 8 (Global):
  symbol_resolution.resolve_symbols(imports) → ResolvedSymbols
```

### What Symbol Resolution Should Do
- Resolve symbol references to their definitions
- Use imports to resolve external symbols
- Track symbol usage across scopes
- NOT extract imports (that's import_resolution's job)

### Testing Approach
Create mock ImportInfo[] for tests:
```typescript
const mockImports: ImportInfo[] = [
  {
    imported_name: 'foo',
    local_name: 'foo',
    source_module: './foo',
    location: { row: 1, column: 0 }
  }
];
const resolved = resolve_symbols(scopeTree, mockImports, source, 'javascript');
```

## Success Metrics
- Zero import extraction code in symbol_resolution
- All tests pass with new data flow
- import_resolution is the only module extracting imports
- No performance regression
- Cleaner separation of concerns

## Benefits
- Single source of truth for import extraction
- Easier to maintain and fix import bugs
- Consistent import handling across codebase
- Follows processing pipeline architecture
- Reduces code duplication

## References
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 2 vs Layer 8)
- Architecture issues: `/packages/core/ARCHITECTURE_ISSUES.md` (Issue #1)
- Duplicate code locations:
  - `/scope_analysis/symbol_resolution/index.ts`
  - `/scope_analysis/symbol_resolution/symbol_resolution.*.ts`
- Canonical implementation: `/import_export/import_resolution/`
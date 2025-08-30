---
id: task-epic-11.62.15
title: Move Export Extraction from Symbol Resolution to Export Detection
status: To Do
assignee: []
created_date: "2025-08-30"
labels: [epic-11, sub-task, cleanup, layer-dependency, architecture]
dependencies: [task-epic-11.62.8, task-epic-11.62.14]
parent_task_id: task-epic-11.62
---

## Description

Move export extraction logic from symbol_resolution (Layer 8) to export_detection (Layer 2), following the same architectural correction done for imports in task 11.62.8. This enforces proper layer dependencies where Layer 2 extracts exports from AST and Layer 8 consumes them.

## Context from Related Tasks

In task 11.62.8, we discovered that import extraction was in the wrong architectural layer:
- `extract_imports` was in symbol_resolution (Layer 8 - Global Symbol Resolution)
- It was moved to import_resolution (Layer 2 - Local Structure Detection)
- This is architecturally correct: Layer 2 extracts from AST, Layer 8 consumes processed data

The **same issue exists for export extraction** - it's currently in symbol_resolution but should be in export_detection.

## Current State

### What Exists Now (Incorrect)
```
/packages/core/src/scope_analysis/symbol_resolution/
├── index.ts                              # Has extract_exports() - WRONG LAYER
├── symbol_resolution.javascript.ts      # Has extract_es6_exports(), extract_commonjs_exports()
├── symbol_resolution.typescript.ts      # Has extract_typescript_exports()
├── symbol_resolution.python.ts          # Has extract_python_exports()
└── symbol_resolution.rust.ts            # Has extract_rust_exports()
```

### What Should Exist (Correct)
```
/packages/core/src/import_export/export_detection/
├── index.ts                              # Should have extract_exports()
├── export_extraction.ts                 # NEW: Core export extraction logic
├── export_detection.ts                  # Existing export detection logic
└── ...language-specific files...
```

## Acceptance Criteria

### 1. Create Export Extraction Module

- [ ] Create `/packages/core/src/import_export/export_detection/export_extraction.ts`
- [ ] Move `extract_exports()` main dispatcher from symbol_resolution
- [ ] Ensure it returns ExportInfo[] from @ariadnejs/types

### 2. Move Language-Specific Export Extraction

- [ ] Move `extract_es6_exports()` from symbol_resolution.javascript.ts
- [ ] Move `extract_commonjs_exports()` from symbol_resolution.javascript.ts
- [ ] Move `extract_typescript_exports()` from symbol_resolution.typescript.ts
- [ ] Move `extract_python_exports()` from symbol_resolution.python.ts
- [ ] Move `extract_rust_exports()` from symbol_resolution.rust.ts

### 3. Update Export Detection Index

- [ ] Update `/packages/core/src/import_export/export_detection/index.ts`:
```typescript
// Re-export extraction functionality
export {
  extract_exports,
  extract_javascript_exports,
  extract_typescript_exports,
  extract_python_exports,
  extract_rust_exports
} from './export_extraction';
```

### 4. Update code_graph.ts

- [ ] Change import from symbol_resolution to export_detection:
```typescript
// OLD:
import { extract_exports } from "./scope_analysis/symbol_resolution";

// NEW:
import { extract_exports } from "./import_export/export_detection";
```

### 5. Update Symbol Resolution

- [ ] Remove `extract_exports()` from symbol_resolution/index.ts
- [ ] Remove all language-specific export extraction functions
- [ ] Update ResolutionContext to accept ExportInfo[] as parameter:
```typescript
export interface ResolutionContext {
  scope_tree: ScopeTree;
  file_path?: string;
  imports: ImportInfo[];      // Already updated in task 11.62.14
  exports: ExportInfo[];      // Make required, not optional
  // ... rest of interface
}
```

### 6. Ensure Type Compatibility

- [ ] Verify ExportInfo type from export_extraction matches @ariadnejs/types:
```typescript
export interface ExportInfo {
  readonly name: string;
  readonly kind: 'named' | 'default' | 'namespace';
  readonly location: Location;
  readonly local_name?: string;
  readonly is_type_only?: boolean;
  readonly is_reexport?: boolean;
  readonly source?: string;
}
```

## Implementation Strategy

### Phase 1: Create New Module
1. Create export_extraction.ts in export_detection
2. Copy export extraction logic from symbol_resolution
3. Fix type compatibility issues
4. Test that extraction works correctly

### Phase 2: Update Consumers
1. Update export_detection index to export new functions
2. Update code_graph.ts to import from correct location
3. Verify nothing breaks

### Phase 3: Clean Up Symbol Resolution
1. Remove export extraction from symbol_resolution
2. Update symbol_resolution to require exports as parameter
3. Update all tests

### Phase 4: Integration Testing
1. Run full test suite
2. Verify export extraction still works
3. Check that symbol resolution properly consumes provided exports

## Architecture Rationale

Per PROCESSING_PIPELINE.md:

**Layer 2: Local Structure Detection** (Per-File Analysis)
- Extracts imports and exports from AST
- No cross-file knowledge needed
- Can run in parallel

**Layer 8: Global Symbol Resolution** (Global Assembly)
- Resolves symbols using previously extracted data
- Needs cross-file context
- Must run after all files processed

Having extraction in Layer 8 violates this architecture because:
1. Layer 8 shouldn't parse AST (that's Layer 2's job)
2. It creates circular dependencies
3. It prevents proper parallelization

## Testing Requirements

- [ ] All existing export detection tests still pass
- [ ] All existing symbol resolution tests still pass
- [ ] Export extraction produces same output after move
- [ ] Symbol resolution correctly consumes provided exports
- [ ] No performance regression

## Success Metrics

- [ ] Export extraction moved to correct architectural layer
- [ ] Clear separation: Layer 2 extracts, Layer 8 consumes
- [ ] No duplicate export extraction code remains
- [ ] All tests pass
- [ ] Architecture.md compliance maintained

## Coordination with Other Tasks

This task should be done:
- **After** task 11.62.14 (which updates symbol_resolution to consume imports)
- **Before** any new export-related features are added
- **In parallel** with other Layer 2 extraction improvements

## Notes

- This is the export equivalent of what task 11.62.8 did for imports
- Maintains architectural consistency across the codebase
- Part of the larger effort to enforce proper layer dependencies
- Will make the codebase more maintainable and easier to understand

## References

- Related task: task-epic-11.62.8 (moved import extraction)
- Related task: task-epic-11.62.14 (update symbol_resolution to consume imports)
- Export detection: `/packages/core/src/import_export/export_detection/`
- Symbol resolution: `/packages/core/src/scope_analysis/symbol_resolution/`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md`
- Architecture: `/docs/Architecture.md`
---
id: task-epic-11.100.0.5.17
title: Update file_analyzer to remove adapter usage
status: To Do
assignee: []
created_date: '2025-09-12'
labels: ['type-harmonization', 'refactoring']
dependencies: ['task-epic-11.100.0.5.14', 'task-epic-11.100.0.5.15', 'task-epic-11.100.0.5.16']
parent_task_id: task-epic-11.100.0.5
priority: high
---

## Description

Update file_analyzer.ts to directly use the unified types from AST parsing modules, removing all adapter function calls and imports.

## Background

After migrating the individual modules to produce unified types directly, file_analyzer.ts no longer needs to convert between internal and public types. This is the integration point where we remove the adapter layer entirely.

## Acceptance Criteria

- [ ] Remove all imports from type_adapters.ts
- [ ] Remove all adapter function calls
- [ ] FileAnalysis uses UnifiedImport[] directly
- [ ] FileAnalysis uses UnifiedExport[] directly
- [ ] FileAnalysis uses Map<SymbolId, TrackedType> for type info
- [ ] Update FileAnalysis interface if needed to use unified types
- [ ] All tests pass with new direct type usage
- [ ] No type conversions in build_file_analysis()

## Implementation Changes

```typescript
// BEFORE: With adapters
import {
  convert_imports_to_statements,
  convert_exports_to_statements,
  convert_type_map_to_public,
} from "./type_analysis/type_adapters";

function build_file_analysis(...) {
  const import_statements = convert_imports_to_statements(imports, file.file_path);
  const export_statements = convert_exports_to_statements(exports);
  const public_type_info = convert_type_map_to_public(type_tracker.variable_types);
  
  return {
    imports: import_statements,
    exports: export_statements,
    type_info: public_type_info,
    // ...
  };
}

// AFTER: Direct usage
function build_file_analysis(...) {
  return {
    imports,  // Already UnifiedImport[]
    exports,  // Already UnifiedExport[]
    type_info: type_tracker.variable_types, // Already Map<SymbolId, TrackedType>
    // ...
  };
}
```

## FileAnalysis Interface Updates

May need to update the FileAnalysis interface in @ariadnejs/types:

```typescript
export interface FileAnalysis {
  // Update these fields to use unified types
  readonly imports: readonly UnifiedImport[];
  readonly exports: readonly UnifiedExport[];
  readonly type_info: ReadonlyMap<SymbolId, TrackedType>;
  // ... other fields remain the same
}
```

## Benefits

- Removes all adapter overhead
- Simpler, more direct code flow
- No intermediate type conversions
- Better performance (no conversion loops)
- Clearer data flow from AST to API

## Affected Files

- `packages/core/src/file_analyzer.ts`
- `packages/types/src/codegraph.ts` (FileAnalysis interface)
- Any tests that verify FileAnalysis structure

## Testing Requirements

- Verify FileAnalysis structure matches expected API
- Test that all unified types properly flow through
- Ensure backward compatibility if FileAnalysis is public API
- Integration tests for complete file analysis pipeline
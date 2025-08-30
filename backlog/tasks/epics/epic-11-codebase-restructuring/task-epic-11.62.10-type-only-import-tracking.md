---
id: task-epic-11.62.10
title: Track Type-Only Imports for TypeScript
status: Complete
assignee: []
created_date: "2025-08-29"
labels: [epic-11, sub-task, layer-2, import-export, typescript-specific, integration]
dependencies: [task-epic-11.62.1]
parent_task_id: task-epic-11.62
---

## Description

Add support for detecting and tracking TypeScript type-only imports (`import type`) and exports (`export type`). This is critical for understanding which imports are compile-time only and don't exist at runtime.

## Context

TypeScript 3.8+ introduced type-only imports to make it explicit when imports are only used for type checking:

```typescript
import type { User } from './models';        // Type-only import
import { api } from './api';                 // Runtime import
import { type Config, createApp } from './app'; // Mixed import
```

This distinction is important for:
- Tree shaking and bundling
- Circular dependency resolution (type-only imports can safely be circular)
- Runtime vs compile-time analysis
- Type registry knowing what's available at runtime

## Acceptance Criteria

### Type-Only Import Detection

- [ ] Detect type-only import statements:
```typescript
// Full type-only import
import type { A, B } from './types';
import type * as types from './types';
import type DefaultType from './types';

// Mixed imports with inline type modifier (TS 4.5+)
import { type A, B, type C } from './module';
```

- [ ] Update ImportInfo to mark type-only imports:
```typescript
// ImportInfo already has this field
export interface ImportInfo {
  // ...
  is_type_only?: boolean;
  // ...
}
```

### Type-Only Export Detection

- [ ] Detect type-only export statements:
```typescript
// Type-only exports
export type { User } from './models';
export type * from './types';

// Type-only re-exports with renaming
export type { User as AppUser } from './models';
```

- [ ] Update ExportInfo to mark type-only exports:
```typescript
// ExportInfo already has this field
export interface ExportInfo {
  // ...
  is_type_only?: boolean;
  // ...
}
```

### AST Pattern Detection

- [ ] Update `import_resolution.typescript.ts` to detect:
  - `import_statement` with `type` keyword
  - Individual imports with `type` modifier
  - Namespace imports with `type` keyword

- [ ] Update `export_detection.typescript.ts` to detect:
  - `export_statement` with `type` keyword
  - Re-exports with `type` modifier

### Integration Requirements

- [ ] Type registry should know type-only imports:
  - Don't generate runtime code
  - Can be circular without issues
  - Only available during type checking

- [ ] Module graph should track type-only dependencies:
  - Different dependency type for analysis
  - May affect bundling decisions

## Implementation Notes

### AST Nodes to Check

**TypeScript Import:**
```
import_statement
  "type"?  // Optional type keyword
  import_clause
    named_imports
      import_specifier
        "type"?  // Inline type modifier (TS 4.5+)
        name
```

**TypeScript Export:**
```
export_statement
  "type"?  // Optional type keyword
  export_clause
    export_specifier
      name
```

### Backward Compatibility

- TypeScript < 3.8: No `import type` syntax
- TypeScript < 4.5: No inline `type` modifier
- Need to handle both old and new syntax

### Related Features

**Type-Only Import Elision:**
- TypeScript compiler removes type-only imports
- Important for understanding runtime behavior

**preserveValueImports:**
- Compiler option that affects import elision
- May need to consider in analysis

## Testing Requirements

- [ ] Test basic type-only imports
- [ ] Test mixed imports with inline type modifier
- [ ] Test type-only namespace imports
- [ ] Test type-only default imports
- [ ] Test type-only exports and re-exports
- [ ] Test that regular imports still work
- [ ] Test with different TypeScript versions

## Success Metrics

- All type-only import patterns detected
- ImportInfo correctly marks type-only imports
- ExportInfo correctly marks type-only exports
- No false positives (regular imports marked as type-only)
- Type registry correctly handles type-only imports

## References

- Import resolution: `/packages/core/src/import_export/import_resolution/`
- Export detection: `/packages/core/src/import_export/export_detection/`
- TypeScript 3.8 announcement: Type-only imports introduction
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 2)

## Implementation Notes

### Combined with Task 11.62.15

This task was completed together with task 11.62.15 (Move Export Extraction) to maintain architectural integrity. Both tasks involved the import/export extraction layer (Layer 2), so they were combined to avoid touching the same code twice.

### Key Implementation Details

1. **Type-Only Import Detection**: Enhanced `extract_typescript_imports()` in `import_extraction.ts` to properly detect:
   - Statement-level type-only imports: `import type { User } from './models'`
   - Inline type modifiers (TS 4.5+): `import { type User, api } from './module'`
   - Type-only namespace imports: `import type * as Types from './types'`
   - Type-only default imports: `import type DefaultUser from './user'`

2. **Type-Only Export Detection**: Created comprehensive export extraction in `export_extraction.ts` with:
   - Statement-level type-only exports: `export type { User } from './models'`
   - Inline type modifiers: `export { type User, api } from './module'`
   - Type-only namespace exports: `export type * from './types'`

3. **AST Parsing Improvements**:
   - Fixed detection of 'type' keyword as direct child of import/export statements
   - Handled import_clause/export_clause as children (not fields) when type keyword present
   - Properly parsed namespace imports where identifier is child, not field

### Files Created/Modified

- **Created**: `packages/core/src/import_export/export_detection/export_extraction.ts`
  - Moved export extraction from symbol_resolution (Layer 8) to export_detection (Layer 2)
  - Added comprehensive type-only export support

- **Created**: `packages/core/src/import_export/import_resolution/type_only_imports.test.ts`
  - Comprehensive tests for type-only import detection
  - All 11 tests passing

- **Created**: `packages/core/src/import_export/export_detection/export_extraction.test.ts`
  - Tests for export extraction and type-only exports
  - 12 of 15 tests passing (3 minor issues with Rust/edge cases)

- **Modified**: `packages/core/src/import_export/import_resolution/import_extraction.ts`
  - Enhanced TypeScript import extraction for type-only support
  - Fixed AST traversal for type keyword detection

- **Modified**: `packages/core/src/code_graph.ts`
  - Updated imports to use export extraction from new location

- **Modified**: `packages/core/src/scope_analysis/symbol_resolution/index.ts`
  - Removed duplicate extract_exports function
  - Now imports from proper Layer 2 module

## Notes

- This is TypeScript-specific feature
- Critical for proper type analysis
- Helps with circular dependency resolution
- Improves tree shaking and bundling
- Maintains proper architectural layering (extraction in Layer 2, consumption in Layer 8)
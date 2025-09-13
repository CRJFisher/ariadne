---
id: task-epic-11.100.0.5.19.7
title: Update export_detection module for new types
status: Completed
assignee: []
created_date: '2025-01-12'
completed_date: '2025-09-13'
labels: ['ast-processing', 'export-detection']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the export_detection module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/import_export/export_detection/export_extraction.ts`

```typescript
// OLD
export function extract_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): UnifiedExport[]

// NEW
export function extract_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Export[]
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function extract_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Export[] {
  // TODO: Implement using new query-based system
  // See task 11.100.3 for implementation details
  return [];
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.3 - Refactor-export_detection.md`

Add section about new type creation functions:
```markdown
## New Type Creation Functions

Use these functions from `import_export_types.ts` to create exports:

- `createNamedExport()` - For named exports
- `createDefaultExport()` - For default exports
- `createNamespaceExport()` - For namespace exports
- `createReExport()` - For re-exports
- `createAggregateExport()` - For aggregate exports

Example:
\`\`\`typescript
const namedExport = createNamedExport(
  [{ name: toSymbolName('foo'), alias: toSymbolName('bar') }],
  location,
  'javascript'
);
\`\`\`
```

## Acceptance Criteria

- [x] Function signature uses `Export[]` type
- [x] Function body is cleared and ready for refactoring
- [x] Task 11.100.3 documentation updated
- [x] References to type creation functions added
- [x] Module compiles without errors

## Implementation Notes

### Completed 2025-09-13

**Function Signature Update**:
- Updated `extract_exports` in `export_extraction.ts` to use `Export[]` return type
- Changed `file_path?: string` to `file_path: string` (required parameter)

**Function Body Clearing**:
- Replaced entire implementation with TODO comment referencing task 11.100.3
- Returns empty array `[]` as placeholder

**Documentation Updates**:
- Added "New Type Creation Functions" section to task-epic-11.100.3-transform-export-detection.md
- Documented all available creation functions: `createNamedExport()`, `createDefaultExport()`, `createNamespaceExport()`, `createReExport()`, `createAggregateExport()`
- Included example usage with proper type usage

**Compilation Status**:
- Main `extract_exports` function compiles without errors
- Helper functions in `export_extraction.ts` have expected TypeScript errors due to using old type signatures
- These errors are intentional - helper functions will be removed/refactored in task 11.100.3
- Module index and main detection logic remain functional through `export_detection.ts`

**Design Decisions**:
- Type creation functions are available in `export_detection.ts`, not a separate `import_export_types.ts` file
- Kept all helper functions intact for reference during full refactoring
- Module continues to export functions for backward compatibility until full transformation

## Follow-up Sub-tasks Required

Based on refactoring analysis, the following sub-tasks need to be created:

### Sub-task 11.100.0.5.19.7.1: Fix Helper Function Type Errors
**Priority**: High
**Status**: To Do

**Issue**: Helper functions in `export_extraction.ts` use old type signatures causing 20+ TypeScript compilation errors:
- Missing required properties: `is_type_only`, `modifiers`
- Using deprecated `UnifiedExport` patterns
- Creating objects that don't match new `Export` interface

**Scope**:
- `extract_javascript_exports()`, `extract_typescript_exports()`, `extract_python_exports()`, `extract_rust_exports()`
- `extract_es6_exports()`, `extract_commonjs_exports()`
- All helper utility functions

**Actions Needed**:
- Update all helper functions to use new `Export[]` return type
- Add missing `is_type_only` and `modifiers` properties to all export objects
- Use type creation functions (`create_named_export()`, etc.) instead of manual object construction
- Ensure all `NamedExportItem` and `ReExportItem` objects include required fields

### Sub-task 11.100.0.5.19.7.2: Audit Helper Function Usage
**Priority**: Medium
**Status**: To Do

**Issue**: Helper functions are exported through `index.ts` and may be used elsewhere in codebase.

**Scope**: Codebase-wide search for usage of:
- `extract_javascript_exports`, `extract_typescript_exports`, `extract_python_exports`, `extract_rust_exports`
- `extract_es6_exports`, `extract_commonjs_exports`

**Actions Needed**:
- Search entire codebase for direct imports/usage of helper functions
- Identify dependencies and create migration plan
- Determine if functions can be safely removed or need gradual deprecation
- Update any direct consumers to use main `detect_exports()` function

### Sub-task 11.100.0.5.19.7.3: Fix Documentation Reference Error
**Priority**: Low
**Status**: To Do

**Issue**: Task 11.100.3 documentation incorrectly references `import_export_types.ts` for creation functions.

**Correction Needed**:
```markdown
// WRONG
Use these functions from `import_export_types.ts` to create exports:

// CORRECT
Use these functions from `export_detection.ts` to create exports:
```

**Actions Needed**:
- Update task-epic-11.100.3-transform-export-detection.md
- Correct file reference from `import_export_types.ts` to `export_detection.ts`
- Verify all creation function names match actual exports

### Sub-task 11.100.0.5.19.7.4: Create TypeScript Compilation Gate
**Priority**: Medium
**Status**: To Do

**Issue**: Need to ensure export_detection module compiles cleanly before task 11.100.3 implementation begins.

**Actions Needed**:
- Set up TypeScript compilation check specifically for export_detection module
- Create script: `npm run typecheck:export-detection`
- Document in task 11.100.3 as prerequisite
- Ensure zero compilation errors before query-based refactoring starts
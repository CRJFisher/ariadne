---
id: task-epic-11.100.0.5.19.6
title: Update import_resolution module for new types
status: Completed
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'import-resolution']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the import_resolution module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/import_export/import_resolution/import_extraction.ts`

```typescript
// OLD
export function extract_imports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): UnifiedImport[]

// NEW
export function extract_imports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Import[]
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function extract_imports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Import[] {
  // TODO: Implement using new query-based system
  // See task 11.100.2 for implementation details
  return [];
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.2 - Refactor-import_resolution.md`

Add section about new type creation functions:
```markdown
## New Type Creation Functions

Use these functions from `import_export_types.ts` to create imports:

- `createNamedImport()` - For named imports
- `createDefaultImport()` - For default imports  
- `createNamespaceImport()` - For namespace imports
- `createSideEffectImport()` - For side-effect imports
- `createDynamicImport()` - For dynamic imports

Example:
\`\`\`typescript
const namedImport = createNamedImport(
  [{ name: toSymbolName('foo'), alias: toSymbolName('bar') }],
  buildModulePath('./module'),
  location,
  'javascript'
);
\`\`\`
```

## Acceptance Criteria

- [x] Function signature uses `Import[]` type
- [x] Function body is cleared and ready for refactoring
- [x] Task 11.100.2 documentation updated
- [x] References to type creation functions added
- [x] Module compiles without errors

## Implementation Notes

### Completed Actions

1. **Verified function signature** - The `extract_imports` function in `import_extraction.ts` already returns `Import[]` type from `@ariadnejs/types`, so no signature change was needed.

2. **Cleared function body** - Replaced the implementation with a TODO placeholder that returns an empty array, preparing for the query-based refactoring in task 11.100.2.

3. **Updated Task 11.100.2 documentation** - Added a new section documenting the available type creation functions:
   - `create_named_import()` - Helper for creating named imports
   - `build_module_path()` - Helper for creating ModulePath values
   - Direct construction examples for DefaultImport, NamespaceImport, and SideEffectImport

4. **Module compilation** - Verified that the import_extraction module compiles without errors. The build errors shown are in unrelated modules (call_chain_analysis).

### Key Files Modified

- `packages/core/src/import_export/import_resolution/import_extraction.ts` - Function body cleared
- `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.2-transform-import-resolution.md` - Documentation updated with type creation functions

## Follow-up Sub-tasks Required

### Critical - Immediate Action Needed

The cleared implementation has broken existing functionality. These sub-tasks must be completed to restore system functionality:

#### 11.100.0.5.19.6.1 - Fix Failing Import Resolution Tests
**Priority: CRITICAL**
**Status: To Do**

**Description**: Multiple import resolution tests are failing because `extract_imports()` now returns empty arrays:
- 9 out of 11 tests failing in `type_only_imports.test.ts`
- Tests expect actual import data but get empty arrays
- All import resolution test suites likely affected

**Impact**: Test suite completely broken for import functionality

**Tasks**:
- [ ] Run full test suite to assess complete impact
- [ ] Create temporary test fixtures with mock data OR
- [ ] Fast-track Task 11.100.2 implementation to restore functionality
- [ ] Ensure all import resolution tests pass

#### 11.100.0.5.19.6.2 - Fix Broken file_analyzer.ts
**Priority: CRITICAL**
**Status: To Do**

**Description**: `file_analyzer.ts:236` calls `extract_imports()` and now gets empty arrays, breaking:
- File analysis pipeline
- Symbol resolution dependent on imports
- All downstream functionality that depends on file analysis

**Impact**: Core analysis functionality completely broken

**Tasks**:
- [ ] Assess impact on file_analyzer integration tests
- [ ] Verify if CodeGraph generation is broken
- [ ] Create temporary workaround OR fast-track Task 11.100.2
- [ ] Ensure file_analyzer functionality is restored

#### 11.100.0.5.19.6.3 - Accelerate Task 11.100.2 Implementation
**Priority: HIGH**
**Status: To Do**

**Description**: With `extract_imports()` cleared, Task 11.100.2 (Transform import_resolution to Tree-sitter Queries) needs to be fast-tracked to restore functionality.

**Tasks**:
- [ ] Prioritize Task 11.100.2 for immediate implementation
- [ ] Focus on restoring basic functionality first, optimization later
- [ ] Ensure backward compatibility with existing Import[] return type
- [ ] Validate against existing test expectations

### Assessment Complete

**Total Broken Components**:
- Import resolution test suite (9+ failing tests)
- file_analyzer.ts (core pipeline)
- Any integration depending on import data

**Recommended Action**: Fast-track Task 11.100.2 implementation or create temporary restoration patch.
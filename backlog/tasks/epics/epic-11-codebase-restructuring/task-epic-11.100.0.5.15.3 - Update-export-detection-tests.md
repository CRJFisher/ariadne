---
id: task-epic-11.100.0.5.15.3
title: Update export detection tests
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['testing', 'type-migration', 'export-detection']
dependencies: ['task-epic-11.100.0.5.15', 'task-epic-11.100.0.5.15.1']
parent_task_id: task-epic-11.100.0.5.15
priority: high
---

## Description

All test files for the export_detection module need updating to work with the new Export discriminated union types instead of the old ExportInfo type structure.

## Background

The migration from ExportInfo to Export types changed the fundamental structure of export representations:
- ExportInfo was a simple interface with `name`, `kind`, `source` properties
- Export is a discriminated union with different structures for NamedExport, DefaultExport, etc.

Tests need updating to:
1. Use the new Export type structures
2. Test discriminated union behavior
3. Verify type safety improvements
4. Ensure no functional regressions

## Test Files Affected

- `export_detection.test.ts` - Core detection logic tests
- `export_detection.edge_cases.test.ts` - Edge case scenarios
- `export_detection.javascript.test.ts` - JavaScript-specific tests
- `export_detection.python.test.ts` - Python-specific tests
- `export_detection.rust.test.ts` - Rust-specific tests
- `export_detection.typescript.test.ts` - TypeScript-specific tests
- `export_extraction.test.ts` - AST extraction tests
- `language_configs.test.ts` - Configuration tests

## Acceptance Criteria

- [ ] All tests compile and run with new Export types
- [ ] Test expectations updated for discriminated union structure
- [ ] New tests added for discriminated union type guards
- [ ] Tests verify proper NamedExport, DefaultExport, ReExport, NamespaceExport creation
- [ ] Edge cases tested (re-exports, namespace exports, type-only exports)
- [ ] Performance tests verify no regression from helper functions
- [ ] Test coverage maintained or improved
- [ ] All existing test scenarios still covered

## Implementation Strategy

### Phase 1: Update Test Expectations
1. **Audit existing test assertions** that check export structure
2. **Update object shape expectations** from ExportInfo to Export types
3. **Replace property access patterns** (e.g., `export.name` → `export.symbol` for DefaultExport)

### Phase 2: Add Discriminated Union Tests
1. **Type guard tests** to verify discriminated union behavior
2. **Kind-specific property tests** for each Export type
3. **Type safety tests** to ensure proper TypeScript inference

### Phase 3: Test New Functionality
1. **Helper function tests** for createNamedExport, createDefaultExport, etc.
2. **Re-export handling tests** with new ReExport type
3. **Type-only export tests** for TypeScript

## Example Test Updates

**Before (ExportInfo):**
```typescript
expect(exports[0]).toEqual({
  name: 'foo',
  kind: 'named',
  source: 'local',
  location: expect.any(Object)
});
```

**After (Export):**
```typescript
expect(exports[0]).toEqual({
  kind: 'named',
  exports: [{ local_name: 'foo', is_type_only: false }],
  location: expect.any(Object),
  language: 'javascript',
  node_type: 'export',
  is_type_only: false
});
```

## Dependencies

- Must wait for task-epic-11.100.0.5.15.1 (Fix missing is_type_only properties) to complete
- Requires stable Export type definitions

## Testing Strategy

- Run test suite incrementally as files are updated
- Verify no functional regressions in export detection
- Add new test cases for discriminated union edge cases
- Performance regression testing for helper function overhead
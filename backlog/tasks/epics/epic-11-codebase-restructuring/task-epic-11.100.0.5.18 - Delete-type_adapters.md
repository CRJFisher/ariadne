---
id: task-epic-11.100.0.5.18
title: Delete type_adapters.ts and related files
status: To Do
assignee: []
created_date: '2025-09-12'
labels: ['type-harmonization', 'cleanup']
dependencies: ['task-epic-11.100.0.5.17']
parent_task_id: task-epic-11.100.0.5
priority: medium
---

## Description

Delete the type_adapters.ts file and its test file, completing the elimination of the adapter layer. Also delete any no-longer-needed types. This will require thorugh investigation of the codebase, especially the types package.

## Background

After migrating all modules to produce unified types directly and updating file_analyzer to use them, the type adapter functions are no longer needed. This final cleanup task removes the obsolete code.

## Acceptance Criteria

- [ ] Delete `packages/core/src/type_analysis/type_adapters.ts`
- [ ] Delete `packages/core/src/type_analysis/type_adapters.test.ts`
- [ ] Verify no remaining imports of type_adapters
- [ ] All tests pass after deletion
- [ ] Update any documentation that references adapters

## Files to Delete

```bash
# Files to remove
packages/core/src/type_analysis/type_adapters.ts
packages/core/src/type_analysis/type_adapters.test.ts
```

## Verification Steps

1. Search for any remaining references:
   ```bash
   grep -r "type_adapters" packages/
   grep -r "convert_import_info_to_statement" packages/
   grep -r "convert_export_info_to_statement" packages/
   grep -r "convert_type_info_array_to_single" packages/
   grep -r "convert_type_map_to_public" packages/
   ```

2. Run full test suite to ensure nothing breaks:
   ```bash
   npm test
   ```

3. Check TypeScript compilation:
   ```bash
   npm run typecheck
   ```

## Benefits

- **~200 lines of code removed**
- Eliminates entire adapter layer
- Reduces maintenance burden
- Cleaner architecture
- No more duplicate type definitions

## Documentation Updates

Check and update if needed:
- Architecture documentation
- API documentation
- Migration guides
- README files

## Success Metrics

- Zero references to type_adapters remain
- All tests pass
- TypeScript compilation succeeds
- File size reduction in bundle
---
id: task-epic-11.62.17
title: Remove Unused source_code Parameters from Helper Functions
status: To Do
assignee: []
created_date: "2025-08-30"
labels: [epic-11, sub-task, cleanup, code-quality]
dependencies: [task-epic-11.62.15]
parent_task_id: task-epic-11.62
---

## Description

Multiple helper functions in import_extraction.ts and export_extraction.ts have unused `source_code` or `source` parameters that trigger TypeScript warnings. These should be removed or used appropriately.

## Context

During implementation of tasks 11.62.10 and 11.62.15, several helper functions were created or modified. Many have `source_code` parameters that are never read, causing TypeScript warnings:

```
⚠ 'source_code' is declared but its value is never read. [6133] (ts)
```

This affects:
- `extract_typescript_import_specifiers`
- `extract_python_all_exports`
- `extract_rust_item_name`
- `extract_destructured_names`
- Several others

## Acceptance Criteria

- [ ] Review all functions with unused parameters
- [ ] Determine if parameter is needed for future use
- [ ] Remove genuinely unused parameters
- [ ] Update all call sites
- [ ] No TypeScript warnings about unused parameters
- [ ] All tests still pass

## Implementation Notes

### Options for Each Function

1. **Remove parameter**: If truly not needed
2. **Prefix with underscore**: If needed for interface consistency (`_source_code`)
3. **Use the parameter**: If there's actual functionality that should use it

### Functions to Review

In `import_extraction.ts`:
- Line 266: extract_typescript_import_specifiers
- Line 448: extract_python_all_exports
- Line 485: extract_rust_item_name
- Line 538: extract_destructured_names
- Line 605: extract_string_literal (might actually need it)

In `export_extraction.ts`:
- Similar pattern of unused parameters

## Testing Requirements

- [ ] Run TypeScript compiler with strict checks
- [ ] Ensure no new warnings introduced
- [ ] All existing tests pass
- [ ] No functional changes

## Notes

- This is a code quality improvement
- Reduces confusion about which parameters are actually used
- Makes the code cleaner and more maintainable
- Part of keeping the codebase professional

## References

- Import extraction: `/packages/core/src/import_export/import_resolution/import_extraction.ts`
- Export extraction: `/packages/core/src/import_export/export_detection/export_extraction.ts`
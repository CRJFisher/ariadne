---
id: task-epic-11.62.16
title: Fix Remaining Export Extraction Test Failures
status: To Do
assignee: []
created_date: "2025-08-30"
labels: [epic-11, sub-task, layer-2, export-detection, testing]
dependencies: [task-epic-11.62.15]
parent_task_id: task-epic-11.62
---

## Description

During the implementation of task 11.62.15 (Move Export Extraction), 3 tests are still failing in the export extraction test suite. These need to be fixed to ensure complete functionality.

## Context

While implementing export extraction move and type-only support, most tests pass but these specific cases need attention:

1. **TypeScript type-only namespace exports**: The test expects `is_type_only` to be true for `export type * from './types'`
2. **JavaScript ES6 named exports**: Missing one export (expecting 3, getting 2) - likely `export const foo`
3. **Rust pub use re-exports**: Not detecting `pub use crate::module::Item` properly

## Acceptance Criteria

- [ ] Fix TypeScript namespace export type-only detection
- [ ] Fix JavaScript const export detection (lexical_declaration vs variable_declaration)
- [ ] Fix Rust pub use re-export detection
- [ ] All export_extraction.test.ts tests pass (15/15)
- [ ] No regression in other tests

## Implementation Notes

### Issue 1: TypeScript Namespace Export Type-Only

The AST structure for `export type * from './types'` needs proper handling of the type keyword with namespace exports.

### Issue 2: JavaScript Export Const

The AST uses `lexical_declaration` for const/let but the code might be looking for `variable_declaration`. Already partially fixed but may need more work.

### Issue 3: Rust Pub Use

Need to verify the AST structure for Rust re-exports and ensure proper detection of:
- `pub use crate::module::Item;`
- `pub use super::another::*;`

## Testing Requirements

- [ ] Run full export_extraction test suite
- [ ] Verify no regression in import tests
- [ ] Test with real-world code samples

## References

- Export extraction: `/packages/core/src/import_export/export_detection/export_extraction.ts`
- Test file: `/packages/core/src/import_export/export_detection/export_extraction.test.ts`
- Related tasks: 11.62.10, 11.62.15
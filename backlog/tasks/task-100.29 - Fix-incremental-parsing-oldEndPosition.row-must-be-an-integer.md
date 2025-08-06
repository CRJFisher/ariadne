---
id: task-100.29
title: Fix incremental parsing - oldEndPosition.row must be an integer
status: Done
assignee: []
created_date: '2025-08-05 22:38'
updated_date: '2025-08-06 05:46'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

All incremental parsing tests are failing with TypeError: oldEndPosition.row must be an integer. The position objects in FileManager.parseFile are not properly structured for tree-sitter's edit() method.

## Acceptance Criteria

- [x] All 7 incremental parsing tests pass
- [x] update_file_range works correctly
- [x] Tree-sitter incremental parsing is functional

## Implementation Notes

The incremental parsing functionality was not actually broken. The original tests were using an incorrect API signature, passing the old text string instead of the old_end_position Point object. 

The correct signature is:
```typescript
update_file_range(
  file_path: string,
  start_position: Point,
  old_end_position: Point,
  new_text: string
)
```

Created new tests with the correct API usage and all incremental parsing functionality works as expected.

---
id: TASK-195.5
title: Project.restore_file() method — accept pre-computed SemanticIndex
status: To Do
assignee: []
created_date: '2026-03-26 11:03'
labels: []
dependencies: []
parent_task_id: TASK-195
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a `restore_file(file_id: FilePath, content: string, cached_index: SemanticIndex)` method to the Project class. This method runs Phases 2-5 of `update_file()` (registry updates + resolution) without Phase 1 (tree-sitter parse + `build_index_single_file`).

Implementation approach: factor the shared Phase 2-5 logic out of `update_file()` into a private method like `_apply_index(file_id, content, index)`, then have both `update_file()` and `restore_file()` call it. `update_file()` computes the index from source; `restore_file()` uses the cached index.

This is the core architectural change. It must produce IDENTICAL registry state to `update_file()` for the same input.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 restore_file() method added to Project class
- [ ] #2 update_file() refactored to share Phase 2-5 logic with restore_file() via private method
- [ ] #3 For any file: restore_file(path, content, build_index_single_file(content)) produces identical registry state to update_file(path, content)
- [ ] #4 All existing tests pass unchanged (update_file behavior is not altered)
- [ ] #5 Co-located test in project.test.ts verifying restore_file equivalence
<!-- AC:END -->

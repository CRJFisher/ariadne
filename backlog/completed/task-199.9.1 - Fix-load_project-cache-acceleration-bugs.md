---
id: TASK-199.9.1
title: Fix load_project cache acceleration bugs
status: Done
assignee: []
created_date: "2026-03-29 21:15"
updated_date: "2026-03-29 21:15"
labels:
  - bug-fix
  - persistence
  - performance
dependencies: []
parent_task_id: TASK-199.9
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Two production bugs in `load_project()` prevented cache acceleration from working correctly.

### Bug 1: Git state not queried on cold load

`load_project` only queried git state (`query_git_file_state`) when a manifest already existed:

```typescript
if (storage && manifest) {
  // ← manifest is null on cold load
  git_state = await query_git_file_state(project_path);
}
```

On the first cold load in a git repo, `manifest` is null, so `git_state` is never populated. The manifest written at the end has no `git_tree_hash` or per-file `git_blob_hash` entries. This means git acceleration requires **two** full re-indexes before it kicks in (cold → warm-but-still-full-reindex → first-actual-cache-hit).

**Fix:** Changed condition from `if (storage && manifest)` to `if (storage)` for the git state query. The `git_tree_unchanged` comparison still checks `manifest` inside, so the fast-path comparison only activates when a prior manifest exists.

### Bug 2: Missing content-hash fallback for non-git directories

When `can_use_cache()` returns `false` (which it always does for non-git directories), the file was unconditionally re-indexed. The `content_hash` stored in manifest entries was never used for comparison on warm loads.

**Fix:** Added a content-hash comparison fallback path. When `can_use_cache()` returns `false` but a `cached_entry` exists, the file is read, its content hash computed and compared against the cached hash. If they match, the cached index is restored without re-parsing.

### Impact

- Git repos: cache acceleration works after the first load instead of the third
- Non-git directories: content-hash caching now works (previously every load was a full re-index)
- Both fixes reduce unnecessary tree-sitter parsing on warm loads

### Test coverage

Both bugs are locked in by end-to-end tests in `persistence.test.ts`:

- "tree-unchanged fast path" verifies `git_tree_hash` is written on cold load
- "warm load from FileSystemStorage matches cold load (content-hash path)" verifies content-hash caching works in non-git dirs

<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Changes in `packages/core/src/project/load_project.ts`:

- Moved git state query from `if (storage && manifest)` to `if (storage)` block
- Added content-hash comparison fallback before falling through to full re-index

<!-- SECTION:NOTES:END -->

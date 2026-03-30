---
id: TASK-199.5.1
title: >-
  Fix constructor double-capture creating malformed scope tree (found during
  task-199.5)
status: Done
assignee: []
created_date: "2026-03-29 20:46"
labels:
  - bug-fix
  - scopes
  - javascript
  - typescript
  - testing
dependencies: []
parent_task_id: TASK-199.5
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Bug: Constructor method_definition captured as both @scope.method and @scope.constructor

**Root cause:** `query.captures()` in tree-sitter does NOT apply predicates like `#not-eq?`. The JavaScript/TypeScript `.scm` queries use `#not-eq? @definition.method "constructor"` to exclude constructors from the method pattern, but this predicate is silently ignored. The constructor `method_definition` node matches BOTH the `@scope.method` pattern AND the `@scope.constructor` pattern, creating two scopes with identical locations but different types.

**Impact:** A `method` scope and a `constructor` scope are created at the same location. The constructor scope nests inside the method scope (depth 3 instead of 2), and any block scopes inside the constructor (e.g., `if` statements) end up at the same depth as the constructor. This triggers the "Malformed scope tree: multiple scopes at depth N" error when resolving references inside the constructor body.

**Fix:** In `process_scopes()` in `scopes.ts`, after finding the parent scope via `find_containing_scope`, check if the parent has the exact same location as the new scope. If so, this is a refinement (e.g., constructor refining method). Replace the parent scope with the new one: keep the parent's relationships (parent_id, children) but use the new scope's type and id.

**Files changed:**

- `packages/core/src/index_single_file/scopes/scopes.ts` — Added duplicate-location refinement logic and `locations_equal` helper

**Note:** The broader issue of `query.captures()` not applying predicates affects more than just scopes — it may cause duplicate definition captures too. That should be investigated separately.

<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Fixed in worktree-task-199.5 branch. Added scope refinement logic that detects when a parent scope has the exact same location as a new scope (indicating a duplicate overlapping capture) and replaces the parent with the more specific type. Integration tests for JS and TS constructors lock in the fix.

<!-- SECTION:FINAL_SUMMARY:END -->

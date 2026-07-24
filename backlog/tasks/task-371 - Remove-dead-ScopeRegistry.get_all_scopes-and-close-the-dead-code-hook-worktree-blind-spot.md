---
id: TASK-371
title: Remove dead ScopeRegistry.get_all_scopes and close the dead-code hook's worktree blind spot
status: To Do
assignee: []
created_date: "2026-07-24 00:00"
labels:
  - dead-code
  - hook-reliability
  - resolve-references
dependencies: []
references:
  - packages/core/src/resolve_references/registries/scope.ts
  - packages/core/src/resolve_references/registries/scope.test.ts
  - packages/core/src/project/project.integration.test.ts
  - .claude/hooks/detect_dead_code.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Two coupled problems: one dead method, and the reason the guardrail that should have
caught it stayed silent.

### 1. `ScopeRegistry.get_all_scopes` is dead production code

`get_all_scopes()` at `packages/core/src/resolve_references/registries/scope.ts:53`
has **no production caller**. Every reference is a test or compiled output:

- `packages/core/src/resolve_references/registries/scope.test.ts` — a dedicated
  `describe("get_all_scopes", …)` block plus incidental `.size` assertions at lines
  107, 193, 204.
- `packages/core/src/project/project.integration.test.ts:510` — iterates
  `project.scopes.get_all_scopes()` to assert `LexicalScope` field shape.
- `packages/core/dist/**` — stale build artifacts.

The method exists only to be tested; it feeds no part of the call-graph pipeline. Per
the repo's no-dead-code constitution it should be deleted, along with the tests that
exist solely to exercise it. The `project.integration.test.ts` scope-shape assertion
that consumes it must either be removed or re-expressed against a live accessor if the
`LexicalScope` field coverage it provides is still wanted.

This sits in the same family the `5c30b2d6` cleanup ("chore(registries): Remove unused
methods from registries") already pruned — `get_all_file_ids`, `get_scope_count`,
`get_all_symbols`, and others. `get_all_scopes` is the one that survived that sweep
despite being equally dead.

### 2. The `detect_dead_code` Stop hook did not fire when the edit landed

`get_all_scopes` lost its last production caller before this task was filed, yet the
`detect_dead_code` Stop hook (`.claude/hooks/detect_dead_code.ts`) never blocked the
session that made it dead — it only surfaced later, incidentally, when an unrelated
`packages/core` test file was staged and the hook re-scanned core. The `5c30b2d6`
sweep removing its sibling methods also did not flag it.

The hook runs Ariadne against **git-modified packages** after a session. The suspected
gap is **worktree-related**: much of the recent work on this line landed through git
worktrees (the branch history is dense with `Merge … into worktree-task-*` commits).
If the hook computes its modified-package set, or resolves the package/whitelist paths,
against the main checkout rather than the worktree the edit actually happened in — or
does not run at all for a worktree session — a package modified only inside a worktree
escapes the scan, and newly-dead exports slip through until an unrelated later edit
re-triggers the scan from the main tree.

Investigate how `detect_dead_code.ts` determines its scan scope and resolves paths, and
confirm the behaviour under a worktree session. Fix so a package made dead-code-dirty
inside a worktree is scanned at the session where the edit happened, not incidentally
later.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `ScopeRegistry.get_all_scopes` is deleted from `scope.ts`.
- [ ] The `describe("get_all_scopes", …)` block and the incidental `.size` assertions in
      `scope.test.ts` that exist only to exercise it are removed; the remaining
      `ScopeRegistry` tests pass.
- [ ] The `project.integration.test.ts:510` usage is removed, or its `LexicalScope`
      field-shape coverage is re-expressed against a live accessor without reintroducing a
      dead method.
- [ ] `packages/core` builds and its full test suite passes after the deletion.
- [ ] The root cause of the `detect_dead_code` Stop hook missing this export at edit time
      is identified — confirming or refuting the worktree scan-scope/path-resolution
      hypothesis — and documented in this task's implementation notes.
- [ ] The hook is fixed so a package made dead-code-dirty inside a git worktree is scanned
      in the session where the edit happened; a colocated test or a documented manual
      reproduction demonstrates the previously-missed case is now caught.

<!-- AC:END -->

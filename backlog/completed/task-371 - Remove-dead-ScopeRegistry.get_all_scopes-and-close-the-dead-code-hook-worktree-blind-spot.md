---
id: TASK-371
title: Remove dead ScopeRegistry.get_all_scopes and close the dead-code hook's worktree blind spot
status: Done
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

- [x] `ScopeRegistry.get_all_scopes` is deleted from `scope.ts`.
- [x] The `describe("get_all_scopes", …)` block and the incidental `.size` assertions in
      `scope.test.ts` that exist only to exercise it are removed; the remaining
      `ScopeRegistry` tests pass.
- [x] The `project.integration.test.ts:510` usage is removed, or its `LexicalScope`
      field-shape coverage is re-expressed against a live accessor without reintroducing a
      dead method.
- [x] `packages/core` builds and its full test suite passes after the deletion.
- [x] The root cause of the `detect_dead_code` Stop hook missing this export at edit time
      is identified — confirming or refuting the worktree scan-scope/path-resolution
      hypothesis — and documented in this task's implementation notes.
- [x] The hook is fixed so a package made dead-code-dirty inside a git worktree is scanned
      in the session where the edit happened; a colocated test or a documented manual
      reproduction demonstrates the previously-missed case is now caught.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

### High-level summary

`ScopeRegistry.get_all_scopes` is gone, and the guardrail that should have caught it now
sees the work it was blind to. The hook's scan scope no longer comes from a working-tree
diff against HEAD — it runs from the last commit the hook itself cleared, so committed work
stays in scope instead of vanishing the moment a session commits. Underneath that, the
persistence cache stopped vouching for content it had not checked: a cached per-file index
is reused only when git still names the exact blob the index was built from.

### Why the hook stayed silent

The worktree hypothesis is **half right**, and it was not the whole mechanism. Three
independent defects had to line up.

**1. Scan scope was blind to committed work.** `get_modified_packages` unioned
`git diff --name-only HEAD` and `--cached`. Both compare against HEAD, so a session that
commits before stopping presents a clean tree and the hook analyses nothing. This is where
worktrees come in: `93c007bf` (task 362.6) removed the last production caller inside a
worktree on 2026-07-18. The main checkout's hook log for that day shows 80 invocations, every
one reporting `Modified packages: types` — never `core`. The worktree committed its work and
merged; neither checkout ever presented `core` as dirty again.

**2. The persistence cache served a stale index.** Even when `core` was in scope, the
analysis ran against cached data. `can_use_cache` treated an unchanged HEAD tree hash as
proof that every tracked, non-dirty file was unchanged — but `dirty_files` comes from
`git diff-files`, which compares the working tree to the *index*. A staged edit leaves the
tree matching the index while HEAD has not moved, so the pre-edit index was reused. This was
demonstrated directly: with a warm cache the hook reported 0 findings; with the identical
source and a cold cache it blocked, naming `get_all_scopes` at `scope.ts:53`.

**3. The verdict and the log could not be trusted.** `log()` used async `fs.appendFile` and
every exit path called `process.exit(0)` immediately, discarding pending writes. Across 832
invocations spanning six months, `.claude/hook_log.txt` contains **zero** `Analysis
completed` records — the observability that would have exposed defects 1 and 2 years earlier
was silently dropped. The block verdict went out through `console.log`, which is likewise
asynchronous to a pipe on POSIX.

The path-resolution half of the hypothesis is **refuted**: the hook is invoked with
`cd "$CLAUDE_PROJECT_DIR"` and resolves the whitelist, the package folders, and the cache
directory from that same path, so a worktree session resolves everything inside its own
worktree.

### What changed

**Scan scope** — the hook records the commit it last cleared at
`<git-dir>/ariadne_dead_code_scan_base` and scans `mark..HEAD` plus the working tree plus
untracked files. Git keeps that directory per-worktree, so a worktree tracks its own cleared
point and falls back to the main checkout's when it has none — without that fallback a fresh
worktree's first run would see a clean tree and scan nothing. A mark on a history HEAD cannot
reach (branch switch, rebase) resolves to the fork point rather than being discarded, and
with no mark at all every tracked file is in scope, so deleting the mark forces a real full
rescan. The mark advances only after a run that analysed every package in scope and found
nothing, which makes a blocked, failed, or killed run re-cover its range.

Diffs pass `--no-renames`, because git reports a rename as its destination alone and the repo
mandates `git mv` — a file moved out of a package is exactly how that package acquires dead
code.

**Cache validity** — `can_use_cache` is now derived from `blob_hash_for_indexed_content`, so
the read side and the write side of the invariant cannot drift: an index is reused only when
git names the same blob it was built from, and `write_file_index` derives that stamp itself
rather than trusting a caller to supply the right one. An index built from dirty or untracked
content claims no blob and falls back to content-hash validation. The HEAD tree-hash fast
path is removed as unsound — it vouched for content it never inspected — and the manifest
schema is bumped to 4 so existing caches, whose blob hashes may describe content they were
not built from, are discarded rather than migrated.

**Output** — logging and the block verdict are written with completed syscalls, and every
verdict path shares one writer.

### Verification

- Colocated tests in `.claude/hooks/detect_dead_code.test.ts` drive real temp git repos:
  a package whose only change is a commit is in scope; the same holds inside a worktree, and
  in a worktree that has no mark of its own; a branch switch keeps the current branch's work
  in scope; a `git mv` between packages reports both sides.
- `project_cache_strategy.test.ts` pins the staged and committed cases that previously
  served a stale index, and `persistence.test.ts` covers a staged edit re-indexing on warm
  load.
- Mutation-checked by hand: removing `--no-renames`, the fork-point fallback, the shared
  git-dir fallback, or the working-tree diff each fails at least one test.
- End-to-end against this repo: with the dead method restored the hook emits a block naming
  `get_all_scopes`; after deletion it reports zero and advances the mark. A repository with
  committed dead code and a clean tree now blocks where it previously passed silently, and a
  non-git project directory blocks loudly instead of reporting "no commits".

### Follow-up

`get_changed_files` in `.claude/hooks/utils.ts` carries the identical working-tree-only blind
spot for the nine other Stop hooks (build, tests, lint, naming, stage boundaries). TASK-372
covers giving them the same anchoring; per seam discipline the shared abstraction waits for a
third consumer.

<!-- SECTION:NOTES:END -->

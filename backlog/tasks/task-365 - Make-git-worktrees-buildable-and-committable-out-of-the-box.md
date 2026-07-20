---
id: TASK-365
title: "Make git worktrees buildable and committable out of the box"
status: To Do
assignee: []
created_date: "2026-07-20 00:00"
labels:
  - ops
  - dx
  - test-infra
dependencies: []
references:
  - pnpm-workspace.yaml
  - .npmrc
  - package.json
  - .claude/scripts/checks/ts-stop.cjs
  - .git/hooks/pre-commit
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A fresh git worktree (e.g. created by the `EnterWorktree` tool or
`git worktree add` for a `/build-and-review` run) cannot run the repo's
`pnpm`-based tooling or commit without a long sequence of manual repair steps.
Every `pnpm exec <tool>` and every `pnpm -r <script>` aborts at pnpm's
deps-status precheck, which blocks the turn-end typecheck/eslint Stop hook
(`.claude/scripts/checks/ts-stop.cjs`, run via `pnpm exec`) and the
`pre-commit` hook — so a commit fails even when the code is independently
green.

### Root cause

Two compounding issues, both traceable to the worktree branching from
`origin/<default>` (the default `worktree.baseRef: fresh`), which is behind
local `main`:

1. **pnpm 11 config divergence.** The correct pnpm configuration lives in
   `pnpm-workspace.yaml` on local `main` only: `publicHoistPattern`
   (`*`, `!tree-sitter*`) and `allowBuilds` (approving `tree-sitter*` and
   `esbuild` native builds). The base commit a fresh worktree branches from
   still carries the superseded form — `public-hoist-pattern[]` in `.npmrc`
   and `pnpm.onlyBuiltDependencies` in `package.json` — both of which pnpm 11
   **silently ignores**. The consequences in a worktree:

   - Native build scripts are unapproved → `pnpm install` reports
     `ERR_PNPM_IGNORED_BUILDS` and skips building `tree-sitter` (the runtime
     `.node` binding never gets compiled, so any index/parse call throws
     `Cannot find package 'tree-sitter'`).
   - The missing hoist config makes pnpm consider `node_modules` perpetually
     out of sync, so every `pnpm exec` tries to purge and recreate it and
     aborts with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.

2. **Sandbox reflink failure.** `pnpm install` inside a worktree path fails
   with `EPERM ... reflink` (`Operation not permitted`) under the command
   sandbox, leaving `node_modules` half-populated; it only completes with the
   sandbox disabled.

The manual repair currently required to unblock one worktree: rerun
`pnpm install` outside the sandbox, hand-build the `tree-sitter` native module
with `node-gyp rebuild`, build `@ariadnejs/types` with `tsc` directly,
replicate local `main`'s `publicHoistPattern`/`allowBuilds` into the
worktree's `pnpm-workspace.yaml`, and set `verifyDepsBeforeRun: false` so
`pnpm exec` stops trying to reinstall. None of this should be necessary.

### Impact

Any worktree-based workflow — `/build-and-review`, `spinoff`, ad-hoc
`git worktree add` — is blocked out of the box. The failure surfaces as a
commit-blocking hook error that looks like a lint/type failure but is really
an environment precheck failing, which is easy to misdiagnose.

### Directions to investigate

- **Branch worktrees from local HEAD.** Set `worktree.baseRef: head` (or make
  the worktree tooling do so) so a new worktree inherits local `main`'s pnpm
  config instead of the stale `origin/<default>` base. Cheapest fix if the
  config on local `main` is the only gap.
- **Land the pnpm config on the shared base.** Push the corrected
  `pnpm-workspace.yaml` (and the `.npmrc`/`package.json` cleanup) to
  `origin/<default>` so every fresh base already carries it.
- **Add a worktree hydration step.** A script the worktree flow runs on entry
  that installs (sandbox-aware), approves native builds, compiles
  `tree-sitter`, builds workspace packages, and sets `verifyDepsBeforeRun`.
- **Fix the sandbox reflink path** so `pnpm install` succeeds inside worktree
  directories without disabling the sandbox.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A newly created worktree can run `pnpm exec tsc`, `pnpm exec eslint`,
      and the full `vitest` suite with no manual repair.
- [ ] The turn-end Stop hook and the `pre-commit` hook pass in a fresh
      worktree when the code is green (no `ERR_PNPM_IGNORED_BUILDS` /
      `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`).
- [ ] `tree-sitter` native bindings build automatically during worktree
      setup (no hand-run `node-gyp rebuild`).
- [ ] The superseded pnpm config (`public-hoist-pattern[]` in `.npmrc`,
      `pnpm.onlyBuiltDependencies` in `package.json`) is removed so pnpm 11
      stops emitting the ignored-keys warning.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Surfaced during TASK-364.8 (`/build-and-review` in a worktree). The commit
there landed only after replicating local `main`'s `pnpm-workspace.yaml`
config into the worktree and setting `verifyDepsBeforeRun: false`; those
changes were left as worktree-local scaffolding and not committed to the
fix branch.

<!-- SECTION:NOTES:END -->

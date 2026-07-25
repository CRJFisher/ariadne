---
id: TASK-372
title: Anchor every Stop hook's scan scope at a cleared commit
status: To Do
assignee: []
created_date: "2026-07-25 00:00"
labels:
  - hook-reliability
dependencies:
  - TASK-371
references:
  - .claude/hooks/utils.ts
  - .claude/hooks/detect_dead_code.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`get_changed_files` in `.claude/hooks/utils.ts` derives its scope from the working
tree alone — `git diff --name-only HEAD`, `git diff --name-only --cached`, and
`git ls-files --others`. A session that commits its work before stopping presents
a clean tree, so the scope is empty and every hook built on it does nothing.

Nine Stop hooks share that scope: `build_stop`, `run_tests_stop`, `eslint_stop`,
`file_naming_validator_stop`, `test_file_enforcement_stop`, `stage_boundary_stop`,
`doc_path_truth`, `detect_language_singleton_stop`, and
`capture_receiver_consistency_stop`. A session that commits therefore skips its
build, tests, lint, naming audit, and stage-boundary check.

TASK-371 fixed exactly this defect for `detect_dead_code`, which now scans from
the last commit it cleared — a mark in the git directory, advanced only by a run
that analysed everything in scope. That hook is the first consumer of the pattern;
`get_changed_files` would be the second.

Two further divergences to reconcile while here:

- `get_changed_files` does not strip ambient `GIT_DIR`/`GIT_INDEX_FILE`, so under
  a git hook it can describe a different repository than the one it was given.
- It omits `--no-renames`, so a file moved out of a package with `git mv` — the
  move the repo mandates — is reported only at its destination, hiding the
  package that lost it.

Per seam discipline, do not lift a shared watermark abstraction yet: two
consumers is the signal to pin the contract in a doc, not to build the seam. The
third consumer is the promotion trigger.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `get_changed_files` includes files changed in commits since a cleared mark, so
      a session that commits its work still presents a non-empty scope.
- [ ] The advance/hold rule for the mark is stated in a contract doc owned by
      `.claude/hooks/`, covering both consumers.
- [ ] `get_changed_files` strips ambient git environment variables and passes
      `--no-renames`, matching `detect_dead_code`.
- [ ] A colocated test demonstrates that a package changed only by a commit is in
      scope for each of the nine dependent hooks' scope computation.

<!-- AC:END -->

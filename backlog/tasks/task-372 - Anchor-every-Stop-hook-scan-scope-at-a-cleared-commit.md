---
id: TASK-372
title: Anchor every Stop hook's scan scope at a cleared commit
status: Done
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

- [x] `get_changed_files` includes files changed in commits since a cleared mark, so
      a session that commits its work still presents a non-empty scope.
- [x] The advance/hold rule for the mark is stated in a contract doc owned by
      `.claude/hooks/`, covering both consumers.
- [x] `get_changed_files` strips ambient git environment variables and passes
      `--no-renames`, matching `detect_dead_code`.
- [x] A colocated test demonstrates that a package changed only by a commit is in
      scope for each of the nine dependent hooks' scope computation.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

### High-level summary

Every Stop hook now scans from the commit it last cleared instead of from HEAD, so a session
that commits its work no longer slips past its own gates. The anchoring logic that TASK-371
built inside `detect_dead_code` moved into `.claude/hooks/scan_base.ts` and is shared by all
ten hooks, each holding its own mark.

### The seam

TASK-371 deliberately left the logic in one hook: two consumers cannot tell an essential
shape from a coincidental one. With ten consumers the promotion signal named in that task
fired, so `scan_base.ts` now owns the git invocation and the mark, `SCAN_SCOPE.md` states the
contract, and `detect_dead_code` was migrated onto it rather than keeping a private copy.

### Design

**One mark per hook**, at `<git-dir>/ariadne_scan_base/<hook>`. A single shared mark would let
a passing hook clear a range for a hook that failed — a session where lint passes and the
build breaks must leave the build's range open. A hook writes its mark only on a path where
it actually passed, so a blocked, failed, or killed run re-covers its range next session.

**Two readings of an absent mark.** `get_scoped_changes` anchors at HEAD when no mark exists,
so a hook that acts on individual files — `eslint --fix` above all — never touches work the
session did not do; the mark it writes covers every session after the first. `detect_dead_code`
keeps reading `range.base` directly, where an absent mark means every tracked file counts:
its analysis is whole-package and read-only, so a wide first pass is safe, and that is what
makes deleting the mark force a real full rescan.

The shared helper also inherits what TASK-371's review turned up: ambient git variables are
stripped so `cwd` alone selects the repository, `--no-renames` keeps a `git mv` from hiding
the directory a file left, and `core.quotepath=false` keeps non-ASCII paths matchable. The
fail-wide fallback now names all five workspace packages rather than the three that existed
when it was written.

### Verification

`scan_base.test.ts` covers the range algebra; a purpose-built probe then drove the real
functions against real git repositories for all ten hook names, checking 60 assertions across
six scenarios: a package changed only by a commit is in scope for every hook; one hook
clearing its range leaves the other nine open; a hook that never records stays open across
repeated sessions and clears once it passes; a fresh worktree's first run covers commits made
inside it; a mark on unreachable history falls back to the fork point; and a first run with no
mark stays on the working tree for per-file hooks while `detect_dead_code` sweeps everything.

All ten hook binaries were then run against this repository: each passed and recorded its mark
at HEAD, leaving the working tree untouched. The commit for this task was then made and the
scope re-measured with a clean tree — every hook still saw all sixteen files through
`mark..HEAD`, where anchoring at HEAD reports zero. That 0-versus-16 contrast on the live
repository is the regression this task closes.

### Also

`detect_dead_code` carries an explicit 300s Stop timeout in `.claude/settings.json`. Its cold
pass measures ~20s, and a timeout kill is a silent skip — the failure mode the whole line of
work exists to remove.

<!-- SECTION:NOTES:END -->

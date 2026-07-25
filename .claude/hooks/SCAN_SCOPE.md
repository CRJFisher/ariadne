# Scan Scope Contract

Every Stop hook that checks "what changed this session" resolves its scope through
`scan_base.ts`. This is the contract each one follows.

## The rule

A hook scans from **the last commit it cleared** up to the working tree — not from HEAD.

Asking git only what differs from HEAD makes a hook blind the moment a session commits: the
edit is already in history, the tree is clean, and the hook finds nothing to check. That is
how a dead export reached `main` unexamined (TASK-371), and the same gap applied to every
other Stop hook (TASK-372).

## The mark

Each hook records its cleared commit at `<git-dir>/ariadne_scan_base/<hook>`.

- **Per hook.** A session where lint passes and the build fails must leave the build's range
  open. One shared mark would let a passing hook clear a range for a hook that failed.
- **Per worktree.** Git keeps the git directory per-worktree. A worktree with no mark of its
  own falls back to the shared git directory's, so its first run still covers the commits
  made inside it rather than treating its whole history as cleared.
- **Advanced only on a clean pass.** A blocked, failed, or killed run leaves the mark where
  it is, so the next run re-covers the range. This is what makes the hooks self-healing.
- **Held on unreachable history.** A mark on a commit HEAD cannot reach — after a branch
  switch or rebase — resolves to the fork point rather than being discarded.

## Using it

```ts
const { changed, range } = get_scoped_changes(project_dir, "build");

// … run the check …

record_scan_cleared(project_dir, "build", range);  // only when the check passed
```

`get_scoped_changes` anchors at `range.base ?? range.head`: with no mark yet the range starts
at HEAD and covers the working tree only, so a hook that acts on individual files never
touches work the session did not do. Every session after the first is covered, because the
mark now exists.

Passing `range.base` alone means "with nothing cleared, everything counts" — every tracked
file enters scope. Only `detect_dead_code` reads the range that way: its analysis is
whole-package and read-only, so a wide first pass is safe, and it is what makes deleting the
mark force a real full rescan.

## Resetting

Deleting a mark makes that hook re-examine from scratch. In a linked worktree delete the
shared one too, or the fallback supplies it:

```bash
HOOK=dead_code
rm -f "$(git rev-parse --absolute-git-dir)/ariadne_scan_base/$HOOK" \
      "$(git rev-parse --path-format=absolute --git-common-dir)/ariadne_scan_base/$HOOK"
```

## Git invocation

`scan_base.ts` owns the git calls so every consumer inherits three properties:

- **Ambient git variables are stripped.** `GIT_DIR` and friends take precedence over the
  working directory, so a hook spawned under a git hook would otherwise query the wrong
  repository.
- **`--no-renames`.** Git reports a rename as its destination alone, hiding the directory a
  file moved out of — and this repo mandates `git mv`.
- **`core.quotepath=false`.** Non-ASCII paths stay literal so they still match path patterns.

#!/bin/sh
#
# Guarded worktree hydration for the SessionStart and PostToolUse:EnterWorktree
# hooks (wired in .claude/settings.json).
#
# Runs scripts/hydrate-worktree.sh exactly when it is needed — inside a linked
# git worktree whose dependencies are not yet installed — and is an instant
# no-op everywhere else: the main checkout (its .git is a directory, not a
# gitdir-pointer file) and any already-hydrated worktree. Because hooks are
# harness-run rather than Bash-sandboxed, this hydrates even a worktree entered
# mid-session, which a sandboxed `pnpm install` could not.
#
# Fails open: a hydration hiccup prints guidance but never wedges the session.

# Resolve the worktree from the hook's cwd (the session's active directory) so
# it targets the right tree whether the session launched here (SessionStart) or
# just switched here (PostToolUse:EnterWorktree). Outside a repo, do nothing.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -n "$ROOT" ] || exit 0

# A linked worktree's .git is a file (a gitdir pointer); the main checkout's is
# a directory. Only worktrees need hydrating.
[ -f "$ROOT/.git" ] || exit 0

# Already hydrated — nothing to do.
[ -d "$ROOT/node_modules" ] && exit 0

echo "Hydrating fresh worktree at $ROOT (one-time: pnpm install + build)…"
if [ -f "$ROOT/scripts/hydrate-worktree.sh" ]; then
  sh "$ROOT/scripts/hydrate-worktree.sh" ||
    echo "hydrate_worktree hook: hydration failed; run scripts/hydrate-worktree.sh by hand."
fi
exit 0

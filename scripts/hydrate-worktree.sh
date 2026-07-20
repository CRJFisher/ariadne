#!/bin/sh
#
# Hydrate a fresh git worktree so pnpm tooling, the vitest suites, and the
# commit hooks work with no manual repair.
#
# A new worktree starts with no node_modules and no compiled native bindings.
# The pnpm config in pnpm-workspace.yaml (publicHoistPattern + allowBuilds)
# makes a single install populate node_modules, auto-approve and compile the
# tree-sitter native bindings, and leave `pnpm exec` able to run without
# purging node_modules. The build then emits every workspace package's dist so
# cross-package imports resolve.
#
# Worktrees created through the EnterWorktree tool branch from local HEAD
# (worktree.baseRef: head in .claude/settings.json), so they inherit that
# config; `git worktree add` from local HEAD does the same.
#
# Idempotent: safe to re-run — pnpm reuses the store and skips up-to-date work.
#
# Under a Claude Code agent, run this once with the Bash sandbox disabled: the
# install writes temp files under .claude/worktrees/**, which the sandbox
# denies. The git commit flow and turn-end hooks are harness-run rather than
# Bash-sandboxed, so they need no such exception once node_modules exists.

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "→ Installing dependencies (compiles tree-sitter native bindings)…"
pnpm install

echo "→ Building workspace packages…"
pnpm build

echo "✅ Worktree hydrated: pnpm exec, vitest, and the commit hooks are ready."

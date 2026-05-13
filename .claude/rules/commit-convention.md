# Commit Message Convention

Commits in this repo use Conventional Commits format with a single extension: when a commit advances or resolves a backlog task, the scope is the task id alone (no `TASK-` prefix). This lets tools — most importantly the fix-sequencer's out-of-band fix detector — extract task references reliably from `git log`.

## Format

```
<type>(<scope>): <subject>

<optional body>

<optional trailers>
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `review`, `backlog`.

## Scope rules

- **Task-scoped commit** — scope is the task id, e.g.:
  - `fix(343): handle null receiver`
  - `feat(190.16.42): implement signal X`
  - `feat(190.17.12-14): batched retarget` (range; expands to .12, .13, .14)
- **General-scope commit** — scope is a named subsystem and is not validated:
  - `fix(mcp): clean up`, `feat(python): add Y`, `refactor(core): split Z`
- **No scope** — also allowed: `chore: gitignore X`.

## Body trailers

When one commit references multiple unrelated tasks (rare), use body trailers:

```
fix(mcp): clean up

Fixes: TASK-190.16.42
Implements TASK-343
```

Accepted trailer prefixes: `Fixes:`, `Implements`, `Closes:`. Each captured task id must exist in `backlog/tasks/`.

## Enforcement

A `commit-msg` git hook validates these rules. It is **permissive by design**: only commits whose subject scope looks task-shaped (matches `^\d+(?:\.\d+)*(?:-\d+)?$`) are validated against `backlog/tasks/`. Named-scope and unscoped commits pass through with no further checks.

Install the hook by running `scripts/setup-hooks.sh` from the repo root.

CI re-validates the latest commit on every PR via `node --import tsx scripts/check-commit-message.ts --ci`.

---
name: release
description: Prepare a new release of Ariadne packages. Creates changesets, verifies build/tests, and drafts the PR to main.
allowed-tools: Bash(pnpm build, pnpm test, pnpm typecheck, pnpm changeset, git *), Read, Write, Edit
---

# Release Preparation

See `docs/RELEASING.md` for the full release process.

## Checklist

1. **Verify clean working tree**: `git status` — no uncommitted changes
2. **Build**: `pnpm build`
3. **Test**: `pnpm test`
4. **Typecheck**: `pnpm typecheck`
5. **Create changesets**: Add `.changeset/<name>.md` files describing the bumps
6. **Verify**: `pnpm changeset status` — confirm expected version bumps
7. **Commit**: Commit changesets and any release-related changes
8. **Create PR**: `gh pr create` targeting `main`

## Changeset Template

```markdown
---
"@ariadnejs/core": minor
"@ariadnejs/types": minor
---

Summary of core + types changes

- Change 1
- Change 2
```

```markdown
---
"@ariadnejs/mcp": minor
---

Summary of MCP changes

- Change 1
- Change 2
```

## PR Template

```markdown
## Summary
- Package version bumps: core vX.Y.0, types vX.Y.0, mcp vX.Y.0
- <bullet summary of major changes>

## Pre-release verification
- [x] `pnpm build` passes
- [x] `pnpm test` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm changeset status` shows expected bumps

## Test plan
- [ ] CI passes on this PR
- [ ] Merge to main creates "Version Packages" PR
- [ ] Version Packages PR shows correct version bumps
```

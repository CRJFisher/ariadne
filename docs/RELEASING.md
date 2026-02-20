# Releasing Ariadne Packages

Ariadne uses [Changesets](https://github.com/changesets/changesets) for version management and releases. Three packages are published to npm:

- `@ariadnejs/core` — Call graph analysis engine
- `@ariadnejs/types` — Shared type definitions
- `@ariadnejs/mcp` — MCP server for IDE integration

## Package Linking

`@ariadnejs/core` and `@ariadnejs/types` are **linked** — they always receive the same bump level. If core gets a minor bump, types gets a minor bump too. This is configured in `.changeset/config.json`.

`@ariadnejs/mcp` is versioned independently.

## Release Flow

### 1. Pre-release Checklist

Before creating changesets, verify the codebase is healthy:

```bash
pnpm build       # All packages build cleanly
pnpm test        # All tests pass
pnpm typecheck   # No type errors
```

### 2. Create Changesets

Each changeset describes a set of package bumps and a summary of changes.

```bash
pnpm changeset   # Interactive CLI to create a changeset
```

Or create a changeset file manually in `.changeset/`:

```markdown
---
"@ariadnejs/core": minor
"@ariadnejs/types": minor
---

Description of core + types changes
```

Valid bump levels: `patch`, `minor`, `major`.

### 3. Verify Changesets

```bash
pnpm changeset status   # Shows which packages will be bumped
```

### 4. Merge to Main

When your PR with changesets merges to `main`, CI creates a "Version Packages" PR that:

- Runs `changeset version` to bump `package.json` versions
- Updates `CHANGELOG.md` for each package
- Removes consumed changeset files

### 5. Publish

When the "Version Packages" PR is merged, CI runs `changeset publish` to publish updated packages to npm.

## Manual / Emergency Release

If CI is unavailable, publish manually:

```bash
pnpm build
pnpm changeset version   # Apply version bumps locally
pnpm changeset publish   # Publish to npm
git push --follow-tags   # Push version commits and tags
```

## Changeset File Format

Changeset files live in `.changeset/` and use this format:

```markdown
---
"@ariadnejs/core": minor
"@ariadnejs/types": minor
---

Summary of changes (supports markdown)

- Feature A
- Fix B
```

The filename can be anything ending in `.md` (excluding `README.md`). Use descriptive names like `add-python-support.md` or `epic-11-core-types.md`.

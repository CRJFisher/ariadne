# Releasing Ariadne

This document describes the process for releasing new versions of Ariadne.

## Release Process with Changesets

Ariadne uses [Changesets](https://github.com/changesets/changesets) for version management and releasing.

### Creating a Changeset

When you make changes that should be released:

```bash
npm run changeset
```

This will prompt you to:

1. Select which packages changed
2. Choose the bump type (major/minor/patch)
3. Write a summary for the changelog

### Automatic Release Process

The release process is fully automated through GitHub Actions:

1. **Create changesets** as you develop
2. **Push to main** - A "Version Packages" PR is automatically created
3. **Review and merge** the version PR
4. **Automatic publishing**:
   - Packages are published to npm
   - Git tag is created

No manual commands needed!

## Version Guidelines

- **Patch** (1.0.0 → 1.0.1): Bug fixes, documentation updates, internal changes
- **Minor** (1.0.0 → 1.1.0): New features, non-breaking API additions
- **Major** (1.0.0 → 2.0.0): Breaking changes, API removals, major refactors

## What Happens During Release

1. **Version PR Creation**:
   - Changesets are consumed
   - Package versions are bumped
   - CHANGELOG.md files are updated
   - Dependencies are updated

2. **After Merging Version PR**:
   - Both packages are published to npm
   - Git tag is created (e.g., `v1.2.3`)

## Troubleshooting

- **No Version PR created**: Check if there are changesets in `.changeset/` directory
- **Publish failed**: Ensure `NPM_TOKEN` secret is set in repository settings

## Manual Release (Emergency Only)

If automation fails, you can manually release:

```bash
npm run version    # Consume changesets and bump versions
git add .
git commit -m "chore: version packages"
git push origin main
npm run release    # Publish to npm
```

But this should rarely be needed as the automation is robust.

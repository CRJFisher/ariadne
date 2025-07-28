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

### Releasing

1. **Create a Version PR** (Recommended):
   ```bash
   npm run version
   ```
   This consumes all changesets and updates versions/changelogs.

2. **Review and merge** the version PR

3. **Publish to npm**:
   ```bash
   npm run release
   ```

### Legacy Script (Deprecated)

The `scripts/release.sh` script is kept for reference but is no longer the recommended approach. Use changesets instead for better monorepo support and changelog generation.

## What the Script Does

1. **Validates Environment**:
   - Ensures you're in a git repository
   - Checks for uncommitted changes
   - Verifies you're on the main branch
   - Confirms local is up-to-date with remote

2. **Bumps Version**:
   - Updates the version in package.json
   - Follows semantic versioning rules

3. **Creates Release**:
   - Commits the version change
   - Creates an annotated git tag (v1.2.3)
   - Pushes both the commit and tag to GitHub

4. **Triggers Automation**:
   - The prebuild workflow automatically runs when a new tag is pushed
   - Prebuilt binaries are created for all supported platforms
   - A GitHub release is created with the binaries attached

## Manual Steps After Release

1. **Monitor Build**: Check GitHub Actions to ensure the prebuild workflow completes successfully

2. **Publish to npm**: Once builds are complete, either:
   - Run `npm publish` locally, or
   - Trigger the publish-npm GitHub workflow

3. **Verify Installation**: Test that users can install the new version without build tools

## Version Guidelines

- **Patch** (1.0.0 -> 1.0.1): Bug fixes, documentation updates, internal changes
- **Minor** (1.0.0 -> 1.1.0): New features, non-breaking API additions
- **Major** (1.0.0 -> 2.0.0): Breaking changes, API removals, major refactors
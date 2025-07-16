# Releasing RefScope

This document describes the process for releasing new versions of RefScope.

## Release Script

Use the `scripts/release.sh` script to create a new release:

```bash
# For bug fixes (patch version: 1.0.0 -> 1.0.1)
./scripts/release.sh patch

# For new features (minor version: 1.0.0 -> 1.1.0)  
./scripts/release.sh minor

# For breaking changes (major version: 1.0.0 -> 2.0.0)
./scripts/release.sh major

# Default is patch if no argument provided
./scripts/release.sh
```

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
# Release Process Rules 🚀

This document defines the complete process for releasing Ariadne packages. Follow these steps exactly to ensure smooth releases.

## Overview

Ariadne uses a monorepo structure with multiple packages:
- `@ariadnejs/types` - TypeScript type definitions
- `@ariadnejs/core` - Core functionality 
- `@ariadnejs/mcp` - MCP server implementation

We use **Changesets** for version management and **npm** for publishing.

## Pre-Release Checklist

### 1. Ensure All Tests Pass ✅

```bash
# Run all tests in the monorepo
npm test

# Expected output:
# - @ariadnejs/core: 500+ tests passing
# - @ariadnejs/mcp: Tests should pass (if failing, assess if critical)
# - @ariadnejs/types: No tests (types only)
```

**Decision Point**: If MCP tests fail, determine if they're:
- Critical bugs → Fix before release
- Feature tests → Can proceed if core is stable

### 2. Build All Packages 🔨

```bash
# Build everything
npm run build

# This runs in order:
# 1. @ariadnejs/types (dependency for others)
# 2. @ariadnejs/core
# 3. @ariadnejs/mcp
```

**Note**: Build errors MUST be fixed before release.

### 3. Update Documentation 📝

Check and update if needed:
- `packages/core/README.md` - API documentation
- `packages/core/CHANGELOG.md` - Will be updated by changesets
- `backlog/WORK_PRIORITY.md` - Current release status

## Release Process

### Step 1: Create a Changeset 📋

```bash
# Create a changeset file manually (interactive mode may not work in some terminals)
cat > .changeset/release-description.md << 'EOF'
---
"@ariadnejs/core": minor
"@ariadnejs/mcp": patch
---

Brief description of changes

**Details:**
- Feature 1
- Feature 2
- Bug fix 1
EOF
```

**Version Bump Guidelines**:
- `patch`: Bug fixes, documentation updates
- `minor`: New features, non-breaking API changes
- `major`: Breaking changes (use sparingly in pre-1.0)

**Note**: While still pre-1.0, we use minor bumps even for API changes since the API is not yet stable.

### Step 2: Apply Version Updates 🔢

```bash
# Update versions and changelogs
npx changeset version

# This will:
# - Update package.json versions
# - Update CHANGELOG.md files
# - Remove changeset files
```

### Step 3: Commit Version Changes 💾

```bash
# Stage and commit the version updates
git add -A
git commit -m "chore: release version X.Y.Z

- Brief summary of major changes
- Note if any breaking changes"
```

### Step 4: Build and Test Final Version 🧪

```bash
# Final build to ensure everything compiles
npm run build

# Run tests one more time
npm test
```

### Step 5: Create Release Tag 🏷️

```bash
# Create annotated tag
git tag -a v[VERSION] -m "Release v[VERSION]

Summary of changes"

# Example:
git tag -a v0.6.0 -m "Release v0.6.0

- Namespace imports for JS/TS
- 500 tests passing
- New folder structure"
```

### Step 6: Push Changes 🚢

```bash
# Push commits and tags
git push origin [branch-name]
git push origin --tags
```

### Step 7: Publish to NPM 📦

**Option A: Local Publishing**
```bash
# Ensure you're logged in to npm
npm login

# Run the release script
npm run release

# Or manually publish
npx changeset publish
```

**Option B: GitHub Actions (Recommended)**
1. Create a GitHub Release from the tag
2. GitHub Actions will automatically:
   - Run tests
   - Build packages
   - Publish to npm

### Step 8: Verify Release ✔️

1. Check npm packages:
   - https://www.npmjs.com/package/@ariadnejs/core
   - https://www.npmjs.com/package/@ariadnejs/mcp
   - https://www.npmjs.com/package/@ariadnejs/types

2. Test installation:
```bash
# In a temporary directory
npm install @ariadnejs/core@latest
npm list @ariadnejs/core
```

## Troubleshooting

### Build Failures

**MCP TypeScript Errors**:
- Usually due to API changes in core
- Check IScopeGraph interface usage
- Verify import/export APIs match

**Solution**:
```bash
# Fix type errors first
npm run build -w @ariadnejs/mcp

# Common fixes:
# - Add type guards for node properties
# - Use correct IScopeGraph methods
# - Update to match current core API
```

### Changeset Issues

**Interactive Mode Fails**:
```bash
# Create changeset manually
echo '---
"@ariadnejs/core": minor
---

Your changes here' > .changeset/temp-change.md
```

### Publishing Failures

**npm Authentication**:
```bash
# Check authentication
npm whoami

# Re-login if needed
npm login
```

**Version Conflicts**:
```bash
# If version already exists
# 1. Bump version manually in package.json
# 2. Create new changeset
# 3. Run changeset version again
```

## Release Communication

After successful release:

1. **Update GitHub Release Notes**:
   - Go to releases page
   - Edit the release for the tag
   - Add comprehensive notes from CHANGELOG

2. **Update Project Documentation**:
   - Update main README if needed
   - Update WORK_PRIORITY.md for next milestone

3. **Archive Completed Tasks**:
   ```bash
   # Follow backlog-post.md rules
   # Archive completed tasks
   # Update priorities
   ```

## Emergency Rollback

If critical issues found post-release:

1. **Deprecate on npm** (don't unpublish):
```bash
npm deprecate @ariadnejs/core@X.Y.Z "Critical bug - use X.Y.Z-1"
```

2. **Fix and Release Patch**:
```bash
# Create hotfix branch
git checkout -b hotfix/critical-bug

# Fix issue
# Create patch changeset
# Release as patch version
```

## Key Reminders

1. **NEVER skip tests** before release
2. **ALWAYS build before publishing**
3. **Use changesets** for version management
4. **Tag releases** for GitHub
5. **Test the published package** after release
6. **Document known issues** in release notes

## Quick Release Commands

For experienced users, here's the minimal flow:

```bash
# 1. Create changeset
npx changeset add  # or manual creation

# 2. Version
npx changeset version

# 3. Commit
git add -A && git commit -m "chore: release vX.Y.Z"

# 4. Tag
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# 5. Push
git push origin main --tags

# 6. Publish
npm run release  # or let GitHub Actions handle it
```

## Related Documentation

- `docs/release-checklist.md` - Simple checklist format
- `.github/workflows/release-and-publish.yml` - GitHub Actions config
- `CHANGELOG.md` files - Auto-updated by changesets
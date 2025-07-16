---
id: task-15.1
title: Add prebuild binary support for tree-sitter native modules
status: In Progress
assignee:
  - "@chuck"
created_date: "2025-07-16"
updated_date: "2025-07-16"
labels: []
dependencies: []
parent_task_id: task-15
---

## Description

Configure the package to include prebuilt binaries for tree-sitter native modules so users don't need build tools like gcc/make installed. This will improve the installation experience across different platforms.

## Acceptance Criteria

- [x] Configure prebuild or prebuild-install for tree-sitter modules
- [x] Add GitHub Actions workflow to build binaries for multiple platforms
- [ ] Test installation works without build tools on Windows/Mac/Linux
- [x] Update package.json with prebuild configuration
- [x] Document the prebuild process

## Implementation Plan

1. Research prebuild vs prebuild-install for tree-sitter native modules
2. Configure prebuild setup in package.json
3. Create GitHub Actions workflow for building binaries on multiple platforms
4. Test the prebuild process locally
5. Test installation without build tools on different platforms
6. Update documentation with prebuild information

## Implementation Notes

### Approach Taken

- Implemented a custom postinstall script that downloads prebuilt binaries from GitHub releases
- Created a GitHub Actions workflow that builds binaries for multiple platforms on release
- Added fallback to build from source if prebuilt binaries are not available

### Features Implemented

- **Postinstall Script** (`scripts/postinstall.js`): Downloads and extracts prebuilt binaries from GitHub releases
- **GitHub Actions Workflow** (`.github/workflows/prebuild.yml`): Builds binaries for Linux, macOS (x64 & arm64), and Windows
- **Automatic Fallback**: If prebuilt binaries aren't available, falls back to building from source
- **CI/Build-from-source Support**: Skips prebuild download when `CI=true` or `--build-from-source` flag is used

### Technical Decisions

- Used tar for extracting downloaded archives (added as a dependency)
- Workflow triggers on version tags (v\*) and manual dispatch
- Binaries are packaged per platform/arch and uploaded as release assets
- Postinstall script uses GitHub API to fetch latest release information

### Modified Files

- `package.json`: Added postinstall script and tar dependency
- `.github/workflows/prebuild.yml`: New workflow for building prebuilt binaries
- `scripts/postinstall.js`: New script for downloading/installing prebuilt binaries
- `docs/prebuild-binaries.md`: New documentation for prebuild support
- `README.md`: Updated installation section to mention prebuild support

### Trade-offs

- Added complexity with postinstall script vs simpler installation
- Requires GitHub releases to be properly tagged for prebuilds to work
- Added tar as a runtime dependency (small overhead)
- Platform-specific testing still needed to verify full functionality

### Additional Notes

- Updated GitHub repository reference to CRJFisher/refscope in postinstall script and package.json
- Added exception in .gitignore for scripts/postinstall.js (was being ignored by \*.js rule)

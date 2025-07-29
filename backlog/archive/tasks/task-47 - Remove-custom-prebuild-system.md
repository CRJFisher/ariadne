---
id: task-47
title: Remove custom prebuild system
status: Done
assignee:
  - '@chuck'
created_date: '2025-07-29'
updated_date: '2025-07-29'
labels: []
dependencies: []
---

## Description

Tree-sitter packages already include platform-specific prebuilt binaries. Our custom prebuild system adds unnecessary complexity without significant benefit. We should remove it and rely on tree-sitter's existing prebuild infrastructure.

## Acceptance Criteria

- [x] Prebuild workflow removed from GitHub Actions
- [x] Postinstall script simplified to remove download logic
- [x] Package installs successfully on all platforms
- [x] Installation time remains acceptable

## Implementation Plan

1. Remove prebuild and github-release jobs from release-and-publish.yml workflow
2. Remove or simplify postinstall.js script to not download binaries
3. Remove prebuilds directory references from .gitignore if any
4. Test installation on different platforms to ensure it works
5. Update documentation to reflect the change

## Implementation Notes

### Approach Taken
Completely removed the custom prebuild system and relied on tree-sitter's built-in prebuild support. This simplifies the codebase and reduces maintenance burden.

### Changes Made
1. **Removed prebuild and github-release jobs** from `.github/workflows/release-and-publish.yml` - The workflow now only handles npm publishing
2. **Removed postinstall script entirely** - Tree-sitter packages handle their own prebuilds, so no custom postinstall logic is needed
3. **Removed tar dependency** from `packages/core/package.json` - No longer needed for extracting prebuild archives
4. **Updated documentation**:
   - Rewrote `docs/prebuild-binaries.md` to explain tree-sitter's native prebuild support
   - Updated `docs/releasing.md` to remove references to prebuild binaries in the release process

### Technical Decisions
- Decided to remove the postinstall script entirely rather than keeping a simplified version, as tree-sitter packages handle everything automatically
- No changes needed to .gitignore as there were no prebuild directory references

### Files Modified
- `.github/workflows/release-and-publish.yml` - Removed prebuild and github-release jobs
- `packages/core/package.json` - Removed postinstall script, tar dependency, and scripts/postinstall.js from files array
- `packages/core/scripts/postinstall.js` - Deleted entirely
- `docs/prebuild-binaries.md` - Rewritten to reflect new approach
- `docs/releasing.md` - Updated to remove prebuild references

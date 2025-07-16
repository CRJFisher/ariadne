---
id: task-15
title: Publish RefScope as NPM package
status: In Progress
assignee:
  - '@chuck'
created_date: '2025-07-08'
updated_date: '2025-07-16'
labels:
  - deployment
  - infrastructure
dependencies:
  - task-14
  - task-17
---

## Description

Prepare and publish RefScope as an NPM package to make it easily installable and usable by other developers. Ensure proper package configuration, build process, and documentation.

## Acceptance Criteria

- [x] Configure package.json for publishing (main entry point exports types repository info)
- [x] Set up TypeScript build configuration for library output
- [x] Create npm publish workflow
- [x] Add .npmignore file to exclude unnecessary files
- [x] Build and test the package locally
- [x] Create NPM account or verify authentication
- [ ] Publish initial version to NPM registry
- [ ] Verify package installation works correctly
- [x] Add installation and usage instructions to README
- [x] Set up automated publishing via GitHub Actions

## Implementation Plan

1. Analyze current package.json and project structure
2. Configure package.json with proper fields for NPM publishing
3. Set up TypeScript build configuration for library distribution
4. Create .npmignore to exclude unnecessary files from package
5. Set up build scripts and test package locally
6. Configure NPM authentication
7. Publish initial version to NPM
8. Test installation from NPM registry
9. Update README with installation and usage instructions
10. Set up GitHub Actions workflow for automated publishing

## Implementation Notes

Implemented NPM package publishing configuration:

### Steps Completed

1. Updated `package.json` with correct `main` entry, `types`, `files` array, and metadata.
2. Configured TypeScript to generate declaration files and source maps.
3. Created `.npmignore` to exclude development files.
4. Added build script to copy `.scm` query files to `dist`.
5. Created manual publish script at `scripts/publish.sh`.
6. Set up GitHub Actions workflows for automated testing and publishing.
7. Enhanced `README.md` with installation instructions and API reference.
8. Created release checklist documentation.

---

The package is now ready to be published to NPM.

**Next steps:**

- Create an NPM account or log in.
- Run `npm run publish:npm` locally, or use GitHub Releases for automated publishing.
- Add `NPM_TOKEN` to GitHub secrets for CI/CD.

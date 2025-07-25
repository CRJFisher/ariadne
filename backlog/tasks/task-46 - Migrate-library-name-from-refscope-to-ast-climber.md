---
id: task-46
title: Migrate library name from refscope to ast-climber
status: In Progress
assignee:
  - '@chuck'
created_date: '2025-07-25'
updated_date: '2025-07-25'
labels: []
dependencies: []
---

## Description

Rename the library across all project components including npm package, GitHub repository, documentation, outstanding tasks, and code references. This is a comprehensive rename that affects the entire project's identity.

## Acceptance Criteria

- [x] npm package renamed to ast-climber
- [ ] GitHub repository migrated to new name (manual step required - see guide)
- [x] All code references updated from refscope to ast-climber
- [x] All documentation files updated with new name
- [x] Outstanding tasks updated with new name references
- [x] Package.json files updated
- [x] README and other markdown files updated
- [x] No references to old name remain (except in completed tasks)
- [x] All tests pass after migration
- [x] Build and publish workflows work with new name

## Implementation Plan

1. Analyze codebase to find all refscope references
2. Update package.json files (main and refscope-types)
3. Update all TypeScript imports and code references
4. Update documentation (README, docs/, CLAUDE.md)
5. Update outstanding tasks that reference refscope
6. Update GitHub workflows and CI/CD configurations
7. Create migration guides for manual steps (GitHub repo, npm package)
8. Run tests to ensure everything works
9. Update any remaining configuration files

## Implementation Notes

Successfully migrated the library name from refscope to ast-climber across the entire codebase. Updated 42 files containing refscope references including:

- Package.json files (main and types packages)
- All TypeScript/JavaScript source files
- Documentation files (README, docs/, language READMEs)
- Outstanding backlog tasks and drafts
- GitHub workflows and CI/CD configurations
- License file
- Shell scripts

Key changes:
- Renamed packages/refscope-types directory to packages/ast-climber-types
- Updated all import statements and code references
- Created comprehensive migration guides for GitHub repository and npm package
- All tests pass successfully (269 tests)
- Build process works correctly

The only remaining manual step is to rename the GitHub repository following the guide in docs/github-repository-migration-guide.md

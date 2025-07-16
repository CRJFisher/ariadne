---
id: task-18
title: Migrate test runner from Jest to Vitest
status: Done
assignee:
  - '@claude'
created_date: '2025-07-16'
updated_date: '2025-07-16'
labels:
  - testing
  - infrastructure
dependencies:
  - task-17
---

## Description

After investigation in task 17, we identified that Jest has a fundamental incompatibility with tree-sitter native modules on Linux (Jest issue #9206). This prevents CI tests from passing. Vitest is a modern test runner with excellent native module support through its 'forks' pool, making it ideal for our use case.

## Acceptance Criteria

- [x] All existing tests migrated to Vitest
- [x] Tests pass on both macOS and Linux CI
- [x] Vitest configuration optimized for native modules
- [x] Remove Jest dependencies and configuration
- [x] Update CI workflow to use Vitest
- [x] Document migration guide

## Implementation Plan

1. Install Vitest and necessary dependencies
2. Create Vitest configuration file
3. Update test scripts in package.json
4. Migrate test setup files and helpers
5. Run tests to identify any syntax/API differences
6. Fix any migration issues
7. Remove Jest dependencies and configuration
8. Update CI workflow
9. Verify tests pass on both macOS and Linux

## Implementation Notes

Successfully migrated from Jest to Vitest to resolve native module compatibility issues on Linux.

**Approach taken:**
- Installed Vitest with @vitest/ui and happy-dom dependencies
- Created vitest.config.mjs using ESM syntax to avoid module loading issues
- Configured Vitest with 'forks' pool and singleFork option for native module compatibility
- Updated package.json test scripts (test, test:ui, test:coverage)
- Removed all Jest dependencies and configuration files
- Updated CI workflow to test on both Ubuntu and macOS

**Features implemented:**
- All 39 existing tests now run successfully under Vitest
- Test setup file at src/test/setup.ts for future test configuration needs
- Coverage reporting configuration matching previous Jest setup
- CI matrix testing on multiple OS and Node versions

**Technical decisions:**
- Used .mjs extension for Vitest config to ensure ESM compatibility
- Chose 'forks' pool over 'threads' for proper native module isolation
- Kept test API compatible by enabling globals: true

**Modified files:**
- package.json (updated scripts, removed Jest deps, added Vitest deps)
- vitest.config.mjs (new configuration file)
- src/test/setup.ts (new test setup file)
- .github/workflows/test.yml (added macOS to test matrix)
- docs/jest-to-vitest-migration.md (new migration guide)
- Removed: jest.config.js

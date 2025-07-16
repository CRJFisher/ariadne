---
id: task-17
title: Fix CI test failures for tree-sitter native modules
status: To Do
assignee: []
created_date: '2025-07-16'
updated_date: '2025-07-16'
labels:
  - bug
  - ci
  - infrastructure
dependencies: []
---

## Description

Multiple test suites fail in CI environment (Ubuntu) while passing locally. The issue is most likely related to tree-sitter native module compilation producing non-functional binaries in the CI environment. This blocks reliable package publishing and testing.

## Acceptance Criteria

- [ ] Diagnose root cause of CI build failures
- [ ] Fix tree-sitter module compilation in Ubuntu CI environment
- [ ] All tests pass in CI for Node 18.x and 20.x
- [ ] Document the solution for future reference
- [ ] Remove or update ci-test-failures.md once resolved

## Implementation Plan

1. Add CI steps to inspect build environment (g++, make, python versions)
2. Capture verbose npm ci logs and upload as artifacts
3. Inspect build outputs after npm ci to verify .node files
4. Compare local vs CI compilation flags and toolchain differences
5. Test with simpler parsers like tree-sitter-json
6. Investigate node-gyp compilation on ubuntu-latest
7. Consider alternative solutions (prebuild binaries, different CI images)
8. Document findings and implement fix
9. Verify all tests pass consistently in CI

## Implementation Notes

## Failing Test Suites

### Core Tests

- **src/index.test.ts**: Cross-file resolution tests (8 failures)
- **src/incremental.test.ts**: Incremental parsing tests (4 failures)

### Language-Specific Tests  

- **src/languages/python/python.test.ts**: All Python parsing tests fail
- **src/languages/typescript/typescript.test.ts**: All TypeScript parsing tests fail
- **Note**: JavaScript tests pass successfully

## Key Findings

- Both local and CI build from source, but produce different results
- Local (macOS/Clang) builds work correctly
- CI (Ubuntu/GCC) builds complete but produce non-functional binaries
- Issue is specific to node-gyp compilation on ubuntu-latest runner
- Problem affects TypeScript and Python parsers, but not JavaScript
- tree-sitter: 0.21.1
- tree-sitter-javascript: 0.21.4 (works)
- tree-sitter-python: 0.21.0 (fails in CI)
- tree-sitter-typescript: 0.21.2 (fails in CI)

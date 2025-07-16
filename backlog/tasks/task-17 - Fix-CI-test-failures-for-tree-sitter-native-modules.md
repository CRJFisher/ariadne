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

Multiple test suites fail in CI environment (Ubuntu) while passing locally. Initially thought to be related to tree-sitter native module compilation, investigation revealed that prebuilt binaries are being used and work correctly in isolation. The issue appears to be specific to the Jest test environment, where TypeScript and Python parsers timeout immediately despite working fine in standalone scripts. This blocks reliable package publishing and testing.

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

## Key Findings (Original Understanding - Now Outdated)

- Both local and CI build from source, but produce different results
- Local (macOS/Clang) builds work correctly
- CI (Ubuntu/GCC) builds complete but produce non-functional binaries
- Issue is specific to node-gyp compilation on ubuntu-latest runner
- Problem affects TypeScript and Python parsers, but not JavaScript
- tree-sitter: 0.21.1
- tree-sitter-javascript: 0.21.4 (works)
- tree-sitter-python: 0.21.0 (fails in CI)
- tree-sitter-typescript: 0.21.2 (fails in CI)

## Recent Findings (2025-07-16) - CRITICAL UPDATE

### Tree-sitter Uses Prebuilt Binaries!

Our initial assumption was completely wrong. The CI is NOT building tree-sitter from source. Investigation revealed:

1. **All tree-sitter modules include prebuilt binaries**:
   - Located in `prebuilds/linux-x64/*.node` for Linux CI environment
   - File sizes: tree-sitter (539KB), JavaScript (405KB), TypeScript (2.96MB), Python (539KB)
   - Binaries exist for all major platforms (darwin-x64, darwin-arm64, linux-x64, win32-x64)
   - Uses `node-gyp-build` which loads prebuilts instead of compiling

2. **Binaries are functional**:
   - Debug script (`scripts/debug-parsers.js`) shows all parsers work perfectly in isolation
   - All parsers successfully parse test code when loaded directly
   - `node-gyp-build` successfully resolves all bindings

3. **The real issue**:
   - Parsers work fine in standalone Node.js scripts
   - Same parsers timeout immediately in Jest tests
   - This indicates Jest environment interference, not binary issues

### What This Changes

**Previous understanding (incorrect)**:
- ❌ CI compiles broken binaries from source
- ❌ Ubuntu/GCC toolchain produces non-functional .node files
- ❌ Need to fix compilation or use prebuild binaries

**Current understanding (correct)**:
- ✅ Prebuilt binaries are already being used
- ✅ Binaries are functional and load correctly
- ✅ Issue is specific to Jest test environment
- ✅ Need to investigate Jest configuration or test setup

### Debugging Progress

1. Created `scripts/debug-parsers.js` - Shows all parsers work in isolation
2. Created `scripts/find-native-modules.js` - Revealed prebuilt binaries
3. Created `scripts/test-parsers-direct.js` - Tests without Jest
4. Created `scripts/check-jest-env.js` - Examines Jest configuration

### Next Investigation Areas

1. **Jest environment issues**:
   - Check if Jest's module loading interferes with native modules
   - Investigate ts-jest transformation effects
   - Test with different Jest configurations

2. **Module initialization timing**:
   - Language configs are initialized at import time
   - May need lazy initialization

3. **Resource constraints**:
   - TypeScript parser is large (3MB)
   - Check memory limits in CI environment

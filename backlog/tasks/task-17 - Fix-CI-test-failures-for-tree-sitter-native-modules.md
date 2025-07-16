---
id: task-17
title: Fix CI test failures for tree-sitter native modules
status: To Do
assignee: []
created_date: "2025-07-16"
updated_date: "2025-07-16"
labels:
  - bug
  - ci
  - infrastructure
dependencies: []
---

## Description

Multiple test suites fail in CI environment (Ubuntu) while passing locally. Initially thought to be related to tree-sitter native module compilation, investigation revealed that prebuilt binaries are being used and work correctly in isolation. The issue appears to be specific to the Jest test environment, where TypeScript and Python parsers timeout immediately despite working fine in standalone scripts. This blocks reliable package publishing and testing.

## Acceptance Criteria

- [x] Diagnose root cause of CI build failures (Jest-specific issue, not binary compilation)
- [ ] Fix Jest compatibility with tree-sitter native modules
- [ ] All tests pass in CI for Node 18.x and 20.x
- [ ] Document the solution for future reference
- [ ] Remove or update ci-test-failures.md once resolved

### Alternative Acceptance Criteria (if Jest proves incompatible)

- [ ] Replace Jest with alternative test runner that works with native modules
- [ ] Migrate existing tests to new test framework
- [ ] Ensure same test coverage and functionality

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

### Tree-sitter Uses Prebuilt Binaries

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

### Additional Testing Results (2025-07-16)

1. **Direct parser tests confirm functionality**:

   - TypeScript parser: 0.152ms parse time
   - Python parser: 0.074ms parse time
   - Project class works perfectly outside Jest
   - All scope graphs generated correctly

2. **Jest environment appears normal**:

   - Using node environment
   - No unusual configuration
   - Default timeout (5000ms)
   - Running in CI environment as expected

3. **Strong evidence of Jest-specific interference**:
   - Same code works in standalone Node.js scripts
   - Fails immediately (timeout) when run under Jest
   - JavaScript parser works even in Jest (different size/complexity?)
   - Issue affects both TypeScript and Python parsers equally

### Current Hypotheses

1. **Jest module loading incompatibility**:

   - Jest's module system may interfere with native module initialization
   - Module caching or transformation could be the culprit
   - The way Jest isolates test environments might affect native bindings

2. **Initialization timing issue**:

   - Parsers are initialized at module import time (not lazy)
   - Jest might be importing modules in a different order/context
   - Race condition between module loading and parser initialization

3. **ts-jest transformation side effects**:
   - Although we're testing compiled JS, ts-jest is still active
   - May affect how native modules are resolved or loaded

### Tests Created for Debugging

1. `scripts/test-jest-simulation.js` - Simulates Jest-like module loading
2. `jest.config.minimal.js` - Minimal Jest config without ts-jest
3. `test-parsers.test.js` - Simple JS test file to bypass TypeScript compilation
4. Various debug scripts to examine module loading and parser state

### Next Steps

1. Run tests with minimal Jest configuration
2. Try lazy initialization of parsers
3. Test with Jest's `--no-cache` flag
4. Consider alternative test runners if Jest proves incompatible
5. Investigate Jest's native module handling documentation

### Critical Finding: Jest Simulation Works Perfectly (2025-07-16)

The `test-jest-simulation.js` results are extremely revealing:

1. **All parsers work with simulated Jest-like behavior**:
   - Module cache clearing works fine
   - Rapid re-imports work fine
   - Async contexts work fine
   - TypeScript: 48ms, Python: 24ms parse times

2. **This definitively proves**:
   - The issue is NOT with module loading
   - The issue is NOT with native bindings
   - The issue is NOT with async execution
   - The issue is specifically with Jest's test runner itself

3. **Jest is doing something unique** that breaks tree-sitter:
   - Possibly related to Jest's VM contexts
   - Could be Jest's module mocking system
   - Might be Jest's worker process isolation

### Conclusion

The problem is a fundamental incompatibility between Jest and tree-sitter native modules. Since everything works outside of Jest (including Jest-like simulations), we should strongly consider moving to an alternative test runner rather than trying to make Jest work.

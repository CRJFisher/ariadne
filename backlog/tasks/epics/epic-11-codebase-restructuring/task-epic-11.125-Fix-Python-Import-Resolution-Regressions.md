# Task: Fix Python Import Resolution Regressions

**Status**: Completed
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-08
**Priority**: Medium
**Related**: task-epic-11.117 (Python module path resolution)

## Problem

Despite successful completion of task-epic-11.117 which fixed Python standalone script imports, **9 Python import resolution tests are currently failing** in the test suite.

### Failing Tests

File: [import_resolver.test.ts](packages/core/src/resolve_references/import_resolution/import_resolver.test.ts)

**Python Import Resolution failures (9 tests)**:

- `from` imports not resolving
- Absolute imports not resolving
- Relative parent imports not resolving
- Other import patterns failing

### Context

Task epic-11.117 successfully implemented:

- ✅ Fixed `find_python_project_root()` for standalone scripts
- ✅ Enabled 5 integration tests in `symbol_resolution.python.test.ts`
- ✅ Bare module imports working: `from helper import process`
- ✅ Relative imports working: `from .helper import process`
- ✅ Package-based imports working

However, the current test failures indicate either:

1. **Regression**: Changes after 2025-10-03 broke previously working functionality
2. **Different test scope**: `import_resolver.test.ts` tests different scenarios than the integration tests
3. **Incomplete coverage**: Task 11.117 focused on integration tests but didn't address all unit test cases

## Investigation Starting Point

### Review Task 11.117 Implementation

**Files modified in 11.117**:

- `packages/core/src/resolve_references/import_resolution/import_resolver.python.ts` - Fixed project root detection
- `packages/core/src/resolve_references/symbol_resolution.python.test.ts` - Enabled integration tests

**What was fixed**:

```typescript
// Added found_any_package flag to distinguish standalone vs package projects
let found_any_package = false;

if (start_is_package) found_any_package = true;
if (parent_is_package) found_any_package = true;

const result = found_any_package
  ? path.dirname(topmost_package) // Package-based
  : start_dir; // Standalone
```

### Identify Current Failures

Run the failing tests to understand what's broken:

```bash
npm test --workspace=packages/core -- import_resolver.test.ts -t "Python"
```

Expected output will show:

- Which specific import patterns are failing
- What the expected vs actual resolved paths are
- Whether this is a new issue or existing gap

## Root Cause Hypotheses

### Hypothesis 1: Test File Location Mismatch

The `import_resolver.test.ts` tests may use different test file structures than the integration tests. The resolver may be working correctly for real-world scenarios but failing for specific unit test setups.

**Investigation**: Check if test file paths in `import_resolver.test.ts` match the patterns that work in `symbol_resolution.python.test.ts`.

### Hypothesis 2: Missing Import Pattern Support

Task 11.117 focused on:

- Bare module imports (`helper`)
- Single-dot relative imports (`.helper`)
- Double-dot relative imports (`..helper`)

But may not have covered:

- `from` statement variations (`from X import Y` vs `import X`)
- Absolute package imports with dots (`from package.module import func`)
- Imports with `as` aliases
- Star imports (`from module import *`)

**Investigation**: Review which import patterns are tested in `import_resolver.test.ts` vs what 11.117 fixed.

### Hypothesis 3: Regression from Subsequent Changes

Changes made after task 11.117 (completed 2025-10-03) may have broken the implementation:

- Query file modifications
- Builder configuration changes
- Import path extraction logic changes
- Definition builder restructuring

**Investigation**: Review git history from 2025-10-03 onwards for changes to Python import handling.

### Hypothesis 4: Test Data Setup Issues

The test data in `import_resolver.test.ts` may have incorrect:

- File paths (relative vs absolute)
- Import path format (raw Python strings vs resolved paths)
- Expected resolution results

**Investigation**: Compare test data format in `import_resolver.test.ts` with working tests in `symbol_resolution.python.test.ts`.

## Investigation Steps

### 1. Run Failing Tests with Debug Output

```bash
# Run Python import tests with full output
npm test --workspace=packages/core -- import_resolver.test.ts -t "Python" --reporter=verbose

# Look for patterns in:
# - Expected paths
# - Actual paths
# - Import path formats
# - File locations
```

### 2. Compare Test Structures

**Read both test files**:

- `packages/core/src/resolve_references/import_resolution/import_resolver.test.ts` (failing)
- `packages/core/src/resolve_references/symbol_resolution.python.test.ts` (passing)

**Compare**:

- Test file path formats
- Import path strings
- Expected resolution results
- Test setup/teardown

### 3. Review 11.117 Scope

**Read task documentation**:

- `task-epic-11.117-Fix-Python-Module-Path-Resolution-for-Cross-File-Imports.md`
- `task-epic-11.117.1-Debug-and-Fix-Python-Module-Resolver-Implementation.md`
- `task-epic-11.117.2-Update-Python-Import-Resolver-Unit-Tests.md`

**Identify**:

- What was explicitly tested
- What was left as "follow-on work"
- Which test files were updated

### 4. Check for Regressions

```bash
# Review changes to Python import handling since 2025-10-03
git log --since="2025-10-03" --until="2025-10-08" -p -- \
  "packages/core/src/resolve_references/import_resolution/import_resolver.python.ts" \
  "packages/core/src/index_single_file/query_code_tree/queries/python.scm" \
  "packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts"
```

### 5. Run Subset of Tests

Test incrementally to isolate the issue:

```bash
# Test bare imports
npm test -- import_resolver.test.ts -t "Python.*bare"

# Test from imports
npm test -- import_resolver.test.ts -t "Python.*from"

# Test relative imports
npm test -- import_resolver.test.ts -t "Python.*relative"

# Test absolute imports
npm test -- import_resolver.test.ts -t "Python.*absolute"
```

## Solution Approach

### Option 1: Fix Regression (If Hypothesis 3)

If changes after 11.117 broke the implementation:

1. Identify the breaking commit
2. Understand why the change was made
3. Fix the implementation to support both old and new requirements
4. Verify all tests pass

### Option 2: Extend Implementation (If Hypothesis 2)

If 11.117 didn't cover all import patterns:

1. Identify which patterns are missing
2. Add support for those patterns in `import_resolver.python.ts`
3. Update unit tests to verify new patterns
4. Ensure no regression in integration tests

### Option 3: Fix Test Data (If Hypothesis 4)

If test data is incorrect:

1. Identify the correct test data format
2. Update `import_resolver.test.ts` to match working patterns
3. Document test data requirements
4. Verify tests pass with corrected data

### Option 4: Complete Test Coverage (If Hypothesis 1)

If tests are validly failing due to incomplete implementation:

1. Map failing tests to unsupported scenarios
2. Prioritize based on real-world usage
3. Implement missing scenarios
4. Update tests to reflect implementation status (skip if not yet supported)

## Implementation Tasks

### Phase 1: Diagnosis (2 hours)

- [ ] Run failing tests and capture detailed error output
- [ ] Compare test structures between failing and passing test files
- [ ] Review task 11.117 documentation and implementation
- [ ] Check git history for regressions
- [ ] Identify root cause hypothesis

### Phase 2: Fix Implementation (2-4 hours)

Depending on root cause:

**If Regression**:

- [ ] Revert or fix breaking changes
- [ ] Verify integration tests still pass
- [ ] Run full test suite

**If Missing Pattern Support**:

- [ ] Implement missing import patterns
- [ ] Add unit tests for new patterns
- [ ] Update integration tests if needed

**If Test Data Issues**:

- [ ] Correct test data in `import_resolver.test.ts`
- [ ] Document correct test data format
- [ ] Verify corrected tests pass

### Phase 3: Validation (1 hour)

- [ ] All Python tests in `import_resolver.test.ts` pass
- [ ] All Python integration tests in `symbol_resolution.python.test.ts` still pass
- [ ] No regressions in other language tests
- [ ] Document what was fixed

## Files to Investigate

### Implementation

- `packages/core/src/resolve_references/import_resolution/import_resolver.python.ts` - Main resolver
- `packages/core/src/resolve_references/import_resolution/import_resolver.ts` - Common import resolution
- `packages/core/src/index_single_file/query_code_tree/queries/python.scm` - Python query patterns
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_imports.ts` - Import handlers

### Tests

- `packages/core/src/resolve_references/import_resolution/import_resolver.test.ts` - Failing unit tests
- `packages/core/src/resolve_references/symbol_resolution.python.test.ts` - Passing integration tests
- `packages/core/src/resolve_references/import_resolution/import_resolver.python.test.ts` - Python-specific unit tests

### Documentation

- `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.117-Fix-Python-Module-Path-Resolution-for-Cross-File-Imports.md`
- `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.117.1-Debug-and-Fix-Python-Module-Resolver-Implementation.md`
- `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.117.2-Update-Python-Import-Resolver-Unit-Tests.md`
- `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.117.3-Validate-Python-Integration-Tests.md`

## Acceptance Criteria

- [ ] All 9 Python import tests in `import_resolver.test.ts` pass
- [ ] All Python integration tests in `symbol_resolution.python.test.ts` still pass (no regression)
- [ ] Root cause documented in task notes
- [ ] Fix documented with before/after behavior
- [ ] If gaps remain, they are documented as known limitations

## Success Metrics

**Before**:

- `import_resolver.test.ts`: 9 Python tests failing
- `symbol_resolution.python.test.ts`: 6/14 passing

**After**:

- `import_resolver.test.ts`: All Python tests passing
- `symbol_resolution.python.test.ts`: Still 6/14+ passing (no regression)
- Clear path to enabling remaining integration tests

## Priority Justification

**Medium Priority** because:

- Integration tests are passing (real-world scenarios work)
- May be test-specific issues rather than implementation bugs
- Should be fixed to ensure comprehensive test coverage
- Builds on substantial work from task 11.117

**Not High Priority** because:

- Core Python import functionality is working (per 11.117)
- Integration tests validate end-to-end scenarios
- May not block other work

## Estimated Effort

- Investigation: 2 hours
- Implementation: 2-4 hours (depends on root cause)
- Testing & validation: 1 hour
- Documentation: 0.5 hours

**Total**: 5.5-7.5 hours

## Notes

- Start by reading task 11.117 documentation thoroughly
- Focus on understanding what 11.117 did vs what's still failing
- May discover that failing tests need to be updated rather than implementation
- Document findings even if implementation changes aren't needed

## Implementation Notes (2025-10-08)

### Investigation Completed

**Task Status**: Completed - Task description was incorrect. No Python issues found.

**Finding**: All Python import resolution tests are **PASSING** (69/69 tests).

**Actual Issue**: The 6 failing tests are **TypeScript/JavaScript re-export chain tests**, not Python tests:

- Test file: `import_resolver.test.ts` (not language-specific)
- Failures: TypeScript/JS re-export chain resolution (export { x } from './y')
- Already tracked in: **task-epic-11.124** (TypeScript re-export chains)

**Root Cause of Confusion**: The test file `import_resolver.test.ts` includes a `language` parameter with "python" as an option, but all actual failing tests use TypeScript/JavaScript scenarios.

**Python Test Results**:

```bash
npm test -- import_resolver.python.test.ts
✓ 69 tests passed
```

**Verification**:

- ✅ `import_resolver.python.test.ts`: All 69 Python-specific tests passing
- ✅ `symbol_resolution.python.test.ts`: Integration tests passing (6/14, others skipped/todo as expected)
- ✅ Task 11.117 fixes remain stable - no regressions

**Conclusion**: No action needed. Python import resolution is working correctly. TypeScript re-export issues are tracked separately in task 11.124.

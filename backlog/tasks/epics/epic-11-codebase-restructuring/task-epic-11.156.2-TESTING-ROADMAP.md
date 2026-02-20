# Task Epic-11.156.2: Testing Roadmap Summary

**Parent Task**: task-epic-11.156.2-callback-invocation-detection.md
**Created**: 2025-11-13
**Status**: Sub-tasks created, execution pending

## Overview

This document provides a comprehensive roadmap for bringing callback detection testing up to production quality. Six sub-tasks have been created to systematically address all testing gaps.

## Sub-Task Breakdown

### 11.156.2.1: Migrate Orphan Test Files
**File**: `task-epic-11.156.2.1-migrate-orphan-test-files.md`
**Priority**: P0 (Blocks all other work)
**Effort**: 1-2 days
**Status**: TODO

**Objective**: Move tests from orphan files to proper companion test files

**Work Items**:
- Migrate 4 scope tests from verify_scopes.test.ts → semantic_index.<lang>.test.ts
- Migrate 7 tests from test_nested_scope.test.ts → semantic_index + project integration files
- Delete orphan files: test_nested_scope.test.ts, verify_scopes.test.ts
- Verify all tests pass after migration

**Dependencies**: None (critical path)

**Success Criteria**:
- All 11 tests migrated
- Both orphan files deleted
- No orphan imports remaining
- `npm test` passes

---

### 11.156.2.2: Unit Tests for detect_callback_context()
**File**: `task-epic-11.156.2.2-unit-tests-detect-callback-context.md`
**Priority**: P1 (High - Core functionality untested)
**Effort**: 1 day
**Status**: TODO

**Objective**: Create comprehensive unit tests for callback detection functions

**Work Items**:
- Create typescript_builder.test.ts (10+ tests)
- Create javascript_builder.test.ts (10+ tests)
- Create python_builder.test.ts (10+ tests)
- Create rust_builder_helpers.test.ts (10+ tests)
- Cover: callback detection, non-callback detection, edge cases, receiver location

**Dependencies**: task-epic-11.156.2.1 (orphan tests should be migrated first)

**Success Criteria**:
- 40+ unit tests created
- 100% coverage of detect_callback_context() functions
- All languages have equal coverage

---

### 11.156.2.3: Semantic Index Tests (Python/Rust)
**File**: `task-epic-11.156.2.3-semantic-index-callback-tests-python-rust.md`
**Priority**: P1 (High - Missing language coverage)
**Effort**: 1 day
**Status**: TODO

**Objective**: Add semantic index integration tests for Python and Rust callback detection

**Work Items**:
- Add 7+ tests to semantic_index.python.test.ts
  - Lambda in map, filter, sorted, reduce
  - Nested lambdas
  - Non-callback lambdas
- Add 7+ tests to semantic_index.rust.test.ts
  - Closures in iter().map, iter().filter, for_each, sort_by
  - Nested closures
  - Non-callback closures

**Dependencies**: task-epic-11.156.2.1 (test organization)

**Success Criteria**:
- 14+ semantic index tests added
- Python and Rust callback detection validated
- Fixture files utilized

---

### 11.156.2.4: Project Integration Tests (Python/Rust)
**File**: `task-epic-11.156.2.4-project-integration-callback-tests-python-rust.md`
**Priority**: P1 (High - Missing end-to-end testing)
**Effort**: 1-2 days
**Status**: TODO

**Objective**: Add end-to-end callback invocation tests for Python and Rust

**Work Items**:
- Create/update project.python.integration.test.ts (5+ tests)
  - External callback invocation
  - Internal callback handling
  - Entry point exclusion
  - Library function classification
- Create/update project.rust.integration.test.ts (4+ tests)
  - Similar coverage to Python

**Dependencies**: task-epic-11.156.2.3 (semantic tests should pass first)

**Success Criteria**:
- 9+ project integration tests added
- Callback invocation edges verified
- Entry point exclusion validated

---

### 11.156.2.5: Comprehensive Edge Case Tests
**File**: `task-epic-11.156.2.5-callback-edge-case-tests.md`
**Priority**: P2 (Medium - Ensures robustness)
**Effort**: 1-2 days
**Status**: TODO

**Objective**: Test complex and unusual callback scenarios

**Work Items**:
- Add 15+ edge case tests across all languages:
  - Deeply nested callbacks (3+ levels)
  - Callbacks with destructured parameters
  - Callbacks as second/third argument
  - Async callbacks (TypeScript/JavaScript)
  - Move closures (Rust)
  - Callbacks in chained method calls
  - Language-specific quirks

**Dependencies**: task-epic-11.156.2.2, 11.156.2.3, 11.156.2.4 (basic tests first)

**Success Criteria**:
- 15+ edge case tests added
- All edge cases pass
- Language-specific behaviors documented

---

### 11.156.2.6: Test Coverage Verification
**File**: `task-epic-11.156.2.6-test-coverage-verification.md`
**Priority**: P2 (Medium - Validation)
**Effort**: 0.5-1 day
**Status**: TODO

**Objective**: Verify comprehensive test coverage and document results

**Work Items**:
- Run test coverage analysis
- Create coverage matrix (language parity check)
- Verify 100% coverage of callback detection code
- Audit test organization (no orphans)
- Update TEST_MIGRATION_STATUS.md
- Create test coverage report in docs/testing/

**Dependencies**: All previous sub-tasks (11.156.2.1-11.156.2.5)

**Success Criteria**:
- 100% line and branch coverage
- Coverage report published
- All documentation updated
- Language parity verified

---

## Execution Strategy

### Sequential Execution (Recommended)

Execute sub-tasks in order due to dependencies:

1. **Week 1**: 11.156.2.1 + 11.156.2.2
   - Day 1-2: Migrate orphan tests
   - Day 3-5: Create unit tests

2. **Week 2**: 11.156.2.3 + 11.156.2.4
   - Day 1-2: Python/Rust semantic index tests
   - Day 3-5: Python/Rust project integration tests

3. **Week 3**: 11.156.2.5 + 11.156.2.6
   - Day 1-3: Edge case tests
   - Day 4-5: Coverage verification and documentation

### Parallel Execution (Advanced)

If multiple developers available:

**Track 1** (Developer A):
- 11.156.2.1 → 11.156.2.3 → 11.156.2.5 (semantic focus)

**Track 2** (Developer B):
- 11.156.2.2 → 11.156.2.4 → 11.156.2.6 (integration focus)

**Coordination points**:
- After 11.156.2.1: Both tracks can start
- After 11.156.2.5: Merge for 11.156.2.6

---

## Expected Test Count

After all sub-tasks complete:

| Test Type           | TypeScript | JavaScript | Python | Rust | Total |
|---------------------|------------|------------|--------|------|-------|
| Unit                | 10         | 10         | 10     | 10   | 40    |
| Semantic Index      | 7          | 7          | 7      | 7    | 28    |
| Project Integration | 5          | 5          | 5      | 4    | 19    |
| Edge Cases          | 5          | 5          | 3      | 4    | 17    |
| **Total**           | **27**     | **27**     | **25** | **25**| **104** |

**Migrated from orphans**: 11 tests
**Net new tests**: 93 tests
**Total callback tests**: 104 tests

---

## Success Criteria (Overall)

- [ ] All 6 sub-tasks completed
- [ ] 104+ callback-related tests created/migrated
- [ ] 100% coverage of callback detection code
- [ ] Language parity achieved (all 4 languages tested equally)
- [ ] All orphan test files deleted
- [ ] Test organization follows companion file pattern
- [ ] Documentation updated (TEST_MIGRATION_STATUS.md, coverage report)
- [ ] All tests pass: `npm test`

---

## Risk Mitigation

**Risk 1**: Test migration causes failures
- **Mitigation**: Execute 11.156.2.1 first, fix all issues before proceeding
- **Fallback**: Revert migration, debug in isolation

**Risk 2**: Coverage tools not working
- **Mitigation**: Install and configure coverage tools early (11.156.2.6)
- **Fallback**: Manual coverage analysis via code inspection

**Risk 3**: Language-specific edge cases break
- **Mitigation**: Start with basic tests (11.156.2.2-11.156.2.4), add edge cases later (11.156.2.5)
- **Fallback**: Mark edge case tests as TODO, file follow-up issues

**Risk 4**: Time estimates too aggressive
- **Mitigation**: Focus on P0/P1 tasks first (11.156.2.1-11.156.2.4)
- **Fallback**: Defer P2 tasks (11.156.2.5-11.156.2.6) to separate sprint

---

## Related Documentation

- **Migration plan**: migrate_tests.md
- **Migration status**: TEST_MIGRATION_STATUS.md
- **Fixture files**:
  - packages/core/tests/fixtures/typescript/callbacks.ts
  - packages/core/tests/fixtures/javascript/callbacks.js
  - packages/core/tests/fixtures/python/callbacks.py
  - packages/core/tests/fixtures/rust/functions_and_closures.rs

---

## Tracking

Use backlog commands to track progress:

```bash
# List all sub-tasks
backlog task list --epic epic-11 --plain | grep "11.156.2"

# View specific sub-task
backlog task view 11.156.2.1

# Update status
backlog task edit 11.156.2.1 -s "In Progress"
backlog task edit 11.156.2.1 -s "Completed"
```

---

## Notes

- **Incremental progress**: Each sub-task can be committed independently
- **Test early, test often**: Run `npm test` after each change
- **Document surprises**: If edge cases reveal unexpected behavior, document in task notes
- **Keep coverage high**: Maintain 100% coverage as new tests are added

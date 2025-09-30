# Task: Verify All Tests After Capture Name Fixes

**Status**: Not Started
**Priority**: High
**Epic**: 11 - Codebase Restructuring
**Parent**: task-epic-11.103

## Objective

Run comprehensive test suite after all capture name fixes to ensure nothing broke.

## Test Categories

### Semantic Index Tests

- [ ] JavaScript semantic index tests
- [ ] TypeScript semantic index tests
- [ ] Python semantic index tests
- [ ] Rust semantic index tests

### Builder Tests

- [ ] JavaScript builder tests
- [ ] TypeScript builder tests
- [ ] Python builder tests
- [ ] Rust builder tests

### Integration Tests

- [ ] Cross-file resolution tests
- [ ] Import/export resolution tests
- [ ] Type resolution tests
- [ ] Call graph tests

### Validation

- [ ] Run validation script - should report 0 invalid captures
- [ ] Check for any runtime errors in capture processing
- [ ] Verify no regressions in existing functionality

## Performance Check

- Compare test execution time before/after
- Ensure no significant performance degradation
- Check memory usage during semantic indexing

## Acceptance Criteria

- [ ] All test suites pass
- [ ] Validation script reports 0 invalid captures across all languages
- [ ] No performance regressions
- [ ] Documentation updated if capture name patterns changed significantly

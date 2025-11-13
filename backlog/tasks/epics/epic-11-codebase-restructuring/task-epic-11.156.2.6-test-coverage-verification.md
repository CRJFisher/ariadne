# Task Epic-11.156.2.6: Test Coverage Verification and Documentation

**Status**: TODO
**Priority**: P2 (Medium - Validation and documentation)
**Estimated Effort**: 0.5-1 day
**Parent Task**: task-epic-11.156.2 (Callback Invocation Detection)
**Depends On**:
- task-epic-11.156.2.1 (Migrate orphan tests)
- task-epic-11.156.2.2 (Unit tests)
- task-epic-11.156.2.3 (Semantic index tests)
- task-epic-11.156.2.4 (Project integration tests)
- task-epic-11.156.2.5 (Edge case tests)
**Epic**: epic-11-codebase-restructuring

## Problem

After implementing all callback detection tests, we need to verify that:
- Test coverage is comprehensive across all languages
- All code paths in callback detection are tested
- No gaps exist in the test suite
- Test organization follows codebase patterns
- All tests pass consistently

Without verification:
- Untested code paths may contain bugs
- Coverage gaps won't be discovered until production
- Test suite quality is unknown
- Regressions may slip through

## Scope

This task focuses on verification and documentation, not new test creation:
1. Run test coverage analysis
2. Identify untested code paths
3. Verify language parity (all languages have equal coverage)
4. Document test organization
5. Create test coverage report
6. Update TEST_MIGRATION_STATUS.md

## Coverage Analysis Steps

### Step 1: Run Test Coverage Tool

Use Vitest coverage (or similar) to analyze test coverage:

```bash
# Install coverage tool if needed
npm install --save-dev @vitest/coverage-v8

# Run tests with coverage
npm test -- --coverage

# Generate coverage report
npm test -- --coverage --reporter=html
```

### Step 2: Analyze detect_callback_context() Coverage

For each language, verify 100% coverage of detect_callback_context():

**Files to check**:
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts:726-761`
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts:834-869`
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts:623-657`
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts:1071-1111`

**Coverage checklist per function**:
- [ ] Every branch tested (if/else, while loops)
- [ ] Edge cases tested (null checks, depth limits)
- [ ] Return statements tested (callback vs non-callback paths)
- [ ] Error handling tested (if applicable)

### Step 3: Analyze resolve_callback_invocations() Coverage

Verify coverage of callback classification and invocation logic:

**File**: `packages/core/src/resolve_references/resolution_registry.ts:594-688`

**Coverage checklist**:
- [ ] External function classification path tested
- [ ] Internal function classification path tested
- [ ] Callback invocation creation tested
- [ ] Edge cases tested (null checks, empty lists)

### Step 4: Language Parity Check

Create a coverage matrix to ensure equal coverage across languages:

```markdown
## Coverage Matrix

| Test Type                  | TypeScript | JavaScript | Python | Rust |
|----------------------------|------------|------------|--------|------|
| Unit: detect_callback      | ✅ 10 tests | ✅ 10 tests | ✅ 10 tests | ✅ 10 tests |
| Semantic: callback detect  | ✅ 7 tests  | ✅ 7 tests  | ✅ 7 tests  | ✅ 7 tests  |
| Project: callback invoke   | ✅ 5 tests  | ✅ 5 tests  | ✅ 5 tests  | ✅ 4 tests  |
| Edge cases                 | ✅ 5 tests  | ✅ 5 tests  | ✅ 3 tests  | ✅ 4 tests  |
| **Total**                  | **27**     | **27**     | **25**     | **25**     |
| **Line Coverage**          | 100%       | 100%       | 100%       | 100%       |
| **Branch Coverage**        | 100%       | 100%       | 100%       | 100%       |
```

### Step 5: Test Organization Audit

Verify all tests follow companion file pattern:

```bash
# Check for orphan test files
find packages/core/src -name "*.test.ts" -type f | while read test_file; do
  # Extract base name without .test.ts
  base=$(echo $test_file | sed 's/\.test\.ts$/\.ts/')

  # Check if corresponding source file exists
  if [ ! -f "$base" ]; then
    echo "ORPHAN: $test_file (no corresponding $base)"
  fi
done

# Expected output: No orphan files (verify_scopes.test.ts and test_nested_scope.test.ts deleted)
```

### Step 6: Test Consistency Check

Verify test naming and structure consistency:

```bash
# Check for consistent test naming
grep -r "describe.*Callback" packages/core/src --include="*.test.ts" | \
  awk -F':' '{print $2}' | \
  sort | \
  uniq -c

# Expected patterns:
# - "Callback context detection"
# - "Callback detection and invocation"
# - "Callback edge cases"
```

## Documentation Tasks

### Task 1: Update TEST_MIGRATION_STATUS.md

Mark all tasks as complete:

```markdown
## Completed

✅ **Orphan Test Files Migrated**:
- verify_scopes.test.ts → semantic_index.<lang>.test.ts (4 tests)
- test_nested_scope.test.ts → semantic_index + project tests (7 tests)
- Files deleted: test_nested_scope.test.ts, verify_scopes.test.ts

✅ **Unit Tests Created**:
- typescript_builder.test.ts (10 tests)
- javascript_builder.test.ts (10 tests)
- python_builder.test.ts (10 tests)
- rust_builder_helpers.test.ts (10 tests)

✅ **Semantic Index Tests Added**:
- Python: 7 callback detection tests
- Rust: 7 callback detection tests

✅ **Project Integration Tests Added**:
- Python: 5 callback invocation tests
- Rust: 4 callback invocation tests

✅ **Edge Case Tests Added**:
- TypeScript: 5 edge case tests
- JavaScript: 5 edge case tests
- Python: 3 edge case tests
- Rust: 4 edge case tests

✅ **Coverage Verification**:
- All detect_callback_context() functions: 100% coverage
- resolve_callback_invocations(): 100% coverage
- All tests pass: ✓
```

### Task 2: Create Test Coverage Report

Create `docs/testing/callback_detection_test_coverage.md`:

```markdown
# Callback Detection Test Coverage Report

Generated: [Date]

## Summary

- **Total Tests**: 104 callback-related tests
- **Line Coverage**: 100% for callback detection code
- **Branch Coverage**: 100% for callback detection code
- **Languages Covered**: TypeScript, JavaScript, Python, Rust

## Test Distribution

### Unit Tests (40 tests)
- TypeScript: 10 tests (typescript_builder.test.ts)
- JavaScript: 10 tests (javascript_builder.test.ts)
- Python: 10 tests (python_builder.test.ts)
- Rust: 10 tests (rust_builder_helpers.test.ts)

### Semantic Index Tests (28 tests)
- TypeScript: 7 tests (semantic_index.typescript.test.ts)
- JavaScript: 7 tests (semantic_index.javascript.test.ts)
- Python: 7 tests (semantic_index.python.test.ts)
- Rust: 7 tests (semantic_index.rust.test.ts)

### Project Integration Tests (19 tests)
- TypeScript: 5 tests (project.typescript.integration.test.ts)
- JavaScript: 5 tests (project.javascript.integration.test.ts)
- Python: 5 tests (project.python.integration.test.ts)
- Rust: 4 tests (project.rust.integration.test.ts)

### Edge Case Tests (17 tests)
- TypeScript: 5 tests
- JavaScript: 5 tests
- Python: 3 tests
- Rust: 4 tests

## Coverage Gaps (None)

All identified code paths are covered by tests.

## Recommendations

1. **Monitor coverage**: Re-run coverage analysis after any callback detection changes
2. **Add tests proactively**: When adding new callback patterns, add tests first (TDD)
3. **Cross-language consistency**: Maintain language parity when adding tests
```

### Task 3: Update Parent Task Documentation

Update task-epic-11.156.2-callback-invocation-detection.md with final test summary:

```markdown
## Testing Summary

### Test Coverage Achieved

- **Unit Tests**: 40 tests across 4 languages
- **Semantic Index Tests**: 28 tests across 4 languages
- **Project Integration Tests**: 19 tests across 4 languages
- **Edge Case Tests**: 17 tests across 4 languages
- **Total**: 104 callback-related tests
- **Coverage**: 100% line and branch coverage

### Test Files Modified

1. typescript_builder.test.ts (created)
2. javascript_builder.test.ts (created)
3. python_builder.test.ts (created)
4. rust_builder_helpers.test.ts (created)
5. semantic_index.typescript.test.ts (added callback tests)
6. semantic_index.javascript.test.ts (added callback tests)
7. semantic_index.python.test.ts (added callback tests)
8. semantic_index.rust.test.ts (added callback tests)
9. project.typescript.integration.test.ts (added callback tests)
10. project.javascript.integration.test.ts (added callback tests)
11. project.python.integration.test.ts (added callback tests)
12. project.rust.integration.test.ts (added callback tests)

### Test Files Deleted

1. test_nested_scope.test.ts (migrated)
2. verify_scopes.test.ts (migrated)
```

## Success Criteria

- [ ] Test coverage analysis run successfully
- [ ] All detect_callback_context() functions have 100% coverage
- [ ] resolve_callback_invocations() has 100% coverage
- [ ] Language parity verified (all languages have similar test counts)
- [ ] No orphan test files remain
- [ ] Test naming is consistent across files
- [ ] TEST_MIGRATION_STATUS.md updated
- [ ] Coverage report created in docs/testing/
- [ ] Parent task documentation updated
- [ ] All tests pass: `npm test`

## Execution Steps

1. **Install coverage tool** (if not installed):
   ```bash
   npm install --save-dev @vitest/coverage-v8
   ```

2. **Run coverage analysis**:
   ```bash
   npm test -- --coverage
   ```

3. **Review coverage report**:
   - Open HTML report in browser
   - Check detect_callback_context() coverage for each language
   - Check resolve_callback_invocations() coverage
   - Identify any untested lines

4. **Create coverage matrix**:
   - Count tests per category per language
   - Create markdown table
   - Verify language parity

5. **Audit test organization**:
   - Run orphan file check script
   - Verify companion file pattern
   - Check test naming consistency

6. **Document findings**:
   - Update TEST_MIGRATION_STATUS.md
   - Create coverage report in docs/testing/
   - Update parent task documentation

7. **Final verification**:
   ```bash
   npm test
   ```
   - All tests pass
   - No failures or warnings

8. **Commit**:
   ```bash
   git add .
   git commit -m "docs(testing): Add callback detection test coverage report and verification"
   ```

## Related Tasks

- **task-epic-11.156.2.1**: Orphan test migration (verify deletion)
- **task-epic-11.156.2.2**: Unit tests (verify coverage)
- **task-epic-11.156.2.3**: Semantic index tests (verify coverage)
- **task-epic-11.156.2.4**: Project integration tests (verify coverage)
- **task-epic-11.156.2.5**: Edge case tests (verify coverage)

## Notes

- **Coverage thresholds**: Aim for 100% line and branch coverage for callback detection code
- **Exclude non-callback code**: Focus coverage analysis on callback-specific code paths
- **Document gaps**: If any gaps found, create follow-up tasks
- **Regression testing**: Re-run coverage analysis periodically to catch regressions
- **Performance**: Note test execution time to detect performance regressions

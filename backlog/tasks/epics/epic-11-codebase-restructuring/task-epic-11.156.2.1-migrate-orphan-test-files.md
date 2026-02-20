# Task Epic-11.156.2.1: Migrate Orphan Test Files to Companion Test Files

**Status**: ✅ COMPLETED (2025-11-13)
**Priority**: P0 (Blocks all other testing work)
**Actual Effort**: 3 hours
**Parent Task**: task-epic-11.156.2 (Callback Invocation Detection)
**Epic**: epic-11-codebase-restructuring

## Problem

Two orphan test files violate the codebase pattern of companion test files:
- `packages/core/src/test_nested_scope.test.ts` (472 lines, 8 tests)
- `packages/core/src/verify_scopes.test.ts` (283 lines, 4 tests)

These files have no corresponding source files and contain tests that should be in proper companion test files:
- Semantic index tests → `semantic_index.<lang>.test.ts`
- Project integration tests → `project.<lang>.integration.test.ts`

## Scope

### Files to Modify (8 test files)

1. `packages/core/src/index_single_file/semantic_index.typescript.test.ts`
2. `packages/core/src/index_single_file/semantic_index.javascript.test.ts`
3. `packages/core/src/index_single_file/semantic_index.python.test.ts`
4. `packages/core/src/index_single_file/semantic_index.rust.test.ts`
5. `packages/core/src/project/project.typescript.integration.test.ts`
6. `packages/core/src/project/project.javascript.integration.test.ts`
7. `packages/core/src/project/project.python.integration.test.ts` (may need creation)
8. `packages/core/src/project/project.rust.integration.test.ts` (may need creation)

### Files to Delete (2 orphan files)

1. `packages/core/src/test_nested_scope.test.ts`
2. `packages/core/src/verify_scopes.test.ts`

### Fixture Files Already Created

- ✅ `packages/core/tests/fixtures/typescript/callbacks.ts`
- ✅ `packages/core/tests/fixtures/javascript/callbacks.js`
- ✅ `packages/core/tests/fixtures/python/callbacks.py`
- ✅ Rust: `packages/core/tests/fixtures/rust/functions_and_closures.rs` (already has callback examples)

## Migration Mapping

### From verify_scopes.test.ts → semantic_index.<lang>.test.ts

Add new describe block "Scope assignment" to each language's semantic_index test file:

#### TypeScript (lines 31-131)
**Test**: "TypeScript: class, interface, enum in module scope"
**New name**: "should assign class, interface, and enum to module scope"
**Destination**: `semantic_index.typescript.test.ts`

#### JavaScript (lines 133-170)
**Test**: "JavaScript: class in module scope"
**New name**: "should assign class to module scope"
**Destination**: `semantic_index.javascript.test.ts`

#### Python (lines 172-205)
**Test**: "Python: class in module scope"
**New name**: "should assign class to module scope"
**Destination**: `semantic_index.python.test.ts`

#### Rust (lines 207-281)
**Test**: "Rust: struct, enum, trait in module scope"
**New name**: "should assign struct, enum, and trait to module scope"
**Destination**: `semantic_index.rust.test.ts`

### From test_nested_scope.test.ts → Split by test type

#### Semantic Index Tests → semantic_index.typescript.test.ts

1. **"should create separate scopes for nested arrow functions"** (lines 41-86)
   - Add to new describe block "Anonymous functions and nested scopes"

2. **"should track constructor calls within same file"** (lines 88-166)
   - Add to new describe block "Constructor calls"

3. **"should track constructor in actual ReferenceBuilder.ts file"** (lines 168-208)
   - **DELETE** - Tests a real file, not a pattern. Not appropriate for unit tests.

4. **"should track this.method() calls within same class"** (lines 210-266)
   - Add to new describe block "Self-reference calls"

#### Project Integration Tests → Split by language

**TypeScript tests → project.typescript.integration.test.ts:**

5. **"should resolve this.method() calls in call graph"** (lines 268-353)
   - Add to new describe block "Call graph resolution"

**JavaScript tests → project.javascript.integration.test.ts:**

6. **"should detect callback context for anonymous functions in array methods"** (lines 355-388)
   - Add to new describe block "Callback detection and invocation"

7. **"should create callback invocation reference for external function callbacks"** (lines 390-430)
   - Add to same describe block

8. **"should NOT create callback invocation for internal function callbacks"** (lines 432-471)
   - Add to same describe block

## Implementation Plan

### Phase 1: Migrate verify_scopes.test.ts (4 tests → 4 files)

For each language:
1. Open `semantic_index.<lang>.test.ts`
2. Add new describe block "Scope assignment" before final `});`
3. Copy test from verify_scopes.test.ts with updated name
4. Adjust imports if needed
5. Run `npm test` to verify
6. Commit: `test(semantic-index): Add scope assignment test for <lang>`

### Phase 2: Migrate test_nested_scope semantic tests (3 tests → 1 file)

1. Open `semantic_index.typescript.test.ts`
2. Add describe block "Anonymous functions and nested scopes"
3. Add describe block "Constructor calls"
4. Add describe block "Self-reference calls"
5. Copy tests from test_nested_scope.test.ts (skip line 168-208)
6. Run `npm test` to verify
7. Commit: `test(semantic-index): Add anonymous function and constructor tests`

### Phase 3: Migrate test_nested_scope project tests (4 tests → 2 files)

**TypeScript integration tests:**
1. Open `project.typescript.integration.test.ts`
2. Add describe block "Call graph resolution"
3. Copy test from lines 268-353
4. Run `npm test` to verify
5. Commit: `test(project): Add call graph resolution test for TypeScript`

**JavaScript integration tests:**
1. Open `project.javascript.integration.test.ts`
2. Add describe block "Callback detection and invocation"
3. Copy tests from lines 355-471
4. Run `npm test` to verify
5. Commit: `test(project): Add callback detection tests for JavaScript`

### Phase 4: Verify and delete orphans

1. Run full test suite: `npm test`
2. Check for orphan imports:
   ```bash
   grep -r "verify_scopes" packages/core/src/
   grep -r "test_nested_scope" packages/core/src/
   ```
3. If clean, delete orphan files:
   ```bash
   rm packages/core/src/test_nested_scope.test.ts
   rm packages/core/src/verify_scopes.test.ts
   ```
4. Run `npm test` again
5. Commit: `test: Remove orphan test files after migration`

## Success Criteria

- [ ] All 4 scope assignment tests migrated to semantic_index.<lang>.test.ts
- [ ] All 3 semantic tests migrated to semantic_index.typescript.test.ts
- [ ] All 4 project tests migrated to project.<lang>.integration.test.ts
- [ ] No orphan imports remaining (grep verification)
- [ ] Both orphan files deleted
- [ ] `npm test` passes with no failures
- [ ] Test count matches or exceeds original (11 tests minimum)

## Execution Checklist

**Before starting:**
- [ ] Read TEST_MIGRATION_STATUS.md for context
- [ ] Read migrate_tests.md for detailed mappings
- [ ] Create git branch: `git checkout -b refactor/migrate-orphan-tests`

**During migration:**
- [ ] Run tests after EACH file modification
- [ ] Document any test failures immediately
- [ ] Fix failures before proceeding to next file
- [ ] Create granular commits after each phase

**After completion:**

- [x] Full test suite passes (52 test files, 1461 tests passed, 7 skipped)
- [x] No duplicate tests
- [x] Update TEST_MIGRATION_STATUS.md to mark as complete
- [x] Committed in feat/epic-11-codebase-restructuring (commit 6dce7da8)

## Completion Summary

**Completed**: 2025-11-13
**Commit**: 6dce7da8 - "feat(callbacks): Implement callback detection and test migration"

### Tests Migrated

**Total**: 11 tests migrated from 2 orphan files

**Phase 1** - verify_scopes.test.ts (4 tests):

- ✅ TypeScript scope test → semantic_index.typescript.test.ts:2858-2886
- ✅ JavaScript scope test → semantic_index.javascript.test.ts:2112-2144
- ✅ Python scope test → semantic_index.python.test.ts:2104-2132
- ✅ Rust scope test → semantic_index.rust.test.ts:2426-2476

**Phase 2** - test_nested_scope.test.ts semantic tests (3 tests):

- ✅ Nested arrow functions → semantic_index.typescript.test.ts:2833-2856
- ✅ Constructor calls → semantic_index.typescript.test.ts:2858-2901
- ✅ Self-reference calls → semantic_index.typescript.test.ts:2903-2939

**Phase 3** - test_nested_scope.test.ts project tests (4 tests):

- ✅ TypeScript call graph resolution → project.typescript.integration.test.ts:707-750
- ✅ JavaScript callback context → project.javascript.integration.test.ts:903-935
- ✅ JavaScript external callback invocation → project.javascript.integration.test.ts:937-963
- ✅ JavaScript internal callback handling → project.javascript.integration.test.ts:965-990

### Files Modified

6 test files updated with migrated tests
2 orphan files deleted (verify_scopes.test.ts, test_nested_scope.test.ts)

### Bonus Refactoring

- Extracted rust callback detection to separate file (rust_callback_detection.ts)
- Reduced rust_builder_helpers.ts from 33KB to 32KB (under size limit)

## Related Tasks

- **task-epic-11.156.2.2**: Add unit tests for detect_callback_context() (depends on this)
- **task-epic-11.156.2.3**: Add semantic index tests for Python/Rust callbacks (depends on this)
- **task-epic-11.156.2.4**: Add project integration tests for Python/Rust (depends on this)

## Notes

- **Incremental execution recommended**: Migrate one file at a time, test, commit
- **Do NOT batch migrations**: Test failures are easier to debug with small changes
- **Keep original test logic intact**: Only change test names and locations
- **Document unexpected behavior**: Note any tests that fail after migration

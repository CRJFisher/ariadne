# Test Migration Status

## Overview

This document tracks the migration of orphan test files to proper companion test files following the codebase pattern.

**Status**: ✅ **COMPLETED** (2025-11-13)

## Completed Migrations

### Phase 1: verify_scopes.test.ts (4 tests migrated)

✅ **TypeScript scope test** → [semantic_index.typescript.test.ts:2858-2886](packages/core/src/index_single_file/semantic_index.typescript.test.ts#L2858-L2886)
- Test: "should assign class, interface, and enum to module scope"
- Verifies class, interface, enum definitions are assigned to module scope

✅ **JavaScript scope test** → [semantic_index.javascript.test.ts:2112-2144](packages/core/src/index_single_file/semantic_index.javascript.test.ts#L2112-L2144)
- Test: "should assign class to module scope"
- Verifies class definitions are assigned to module scope

✅ **Python scope test** → [semantic_index.python.test.ts:2104-2132](packages/core/src/index_single_file/semantic_index.python.test.ts#L2104-L2132)
- Test: "should assign class to module scope"
- Verifies class definitions are assigned to module scope

✅ **Rust scope test** → [semantic_index.rust.test.ts:2426-2476](packages/core/src/index_single_file/semantic_index.rust.test.ts#L2426-L2476)
- Test: "should assign struct, enum, and trait to module scope"
- Verifies struct, enum, trait definitions are assigned to module scope

### Phase 2: test_nested_scope.test.ts - Semantic tests (3 tests migrated)

✅ **Nested arrow functions** → [semantic_index.typescript.test.ts:2833-2856](packages/core/src/index_single_file/semantic_index.typescript.test.ts#L2833-L2856)
- Test: "should create separate scopes for nested arrow functions"
- Verifies nested function scopes are created correctly

✅ **Constructor calls** → [semantic_index.typescript.test.ts:2858-2901](packages/core/src/index_single_file/semantic_index.typescript.test.ts#L2858-L2901)
- Test: "should track constructor calls within same file"
- Verifies constructor call references are created

✅ **Self-reference calls (this.method())** → [semantic_index.typescript.test.ts:2903-2939](packages/core/src/index_single_file/semantic_index.typescript.test.ts#L2903-L2939)
- Test: "should track this.method() calls within same class"
- Verifies self-reference calls are captured

### Phase 3: test_nested_scope.test.ts - Project integration tests (4 tests migrated)

✅ **TypeScript call graph resolution** → [project.typescript.integration.test.ts:707-750](packages/core/src/project/project.typescript.integration.test.ts#L707-L750)
- Test: "should resolve this.method() calls in call graph"
- Verifies this.method() calls are resolved and excluded from entry points

✅ **JavaScript callback context detection** → [project.javascript.integration.test.ts:903-935](packages/core/src/project/project.javascript.integration.test.ts#L903-L935)
- Test: "should detect callback context for anonymous functions in array methods"
- Verifies callback_context field is populated for callbacks

✅ **JavaScript external callback invocation** → [project.javascript.integration.test.ts:937-963](packages/core/src/project/project.javascript.integration.test.ts#L937-L963)
- Test: "should create callback invocation reference for external function callbacks"
- Verifies is_callback_invocation flag is set for external callbacks

✅ **JavaScript internal callback handling** → [project.javascript.integration.test.ts:965-990](packages/core/src/project/project.javascript.integration.test.ts#L965-L990)
- Test: "should NOT create callback invocation for internal function callbacks"
- Verifies internal callbacks do NOT create invocation references

## Deleted Files

✅ **verify_scopes.test.ts** - Deleted after migrating all 4 tests
✅ **test_nested_scope.test.ts** - Deleted after migrating all 7 tests

## Verification

✅ **All tests pass**: 52 test files, 1461 tests passed, 7 skipped
✅ **No orphan test files**: Both orphan files successfully deleted
✅ **No orphan imports**: No references to deleted files found in codebase

## Summary

- **Total tests migrated**: 11
- **Test files modified**: 6
  - semantic_index.typescript.test.ts
  - semantic_index.javascript.test.ts
  - semantic_index.python.test.ts
  - semantic_index.rust.test.ts
  - project.typescript.integration.test.ts
  - project.javascript.integration.test.ts
- **Orphan files deleted**: 2
- **Test suite status**: ✅ All passing

## Next Steps

The following sub-tasks under epic-11.156.2 remain to complete comprehensive callback detection testing:

- **task-epic-11.156.2.2**: Create unit tests for detect_callback_context() (40+ tests)
- **task-epic-11.156.2.3**: Add semantic index callback tests for Python/Rust (14+ tests)
- **task-epic-11.156.2.4**: Add project integration callback tests for Python/Rust (9+ tests)
- **task-epic-11.156.2.5**: Add edge case tests (17+ tests)
- **task-epic-11.156.2.6**: Verify test coverage and create documentation

Total expected tests after all sub-tasks: 104 callback-related tests

# Task epic-11.146: Triage all skipped test cases

**Status:** Not Started
**Epic:** epic-11 - Codebase Restructuring

## Overview

Systematically triage 228 skipped tests across the codebase. Each skipped test should either be:
1. **Fixed** - Add proper setup/context to make it pass
2. **Deleted** - If testing obsolete functionality or covered elsewhere

Excludes 4 `.todo()` tests which mark planned features that require other work first.

## Test Groups to Triage

### Total: 228 skipped tests

1. **query_loader.test.ts**: 76 tests - Worker crash issue
2. **javascript_builder.test.ts**: 32 tests - Need scope setup
3. **python_builder.test.ts**: 56 tests - Need scope setup
4. **rust_builder.test.ts**: 48 tests - Need scope setup
5. **member_extraction.test.ts**: 7 tests - Blocked by missing semantic_index features
6. **reference_builder.test.ts**: 7 tests - Testing unimplemented features
7. **Edge cases**: 2 tests - Various issues

## Goal

100% of non-todo tests either:
- ✅ Passing with proper setup/context
- 🗑️ Deleted with clear justification in commit message

## Sub-tasks

- [ ] 11.146.1: Fix query_loader.test.ts worker crash issue (76 tests)
- [ ] 11.146.2: Fix javascript_builder.test.ts scope setup (32 tests)
- [ ] 11.146.3: Fix python_builder.test.ts scope setup (56 tests)
- [ ] 11.146.4: Fix rust_builder.test.ts scope setup (48 tests)
- [ ] 11.146.5: Triage member_extraction.test.ts skipped tests (7 tests)
- [ ] 11.146.6: Triage reference_builder.test.ts skipped tests (7 tests)
- [ ] 11.146.7: Fix or delete edge case skipped tests (2 tests)

## Success Criteria

- [ ] All 228 skipped tests are either passing or explicitly deleted
- [ ] Clear documentation for why any tests were deleted
- [ ] Test coverage remains comprehensive (no functionality left untested)
- [ ] All `.skip()` calls removed from codebase (except `.todo()`)

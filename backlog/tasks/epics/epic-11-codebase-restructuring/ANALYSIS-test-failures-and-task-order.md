# Epic-11 Test Failures & Task Order Analysis

**Date**: 2025-10-08
**Status**: Complete

## Executive Summary

After running the full test suite and analyzing outstanding tasks 11.123-11.127, I've identified:

- **5 real test failures** requiring fixes (grouped into 2 root causes)
- **12 broken MCP tests** that need deletion/rewrite
- **4 outstanding tasks** requiring analysis
- **2 new bug fix tasks** to be created

## Test Failure Analysis

### Test Run Summary

```
@ariadnejs/core:     218 tests | 5 failed | 213 passed
@ariadnejs/mcp:      49 tests  | 12 failed | 1 passed | 36 skipped
@ariadnejs/types:    13 tests  | 0 failed | 13 passed
```

## Root Cause Groups

### ROOT CAUSE #1: Function Return Type Tracking Not Implemented

**Severity**: Medium
**Affected Tests**: 4 failures in type_context.test.ts

#### Failures:

1. TypeScript: "should track function return type annotation"

   - Expected: `class:test.ts:2:7:2:12:Result`
   - Actual: `null`

2. Python: "should track function return type hint"

   - Expected: `class:test.py:2:7:2:12:Result`
   - Actual: `null`

3. Rust: "should track function return type"
   - Expected: `class:test.rs:2:1:4:1:Result`
   - Actual: `null`

#### Test Pattern:

All three tests follow the same pattern:

```typescript
// TypeScript example
function process(): Result { ... }

// Test expects:
const return_type = type_context.get_type(process_fn);
expect(return_type).toBe(result_class.symbol_id);  // FAILS - returns null
```

#### Root Cause:

The `type_context` module tracks:

- ✅ Variable type annotations (`let x: Type`)
- ✅ Parameter type annotations (`fn(x: Type)`)
- ❌ **Function return types** (`fn(): Type`)

**Missing functionality**: Function return type extraction and tracking.

#### Impact:

- Type-based method resolution incomplete
- Call graph analysis cannot infer return types
- Type inference chains broken
- Medium priority - affects type analysis accuracy

#### Recommendation:

**CREATE NEW TASK**: "Implement Function Return Type Tracking"

- Add return type extraction to type_context
- Support TypeScript, Python, Rust return type annotations
- Update type_context tests

---

### ROOT CAUSE #2: Python Parameter Capture Missing in Test

**Severity**: Low
**Affected Tests**: 1 failure in type_context.test.ts

#### Failure:

Python: "should track parameter type hint"

- Expected: `data_param` to be defined
- Actual: `undefined`

#### Test Code:

```python
def process(data: DataType) -> Result:
    return Result()

# Test expects:
const data_param = process_fn.parameters.find(p => p.name === "data");
expect(data_param).toBeDefined();  // FAILS - undefined
```

#### Root Cause Analysis:

This could be:

1. Python parameter capture not working (unlikely - other param tests pass)
2. Test setup issue (more likely)
3. Function definition not being captured correctly

**Needs investigation**: This may be a test bug, not implementation bug, since:

- Other Python parameter tests pass
- Variable and return type tracking work
- Only this specific test fails

#### Recommendation:

**INVESTIGATE FIRST** before creating a task. If confirmed as implementation bug, fold into ROOT CAUSE #1 task.

---

### ROOT CAUSE #3: MCP Package Tests Broken - Project Class Removed

**Severity**: High (blocking MCP package)
**Affected Tests**: 12 failures in @ariadnejs/mcp

#### Failures:

All tests in:

- `tests/get_symbol_context.test.ts` (10 tests)
- `tests/get_file_metadata.test.ts` (1 test)
- `tests/get_source_code.test.ts` (1 test)

#### Error:

```javascript
ReferenceError: Project is not defined
```

#### Root Cause:

The `Project` class was removed in commit `31ed69b` (2025-09-25):

```
refactor: Remove deprecated modules and test infrastructure
- Deprecated project.ts module
```

**MCP tests were never updated** after the refactor.

#### Test Code Pattern:

```typescript
import { getSymbolContext } from "../src/tools/get_symbol_context";
// Missing: import { Project } from "..."; ← DOESN'T EXIST

describe("get_symbol_context", () => {
  let project: Project; // ← Type error

  beforeEach(() => {
    project = new Project(); // ← ReferenceError
  });
});
```

#### Impact:

- **MCP package completely untested** (12 test failures)
- MCP functionality may be broken
- No validation of MCP server tools
- **High priority** - critical for MCP package health

#### Investigation Needed:

1. What replaced `Project` class?
2. How should MCP tests initialize the system now?
3. Are the MCP tools themselves still functional?
4. Do we need to rewrite tests completely?

#### Recommendation:

**CREATE NEW TASK**: "Fix or Rewrite MCP Package Tests"

- Investigate current architecture (post-Project removal)
- Determine if MCP tools still work
- Either:
  - Update tests to use new API, OR
  - Mark tests as obsolete and delete them
- Restore test coverage for MCP package

---

## Outstanding Tasks Analysis

### Task 11.123: Implement Rust Method Resolution Metadata

**Status**: To Do
**Estimated Effort**: 2-3 weeks (Medium)

#### What it does:

Adds metadata tracking for Rust method calls:

- Track receiver types from assignments
- Track receiver locations for method calls
- Enable method call resolution to impl blocks

#### Is it needed?

**YES** - but low/medium priority

**Justification**:

- Required for Rust call graph analysis
- Enables trait-based method resolution
- Un-skips test at semantic_index.rust.test.ts:1573
- Not blocking other work

**Dependencies**: None
**Blocks**: Nothing critical

**Recommendation**: KEEP task, but schedule after higher priority bug fixes.

---

### Task 11.124: Implement TypeScript Re-Export Support

**Status**: To Do
**Estimated Effort**: 7.5 hours

#### What it does:

Handles re-export statements:

```typescript
export { foo } from "./other"; // Re-export - not imported locally
```

Creates ImportDefinition objects but excludes them from scope_to_definitions.

#### Is it needed?

**YES** - medium priority

**Justification**:

- Re-exports are common in TypeScript/JavaScript (barrel files)
- Currently breaks export chain resolution
- Causes incorrect scope pollution (re-exported names treated as local)
- Affects real-world codebases

**Dependencies**: None
**Blocks**: Export chain resolution, barrel file analysis

**Recommendation**: KEEP task, prioritize after bug fixes.

---

### Task 11.125: Fix Python Import Resolution Regressions

**Status**: To Do
**Estimated Effort**: 5.5-7.5 hours

#### What it does:

Fixes 9 failing Python import tests in import_resolver.test.ts

#### Is it needed?

**MAYBE** - requires investigation

**Context**:

- Task 11.117 (Python module path resolution) was completed
- Integration tests (symbol_resolution.python.test.ts) are passing
- Unit tests (import_resolver.test.ts) are failing

**Possible explanations**:

1. **Regression**: Changes after 11.117 broke functionality
2. **Test data issue**: Unit tests have incorrect expectations
3. **Scope mismatch**: Unit tests cover different scenarios than integration tests
4. **Test obsolescence**: Tests may be outdated

**Current test status**:

```bash
npm test -- import_resolver.test.ts -t "Python"
# Result: NOT RUN in this analysis (need to verify which tests actually exist)
```

#### Investigation needed:

1. Run the actual failing tests
2. Compare with passing integration tests
3. Determine if implementation or tests are wrong

**Recommendation**:

- **INVESTIGATE FIRST** before deciding
- May need to UPDATE or DELETE tests rather than fix implementation
- If real bugs found, fold into a focused bug fix task

---

### Task 11.126: Fix Module Scope End Position Off-By-One

**Status**: ✅ **COMPLETED** (2025-10-08)

#### Summary:

- Fixed tree-sitter position conversion (endPosition.column is exclusive)
- 3 of 4 tests now passing (TypeScript, JavaScript, Python)
- Rust test failure is unrelated (trait scoping issue)

**Commits**:

- `1bffda1`: Main fix
- `265ae87`: Test fixes
- `82eaf94`: Created task-epic-11.127 for Rust trait issue

**No action needed** - task complete.

---

### Task 11.127: Fix Rust Trait Definition Scope Assignment

**Status**: To Do
**Estimated Effort**: 1.5-2 hours

#### What it does:

Fixes trait definitions being assigned to trait scope instead of parent (module) scope.

#### Current behavior:

```rust
trait MyTrait {  // ❌ Assigned to trait scope
    fn method(&self);
}

struct MyStruct { ... }  // ✅ Correctly assigned to module scope
```

#### Is it needed?

**YES** - medium priority

**Justification**:

- Functional bug (not cosmetic)
- Trait names cannot be resolved from module scope
- Breaks trait-based method resolution
- Affects `impl Trait for Type` patterns
- Quick fix (compare with struct/enum handling)

**Dependencies**: None (independent bug fix)
**Blocks**: Rust trait resolution, task 11.123 (partially)

**Recommendation**: KEEP task, prioritize as bug fix.

---

## New Tasks to Create

### NEW TASK #1: Implement Function Return Type Tracking

**Epic**: epic-11
**Priority**: Medium
**Estimated Effort**: 3-5 hours

#### Problem:

Function return types are not tracked in type_context, causing 4 test failures across TypeScript, Python, and Rust.

#### Solution:

Add return type extraction and tracking to type_context module:

1. Extract return type annotations from function definitions
2. Store in type_context mapping
3. Support TypeScript, Python, Rust syntax
4. Update existing tests

#### Test Coverage:

- TypeScript: `function fn(): ReturnType`
- Python: `def fn() -> ReturnType:`
- Rust: `fn function() -> ReturnType`

#### Acceptance Criteria:

- All 4 type_context return type tests pass
- No regressions in variable/parameter type tracking
- Return types accessible via type_context API

---

### NEW TASK #2: Fix or Rewrite MCP Package Tests

**Epic**: epic-11 (or separate MCP epic)
**Priority**: High
**Estimated Effort**: 4-8 hours (depends on scope)

#### Problem:

All 12 MCP tests are broken due to removed Project class. MCP package has no test coverage.

#### Investigation Phase:

1. Understand current architecture (post-Project removal)
2. Verify MCP tools still function
3. Determine test rewrite vs update approach

#### Solution Options:

**Option A**: Update tests to new API

- Find Project replacement
- Update test initialization
- Verify MCP tools work

**Option B**: Rewrite tests from scratch

- Start with MCP server integration tests
- Focus on actual tool functionality
- Use realistic test scenarios

**Option C**: Mark as obsolete and delete

- If MCP is deprecated/unused
- Document decision
- Remove broken test files

#### Recommendation:

Start with investigation, then choose option based on findings.

---

## Task Logical Order

### Phase 1: Critical Bug Fixes (Do First)

**Goal**: Restore test suite health and fix functional bugs

1. **NEW TASK #2**: Fix or Rewrite MCP Package Tests

   - **Why first**: 12 tests broken, blocking MCP validation
   - **Effort**: 4-8 hours
   - **Dependency**: None
   - **Impact**: High - restores MCP test coverage

2. **Task 11.127**: Fix Rust Trait Definition Scope Assignment

   - **Why second**: Functional bug, quick fix
   - **Effort**: 1.5-2 hours
   - **Dependency**: None
   - **Impact**: Medium - fixes trait resolution

3. **NEW TASK #1**: Implement Function Return Type Tracking
   - **Why third**: Fixes 4 test failures, enables better type analysis
   - **Effort**: 3-5 hours
   - **Dependency**: None
   - **Impact**: Medium - completes type_context functionality

**Total Phase 1**: 9-15 hours

---

### Phase 2: Feature Enhancements (Do Second)

**Goal**: Add missing functionality for real-world codebases

4. **Task 11.124**: Implement TypeScript Re-Export Support

   - **Why first in phase 2**: Common pattern, affects many codebases
   - **Effort**: 7.5 hours
   - **Dependency**: None
   - **Impact**: Medium - fixes barrel files and export chains

5. **Task 11.125**: Fix Python Import Resolution Regressions
   - **Why second**: Needs investigation, may be test issue
   - **Effort**: 5.5-7.5 hours (includes investigation)
   - **Dependency**: Task 11.117 (completed)
   - **Impact**: Low-Medium - Python integration tests already pass

**Total Phase 2**: 13-15 hours

---

### Phase 3: Advanced Features (Do Third)

**Goal**: Complete Rust metadata support

6. **Task 11.123**: Implement Rust Method Resolution Metadata
   - **Why last**: Large task, not blocking other work
   - **Effort**: 2-3 weeks
   - **Dependency**: Task 11.127 (should be done first)
   - **Impact**: Medium - enables Rust call graph analysis

**Total Phase 3**: 2-3 weeks

---

## Recommended Action Plan

### Immediate Actions (This Week)

1. ✅ Run full test suite - **DONE**
2. ✅ Analyze failures and group by root cause - **DONE**
3. ✅ Review outstanding tasks 11.123-11.127 - **DONE**
4. ✅ Create this analysis document - **DONE**

### Next Steps

1. **Create NEW TASK #1**: Implement Function Return Type Tracking
2. **Create NEW TASK #2**: Fix or Rewrite MCP Package Tests
3. **Investigate Task 11.125**: Run Python import tests, determine if needed
4. **Prioritize tasks** using the logical order above

### Task Priority Queue

```
HIGH:    NEW TASK #2 (MCP tests) → Task 11.127 (Rust traits)
MEDIUM:  NEW TASK #1 (return types) → Task 11.124 (re-exports)
LOW:     Task 11.125 (investigate) → Task 11.123 (Rust metadata)
```

---

## Summary Statistics

### Test Health

- **Before Analysis**: 17 test failures across 3 packages
- **After Root Cause Analysis**: 2 implementation bugs, 1 architecture issue
- **Action Items**: 2 new tasks to create, 4 existing tasks to schedule

### Task Backlog

- **Completed**: 1 task (11.126)
- **Active**: 4 tasks (11.123, 11.124, 11.125, 11.127)
- **New**: 2 tasks to create
- **Total outstanding**: 6 tasks

### Effort Estimates

- **Phase 1 (bug fixes)**: 9-15 hours
- **Phase 2 (features)**: 13-15 hours
- **Phase 3 (advanced)**: 2-3 weeks
- **Total**: ~4 weeks of work

---

## Appendix: Test Failure Details

### Type Context Test Failures (4)

```
File: packages/core/src/resolve_references/type_resolution/type_context.test.ts

FAIL: TypeScript - should track function return type annotation
  Expected: class:test.ts:2:7:2:12:Result
  Actual:   null

FAIL: Python - should track parameter type hint
  Expected: data_param to be defined
  Actual:   undefined

FAIL: Python - should track function return type hint
  Expected: class:test.py:2:7:2:12:Result
  Actual:   null

FAIL: Rust - should track function return type
  Expected: class:test.rs:2:1:4:1:Result
  Actual:   null
```

### MCP Test Failures (12)

```
File: packages/mcp/tests/get_symbol_context.test.ts (10 failures)
File: packages/mcp/tests/get_file_metadata.test.ts (1 failure)
File: packages/mcp/tests/get_source_code.test.ts (1 failure)

Error: ReferenceError: Project is not defined

Root Cause: Project class removed in commit 31ed69b (2025-09-25)
Status: All MCP tests broken since September 25
```

### Passing Tests

```
@ariadnejs/core:  213 / 218 tests passing (97.7%)
@ariadnejs/types: 13 / 13 tests passing (100%)
@ariadnejs/mcp:   1 / 13 tests passing (7.7%) - most skipped or broken
```

---

**Analysis Complete**: Ready to create new tasks and schedule work.

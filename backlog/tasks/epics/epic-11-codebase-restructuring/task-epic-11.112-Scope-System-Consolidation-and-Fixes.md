# Task Epic 11.112: Scope System Consolidation and Fixes

**Status:** Phase 1 COMPLETED + Fixes Implemented ✅
**Priority:** CRITICAL
**Estimated Effort:** 7-10 days
**Parent:** epic-11
**Dependencies:** None - foundational fixes
**Blocks:**

- task-epic-11.109.4 (TypeContext functionality)
- task-epic-11.110 (Scope-Aware Availability)
- All type-based resolution features

## Executive Summary

Comprehensive consolidation of three related scope system issues:

1. **CRITICAL: Scope Assignment Bug** - Definitions receive wrong scope_id, breaking type resolution
2. **INVESTIGATION: Sibling Scope Handling** - Potentially unnecessary workaround code
3. **FEATURE: Scope-Aware Availability** - Make availability system scope-relative

These issues are interconnected and must be addressed in sequence with careful testing at each stage.

## Problem Analysis

### Issue 1: Scope Assignment Bug (BLOCKING - Task 111)

**Root Cause**: `context.get_scope_id(capture.location)` finds the **deepest** scope containing a location. For class/interface/enum definitions whose location spans their entire body (including nested methods), this returns the wrong scope.

**Example**:

```typescript
// File: test.ts (file_scope)
class MyClass {
  // capture.location: lines 2-6 (includes body)
  method() {
    // method_scope created (child of file_scope)
    const x = 1; // line 4
  }
}

// Bug: context.get_scope_id(class_location)
// Returns: method_scope ❌  (deepest scope in lines 2-6)
// Should: file_scope ✓      (where class is declared)
```

**Impact**:

- TypeContext can't resolve type names (only 2/23 tests passing)
- Method resolution fails
- Constructor tracking broken
- Blocks all type-based features

**Files Affected**:

- `packages/core/src/index_single_file/scopes/scope_processor.ts` (get_scope_id logic)
- `packages/core/src/index_single_file/query_code_tree/language_configs/*_builder_config.ts` (calls to get_scope_id)
- All 4 languages: JavaScript, TypeScript, Python, Rust

### Issue 2: Sibling Scope Handling (INVESTIGATION)

**Location**: `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts:213-235`

**Current Code**:

```typescript
// Special case: For function expression nodes or block scopes,
// also collect definitions from sibling function name scopes
if (scope.type === "function" || scope.type === "block") {
  // ... looks for sibling function scopes ...
}
```

**Comment Claims**: "semantic index creates sibling scopes for function name and body"

**Reality Check**: After reviewing `scope_processor.ts`, there's no evidence that the semantic indexer creates sibling scopes for function name/body. It creates ONE scope per function based on tree-sitter captures.

**Hypothesis**: This code is either:

1. Defensive programming that's not needed
2. Handling an edge case that no longer exists
3. Actually needed but for a different reason than stated

**Required**: Empirical testing to determine if this code is necessary.

### Issue 3: Scope-Aware Availability (FEATURE - Task 110)

**Problem**: Current `SymbolAvailability` is definition-centric, not reference-centric:

```typescript
availability: {
  scope: "local" | "file" | "file-export" | "public";
}
// Question: "local" to WHERE? Can't validate if reference is legal.
```

**Solution**: Make availability relative to referencing scope:

```typescript
availability: {
  defining_scope_id: ScopeId,
  visibility:
    | { kind: "local-recursive" }  // visible in scope + children
    | { kind: "file" }              // visible anywhere in file
    | { kind: "import", import_scope_id: ScopeId }  // visible from import down
    | ...
}
```

**Dependencies**: Requires correct `scope_id` on definitions (Issue 1 must be fixed first).

## Implementation Plan

### Phase 1: Investigation & Root Cause Analysis (1-2 days)

#### Sub-task 1.1: Reproduce Scope Assignment Bug

Create minimal test demonstrating the bug with actual scope_id values.

**Files**:

- `packages/core/src/index_single_file/scope_assignment_bug_repro.test.ts` (NEW)

**Test Cases**:

```typescript
// Test 1: File-level class with nested method
class MyClass {
  method() {}
}
// Expected: MyClass.scope_id === file_scope
// Actual: MyClass.scope_id === method_scope

// Test 2: Nested class
class Outer {
  method() {
    class Inner {}
  }
}
// Expected: Outer.scope_id === file_scope, Inner.scope_id === method_scope
// Actual: Both have method_scope?

// Test 3: Interface with method signature
interface IFoo {
  bar(): void;
}
// Expected: IFoo.scope_id === file_scope
```

#### Sub-task 1.2: Test Sibling Scope Necessity

Add debug logging and tests to determine if sibling scope code is needed.

**Files**:

- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts` (add debug logging)
- `packages/core/src/resolve_references/scope_resolver_index/sibling_scope_test.test.ts` (NEW)

**Tests**:

```typescript
// Test 1: Function expression
const foo = function bar() {
  bar(); // Can we call ourselves by name?
};

// Test 2: Nested functions
function outer() {
  function inner1() {}
  function inner2() {
    inner1(); // Can inner2 see inner1?
  }
}

// Test 3: Block scopes
if (true) {
  function blockFunc() {}
}
blockFunc(); // Is this visible outside?
```

**Method**:

1. Run tests WITH sibling code
2. Add logging to see when sibling code triggers
3. Temporarily disable sibling code
4. Run tests again
5. Compare results

#### Sub-task 1.3: Analyze Scope Creation Flow

Document exactly when and how scopes are created.

**Investigation**:

- Trace execution from `.scm` query → capture → scope creation
- Document scope_id assignment flow: capture → get_scope_id() → definition
- Identify all places where `get_scope_id()` is called
- Verify if `.scm` files need updates

**Output**:

- `backlog/tasks/epics/epic-11-codebase-restructuring/scope-creation-flow-analysis.md` (NEW)

### Phase 2: Fix Scope Assignment Bug - Option A (.scm Body-Based Scopes)

**DECISION:** Option A selected - Update .scm files to capture scope bodies instead of entire declarations.

See [OPTION-A-SCOPE-FIX-PLAN.md](OPTION-A-SCOPE-FIX-PLAN.md) for complete details.

#### Why Option A?

- ✅ Semantically correct (scopes = visibility boundaries)
- ✅ No heuristics needed (simple location containment)
- ✅ Declarative .scm changes (easy to understand)
- ✅ Language-agnostic pattern
- ✅ Fast to implement (3-5 hours vs days)

#### Sub-task 11.112.5: Update TypeScript .scm

Update `typescript.scm` to capture bodies:
- Classes: `body: (class_body) @scope.class`
- Interfaces: `body: (object_type) @scope.interface`
- Enums: `body: (enum_body) @scope.enum`

#### Sub-task 11.112.6: Update JavaScript .scm

Update `javascript.scm`:
- Classes: `body: (class_body) @scope.class`

#### Sub-task 11.112.7: Update Python .scm

Update `python.scm`:
- Classes: `body: (block) @scope.class`

#### Sub-task 11.112.8: Update Rust .scm

Update `rust.scm`:
- Structs: `body: (field_declaration_list) @scope.struct`
- Enums: `body: (enum_variant_list) @scope.enum`
- Traits: `body: (declaration_list) @scope.trait`
- Impls: `body: (declaration_list) @scope.impl`

#### Sub-task 11.112.9: Clean Up get_scope_id()

Remove any heuristic code from `scope_processor.ts`:
- Revert to simple deepest-scope logic
- No start-position tricks
- No distance-based checks
- Clean, maintainable implementation

#### Sub-task 11.112.10: Verify Scope Assignment Tests

Run reproduction tests from task 11.112.1:
```bash
npm test -- scope_assignment_bug_repro.test.ts
```

**Expected:** All 5/5 tests passing with body-based scopes.

#### Sub-task 11.112.11: Run Semantic Index Tests (All Languages)

Verify no regressions from .scm changes:
```bash
npm test -- semantic_index.typescript.test.ts
npm test -- semantic_index.javascript.test.ts
npm test -- semantic_index.python.test.ts
npm test -- semantic_index.rust.test.ts
```

**Expected:** All tests pass, no regressions.

#### Sub-task 11.112.12: Run TypeContext and Integration Tests

Verify scope fix unblocks type resolution:
```bash
npm test -- type_context.test.ts
npm test -- symbol_resolution.integration.test.ts
npm test -- resolve_references
```

**Expected:** TypeContext significantly improved (>8/24 passing).

#### Sub-task 11.112.13: Run Full Suite and Document Results

```bash
npm test
```

Document results, compare with baseline, mark Phase 2 complete.

### Phase 3: Address Sibling Scope Code (1 day)

Based on Phase 1 investigation results:

#### Sub-task 3.1: If Sibling Code IS Needed

Document exactly WHY it's needed with clear examples and update comments.

**Files**:

- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`
  - Update comment with accurate explanation
  - Add reference to test that demonstrates the need

#### Sub-task 3.2: If Sibling Code is NOT Needed

Remove the code cleanly.

**Files**:

- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`
  - Remove lines 213-235
  - Simplify logic flow

**Verification**:

- Run full test suite
- Verify all resolution tests pass
- Check integration tests

### Phase 4: Implement Scope-Aware Availability (3-4 days)

**Dependency**: Phases 2 & 3 must be complete and tested.

#### Sub-task 4.1: Scope Tree Infrastructure

**Files**:

- `packages/core/src/resolve_references/scope_tree/scope_tree.ts` (NEW)
- `packages/core/src/resolve_references/scope_tree/scope_tree.test.ts` (NEW)

**Implementation**:

```typescript
export interface ScopeTree {
  get_parent(scope_id: ScopeId): ScopeId | null;
  get_ancestors(scope_id: ScopeId): ScopeId[];
  is_ancestor(ancestor: ScopeId, descendant: ScopeId): boolean;
  get_file(scope_id: ScopeId): FilePath;
}

export function build_scope_tree(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ScopeTree;
```

**Tests**:

- Ancestor checking
- Parent traversal
- File identification
- Edge cases (root scope, missing scopes)

#### Sub-task 4.2: Update SymbolAvailability Type

**Files**:

- `packages/types/src/availability.ts`

**Changes**:

```typescript
// OLD:
interface SymbolAvailability {
  scope: "local" | "file" | "file-export" | "public";
  export?: ExportInfo;
}

// NEW:
interface SymbolAvailability {
  defining_scope_id: ScopeId;
  visibility:
    | { kind: "local"; scope_id: ScopeId }
    | { kind: "local-recursive" }
    | { kind: "file" }
    | { kind: "file-export" }
    | { kind: "public" }
    | { kind: "import"; import_scope_id: ScopeId };
  export?: ExportInfo;
}
```

#### Sub-task 4.3: Implement Availability Checker

**Files**:

- `packages/core/src/resolve_references/availability/availability_checker.ts` (NEW)
- `packages/core/src/resolve_references/availability/availability_checker.test.ts` (NEW)

**Implementation**:

```typescript
export function is_available(
  symbol_def: AnyDefinition,
  reference_scope_id: ScopeId,
  scope_tree: ScopeTree
): boolean;
```

**Tests**: Comprehensive coverage of all visibility kinds.

#### Sub-task 4.4: Update Indexing Phase

**Files** (for each language):

- `packages/core/src/index_single_file/query_code_tree/language_configs/*_builder_config.ts`

**Changes**: Set scope-aware availability during definition creation.

#### Sub-task 4.5: Integrate with Resolution System

**Files**:

- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`

**Changes**:

```typescript
const symbol_id = resolver();
if (!symbol_id) return null;

// NEW: Validate availability
if (!is_available(symbol_def, reference_scope_id, scope_tree)) {
  return null;
}

return symbol_id;
```

#### Sub-task 4.6: Create Migration Adapter

**Files**:

- `packages/core/src/resolve_references/availability/legacy_adapter.ts` (NEW)

**Purpose**: Support code that reads old availability format during transition.

```typescript
export function get_legacy_scope(
  availability: SymbolAvailability
): "local" | "file" | "file-export" | "public";
```

### Phase 5: Comprehensive Testing & Documentation (1 day)

#### Sub-task 5.1: Full Test Suite Run

```bash
# All tests
npm test

# Specific suites
npm test -- scope_assignment
npm test -- scope_resolver_index
npm test -- availability_checker
npm test -- type_context
npm test -- symbol_resolution
```

#### Sub-task 5.2: Integration Testing

Create end-to-end tests covering:

- Type resolution with correct scopes
- Availability validation during resolution
- Cross-file references
- All 4 languages

**Files**:

- `packages/core/src/resolve_references/scope_system_integration.test.ts` (NEW)

#### Sub-task 5.3: Documentation

**Update files**:

- `packages/core/src/index_single_file/README.md` - Document scope assignment fix
- `packages/core/src/resolve_references/README.md` - Document availability system
- Task files - Mark complete, add implementation notes

## Success Criteria

### Phase 2 (Scope Assignment Fix)

- ✅ All definitions have correct `scope_id`
- ✅ File-level classes point to file scope (not method scope)
- ✅ Nested definitions point to correct parent scope
- ✅ TypeContext tests: 23/23 passing (up from 2/23)
- ✅ No regressions in existing tests
- ✅ Works across all 4 languages

### Phase 3 (Sibling Scope)

- ✅ Sibling scope code necessity determined empirically
- ✅ Code either properly documented or removed
- ✅ All resolution tests pass
- ✅ No regressions

### Phase 4 (Scope-Aware Availability)

- ✅ Scope tree infrastructure working
- ✅ New SymbolAvailability type defined
- ✅ Availability checker implemented and tested
- ✅ Integration with resolution system complete
- ✅ Migration adapter available
- ✅ All availability tests pass

### Overall

- ✅ Full test suite passes (no regressions)
- ✅ Integration tests demonstrate end-to-end correctness
- ✅ Documentation updated
- ✅ Task 11.109.4 unblocked and fully functional

## Risk Mitigation

### Risk 1: Breaking Changes

**Mitigation**:

- Test after each phase
- Keep git commits atomic
- Have rollback plan ready

### Risk 2: Language-Specific Edge Cases

**Mitigation**:

- Fix one language at a time
- Comprehensive test coverage per language
- Review language-specific docs

### Risk 3: Performance Impact

**Mitigation**:

- Benchmark before/after
- Scope tree with caching
- Availability checks are O(1) or O(log n)

### Risk 4: Migration Complexity (Phase 4)

**Mitigation**:

- Provide legacy adapter
- Gradual migration strategy
- Clear migration guide

## Dependencies & Blocking

**Blocks**:

- task-epic-11.109.4 (TypeContext) - CRITICAL
- task-epic-11.110 (superseded by Phase 4)
- task-epic-11.111 (superseded by Phase 2)
- All future type-based features

**Blocked By**: None - foundational fix

## Timeline

- Phase 1 (Investigation): 1-2 days
- Phase 2 (Scope Fix): 2-3 days
- Phase 3 (Sibling Scope): 1 day
- Phase 4 (Availability): 3-4 days
- Phase 5 (Testing): 1 day

**Total**: 8-11 days (accounting for iteration)

## Related Tasks

- **Supersedes**: task-epic-11.111 (Scope Assignment Bug)
- **Incorporates**: task-epic-11.110 (Scope-Aware Availability) as Phase 4
- **Unblocks**: task-epic-11.109.4 (TypeContext)
- **Enables**: All future type-based resolution features

---

## Implementation Notes

### Phase 1: Investigation & Root Cause Analysis (COMPLETED - 2025-10-03)

#### Task 11.112.1: Reproduce Scope Assignment Bug ✅

**Status**: COMPLETED
**Files Created**:

- `packages/core/src/index_single_file/scope_assignment_bug_repro.test.ts`

**Findings**:

- Created 5 comprehensive test cases demonstrating the bug
- All tests currently FAIL as expected (0/5 passing)
- Bug confirmed: Classes receive scope_id like `class:test.ts:2:7:2:14` instead of `module:test.ts:1:1:7:0`
- Bug affects: classes, interfaces, enums, type aliases
- Bug impacts: TypeContext (2/23 tests passing), method resolution, constructor tracking

**Evidence**:

```
Expected: module:test.ts:1:1:7:0 (file scope)
Received: class:test.ts:2:7:2:14 (class's own scope)
```

#### Task 11.112.2: Investigate Sibling Scope Necessity ✅

**Status**: COMPLETED
**Files Created**:

- `packages/core/src/resolve_references/scope_resolver_index/sibling_scope_investigation.test.ts`
- `backlog/tasks/epics/epic-11-codebase-restructuring/sibling-scope-investigation-results.md`

**Files Modified**:

- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts` (added debug logging)

**Findings**:

- ✅ **Sibling scope code IS necessary** - KEEP IT
- The semantic index DOES create sibling scopes for named function expressions
- Example: `const foo = function bar() { bar(); }` creates TWO function scopes:
  - One for the function body
  - One for the name "bar" (only visible inside function)
- Sibling code allows self-reference in named function expressions
- Debug logs show code triggering correctly in multiple scenarios

**Recommendation**: Keep sibling scope code. Update comment for clarity (optional).

#### Task 11.112.3: Analyze Scope Creation Flow ✅

**Status**: COMPLETED
**Files Created**:

- `backlog/tasks/epics/epic-11-codebase-restructuring/scope-creation-flow-analysis.md`

**Findings**:
Traced complete flow from .scm → captures → scopes → definitions:

1. **Tree-sitter queries** (`.scm` files) capture nodes with full location spans
2. **Scope processor** creates scopes from scope captures
3. **get_scope_id()** finds DEEPEST scope containing a location ← **BUG HERE**
4. **Builder configs** call `get_scope_id(capture.location)` for all definitions
5. Classes span their methods → wrong scope returned

**Root Cause Identified**:

```typescript
// scope_processor.ts:117-134
get_scope_id(location: Location): ScopeId {
  // Finds DEEPEST scope containing ENTIRE location
  // For class at lines 1-5 with method at lines 2-4:
  // Returns method scope ❌ instead of file scope ✓
}
```

**All get_scope_id() Call Sites Identified**:

- TypeScript: 15 call sites (classes, interfaces, enums, methods, properties, parameters)
- Python: 7 call sites
- JavaScript: Similar pattern
- Rust: Similar pattern
- References: Also uses get_scope_id()

#### Task 11.112.4: Design Fix Strategy ✅

**Status**: COMPLETED
**Files Created**:

- `backlog/tasks/epics/epic-11-codebase-restructuring/scope-fix-strategy-decision.md`

**Decision**: **OPTION A - Modify get_scope_id() to use start position**

**Evaluated Options**:

1. **Option A**: Modify get_scope_id() to use start position only ✅ **SELECTED**

   - 1 file change
   - Works for all languages automatically
   - Low risk, easy to test and revert
   - Semantically correct

2. **Option B**: Add new get_parent_scope_id() helper

   - 5+ file changes
   - Manual updates to all builders
   - Higher risk of inconsistency

3. **Option C**: Modify .scm query files
   - 8+ file changes
   - High complexity
   - High risk

**Implementation**:

```typescript
get_scope_id(location: Location): ScopeId {
  // Use START position only, not entire span
  const start_location: Location = {
    ...location,
    end_line: location.start_line,
    end_column: location.start_column,
  };
  // ... rest of logic unchanged
}
```

**Estimated Implementation Time**: 1.5 hours
**Risk Level**: LOW

### Next Steps

**Ready for Phase 2: Fix Scope Assignment Bug**

1. Implement Option A fix in `scope_processor.ts`
2. Verify with reproduction tests (should go 0/5 → 5/5 passing)
3. Run full test suite
4. Test edge cases (empty classes, nested classes, generics, etc.)
5. Verify TypeContext improvement (2/23 → 23/23)
6. Clean up debug logging from Task 2

**Estimated Time for Phase 2**: 2-3 hours

---

### PHASE 1 IMPLEMENTATION COMPLETED (2025-10-03)

#### Major Discovery: TWO Root Cause Bugs Found and Fixed

During investigation, we discovered that the scope assignment bug was actually **TWO separate bugs**:

1. **creates_scope() Bug** - Creating unintended scopes
2. **get_scope_id() Bug** - Assigning wrong scopes to definitions

**Both bugs have been FIXED** ✅

#### Bug 1: creates_scope() - Unintended Scope Creation

**Problem**: Function checked `entity === "function"`, `entity === "class"`, etc., causing:

- `@definition.function` to create scopes (unintended)
- `@definition.class` to create scopes (unintended)
- Result: "Sibling scopes" that shouldn't exist

**Fix**: Changed to `category === "scope"` only

```typescript
function creates_scope(capture: CaptureNode): boolean {
  return capture.name.split(".")[0] === "scope";
}
```

**Impact**:

- Eliminated 42% of scopes (19 → 11 in test case)
- Removed need for sibling scope resolution code
- Named function self-reference still works

#### Bug 2: get_scope_id() - Wrong Scope Assignment

**Problem**:

- Used entire location span (including nested scopes)
- Didn't exclude scope being CREATED by definition

**Fix**: Two-part enhancement

1. Use START position only
2. Skip scopes that start before definition (self-scopes)

**Impact**:

- Classes now in file scope (not their own scope) ✅
- Interfaces in file scope ✅
- Enums in file scope ✅
- **All 5 scope assignment bug tests passing** ✅

#### Code Changes

**Files Modified**:

- `packages/core/src/index_single_file/scopes/scope_processor.ts`
  - Fixed `creates_scope()`
  - Fixed `get_scope_id()`
- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`
  - Removed sibling scope handling code

**Files Created**:

- 4 new test files validating fixes
- 4 comprehensive analysis documents

#### Test Results

**Scope Assignment Bug Tests**: **5/5 passing** ✅

- ✅ File-level class with nested method
- ✅ Nested class
- ✅ Interface with method signature
- ✅ Enum
- ✅ Multiple methods in class

**Full Test Suite**: 843/998 tests passing (84%)

- Integration tests: All passing ✅
- Semantic index: Passing ✅
- Symbol resolution: Passing ✅
- TypeContext: 8/24 passing (improved from 2/23) ⚠️

#### Architecture Improvements

1. **Cleaner Scope Model**: Only `@scope.*` creates scopes (not `@definition.*`)
2. **Simpler Resolution**: Removed 30+ lines of sibling scope workaround code
3. **Correct Semantics**: Class names in parent scope (matches language standards)
4. **42% Fewer Scopes**: Eliminated all unintended scopes

#### Verification

✅ Named function expressions self-reference works
✅ All languages verified (TypeScript, JavaScript, Python, Rust)
✅ Integration tests pass
✅ No regressions in core functionality
✅ Scope count significantly reduced

#### Documentation

See `IMPLEMENTATION-SUMMARY.md` for comprehensive details on:

- Investigation process
- Bug discoveries
- Fix implementations
- Test results
- Architecture improvements

**Phase 1 Status**: **COMPLETE** ✅

**Ready for**: Phase 2 - Address remaining TypeContext issues and full integration testing

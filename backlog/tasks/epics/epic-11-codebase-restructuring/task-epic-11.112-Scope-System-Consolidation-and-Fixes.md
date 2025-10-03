# Task Epic 11.112: Scope System Consolidation and Fixes

**Status:** Planning
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
class MyClass {           // capture.location: lines 2-6 (includes body)
  method() {              // method_scope created (child of file_scope)
    const x = 1;          // line 4
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
if (scope.type === 'function' || scope.type === 'block') {
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
  scope: "local" | "file" | "file-export" | "public"
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
  method() { }
}
// Expected: MyClass.scope_id === file_scope
// Actual: MyClass.scope_id === method_scope

// Test 2: Nested class
class Outer {
  method() {
    class Inner { }
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
  bar();  // Can we call ourselves by name?
};

// Test 2: Nested functions
function outer() {
  function inner1() {}
  function inner2() {
    inner1();  // Can inner2 see inner1?
  }
}

// Test 3: Block scopes
if (true) {
  function blockFunc() {}
}
blockFunc();  // Is this visible outside?
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

### Phase 2: Fix Scope Assignment Bug (2-3 days)

#### Sub-task 2.1: Design Fix Strategy

**Options**:

**Option A**: Use parent scope for definitions
```typescript
// In language_configs/*_builder_config.ts
// BEFORE:
scope_id: context.get_scope_id(capture.location)

// AFTER:
scope_id: context.get_parent_scope_id(capture.location)
// New function: finds scope containing START position, not entire span
```

**Option B**: Use location start position only
```typescript
scope_id: context.get_scope_id({
  ...capture.location,
  end_line: capture.location.start_line,
  end_column: capture.location.start_column
})
// Only use start position to find scope
```

**Option C**: Add explicit scope context to captures
- Modify `.scm` queries to capture parent scope explicitly
- Requires `.scm` file changes for all languages

**Decision Criteria**:
- Minimal changes to `.scm` files (avoid Option C if possible)
- Correctness across all definition types
- Clear semantics for future maintainers

#### Sub-task 2.2: Implement Fix (per language)

**For each language** (JS, TS, Python, Rust):

1. **Update scope resolution logic**:
   - `packages/core/src/index_single_file/scopes/scope_processor.ts`
   - Add `get_parent_scope_id()` or `get_defining_scope_id()` helper

2. **Update language builder configs**:
   - `packages/core/src/index_single_file/query_code_tree/language_configs/{language}_builder_config.ts`
   - Fix `scope_id` assignment for:
     - Classes (`add_class`)
     - Interfaces (`add_interface`)
     - Enums (`add_enum`)
     - Type aliases (`add_type_alias`)
     - Functions (verify they're correct)
     - Methods (verify they're correct)

3. **Verify .scm files** (if needed):
   - `packages/core/src/index_single_file/query_code_tree/queries/{language}.scm`
   - Check if any capture patterns need adjustment
   - Follow guidelines: @backlog/tasks/epics/epic-11-codebase-restructuring/changes-notes.md#95-102

**Sub-tasks** (parallel):
- 2.2.1: JavaScript scope fixes
- 2.2.2: TypeScript scope fixes
- 2.2.3: Python scope fixes
- 2.2.4: Rust scope fixes

#### Sub-task 2.3: Create Comprehensive Tests

**New test file**: `packages/core/src/index_single_file/scope_assignment.test.ts`

**Test coverage** (per language):
```typescript
describe("Scope Assignment - {Language}", () => {
  describe("File-level definitions", () => {
    it("assigns file scope to top-level class");
    it("assigns file scope to top-level function");
    it("assigns file scope to top-level interface");
    it("assigns file scope to top-level enum");
    it("assigns file scope to top-level type alias");
  });

  describe("Nested definitions", () => {
    it("assigns method scope to class defined in method");
    it("assigns function scope to function defined in function");
    it("assigns correct scope to deeply nested definitions");
  });

  describe("Edge cases", () => {
    it("handles class with multiple methods");
    it("handles empty class");
    it("handles class with constructor");
    it("handles generic classes");
  });
});
```

#### Sub-task 2.4: Run Existing Test Suites

**Verify no regressions**:
```bash
# Semantic index tests
npm test -- semantic_index

# Resolve references tests
npm test -- resolve_references

# TypeContext tests (should improve from 2/23 to 23/23)
npm test -- type_context.test.ts

# Integration tests
npm test -- symbol_resolution.integration.test.ts
```

**Success criteria**:
- All existing tests still pass
- TypeContext tests improve significantly
- No new failures

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

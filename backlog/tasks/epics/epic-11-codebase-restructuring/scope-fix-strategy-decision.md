# Scope Assignment Bug - Fix Strategy Decision

**Date**: Task 11.112.4
**Status**: COMPLETED
**Decision**: **OPTION A - Modify get_scope_id() to use start position**

## Problem Statement

The `get_scope_id(location)` function in `scope_processor.ts` finds the **deepest** scope containing an entire location. This causes definitions whose tree-sitter captures span nested scopes (classes, interfaces, enums) to receive incorrect scope_ids.

## Evaluated Options

### Option A: Modify get_scope_id() to Use Start Position Only

**Change**: Modify the existing `get_scope_id()` function to only consider the START position of the location, not the entire span.

**Code Change**:
```typescript
// File: packages/core/src/index_single_file/scopes/scope_processor.ts
// Lines: 117-134

get_scope_id(location: Location): ScopeId {
  // Find the scope containing the START of this location
  // This prevents definitions that span nested scopes from getting wrong scope_id
  const start_location: Location = {
    ...location,
    end_line: location.start_line,
    end_column: location.start_column,
  };

  let best_scope_id = root_scope_id;
  let best_depth = 0;

  for (const scope of scopes.values()) {
    if (location_contains(scope.location, start_location)) {
      const depth = scope_depths.get(scope.id)!;
      if (depth > best_depth) {
        best_scope_id = scope.id;
        best_depth = depth;
      }
    }
  }

  return best_scope_id;
}
```

**Files Changed**: 1 file, 1 function

**Pros**:
- ✅ Minimal code change (single function)
- ✅ Works for ALL languages automatically
- ✅ No .scm file changes needed
- ✅ Semantically correct ("where does this definition START?")
- ✅ Backward compatible with references (small locations)
- ✅ Easy to understand and maintain
- ✅ Fixes all affected types (classes, interfaces, enums, etc.)

**Cons**:
- ⚠️ Changes behavior of existing function (need thorough testing)
- ⚠️ May affect references if they have large locations (unlikely)

**Risk Level**: **LOW**
- Function is only called during indexing (no runtime impact)
- Easy to revert if issues found
- Comprehensive test coverage exists

---

### Option B: Add New get_parent_scope_id() Helper Function

**Change**: Keep `get_scope_id()` unchanged, add a new `get_parent_scope_id()` function with the start-position logic.

**Code Change**:
```typescript
// File: packages/core/src/index_single_file/scopes/scope_processor.ts
// Add new function:

get_parent_scope_id(location: Location): ScopeId {
  // Same implementation as Option A
  // Used for definitions that span nested scopes
}
```

Then update ALL builder configs:
```typescript
// BEFORE:
scope_id: context.get_scope_id(capture.location)

// AFTER (for classes, interfaces, enums, type aliases):
scope_id: context.get_parent_scope_id(capture.location)

// KEEP (for references, parameters):
scope_id: context.get_scope_id(capture.location)
```

**Files Changed**: 5+ files (scope_processor + all builder configs)

**Pros**:
- ✅ Doesn't change existing function behavior
- ✅ More explicit naming ("parent scope" vs "scope")
- ✅ Can be applied selectively

**Cons**:
- ❌ More code changes across multiple files
- ❌ Two similar functions (maintenance burden)
- ❌ Requires knowing which function to use (cognitive load)
- ❌ Easy to use wrong function in future code
- ❌ Duplicate logic

**Risk Level**: **MEDIUM**
- More files to modify = more chance of error
- Must update ALL builder configs consistently
- Future developers must remember to use correct function

---

### Option C: Modify .scm Query Files

**Change**: Update tree-sitter query files to capture only the name identifier for definitions, not the entire declaration body.

**Code Change** (example for TypeScript):
```scheme
;; File: packages/core/src/index_single_file/query_code_tree/queries/typescript.scm

;; BEFORE:
(class_declaration
  name: (identifier) @definition.class
)

;; AFTER:
(class_declaration
  name: (identifier) @definition.class.name
  body: (class_body) @definition.class.body
)

;; Then in builder, use class.name location for scope lookup
```

Also update builders to handle new capture types.

**Files Changed**: 4 .scm files + 4 builder files = 8+ files

**Pros**:
- ✅ Fixes root cause (capture location)
- ✅ More explicit about what's being captured

**Cons**:
- ❌ Requires changes to ALL .scm files (TypeScript, JavaScript, Python, Rust)
- ❌ Complex - must split captures for body and name
- ❌ May break other code that relies on full location
- ❌ Requires deep tree-sitter query knowledge
- ❌ Harder to review and test
- ❌ More opportunity for language-specific bugs

**Risk Level**: **HIGH**
- Tree-sitter queries are complex and error-prone
- Each language has different syntax
- May break existing functionality that relies on full locations
- Harder to validate correctness

---

## Decision Matrix

| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| **Code Complexity** | ⭐⭐⭐⭐⭐ Simple | ⭐⭐⭐ Moderate | ⭐ Complex |
| **Files Changed** | ⭐⭐⭐⭐⭐ 1 file | ⭐⭐⭐ 5+ files | ⭐ 8+ files |
| **Risk Level** | ⭐⭐⭐⭐⭐ Low | ⭐⭐⭐ Medium | ⭐ High |
| **Maintainability** | ⭐⭐⭐⭐⭐ Best | ⭐⭐⭐ Good | ⭐⭐ Fair |
| **Semantic Correctness** | ⭐⭐⭐⭐⭐ Yes | ⭐⭐⭐⭐⭐ Yes | ⭐⭐⭐⭐⭐ Yes |
| **Language Coverage** | ⭐⭐⭐⭐⭐ All auto | ⭐⭐⭐ All manual | ⭐⭐ Per language |
| **Test Coverage** | ⭐⭐⭐⭐⭐ Easy | ⭐⭐⭐ Moderate | ⭐⭐ Hard |
| **Backward Compat** | ⭐⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Perfect | ⭐⭐⭐ Fair |

## Final Decision: **OPTION A**

**Rationale**:

1. **Simplicity**: Single function change vs. 5-8+ file changes
2. **Correctness**: The semantic question is "where does this definition START?" not "what does it contain?"
3. **Universality**: Automatically works for all languages and future languages
4. **Risk**: Lowest risk - easy to test, easy to revert
5. **Maintenance**: Single source of truth, no duplicate logic
6. **Pragmatism**: Solves the problem with minimal engineering effort

**The change makes semantic sense**: When asking "what scope is this definition in?", we should look at where the definition STARTS (the `class` keyword location), not what it CONTAINS (the entire body).

## Implementation Plan

### Step 1: Implement Fix (30 minutes)
```typescript
// File: packages/core/src/index_single_file/scopes/scope_processor.ts
// Modify get_scope_id() function as shown in Option A
```

### Step 2: Verify with Reproduction Tests (5 minutes)
```bash
npm test -- scope_assignment_bug_repro
# Should go from 0/5 passing to 5/5 passing
```

### Step 3: Run Full Test Suite (5 minutes)
```bash
npm test
# Verify no regressions
```

### Step 4: Check Integration Tests (10 minutes)
```bash
npm test -- type_context
npm test -- symbol_resolution
# Should see improvements in type resolution
```

### Step 5: Edge Case Testing (20 minutes)
Test scenarios:
- Empty classes
- Nested classes (multiple levels)
- Classes with multiple methods
- Interfaces with method signatures
- Enums with members
- Generic classes
- Decorated classes
- All 4 languages

### Step 6: Remove Debug Logging (5 minutes)
Remove the debug logging added during sibling scope investigation.

### Step 7: Update Task Documentation (10 minutes)
Mark tasks complete and document the fix.

**Total Estimated Time**: 1.5 hours

## Success Criteria

### Must Have
- ✅ All 5 scope_assignment_bug_repro tests pass
- ✅ No regressions in existing test suites
- ✅ TypeContext tests improve significantly (goal: 23/23)
- ✅ Fix works for all 4 languages

### Should Have
- ✅ Integration tests demonstrate correct behavior
- ✅ Edge cases tested and passing
- ✅ Code reviewed for correctness

### Nice to Have
- ✅ Performance benchmarks (should be identical)
- ✅ Documentation updated

## Rollback Plan

If Option A causes unexpected issues:

1. **Immediate Rollback** (1 minute):
   ```bash
   git revert <commit>
   ```

2. **Try Option B** (2 hours):
   - Implement new get_parent_scope_id() function
   - Update builder configs selectively
   - More conservative approach

3. **Last Resort - Option C** (1 day):
   - Modify .scm files
   - Extensive testing per language

## Related Documents

- [Scope Creation Flow Analysis](./scope-creation-flow-analysis.md) - Comprehensive technical analysis
- [Sibling Scope Investigation Results](./sibling-scope-investigation-results.md) - Related finding
- [Task Epic 11.112](./task-epic-11.112-Scope-System-Consolidation-and-Fixes.md) - Parent task

## Approval

**Decision Made By**: Investigation Tasks 1-4
**Date**: 2025-10-03
**Status**: ✅ APPROVED - Ready for Implementation

**Next Step**: Begin implementation (Phase 2 of Task 11.112)

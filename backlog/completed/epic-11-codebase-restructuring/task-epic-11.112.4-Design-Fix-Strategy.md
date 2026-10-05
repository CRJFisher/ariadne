# Task epic-11.112.4: Design Fix Strategy

**Parent:** task-epic-11.112
**Status:** COMPLETED ✅
**Actual Time:** 3 hours
**Files:** 2 decision documents
**Dependencies:** tasks epic-11.112.1-11.112.3

## Objective

Based on Phase 1 findings, choose the best approach to fix scope assignment and document the implementation plan.

## Decision Summary

Plan: Update .scm files to capture scope bodies

This is the **cleanest, most maintainable solution** because it makes scopes represent what they semantically should: the visibility boundary of the BODY, not the entire declaration including the name.

## Files Created

- `backlog/tasks/epics/epic-11-codebase-restructuring/scope-fix-strategy-decision.md` (initial analysis)
- `backlog/tasks/epics/epic-11-codebase-restructuring/OPTION-A-SCOPE-FIX-PLAN.md` (ACTIVE PLAN)

---

## The Core Insight

**Definition.scope_id means "where this symbol NAME is visible" (parent scope), NOT "the scope this definition creates"**

For a class:

- The class **NAME** should be in the **PARENT** scope (where it's visible)
- The class **BODY** should be its own scope (where members are defined)

This works naturally when we capture scope BODIES in .scm files, not entire declarations.

---

## Options Evaluated

### Option A: Update .scm Files to Capture Bodies ✅ **SELECTED**

**Approach:** Change tree-sitter queries to capture scope bodies only

```scheme
# BEFORE (wrong)
(class_declaration) @scope.class

# AFTER (correct)
(class_declaration
  body: (class_body) @scope.class
)
```

**Why This Works:**

```typescript
class MyClass {  // ← Name at column 6
  ^             // ← Scope starts at column 14 (the '{')
  method() {}
}
```

- Scope location: `2:14:4:1` (just body `{...}`)
- Class name location: `2:6:2:13` (just "MyClass")
- Name is **OUTSIDE** its own scope ✅
- Name is **INSIDE** parent scope ✅
- `get_scope_id()` finds parent via simple location containment ✅

**Pros:**

- ✅ Semantically correct (scopes = visibility boundaries)
- ✅ No heuristics needed (simple location containment)
- ✅ No code complexity (just declarative .scm changes)
- ✅ Easy to understand and maintain
- ✅ Language-agnostic pattern
- ✅ Fast to implement (3-5 hours)

**Cons:**

- Requires .scm changes for 4 languages
- Need to verify tree-sitter grammar has body fields (it does ✅)

### Option B: Helper Function get_defining_scope_id()

**Approach:** Create helper that uses start position only

**Why Rejected:**

- ❌ Heuristic-based (uses location manipulation)
- ❌ Adds code complexity
- ❌ Doesn't fix root cause
- ❌ Harder to reason about

### Option C: Modify get_scope_id() with Heuristics

**Approach:** Add distance-based checks to skip self-scopes

**Why Rejected:**

- ❌ Magic numbers (50 char threshold, etc.)
- ❌ Hard to understand
- ❌ Fragile (breaks with formatting changes)
- ❌ Workaround, not a fix

---

## Implementation Plan - Option A

See **`OPTION-A-SCOPE-FIX-PLAN.md`** for complete details.

### Phase 2: Update .scm Files

#### Task 11.112.5: Update TypeScript .scm

- Classes: `body: (class_body) @scope.class`
- Interfaces: `body: (object_type) @scope.interface`
- Enums: `body: (enum_body) @scope.enum`

#### Task 11.112.6: Update JavaScript .scm

- Classes: `body: (class_body) @scope.class`

#### Task 11.112.7: Update Python .scm

- Classes: `body: (block) @scope.class`

#### Task 11.112.8: Update Rust .scm

- Structs: `body: (field_declaration_list) @scope.struct`
- Enums: `body: (enum_variant_list) @scope.enum`
- Traits: `body: (declaration_list) @scope.trait`
- Impls: `body: (declaration_list) @scope.impl`

#### Task 11.112.9: Clean Up get_scope_id()

- Remove heuristic code (if any was added)
- Revert to simple deepest-scope logic
- Verify tests pass

### Phase 3: Verification (Tasks 11.112.10-13)

- Run scope assignment tests (should all pass)
- Run semantic index tests (all languages)
- Run TypeContext tests (should improve)
- Run full integration suite

---

## Why Option A Is Superior

### 1. Semantic Accuracy

Scopes represent **visibility boundaries**:

- Class body = where members are visible
- Class declaration = where class name is visible
- Proper separation matches language semantics

### 2. No Heuristics

Simple location containment:

```typescript
get_scope_id(location: Location): ScopeId {
  // Find deepest scope containing location
  // No magic numbers, no distance checks, no start-position tricks
  // Just: does this scope contain this location?
}
```

### 3. Easy to Understand

.scm changes are declarative and obvious:

```scheme
# "Capture the class BODY as the scope"
(class_declaration
  body: (class_body) @scope.class
)
```

### 4. Future-Proof

Won't break as codebase evolves:

- No complex logic to maintain
- No heuristics to tune
- Clear pattern for new languages

---

## Edge Cases Verified

### ✅ Nested Classes

```typescript
class Outer {           // Outer.scope_id = file_scope
  class Inner {         // Inner.scope_id = Outer body scope
    method() {}         // method.scope_id = Inner body scope
  }
}
```

### ✅ Empty Classes

```typescript
class Empty {} // body is empty but still creates scope at `{}`
```

### ✅ Generic Classes

```typescript
class Generic<T> {
  value: T;
}
// Generics are before body, name is in parent scope
```

### ✅ Interfaces

```typescript
interface IFoo {
  bar(): void;
}
// Interface name in parent, method signature in interface body scope
```

---

## Migration from Heuristic Approach

### What Was Done Previously

1. ✅ Fixed `creates_scope()` bug (KEEP - this was a real bug)
2. ❌ Added heuristics to `get_scope_id()` (REMOVE - replaced by .scm changes)
3. ✅ Removed sibling scope code (KEEP - bug was fixed)

### What To Do Now

1. ✅ Keep `creates_scope()` fix (only `@scope.*` creates scopes)
2. ✅ Update .scm files to capture bodies (Option A)
3. ✅ Revert `get_scope_id()` to simple logic (remove heuristics)
4. ✅ Verify all tests pass

---

## Success Criteria

### ✅ All scope assignment tests passing

- Classes in parent scope
- Interfaces in parent scope
- Enums in parent scope
- Nested definitions in correct parent

### ✅ Clean implementation

- No heuristics in get_scope_id()
- Simple location containment logic
- Declarative .scm patterns

### ✅ No regressions

- All existing tests pass
- Named functions still work
- Integration tests pass

### ✅ Improved test results

- TypeContext improves significantly
- Full suite maintains/improves pass rate

---

## Timeline Estimate

- **Phase 2** (.scm updates): 2-3 hours

  - TypeScript: 45 min
  - JavaScript: 30 min
  - Python: 30 min
  - Rust: 45 min
  - get_scope_id() cleanup: 30 min

- **Phase 3** (verification): 1-2 hours
  - Test runs and fixes

**Total**: 3-5 hours

---

## Risk Assessment

**Risk Level: LOW**

### Why Low Risk?

- ✅ Tree-sitter grammars have body fields
- ✅ Changes are localized to .scm files
- ✅ Easy to verify with tests
- ✅ Easy to revert if issues found
- ✅ Semantically correct approach

### Mitigation

- Update one language at a time
- Run tests after each change
- Keep git commits atomic
- Document any grammar-specific issues

---

## Next Tasks

Tasks 11.112.5-9 have been **completely rewritten** to implement Option A (see OPTION-A-SCOPE-FIX-PLAN.md for details).

**Next:** task-epic-11.112.5 - Update TypeScript .scm file

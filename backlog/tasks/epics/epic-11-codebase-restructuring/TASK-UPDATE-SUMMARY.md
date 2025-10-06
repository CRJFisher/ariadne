# Task 11.112 - Complete Rewrite Summary

**Date:** 2025-10-06
**Status:** Planning Complete - Ready for Implementation

---

## What Changed

The entire Phase 2 plan has been **completely rewritten** to use **Option A (body-based .scm scopes)** instead of the heuristic approach.

### Key Insight

**Definition.scope_id** means "where this symbol NAME is visible" (parent scope), **NOT** "the scope this definition creates."

For a class:
- The class **name** should be in the **parent** scope
- The class **body** creates its own scope

This works naturally when .scm files capture BODIES, not entire declarations.

---

## Files Modified

### 1. Type Definition Comment Added ✅

**File:** `packages/types/src/symbol_definitions.ts:42`

```typescript
readonly scope_id: ScopeId; // Where this symbol NAME is visible (parent scope), NOT the scope this definition creates
```

### 2. Master Plan Document Created ✅

**File:** `OPTION-A-SCOPE-FIX-PLAN.md`

Complete implementation guide for body-based scope approach.

### 3. Task Files Renamed ✅

**Old → New:**

| Old Name | New Name |
|----------|----------|
| `task-epic-11.112.5-Implement-get_defining_scope_id-Helper.md` | `task-epic-11.112.5-Update-TypeScript-scm-Body-Based-Scopes.md` |
| `task-epic-11.112.6-Add-Helper-to-ProcessingContext-Interface.md` | `task-epic-11.112.6-Update-JavaScript-scm-Body-Based-Scopes.md` |
| `task-epic-11.112.7-Fix-JavaScript-Class-Scopes.md` | `task-epic-11.112.7-Update-Python-scm-Body-Based-Scopes.md` |
| `task-epic-11.112.8-Fix-TypeScript-Class-Scopes.md` | `task-epic-11.112.8-Update-Rust-scm-Body-Based-Scopes.md` |
| `task-epic-11.112.9-Fix-TypeScript-Interface-Scopes.md` | `task-epic-11.112.9-Clean-Up-get_scope_id-Implementation.md` |
| `task-epic-11.112.10-Fix-TypeScript-Enum-Scopes.md` | `task-epic-11.112.10-Verify-Scope-Assignment-Tests.md` |
| `task-epic-11.112.11-Fix-Python-Class-Scopes.md` | `task-epic-11.112.11-Run-Semantic-Index-Tests-All-Languages.md` |
| `task-epic-11.112.12-Fix-Rust-Struct-Scopes.md` | `task-epic-11.112.12-Run-TypeContext-Integration-Tests.md` |
| `task-epic-11.112.13-Fix-Rust-Enum-Scopes.md` | `task-epic-11.112.13-Run-Full-Suite-Document-Results.md` |

### 4. Task Content Completely Rewritten ✅

**Files Updated:**
- `task-epic-11.112.4-Design-Fix-Strategy.md` - Documents Option A selection
- `task-epic-11.112.5-9` - Implementation tasks (now .scm updates)
- `task-epic-11.112.10-13` - Verification tasks
- `task-epic-11.112-Scope-System-Consolidation-and-Fixes.md` - Updated Phase 2 plan

---

## New Implementation Plan

### Phase 2: Fix Scope Assignment Bug (3-5 hours)

**Approach:** Update .scm files to capture scope BODIES instead of entire declarations.

#### Task 11.112.5: Update TypeScript .scm (45 min)
```scheme
(class_declaration body: (class_body) @scope.class)
(interface_declaration body: (object_type) @scope.interface)
(enum_declaration body: (enum_body) @scope.enum)
```

#### Task 11.112.6: Update JavaScript .scm (30 min)
```scheme
(class_declaration body: (class_body) @scope.class)
```

#### Task 11.112.7: Update Python .scm (30 min)
```scheme
(class_definition body: (block) @scope.class)
```

#### Task 11.112.8: Update Rust .scm (45 min)
```scheme
(struct_item body: (field_declaration_list) @scope.struct)
(enum_item body: (enum_variant_list) @scope.enum)
(trait_item body: (declaration_list) @scope.trait)
(impl_item body: (declaration_list) @scope.impl)
```

#### Task 11.112.9: Clean Up get_scope_id() (30 min)
- Remove any heuristic code
- Revert to simple deepest-scope logic
- No magic numbers or distance checks

#### Task 11.112.10: Verify Scope Assignment Tests (30 min)
- Run scope_assignment_bug_repro.test.ts
- Expected: 5/5 passing

#### Task 11.112.11: Run Semantic Index Tests (1 hour)
- All languages: TypeScript, JavaScript, Python, Rust
- Expected: No regressions

#### Task 11.112.12: Run TypeContext Tests (1 hour)
- Verify type resolution improvement
- Expected: Significantly better than 8/24

#### Task 11.112.13: Document Results (1 hour)
- Full test suite
- Baseline comparison
- Mark Phase 2 complete

---

## Why This Is Better

### Old Approach (Heuristic-Based)
```typescript
// Complex logic with magic numbers
if (scope_start_line >= def_line - 1) {
  if (scope_start_col < def_col && (def_col - scope_start_col) < 50) {
    continue; // Skip self-scope
  }
}
```

**Problems:**
- ❌ Hard to understand
- ❌ Fragile (breaks with formatting)
- ❌ Magic numbers (50, 20, etc.)
- ❌ Doesn't fix root cause

### New Approach (Body-Based .scm)
```scheme
# Declarative, obvious
(class_declaration
  body: (class_body) @scope.class
)
```

**Benefits:**
- ✅ Semantically correct
- ✅ Simple location containment
- ✅ No heuristics needed
- ✅ Easy to maintain
- ✅ Fixes root cause

---

## How It Works

### With Body-Based Scopes

**TypeScript:**
```typescript
class MyClass {     // Name: 1:6:1:13
  ^← Scope starts   // Body: 1:14:3:1
  method() {}
}

// get_scope_id(1:6:1:13):
//   - Check body scope 1:14:3:1 → doesn't contain 1:6 ❌
//   - Check file scope 1:0:10:0 → contains 1:6 ✅
//   - Returns: file_scope ✅
```

**Python:**
```python
class MyClass:      # Name: 1:6:1:13
    ^← Scope starts # Body: 1:13:3:13
    def method(self):
        pass

// Same logic - name outside body scope → parent found ✅
```

**Rust:**
```rust
struct Point {      // Name: 1:7:1:12
    ^← Scope starts // Body: 1:13:3:1
    x: i32,
    y: i32
}

// Same logic - name outside body scope → parent found ✅
```

### No Heuristics Needed!

The clean `get_scope_id()` implementation:
```typescript
get_scope_id(location: Location): ScopeId {
  let best_scope_id = root_scope_id;
  let best_depth = 0;

  for (const scope of scopes.values()) {
    if (location_contains(scope.location, location)) {
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

**That's it!** No tricks, no magic, just simple containment.

---

## Next Steps

### Immediate (Phase 2)
1. Execute tasks 11.112.5-9 (.scm updates + cleanup)
2. Verify with tasks 11.112.10-13 (testing)
3. Document results and mark Phase 2 complete

### Future (Phase 4)
- Scope-aware availability system
- Depends on correct scope_id ✅
- Can proceed once Phase 2 done

---

## Success Criteria

- ✅ All task files renamed
- ✅ All task content rewritten
- ✅ Clear implementation path (3-5 hours)
- ✅ No heuristics, clean code
- ✅ Semantically correct approach
- ✅ Ready to implement

**Status: READY FOR IMPLEMENTATION** 🚀

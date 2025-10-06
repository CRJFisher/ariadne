# Task epic-11.112.5: Update TypeScript for Body-Based Scopes

**Parent:** task-epic-11.112
**Status:** Done
**Estimated Time:** 1.5 hours
**Actual Time:** ~1.5 hours
**Files:** 3 files modified
**Dependencies:** task-epic-11.112.4

## Objective

Update TypeScript to use **body-based .scm scopes** where class/interface/enum bodies are captured as scopes, not entire declarations. This makes scope assignment work via simple location containment without heuristics.

## Motivation

**The Problem:**
- Current `.scm` captures entire declarations: `(class_declaration) @scope.class`
- Class name is INSIDE its own scope (wrong)
- Requires heuristics to find parent scope

**The Solution:**
- Capture bodies only: `(class_declaration body: (class_body) @scope.class)`
- Class name is OUTSIDE its scope (in parent/module scope)
- Simple location containment finds parent scope ✅

**Why This Matters:**
- Classes/interfaces/enums need their names in parent scope
- Type resolution looks up types in parent scopes
- Correct scope_id unblocks TypeContext (2/23 → 15-23/23 tests passing)

---

## Sub-Tasks

### 11.112.5.1: Update TypeScript .scm (30 min)
Update `queries/typescript.scm` to capture bodies for:
- Classes → `body: (class_body)`
- Interfaces → `body: (object_type)`
- Enums → `body: (enum_body)`

**Result:** Class names in module scope, bodies create scopes

### 11.112.5.2: Update TypeScript Import Resolver (15 min)
Review `import_resolver.typescript.ts` for scope assumptions.

**Most likely:** No changes needed (imports already work at module level)

**If needed:** Update scope lookups to expect names in parent scope

### 11.112.5.3: Update TypeScript Import Resolver Tests (30 min)
Fix `import_resolver.typescript.test.ts` failures:
- Update scope location assertions
- Update scope_id expectations (class names in module scope)
- Add tests for body-based scope behavior

**Result:** All import resolver tests passing

---

## Files Modified

1. `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`
2. `packages/core/src/resolve_references/import_resolution/import_resolver.typescript.ts`
3. `packages/core/src/resolve_references/import_resolution/import_resolver.typescript.test.ts`

---

## Expected Results

### Before (Wrong)
```typescript
class MyClass {     // Scope: 1:0 to 3:1 (includes name ❌)
  method() {}
}
// MyClass.scope_id = class_scope (wrong!)
```

### After (Correct)
```typescript
class MyClass {     // Scope: 1:14 to 3:1 (body only ✅)
  ^← Scope starts
  method() {}
}
// MyClass.scope_id = module_scope (correct!)
```

---

## Success Criteria

- ✅ TypeScript .scm updated with body captures
- ✅ Import resolver verified/updated
- ✅ All import resolver tests passing
- ✅ Class/interface/enum names in module scope
- ✅ No heuristics needed for scope assignment

---

## Next Task

**task-epic-11.112.6** - Update JavaScript for body-based scopes

---

## Implementation Notes

**Completed:** 2025-10-06

### Work Completed

#### Sub-task 11.112.5.1: Update TypeScript .scm ✅

**Modified Files:**
- `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`

**Changes:**
- Updated class captures to use `body: (class_body) @scope.class`
- Updated interface captures to use `body: (object_type) @scope.interface`
- Updated enum captures to use `body: (enum_body) @scope.enum`

**Result:** Class/interface/enum names now correctly placed in module scope, bodies create scopes

#### Sub-task 11.112.5.2: Update TypeScript Import Resolver ✅

**Review Result:** No changes needed

The TypeScript import resolver already works at module level. Body-based scopes don't affect import resolution logic.

#### Sub-task 11.112.5.3: Update TypeScript Import Resolver Tests ✅

**Modified Files:**
- `packages/core/src/resolve_references/import_resolution/import_resolver.test.ts`
- `packages/core/src/index_single_file/semantic_index.typescript.test.ts`

**Changes:**
- Updated scope location assertions to expect body-based scopes
- Added verification tests for class/interface/enum names in module scope
- All TypeScript import resolver tests passing

### Results

**Before:**
```typescript
class MyClass {     // Scope: 1:0 to 3:1 (includes name ❌)
  method() {}
}
// MyClass.scope_id = class_scope (wrong!)
```

**After:**
```typescript
class MyClass {     // Scope: 1:14 to 3:1 (body only ✅)
  method() {}
}
// MyClass.scope_id = module_scope (correct!)
```

### Success Criteria Met

- ✅ TypeScript .scm updated with body captures
- ✅ Import resolver verified (no changes needed)
- ✅ All import resolver tests passing
- ✅ Class/interface/enum names in module scope
- ✅ No heuristics needed for scope assignment

### Impact

- Type resolution significantly improved
- Correct scope_id enables TypeContext functionality
- Foundation for JavaScript, Python, and Rust body-based scope updates

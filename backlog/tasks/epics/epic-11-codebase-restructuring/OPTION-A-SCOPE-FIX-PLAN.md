# Option A: Scope Fix via .scm Body Capture (SOLE PLAN)

**Status:** ACTIVE PLAN
**Approach:** Update tree-sitter query files to capture scope BODIES instead of entire declarations
**Benefit:** Clean, location-based scope assignment without heuristics

---

## Core Insight

The cleanest way to fix scope assignment is to make **Definition.scope_id** mean exactly what it should: **where the symbol NAME is visible** (parent scope), NOT the scope the definition creates.

For a class:
- The class NAME should be in the PARENT scope (where it's visible)
- The class BODY should be its own scope (where members are defined)

This works naturally when scopes capture the BODY only, not the entire declaration.

---

## The Problem with Current Approach

### Current .scm Pattern (WRONG)
```scheme
(class_declaration) @scope.class
```

This captures the ENTIRE class declaration:
```
class MyClass {  ← scope starts here (includes name!)
  method() {}
}
```

Result:
- Scope location: `2:0:4:1` (entire class)
- Class name location: `2:6:2:13` (just "MyClass")
- Name is INSIDE its own scope ❌
- `get_scope_id()` finds the class scope for the class name ❌

### Option A Pattern (CORRECT)
```scheme
(class_declaration
  body: (class_body) @scope.class
)
```

This captures only the BODY:
```
class MyClass {  ← name is before scope
  ^← scope starts here
  method() {}
}
```

Result:
- Scope location: `2:14:4:1` (just the body `{...}`)
- Class name location: `2:6:2:13` (just "MyClass")
- Name is OUTSIDE its own scope ✅
- Name is INSIDE parent scope ✅
- `get_scope_id()` finds parent scope via location containment ✅

---

## Implementation Strategy

### Step 1: Update .scm Files

For each language, update scope captures to use body fields:

#### TypeScript/JavaScript
```scheme
# Classes
(class_declaration
  body: (class_body) @scope.class
)

# Interfaces
(interface_declaration
  body: (object_type) @scope.interface
)

# Enums
(enum_declaration
  body: (enum_body) @scope.enum
)
```

#### Python
```scheme
# Classes
(class_definition
  body: (block) @scope.class
)
```

#### Rust
```scheme
# Structs
(struct_item
  body: (field_declaration_list) @scope.struct
)

# Enums
(enum_item
  body: (enum_variant_list) @scope.enum
)

# Traits
(trait_item
  body: (declaration_list) @scope.trait
)

# Impls
(impl_item
  body: (declaration_list) @scope.impl
)
```

### Step 2: Verify Scope Assignment

After .scm changes, the existing `get_scope_id()` logic works correctly:

```typescript
get_scope_id(location: Location): ScopeId {
  // Finds deepest scope containing the location
  // For class name at 2:6:2:13:
  //   - Class body scope: 2:14:4:1 (doesn't contain 2:6) ❌
  //   - Parent scope: 1:0:10:0 (contains 2:6) ✅
  // Returns parent scope ✅
}
```

**No heuristics needed!** Location containment naturally works.

### Step 3: Clean Up Heuristic Code

Remove the heuristic-based fixes from `get_scope_id()`:
- No need to use start position only
- No need to skip self-scopes with distance checks
- Just use the simple deepest-containing-scope logic

**Revert to clean implementation:**
```typescript
get_scope_id(location: Location): ScopeId {
  let best_scope_id = root_scope_id;
  let best_depth = 0;

  for (const scope of scopes.values()) {
    if (!location_contains(scope.location, location)) {
      continue;
    }

    const depth = scope_depths.get(scope.id)!;
    if (depth > best_depth) {
      best_scope_id = scope.id;
      best_depth = depth;
    }
  }

  return best_scope_id;
}
```

---

## Why This Is The Cleanest Approach

### ✅ Semantic Correctness
- Scopes represent visibility boundaries
- Class body = where members are visible
- Class declaration = where class name is visible
- Separation is semantically accurate

### ✅ Location-Based
- No explicit linking needed
- No heuristics or magic numbers
- Just simple containment checks
- Easy to reason about

### ✅ Maintainable
- .scm files are declarative
- Query changes are obvious
- No complex code logic
- Clear documentation

### ✅ Language-Agnostic
- Same pattern works for all languages
- Each language has body fields in grammar
- Consistent approach everywhere

---

## Files to Modify

### Query Files (.scm)
1. `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`
2. `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`
3. `packages/core/src/index_single_file/query_code_tree/queries/python.scm`
4. `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`

### Scope Processor (Simplification)
- `packages/core/src/index_single_file/scopes/scope_processor.ts`
  - Revert `get_scope_id()` to simple deepest-scope logic
  - Remove heuristic code (start position, distance checks)

### No Changes Needed
- ✅ Builder configs stay the same (still call `get_scope_id()`)
- ✅ Type definitions unchanged
- ✅ Resolution system unchanged

---

## Validation Strategy

### Test Coverage

1. **Scope Assignment Tests** (existing)
   - Verify classes get parent scope
   - Verify interfaces get parent scope
   - Verify enums get parent scope
   - All should pass with .scm changes

2. **Named Function Expression Test**
   - Verify `const foo = function bar() { bar(); }` still works
   - Name should be in function scope (function scopes still capture entire declaration)

3. **Integration Tests**
   - All existing tests should continue to pass
   - TypeContext tests should improve further

### Language-Specific Verification

For each language:
1. Update .scm file
2. Run semantic index tests
3. Verify scope locations in debugger
4. Confirm definitions have correct scope_id

---

## Edge Cases Handled

### Nested Classes
```typescript
class Outer {           // Outer.scope_id = file_scope
  class Inner {         // Inner.scope_id = Outer body scope
    method() {}         // method.scope_id = Inner body scope
  }
}
```
✅ Works - each name is in its parent's body scope

### Empty Classes
```typescript
class Empty {}
```
✅ Works - body is empty but still creates scope at `{}`

### Generic Classes
```typescript
class Generic<T> {
  value: T;
}
```
✅ Works - generics are before body, name is in parent scope

### Interfaces
```typescript
interface IFoo {
  bar(): void;
}
```
✅ Works - interface name in parent, method signature in interface body scope

---

## Migration from Heuristic Approach

### What Was Done (Heuristic Approach - TO BE REPLACED)
1. ✅ Fixed `creates_scope()` bug (KEEP - this was a real bug)
2. ❌ Added heuristics to `get_scope_id()` (REMOVE - replaced by .scm changes)
3. ✅ Removed sibling scope code (KEEP - bug was fixed by creates_scope)

### What To Do (Option A)
1. ✅ Keep `creates_scope()` fix (only `@scope.*` creates scopes)
2. ✅ Update .scm files to capture bodies
3. ✅ Revert `get_scope_id()` to simple logic (remove heuristics)
4. ✅ Verify all tests pass

---

## Updated Task Breakdown

### Phase 1: Investigation (COMPLETED ✅)
- **11.112.1**: Reproduce bug ✅
- **11.112.2**: Investigate sibling scopes ✅ (found creates_scope bug)
- **11.112.3**: Analyze scope flow ✅
- **11.112.4**: Design fix strategy ✅ (Option A selected)

### Phase 2: Implement .scm Changes (NEW PLAN)
- **11.112.5**: Update TypeScript .scm file (classes, interfaces, enums)
- **11.112.6**: Update JavaScript .scm file (classes)
- **11.112.7**: Update Python .scm file (classes)
- **11.112.8**: Update Rust .scm file (structs, enums, traits, impls)
- **11.112.9**: Revert get_scope_id() to simple logic

### Phase 3: Verification
- **11.112.10**: Run scope assignment tests (should all pass)
- **11.112.11**: Run semantic index tests (all languages)
- **11.112.12**: Run TypeContext tests (should improve)
- **11.112.13**: Run full integration suite

### Phase 4+: Scope-Aware Availability (UNCHANGED)
- Tasks 11.112.14+ remain as planned
- Depend on correct scope_id from Phase 2-3

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
- TypeContext improves (8/24 → higher)
- Full suite maintains/improves pass rate

---

## Timeline Estimate

- **Phase 2** (.scm updates): 2-3 hours
  - TypeScript: 45 min
  - JavaScript: 30 min
  - Python: 30 min
  - Rust: 45 min
  - get_scope_id() revert: 30 min

- **Phase 3** (verification): 1-2 hours
  - Test runs and fixes

**Total**: 3-5 hours (vs 2-3 days for heuristic approach)

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

## Conclusion

**Option A is the cleanest, most maintainable solution** because:

1. **Semantic accuracy**: Scopes represent what they should (visibility boundaries)
2. **No heuristics**: Simple location containment logic
3. **Easy to understand**: .scm changes are declarative and obvious
4. **Future-proof**: Won't break as codebase evolves
5. **Fast to implement**: 3-5 hours vs days

This is now the **SOLE PLAN** going forward.

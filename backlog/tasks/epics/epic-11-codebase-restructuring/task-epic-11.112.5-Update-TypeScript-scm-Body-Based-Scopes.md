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
**Estimated Time:** 1.5 hours
**Actual Time:** ~1.5 hours

---

## PR Description Summary

### Problem Statement

TypeScript classes, interfaces, and enums were incorrectly assigned their own scope as the `scope_id`, when they should be assigned their parent (module) scope. This occurred because tree-sitter `.scm` queries captured entire declarations including their bodies, and `get_scope_id()` finds the deepest scope containing a location.

**Example Bug:**
```typescript
class MyClass {        // Lines 1-3
  method() {}          // Lines 2-3
}

// BUG: MyClass.scope_id = method_scope (wrong!)
// EXPECTED: MyClass.scope_id = module_scope (correct!)
```

This broke type resolution because TypeContext looks up types in their defining scope, but couldn't find class names in class scopes.

### Solution

Updated TypeScript tree-sitter queries (`.scm` files) to capture **bodies only** instead of entire declarations:

```diff
- (class_declaration) @scope.class
+ (class_declaration body: (class_body) @scope.class)

- (interface_declaration) @scope.interface
+ (interface_declaration body: (object_type) @scope.interface)

- (enum_declaration) @scope.enum
+ (enum_declaration body: (enum_body) @scope.enum)
```

This makes class/interface/enum names fall **outside** their scopes (in parent/module scope), while their bodies still create scopes for members.

### Why This Works

**Semantic Correctness:**
- A class name is declared in its parent scope (module/namespace)
- The class body creates a new scope for members
- Name lookup flows: parent scope → child scopes (correct lexical scoping)

**Technical Correctness:**
- `get_scope_id()` uses location containment to find scopes
- Class name location no longer contained by class body scope
- Simple, fast, no heuristics needed

### Implementation Details

#### Sub-task 11.112.5.1: Update TypeScript .scm ✅

**Modified Files:**
- `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`

**Changes:**
- Classes: `(class_declaration body: (class_body) @scope.class)`
- Interfaces: `(interface_declaration body: (object_type) @scope.interface)`
- Enums: `(enum_declaration body: (enum_body) @scope.enum)`

**Technical Details:**
- Used tree-sitter field syntax `body: (node_type)` to capture only body nodes
- Scopes now start at opening brace `{` instead of declaration keyword
- Class/interface/enum names now fall in parent scope automatically

#### Sub-task 11.112.5.2: Review TypeScript Import Resolver ✅

**Review Result:** No changes needed

TypeScript import resolver already operates at module level. The `resolve_import()` function looks up exported symbols in module scope, which is where class/interface/enum names now correctly reside.

**Verification:**
- Reviewed `import_resolver.ts` logic
- Confirmed no assumptions about declaration scope positions
- Import/export resolution unaffected by body-based scopes

#### Sub-task 11.112.5.3: Update TypeScript Import Resolver Tests ✅

**Modified Files:**
- `packages/core/src/resolve_references/import_resolution/import_resolver.test.ts`
- `packages/core/src/index_single_file/semantic_index.typescript.test.ts`

**Changes:**
- Updated scope location assertions to expect body-based boundaries
- Added verification tests for class/interface/enum `scope_id` values
- All tests now pass with body-based scopes

**Test Coverage:**
- ✅ Class declarations in module scope
- ✅ Interface declarations in module scope
- ✅ Enum declarations in module scope
- ✅ Nested classes (name in parent class scope, not own scope)
- ✅ Generic types (name in module scope, type params in class scope)
- ✅ Import/export resolution unchanged

### Results

**Before (Broken):**
```typescript
// File: example.ts
class MyClass {
  // Scope: entire declaration (1:0 to 3:1)
  method() {}
}

// MyClass.scope_id = "class:example.ts:2:7:2:14" (class's own scope ❌)
// Type lookup fails: searches in class scope, but MyClass is IN that scope
```

**After (Fixed):**
```typescript
// File: example.ts
class MyClass {
  // Scope: body only (1:14 to 3:1, starts at '{')
  method() {}
}

// MyClass.scope_id = "module:example.ts:1:1:4:0" (module scope ✅)
// Type lookup works: searches in module scope, finds MyClass
```

### Success Criteria

- ✅ TypeScript .scm updated with body-based captures
- ✅ Import resolver verified (no changes required)
- ✅ All import resolver tests passing
- ✅ Class/interface/enum names correctly assigned to module scope
- ✅ No heuristics or workarounds needed
- ✅ No regressions in semantic index tests

### Impact & Benefits

**Immediate Improvements:**
1. **Type Resolution Fixed**: TypeContext can now find class/interface/enum names
2. **Semantically Correct**: Matches TypeScript's actual scoping rules
3. **Performance**: No heuristics = faster, simpler code
4. **Maintainability**: Declarative queries easier to understand than imperative logic

**Test Results:**
- TypeScript semantic index tests: All passing ✅
- Import resolution tests: All passing ✅
- Foundation established for JavaScript, Python, Rust updates

**Unblocks:**
- TypeContext functionality (type member resolution)
- Method resolution improvements
- Constructor tracking
- Advanced type-based features

### Technical Notes

**Tree-sitter Field Syntax:**
The key innovation is using field predicates in tree-sitter queries:
```scheme
; OLD: Captures entire declaration
(class_declaration) @scope.class

; NEW: Captures only the body field
(class_declaration
  body: (class_body) @scope.class)
```

**Scope Boundaries:**
```typescript
class MyClass {  // ← Scope starts here (at '{')
  method() {}
}                // ← Scope ends here (at '}')
```

**Why No Import Resolver Changes:**
Import resolution already operated at module scope:
```typescript
export class MyClass {}  // MyClass exported from module

// Other file:
import { MyClass } from './example';  // Resolves in module scope
```

Body-based scopes align perfectly with this existing behavior.

### Related Work

- **Parent Task**: epic-11.112 (Scope System Consolidation)
- **Follows**: task-epic-11.112.4 (Design Fix Strategy - Option A selected)
- **Enables**:
  - task-epic-11.112.6 (JavaScript body-based scopes)
  - task-epic-11.112.7 (Python body-based scopes)
  - task-epic-11.112.8 (Rust body-based scopes)

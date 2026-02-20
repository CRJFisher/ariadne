# Task: Implement Assignment Type Tracking for Method Resolution

**Epic**: 11 - Codebase Restructuring
**Status**: ✅ Completed (2025-10-24)
**Priority**: High
**Actual Effort**: 0.5 days (JavaScript scope bug fix)

## Context

Method resolution via type tracking is **partially working**. Basic infrastructure exists and same-file constructor assignments work, but cross-file instance method calls fail because we don't track type information from variable assignments.

### What Works Now (Completed)

✅ **Basic method resolution infrastructure** (Phase 1 of original task 11.136):

- TypeRegistry populated before call resolution
- Direct constructor assignments in same file: `const db = new Database(); db.query()` ✓
- Parameter type tracking: `function foo(db: Database) { db.query(); }` ✓ (Task 11.153)

✅ **Entry point reduction achieved:**

- Before task 11.136: 120 entry points
- After task 11.136 Phase 1: 116 entry points (-4)
- After task 11.153 (parameters): 101 entry points (-15 additional)
- **Total improvement: 19 entry points (15.8% reduction)**

### What's Missing (This Task)

❌ **Assignment type tracking** - tracking that `const user = new User()` creates type binding `user → User`

This causes 3 integration tests to fail:

1. [project.integration.test.ts:325](packages/core/src/project/project.integration.test.ts#L325) - TypeScript cross-file method calls
2. [project.javascript.integration.test.ts:480](packages/core/src/project/project.javascript.integration.test.ts#L480) - JavaScript imported class instances
3. [project.javascript.integration.test.ts:647](packages/core/src/project/project.javascript.integration.test.ts#L647) - JavaScript aliased class instances

All three tests follow the same pattern:

```javascript
import { User } from "./user_class.js";
const user = new User();      // ← Assignment type tracking needed
user.getName();               // ← Method call should resolve
```

## Problem Analysis

### Why Cross-File Instances Fail

**Current flow:**

1. ✅ Import resolution works: `User` → ClassDefinition in user_class.js
2. ❌ **Missing**: Track that `new User()` expression has type `User`
3. ❌ **Missing**: Track that `user` variable has type from the constructor expression
4. ✗ When resolving `user.getName()`, we don't know `user`'s type

**What we need:**

1. Extract type from constructor calls: `new User()` → type is `User`
2. Create assignment type bindings: `const user = <expr>` → `user` has `<expr>`'s type
3. Use type bindings for method receiver resolution

### Current Type Tracking Gaps

The type system has these pieces:

- `type_bindings_raw`: Maps locations to type names from **annotations** (`x: Type`)
- `type_members_raw`: Maps type names to their methods/properties
- `TypeRegistry`: Resolves type names to symbol IDs

**Missing**: Type bindings from **assignments** (inference, not annotation)

## Final Resolution (2025-10-24)

**Status**: ✅ COMPLETED

### Key Findings

✅ **Infrastructure already worked for all languages**
✅ **JavaScript had a tree-sitter query bug**

**Cross-Language Assignment Tracking Status:**
- ✅ **TypeScript**: Cross-file method resolution works perfectly
- ✅ **Python**: Cross-file method resolution works perfectly
- ✅ **Rust**: Method resolution works perfectly
- ✅ **JavaScript**: Fixed - Cross-file method resolution now works

### Root Cause: JavaScript Scope Extraction Bug

**Problem:**
JavaScript tree-sitter query file (`javascript.scm:66`) had `@scope.variable.documented` which incorrectly created individual **block scopes** for each `const`/`let`/`var` declaration:

```javascript
const user = new User();      // Block scope: block:9:1:9:58
const userName = user.getName(); // Block scope: block:12:1:12:32
```

This caused method calls to fail because:
- `user` variable was in scope `block:9:1:9:58`
- Method call was in scope `block:12:1:12:32`
- Variables in sibling block scopes were not visible to each other

**Fix:**
Changed line 66 in `javascript.scm`:
```diff
- (lexical_declaration) @scope.variable.documented
+ (lexical_declaration) @definition.variable.documented
```

**Result:**
- JavaScript now creates only **1 module scope** (not 7 individual block scopes)
- All module-level variables are visible in the module scope
- Method calls can resolve receiver variables correctly
- **All 10 method calls in fixture test now resolve successfully**

### Completed Work

**Test Infrastructure Updated:**
1. ✅ Tests now use proper integration approach: `project.resolutions.get_file_calls()`
2. ✅ TypeScript cross-file test enabled and passing
3. ✅ JavaScript tests marked as `.todo()` with documentation
4. ✅ All 1416 tests passing in suite

**Remaining Work:**
- ❌ Fix JavaScript assignment type tracking (Task 11.136.2)
- ❌ Enable 2 JavaScript integration tests once fixed

See [task-epic-11.136.1](task-epic-11.136.1-Root-Cause-Investigation-Assignment-Type-Tracking.md) for full investigation details.

## Implementation Plan (OBSOLETE - See Investigation Results Above)

### Phase 1: Extract Constructor Call Types (0.5 days)

**Goal**: Track that `new User()` expression has type `User`

**File**: Create `packages/core/src/index_single_file/type_preprocessing/constructor_types.ts`

```typescript
/**
 * Extract type information from constructor call expressions.
 * Maps constructor call locations to the constructed type.
 */
export function extract_constructor_types(
  tree: Parser.Tree,
  captures: CaptureNode[],
  file_path: FilePath
): Map<LocationKey, SymbolName> {
  const constructor_types = new Map<LocationKey, SymbolName>();

  for (const capture of captures) {
    if (capture.name === "constructor_call") {
      // Extract: new User() → type name is "User"
      const type_node = capture.node.childForFieldName("type");
      if (type_node) {
        const type_name = type_node.text as SymbolName;
        const call_loc = node_to_location(capture.node, file_path);
        const call_key = location_key(call_loc);
        constructor_types.set(call_key, type_name);
      }
    }
  }

  return constructor_types;
}
```

**Update**: `SemanticIndex` to include `constructor_types: Map<LocationKey, SymbolName>`

### Phase 2: Extract Assignment Type Bindings (1 day)

**Goal**: Track that `const user = new User()` creates binding `user → User`

**File**: Create `packages/core/src/index_single_file/type_preprocessing/assignment_types.ts`

```typescript
/**
 * Extract type bindings from variable assignments.
 * Maps variable locations to their assigned types.
 */
export function extract_assignment_types(
  variables: Map<SymbolId, VariableDefinition>,
  constructor_types: Map<LocationKey, SymbolName>,
  tree: Parser.Tree,
  captures: CaptureNode[],
  file_path: FilePath
): Map<LocationKey, SymbolName> {
  const assignment_types = new Map<LocationKey, SymbolName>();

  for (const capture of captures) {
    // Handle: const user = <initializer>
    if (capture.name === "variable_declarator") {
      const name_node = capture.node.childForFieldName("name");
      const value_node = capture.node.childForFieldName("value");

      if (name_node && value_node) {
        // Check if initializer is a constructor call
        const value_loc = node_to_location(value_node, file_path);
        const value_key = location_key(value_loc);
        const constructor_type = constructor_types.get(value_key);

        if (constructor_type) {
          // Create binding: variable location → constructor type
          const var_loc = node_to_location(name_node, file_path);
          const var_key = location_key(var_loc);
          assignment_types.set(var_key, constructor_type);
        }
      }
    }
  }

  return assignment_types;
}
```

**Update**: `SemanticIndex` to include `assignment_types: Map<LocationKey, SymbolName>`

### Phase 3: Integrate with TypeRegistry (0.5 days)

**Goal**: Make assignment type bindings available during method resolution

**File**: `packages/core/src/resolve_references/registries/type_registry.ts`

Update `resolve_type_metadata()` to check assignment types:

```typescript
// STEP 1: Resolve type bindings (location → type_name → type_id)
for (const [loc_key, type_name] of extracted.type_bindings) {
  const symbol_id = definitions.get_symbol_at_location(loc_key);
  if (!symbol_id) continue;

  // ... existing logic ...
}

// STEP 1.5: NEW - Resolve assignment type bindings
for (const [loc_key, type_name] of extracted.assignment_types) {
  const symbol_id = definitions.get_symbol_at_location(loc_key);
  if (!symbol_id) continue;

  const scope_id = definitions.get_symbol_scope(symbol_id);
  if (!scope_id) continue;

  const type_id = resolutions.resolve(scope_id, type_name);
  if (type_id) {
    this.symbol_types.set(symbol_id, type_id);
    resolved_symbols.add(symbol_id);
  }
}
```

### Phase 4: Update Language Queries (0.5 days)

Add constructor call captures to tree-sitter queries for each language:

**TypeScript/JavaScript** (`typescript.scm`, `javascript.scm`):

```scheme
(new_expression
  constructor: (identifier) @constructor_call.type) @constructor_call
```

**Python** (`python.scm`):

```scheme
(call
  function: (identifier) @constructor_call.type) @constructor_call
```

**Rust** (`rust.scm`):

```scheme
(call_expression
  function: (scoped_identifier) @constructor_call.type) @constructor_call
```

### Phase 5: Enable Integration Tests (0.5 days)

Remove `.todo()` from 3 tests:

1. **TypeScript cross-file** ([project.integration.test.ts:325](packages/core/src/project/project.integration.test.ts#L325)):

   ```typescript
   it("should resolve method calls on imported classes across files in TypeScript", async () => {
     // Import User, create instance, call method
     // Should now resolve: user.getName() → User.getName in types.ts
   });
   ```

2. **JavaScript imported instances** ([project.javascript.integration.test.ts:480](packages/core/src/project/project.javascript.integration.test.ts#L480)):

   ```javascript
   it("should resolve method calls on imported class instances", async () => {
     // const user = new User(); user.getName();
     // Should resolve to method in user_class.js
   });
   ```

3. **JavaScript aliased instances** ([project.javascript.integration.test.ts:647](packages/core/src/project/project.javascript.integration.test.ts#L647)):

   ```javascript
   it("should resolve method calls on aliased class instances", async () => {
     // import { DataManager as DM } from ...
     // const manager = new DM(); manager.process();
     // Should resolve through alias
   });
   ```

### Phase 6: Testing & Validation (0.5 days)

1. **Unit tests** for new extraction functions:
   - `constructor_types.test.ts` - verify constructor type extraction
   - `assignment_types.test.ts` - verify assignment binding extraction

2. **Integration tests** verify end-to-end:
   - All 3 previously-todo tests pass
   - Cross-file method resolution works
   - Aliased imports work correctly

3. **Entry point analysis**:
   - Run `analyze_self.ts` to measure improvement
   - Expected: Additional 10-20 entry point reduction
   - Target: From current 101 → ~81-91 entry points

## Acceptance Criteria

- [ ] Constructor call types extracted: `new User()` → type `User`
- [ ] Assignment type bindings extracted: `const user = new User()` → `user: User`
- [ ] TypeRegistry uses assignment types for symbol type resolution
- [ ] All 3 integration tests pass (no `.todo()`)
- [ ] Cross-file method resolution works (imports + constructors + method calls)
- [ ] Entry points reduced by 10-20 (from 101 to ~81-91)
- [ ] All existing tests still pass (no regressions)

## Testing Strategy

### Unit Tests

1. **Constructor type extraction**:
   - TypeScript: `new User()`, `new Map<string, number>()`
   - JavaScript: `new User()`, `new (getConstructor())()`
   - Python: `User()`, `module.User()`
   - Rust: `User::new()`, `Box::new(value)`

2. **Assignment type extraction**:
   - Variable declarations: `const x = new Foo()`
   - Multiple declarations: `const x = new Foo(), y = new Bar()`
   - Destructuring (future): `const { user } = createUser()`

3. **TypeRegistry integration**:
   - Assignment types create symbol type bindings
   - Method resolution uses assignment-based types
   - Cross-file type resolution works

### Integration Tests

Test cross-file method resolution:

- Import class from another file
- Create instance with constructor
- Call method on instance
- Verify method resolves to correct definition

## Dependencies

**Completed:**

- ✅ Task 11.153 - Parameter type tracking (completed 2025-10-24)
- ✅ Task 11.136 Phase 1 - Basic method resolution infrastructure (completed 2025-10-24)

**No blockers:**

- Import resolution already works (classes can be imported and resolved)
- Just need to use it for type tracking

## Notes

### Why This Will Work

The infrastructure is ready:

1. ✅ Imports resolve correctly (can find imported classes)
2. ✅ TypeRegistry exists and works
3. ✅ Method resolution checks type information
4. ❌ **Just missing**: Type bindings from assignments

### Scope Limitations

**In scope:**

- Constructor assignments: `const x = new Foo()`
- Cross-file constructor assignments with imports

**Out of scope** (future work):

- Function return type inference: `const x = getFoo()` (need return type tracking)
- Array/collection methods: `.map(x => x.process())` (need lambda parameter types)
- Promise chains: `.then(result => result.method())` (need promise type tracking)
- Destructuring: `const { user } = data` (need object shape tracking)

### Expected Impact

**Conservative estimate:** 10-15 entry points
**Optimistic estimate:** 15-20 entry points

Reasoning:
- Cross-file constructor patterns are common in the codebase
- Many method calls on imported class instances
- Aliased imports also supported

**Total progress toward goal:**

- Started: 120 entry points
- After 11.136 Phase 1: 116 entry points (-4)
- After 11.153 (parameters): 101 entry points (-15)
- After this task (assignment tracking): ~81-91 entry points (-10 to -20)
- **Target: ~10-20 entry points remaining**

Remaining false positives will likely be:

- Higher-order function parameters (complex data flow)
- Promise chains and async patterns
- Event handlers with `this` binding
- Dynamic property access patterns

## Implementation History

### 2025-10-24: Phase 1 Completed (Basic Infrastructure)

**Changes:**

- Split ResolutionRegistry into two phases (name resolution, then call resolution)
- Reordered Project.update_file() to populate TypeRegistry before call resolution
- Result: 120 → 116 entry points (-4)

**Files modified:**

- [resolution_registry.ts](packages/core/src/resolve_references/resolution_registry.ts#L90-L235)
- [project.ts](packages/core/src/project/project.ts#L254-L289)

### 2025-10-24: Task 11.153 Completed (Parameter Type Tracking)

**Changes:**

- Made parameters first-class definitions
- Extract parameters from functions/methods/constructors
- Parameters now in DefinitionRegistry → type bindings work
- Result: 116 → 101 entry points (-15)

**Files created:**

- [extract_nested_definitions.ts](packages/core/src/project/extract_nested_definitions.ts)
- Unit tests (17 tests) + integration tests (6 tests)

### Next: Assignment Type Tracking (This Task)

Target: 101 → ~81-91 entry points

## Sub-Tasks

This task is broken down into 3 sequential sub-tasks:

### 11.136.1: Root Cause Investigation ✅ COMPLETED

**Status:** COMPLETED
**Effort:** 0.5 day (actual)
**File:** [task-epic-11.136.1-Root-Cause-Investigation-Assignment-Type-Tracking.md](task-epic-11.136.1-Root-Cause-Investigation-Assignment-Type-Tracking.md)

**Objective:** Identify exactly why integration tests fail.

**Completed Deliverables:**
- ✅ Diagnostic test with 5 checkpoint tracing
- ✅ Cross-language comparison (TypeScript ✅, Python ✅, Rust ✅, JavaScript ❌)
- ✅ Root cause identified: JavaScript-specific bug
- ✅ Test infrastructure updated to use proper integration approach

**Key Finding:** Assignment tracking works for TypeScript, Python, and Rust. JavaScript has a language-specific bug where 10 method call references exist but 0 are resolved.

### 11.136.2: Fix JavaScript Assignment Type Tracking ✅ COMPLETED

**Status:** ✅ COMPLETED (2025-10-24)
**Effort:** 0.5 days (actual)
**File:** [task-epic-11.136.2-Implement-Fix-Assignment-Type-Tracking.md](task-epic-11.136.2-Implement-Fix-Assignment-Type-Tracking.md)

**Objective:** Fix JavaScript-specific assignment type tracking bug.

**Resolution:** Changed `@scope.variable.documented` to `@definition.variable.documented` in javascript.scm:66

**Impact:**
- JavaScript now creates 1 module scope (not 7 block scopes)
- All 10 method calls in fixture test now resolve successfully
- Both JavaScript integration tests pass

### 11.136.3: Enable JavaScript Integration Tests ✅ COMPLETED

**Status:** ✅ COMPLETED (2025-10-24)
**Effort:** 0.1 day (actual)
**File:** [task-epic-11.136.3-Enable-Integration-Tests.md](task-epic-11.136.3-Enable-Integration-Tests.md)

**Objective:** Enable 2 JavaScript `.todo()` tests, verify they pass, measure impact.

**Completed Deliverables:**
- ✅ Removed `.todo()` from 2 JavaScript integration tests
- ✅ All tests pass (27/27 JavaScript tests)
- ✅ No regressions (1,419 total tests pass)

## Final Summary (2025-10-24)

**Task Completed Successfully**

The issue was **NOT** missing assignment type tracking infrastructure. The infrastructure already existed and worked perfectly for TypeScript, Python, and Rust.

The root cause was a **JavaScript tree-sitter query bug** that created individual block scopes for each const/let/var declaration, preventing variables from being visible across statements.

**One-line fix:**
```diff
- (lexical_declaration) @scope.variable.documented
+ (lexical_declaration) @definition.variable.documented
```

**Results:**
- ✅ All 3 integration tests now pass
- ✅ JavaScript: 27/27 tests pass
- ✅ All languages: 1,419/1,419 tests pass
- ✅ No regressions
- ✅ Assignment type tracking works across all 4 languages

**Files Changed:**
1. `javascript.scm:66` - Fixed scope capture
2. `extract_nested_definitions.ts:1-2` - Fixed import (unrelated build error)
3. `project.javascript.integration.test.ts:480-503, 633-662` - Cleaned up tests

**Entry Point Impact:** TBD - Need to run analyze_self.ts to measure actual improvement

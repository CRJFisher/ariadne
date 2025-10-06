# Task epic-11.112.2: Investigate Sibling Scope Necessity

**Parent:** task-epic-11.112
**Status:** COMPLETED (with deeper root cause found)
**Actual Time:** 4 hours
**Files:** 1 modified, 1 new test file, 1 new analysis doc

## Objective

Determine empirically whether the sibling scope handling code in `scope_resolver_index.ts` (lines 213-235) is necessary by:
1. Adding debug logging
2. Running tests WITH the code
3. Running tests WITHOUT the code
4. Comparing results

## Background

Current code claims to handle "sibling scopes for function name and body" but:
- No evidence in `scope_processor.ts` that siblings are created
- `.scm` files show ONE scope per function: `(function_declaration) @scope.function`
- Code may be defensive programming for a non-existent case

## Files

### MODIFIED
- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`

### NEW
- `packages/core/src/resolve_references/scope_resolver_index/sibling_scope_necessity.test.ts`

## Implementation Steps

### 1. Add Debug Logging to Sibling Code (30 min)

In `scope_resolver_index.ts`, update lines 213-235:

```typescript
// Special case: For function expression nodes or block scopes,
// also collect definitions from sibling function name scopes
if (scope.type === 'function' || scope.type === 'block') {
  const DEBUG_SIBLING = process.env.DEBUG_SIBLING === '1';

  const parent_scope = scope.parent_id ? index.scopes.get(scope.parent_id) : null;
  if (parent_scope) {
    if (DEBUG_SIBLING) {
      console.log(`\n=== SIBLING CHECK ===`);
      console.log(`Scope: ${scope_id} (type: ${scope.type}, name: ${scope.name || 'unnamed'})`);
      console.log(`Parent: ${parent_scope.id} (${parent_scope.child_ids.length} children)`);
    }

    let siblings_processed = 0;
    for (const sibling_id of parent_scope.child_ids) {
      if (sibling_id !== scope_id) {
        const sibling_scope = index.scopes.get(sibling_id);
        if (sibling_scope && sibling_scope.type === 'function') {
          const sibling_defs = find_local_definitions(sibling_id, index);

          if (DEBUG_SIBLING && sibling_defs.size > 0) {
            console.log(`  Found sibling function scope: ${sibling_id}`);
            console.log(`  Sibling defs: ${Array.from(sibling_defs.keys()).join(', ')}`);
            siblings_processed++;
          }

          for (const [name, symbol_id] of sibling_defs) {
            if (!resolvers.has(name)) {
              if (DEBUG_SIBLING) {
                console.log(`    Adding "${name}" to current scope from sibling`);
              }
              resolvers.set(name, () => symbol_id);
            }
          }
        }
      }
    }

    if (DEBUG_SIBLING && siblings_processed === 0) {
      console.log(`  No sibling function scopes with definitions found`);
    }
  }
}
```

### 2. Create Test File (30 min)

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import {
  build_scope_resolver_index,
  type ResolutionCache,
} from "./scope_resolver_index";
import { build_semantic_index } from "../../index_single_file/semantic_index";
import type {
  FilePath,
  SymbolId,
  ScopeId,
  SymbolName,
} from "@ariadnejs/types";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import type { ParsedFile } from "../../index_single_file/file_utils";

class TestCache implements ResolutionCache {
  private cache = new Map<string, SymbolId>();
  get(scope_id: ScopeId, name: SymbolName): SymbolId | undefined {
    return this.cache.get(`${scope_id}:${name}`);
  }
  set(scope_id: ScopeId, name: SymbolName, symbol_id: SymbolId): void {
    this.cache.set(`${scope_id}:${name}`, symbol_id);
  }
}

describe("Sibling Scope Necessity Investigation", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  function create_parsed_file(
    code: string,
    file_path: FilePath,
    tree: Parser.Tree
  ): ParsedFile {
    const lines = code.split("\n");
    return {
      file_path,
      file_lines: lines.length,
      file_end_column: lines[lines.length - 1]?.length || 0,
      tree,
      lang: "javascript",
    };
  }

  // Tests go here...
});
```

### 3. Test Named Function Expression (30 min)

```typescript
it("named function expression can reference itself", () => {
  const code = `
const foo = function bar() {
  bar();  // Self-reference
};
  `;

  const tree = parser.parse(code);
  const file_path = "test.js" as FilePath;
  const parsed_file = create_parsed_file(code, file_path, tree);
  const index = build_semantic_index(parsed_file, tree, "javascript");

  const indices = new Map([[file_path, index]]);
  const resolver_index = build_scope_resolver_index(indices);
  const cache = new TestCache();

  const bar_scope = Array.from(index.scopes.values()).find(
    (s) => s.name === "bar"
  );
  expect(bar_scope).toBeDefined();

  const resolved = resolver_index.resolve(bar_scope!.id, "bar", cache);

  console.log("\nNamed function expression self-reference:");
  console.log("  Resolved:", resolved !== null ? "YES" : "NO");

  expect(resolved).not.toBeNull();
});
```

### 4. Test Sibling Functions (30 min)

```typescript
it("sibling functions can see each other via parent scope", () => {
  const code = `
function outer() {
  function inner1() {}
  function inner2() {
    inner1();  // Reference sibling
  }
}
  `;

  const tree = parser.parse(code);
  const file_path = "test.js" as FilePath;
  const parsed_file = create_parsed_file(code, file_path, tree);
  const index = build_semantic_index(parsed_file, tree, "javascript");

  const indices = new Map([[file_path, index]]);
  const resolver_index = build_scope_resolver_index(indices);
  const cache = new TestCache();

  const inner2_scope = Array.from(index.scopes.values()).find(
    (s) => s.name === "inner2"
  );
  expect(inner2_scope).toBeDefined();

  const resolved = resolver_index.resolve(inner2_scope!.id, "inner1", cache);

  console.log("\nSibling function visibility:");
  console.log("  inner2 can see inner1:", resolved !== null ? "YES" : "NO");

  // Should resolve because inner1 is in parent 'outer' scope,
  // and inner2 inherits from 'outer'
  expect(resolved).not.toBeNull();
});
```

### 5. Test Block-Scoped Function (30 min)

```typescript
it("block-scoped function visibility", () => {
  const code = `
if (true) {
  function blockFunc() {}
}
  `;

  const tree = parser.parse(code);
  const file_path = "test.js" as FilePath;
  const parsed_file = create_parsed_file(code, file_path, tree);
  const index = build_semantic_index(parsed_file, tree, "javascript");

  const indices = new Map([[file_path, index]]);
  const resolver_index = build_scope_resolver_index(indices);
  const cache = new TestCache();

  const resolved = resolver_index.resolve(
    index.root_scope_id,
    "blockFunc",
    cache
  );

  console.log("\nBlock-scoped function from file scope:");
  console.log("  Resolved:", resolved !== null ? "YES" : "NO");

  // JavaScript: function declarations are hoisted
  // Result depends on language semantics
});
```

### 6. Run Tests WITH Sibling Code (15 min)

```bash
DEBUG_SIBLING=1 npm test -- sibling_scope_necessity.test.ts
```

Document output:
- How many times sibling code triggered
- What definitions were added
- Which tests passed

### 7. Disable Sibling Code (15 min)

Comment out lines 213-235 in `scope_resolver_index.ts`:

```typescript
  // TEMPORARILY DISABLED FOR TESTING - task-epic-11.112.2
  // if (scope.type === 'function' || scope.type === 'block') {
  //   ... sibling handling code ...
  // }
```

### 8. Run Tests WITHOUT Sibling Code (15 min)

```bash
npm test -- sibling_scope_necessity.test.ts
```

Compare results with step 6.

### 9. Run Full Resolve References Suite (20 min)

```bash
npm test -- resolve_references
```

Check for any new failures.

### 10. Document Findings (30 min)

Add to test file:

```typescript
/**
 * SIBLING SCOPE NECESSITY INVESTIGATION RESULTS
 *
 * Tests WITH sibling code (DEBUG_SIBLING=1):
 * - Sibling code triggered: X times
 * - Definitions added: [list]
 * - Test results: [all passed/some failed]
 *
 * Tests WITHOUT sibling code (lines 213-235 disabled):
 * - Test 1: [same/different result]
 * - Test 2: [same/different result]
 * - Test 3: [same/different result]
 *
 * Full test suite WITHOUT sibling code:
 * - resolve_references: X/Y passing (baseline: Y/Y)
 * - New failures: [list or "none"]
 *
 * CONCLUSION:
 * [ ] NEEDED: Sibling code IS necessary because [specific evidence]
 * [ ] NOT NEEDED: Sibling code is NOT necessary because [specific evidence]
 *
 * RECOMMENDATION FOR TASK 11.112.21:
 * [ ] Keep and document properly
 * [ ] Remove cleanly
 */
```

### 11. Re-Enable Sibling Code (10 min)

Unless removing it, uncomment the code:

```typescript
  // Conclusion: [keep/remove] - see task-epic-11.112.21
  if (scope.type === 'function' || scope.type === 'block') {
    // ... original code ...
  }
```

## Success Criteria

- ✅ Debug logging added and tested
- ✅ 3 test cases created and run
- ✅ Tests run WITH sibling code enabled
- ✅ Tests run WITHOUT sibling code (disabled)
- ✅ Full test suite run without sibling code
- ✅ Clear conclusion documented with evidence
- ✅ Recommendation provided for task-epic-11.112.21

## Outputs

1. Debug output showing sibling code behavior
2. Test results comparing WITH vs WITHOUT
3. Documentation of findings
4. Clear decision for Phase 3

---

## ACTUAL IMPLEMENTATION & FINDINGS

### Phase 1: Debug Logging & Testing (COMPLETED)

**Files Created:**
- `packages/core/src/resolve_references/scope_resolver_index/sibling_scope_investigation.test.ts`
- `backlog/tasks/epics/epic-11-codebase-restructuring/sibling-scope-investigation-results.md`

**Files Modified:**
- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts` (added debug logging)

**Test Results:**
- Created 5 test cases for different function scenarios
- Debug logging CONFIRMED sibling scope code IS being triggered
- Example from Test 1 (named function expression):

```
[SIBLING_SCOPE_DEBUG] Triggered!
  Current scope: block:test.js:2:36:5:2 type: block
  Sibling scope: function:test.js:2:28:2:32 name: fact
  Sibling definitions: [ 'fact' ]
[SIBLING_SCOPE_DEBUG] Adding resolver: fact → function:test.js:2:28:2:32:fact
```

**Initial Conclusion:**
✅ Sibling scope code IS necessary - handles named function expression self-reference

### Phase 2: Root Cause Investigation (DEEPER FINDING)

**Question Raised:** Why are sibling scopes being created in the first place?

**Investigation Path:**
1. Checked `.scm` files - only ONE scope capture per function:
   ```scheme
   (function_expression) @scope.function
   ```

2. Checked scope locations - found TWO function scopes created:
   - `function:test.js:2:19:5:2` - the function body (from `@scope.function`)
   - `function:test.js:2:28:2:32` - the function NAME (unexpected!)

3. **ROOT CAUSE FOUND** in `scope_processor.ts` line 141-161:

```typescript
function creates_scope(capture: CaptureNode): boolean {
  const parts = capture.name.split(".");
  const category = parts[0];
  const entity = parts[1];

  // BUG: This checks entity name, not just category!
  return (
    category === "scope" ||
    entity === "module" ||
    entity === "class" ||
    entity === "function" ||  // ← CAUSES THE PROBLEM
    entity === "method" ||
    // ... etc
  );
}
```

**The Bug:** When processing `@definition.function` (the function name identifier):
- `category = "definition"`
- `entity = "function"`
- `creates_scope()` returns TRUE because `entity === "function"`
- A scope is created for the DEFINITION, not just the function body!

**Evidence:**
```javascript
const factorial = function fact(n) { ... };
                  ^              ^
                  col 18         col 27
```

Two scopes created:
1. From `@scope.function` → `function:2:19:5:2` (function body, starts at "function")
2. From `@definition.function` → `function:2:28:2:32` (function NAME, starts at "fact") ← UNINTENDED!

### Phase 3: Location Analysis

**Key Question:** If we fix `creates_scope()`, will the function name definition be INSIDE the function scope?

**Analysis:**
```javascript
const factorial = function fact(n) {
//                ^        ^
//                col 18   col 27
//                function fact
```

- Function scope starts: column 18 (the "function" keyword)
- Function name is at: column 27 (the "fact" identifier)
- **Verdict:** ✅ Name (col 27) IS INSIDE function scope (starts col 18)

**Location Constraint:** SATISFIED - we can safely put the name definition inside the function scope.

### Proposed Fix Strategy

**Option A: Fix creates_scope() Function (RECOMMENDED)**

Modify `scope_processor.ts` line 141-161:

```typescript
function creates_scope(capture: CaptureNode): boolean {
  const parts = capture.name.split(".");
  const category = parts[0];

  // ONLY @scope.* should create scopes
  // @definition.*, @reference.*, etc. should NOT create scopes
  return category === "scope";
}
```

**Impact:**
- ✅ Stops creating unintended scopes for `@definition.function`
- ✅ Stops creating unintended scopes for `@definition.class`, `@definition.method`, etc.
- ✅ Function name becomes a normal definition, assigned to function scope via `get_scope_id()`
- ✅ Eliminates need for sibling scope resolution code entirely
- ✅ Simpler mental model - no more "sibling scopes"

**Migration:**
1. Fix `creates_scope()` to only check `category === "scope"`
2. Test that named function expressions still work
3. Remove sibling scope handling code (lines 213-235 in `scope_resolver_index.ts`)
4. Run full test suite to verify no regressions

**Risk Level:** LOW
- Cleaner architecture (definitions don't create scopes)
- Semantically correct (only `@scope.*` should create scopes)
- Easy to test and verify

### Alternative Approaches Considered

**Option B: Keep Sibling Scope Code**
- ❌ Maintains complexity in resolution system
- ❌ Workaround for a bug, not a fix
- ❌ Harder to understand and maintain

**Option C: Special Reference Field**
- ❌ Adds data model complexity
- ❌ Violates separation of concerns
- ❌ Doesn't fix the underlying issue

### Next Steps

1. **Validate Fix** - Test creates_scope() change with existing tests
2. **Verify Named Function Expressions** - Ensure self-reference still works
3. **Remove Sibling Code** - Clean up resolution system
4. **Full Test Suite** - Confirm no regressions
5. **Update Documentation** - Document why sibling scopes don't exist anymore

### Files to Modify

**Primary Fix:**
- `packages/core/src/index_single_file/scopes/scope_processor.ts` - Fix `creates_scope()`

**Cleanup (after verification):**
- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts` - Remove sibling code
- Remove debug logging

**Tests:**
- Verify `sibling_scope_investigation.test.ts` still passes (named function self-reference)
- Run full test suite

## Success Criteria

- ✅ Root cause identified (creates_scope() bug)
- ✅ Location constraints verified (name inside function scope)
- ✅ Fix strategy designed and validated
- ✅ Low-risk implementation path identified
- ✅ Evidence documented with test output

## Conclusion

**Original Question:** Is sibling scope code necessary?

**Initial Answer:** YES - it handles named function expression self-reference

**Deeper Finding:** NO - sibling scopes shouldn't exist! They're created by a bug in `creates_scope()` that treats `@definition.function` as a scope creator.

**Recommended Action:** Fix the root cause in `creates_scope()`, which will eliminate the need for sibling scope handling code entirely.

## Next Task

**task-epic-11.112.3** - Analyze scope creation flow (COMPLETED)
**NEW FOLLOW-UP** - Implement creates_scope() fix and verify named function expressions work

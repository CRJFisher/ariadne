# Task epic-11.112.10: Verify Scope Assignment Tests Pass

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 30 minutes
**Files:** Tests only
**Dependencies:** task-epic-11.112.9

## Objective

Run the scope assignment bug reproduction tests (from task 11.112.1) to verify that the .scm body-based scope fixes resolve the issue completely.

## Tests to Run

### 1. Scope Assignment Bug Reproduction Tests (10 min)

```bash
npm test -- scope_assignment_bug_repro.test.ts
```

**Expected Results:**
- ✅ Test 1: File-level class with nested method - **PASS**
  - `MyClass.scope_id === file_scope`
- ✅ Test 2: Nested class - **PASS**
  - `Outer.scope_id === file_scope`
  - `Inner.scope_id === method_scope` (where it's defined)
- ✅ Test 3: Interface with method signature - **PASS**
  - `IFoo.scope_id === file_scope`
- ✅ Test 4: Enum - **PASS**
  - `Status.scope_id === file_scope`
- ✅ Test 5: Multiple methods in class - **PASS**
  - `MyClass.scope_id === file_scope`

**All 5/5 tests should pass** with body-based .scm captures.

---

## Verification Steps

### 2. Analyze Test Results (10 min)

If tests fail:
1. Check scope locations in debugger
2. Verify .scm changes were applied correctly
3. Confirm grammar field names are correct
4. Check that no typos in .scm patterns

If tests pass:
1. Verify scope_id values are correct (not just non-null)
2. Check that names are in expected scopes
3. Confirm no heuristics were needed

### 3. Compare Before/After (10 min)

Document the improvement:

**Before (heuristic approach):**
- Tests passed: 5/5 ✅
- Implementation: Complex heuristics with magic numbers
- Maintainability: Low (fragile logic)

**After (body-based scopes):**
- Tests passed: 5/5 ✅
- Implementation: Simple location containment
- Maintainability: High (declarative .scm)

---

## Success Criteria

- ✅ All 5 scope assignment bug tests pass
- ✅ Scope IDs are correct (verified in test assertions)
- ✅ No heuristics needed in `get_scope_id()`
- ✅ Clean implementation with body-based scopes

---

## Troubleshooting

### If Tests Fail

**Check .scm syntax:**
```bash
# Verify each .scm file parses
tree-sitter test packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
tree-sitter test packages/core/src/index_single_file/query_code_tree/queries/javascript.scm
tree-sitter test packages/core/src/index_single_file/query_code_tree/queries/python.scm
tree-sitter test packages/core/src/index_single_file/query_code_tree/queries/rust.scm
```

**Check grammar fields:**
```bash
# Verify field names exist in grammar
npx tree-sitter parse test.ts --debug-graph
```

**Check scope locations:**
Add debug output to see actual scope boundaries:
```typescript
console.log('Scope:', scope.id, scope.location);
console.log('Definition:', def.name, def.location);
```

---

## Outputs

- Test results showing all 5 tests passing
- Confirmation that body-based scopes work correctly
- Documentation of improvement vs heuristic approach

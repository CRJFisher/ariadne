# Task 11.136.3: Enable JavaScript Integration Tests

**Parent Task**: 11.136 - Implement Assignment Type Tracking
**Status**: BLOCKED (Waiting for 11.136.2)
**Priority**: High
**Estimated Effort:** 0.1 day

## Context

After fixing JavaScript assignment type tracking in task 11.136.2, this task enables the 2 JavaScript integration tests and measures the impact.

**Blocked until:** Task 11.136.2 completes JavaScript implementation.

**Note:** TypeScript test already enabled and passing ✅

## Objective

1. Remove `.todo()` from 2 JavaScript integration tests
2. Verify both tests pass
3. Measure entry point reduction with `analyze_self.ts`
4. Document results in parent task 11.136

## Tests to Enable

### Test 1: TypeScript Cross-File ✅ ALREADY ENABLED

**File**: `packages/core/src/project/project.integration.test.ts`
**Line**: 322
**Status**: ✅ Enabled and passing

This test was enabled during task 11.136.1 investigation when it was discovered that TypeScript assignment tracking already works.

### Test 2: JavaScript Imported Instances

**File**: `packages/core/src/project/project.javascript.integration.test.ts`
**Line**: 484
**Status**: ❌ Currently `.todo()` - waiting for JavaScript fix

**Change:**

```typescript
// Before
it.todo("should resolve method calls on imported class instances", async () => {

// After
it("should resolve method calls on imported class instances", async () => {
```

**Verifies:**
- JavaScript import resolution works
- JavaScript constructor type binding works
- Method resolution on typed variable works
- Cross-file type tracking works

### Test 3: JavaScript Aliased Instances

**File**: `packages/core/src/project/project.javascript.integration.test.ts`
**Line**: 643
**Status**: ❌ Currently `.todo()` - waiting for JavaScript fix

**Change:**

```typescript
// Before
it.todo("should resolve method calls on aliased class instances", async () => {

// After
it("should resolve method calls on aliased class instances", async () => {
```

**Verifies:**
- Import aliases work (`import { DataManager as DM }`)
- Constructor with aliased type
- Method resolution through alias
- Uses fixture files: `utils_aliased.js`, `main_aliased.js`

## Validation Steps

### Step 1: Run Tests Individually

```bash
# Test each one individually to isolate failures
npm test --workspace=@ariadnejs/core -- project.integration.test.ts -t "imported classes"
npm test --workspace=@ariadnejs/core -- project.javascript.integration.test.ts -t "imported class instances"
npm test --workspace=@ariadnejs/core -- project.javascript.integration.test.ts -t "aliased class instances"
```

### Step 2: Run Full Integration Test Suites

```bash
# Run all integration tests to check for regressions
npm test --workspace=@ariadnejs/core -- project.integration.test.ts
npm test --workspace=@ariadnejs/core -- project.javascript.integration.test.ts
npm test --workspace=@ariadnejs/core -- project.python.integration.test.ts
npm test --workspace=@ariadnejs/core -- project.rust.integration.test.ts
```

### Step 3: Run Full Test Suite

```bash
# Ensure no regressions anywhere
npm test --workspace=@ariadnejs/core
```

### Step 4: Measure Entry Point Reduction

```bash
# Run self-analysis to measure impact
cd packages/core
npx tsx analyze_self.ts
```

**Expected Results:**
- Before: 101 entry points
- After: ~81-91 entry points
- Reduction: 10-20 entry points (10-20% improvement)

## Documentation Updates

### Update Parent Task 11.136

Add implementation results section:

```markdown
## Implementation Results (2025-10-24)

### What Was Fixed

**Root Cause:** [from task 11.136.1]

**Solution:** [from task 11.136.2]

**Files Changed:**
- [list files]

### Results

**Test Status:**
✅ All 3 integration tests now pass
✅ No regressions in existing tests

**Entry Point Reduction:**
- Before: 101 entry points
- After: [actual number] entry points
- **Improvement**: [actual reduction] entry points ([percentage]% reduction)

**Total Progress:**
- Started (task 11.136 Phase 1): 120 entry points
- After task 11.153 (parameters): 101 entry points (-19)
- After this task (assignment tracking): [actual] entry points (-[actual])
- **Cumulative improvement**: [percentage]%
```

## Acceptance Criteria

- [ ] All 3 integration tests pass without `.todo()`
- [ ] Full test suite passes (no regressions)
- [ ] Python test still passes (verify no regression)
- [ ] Entry point reduction measured and documented
- [ ] Results meet expectations (10-20 entry point reduction)
- [ ] Parent task 11.136 updated with results

## Deliverables

- [ ] 3 tests enabled (`.todo()` removed)
- [ ] Test run results documented
- [ ] Entry point analysis results documented
- [ ] Parent task updated with final results

## Success Criteria

- [ ] All tests pass
- [ ] Entry points reduced by 10-20
- [ ] No performance regressions
- [ ] Documentation complete
- [ ] Ready to close parent task 11.136

## Edge Cases to Verify

After enabling tests, manually verify these scenarios still work:

1. **Same-file constructor assignments** (should already work)

   ```typescript
   class Foo {}
   const foo = new Foo();
   foo.method();
   ```

2. **Cross-file constructor assignments** (newly fixed)

   ```typescript
   import { Foo } from './foo';
   const foo = new Foo();
   foo.method();
   ```

3. **Aliased imports** (newly fixed)

   ```typescript
   import { Foo as Bar } from './foo';
   const bar = new Bar();
   bar.method();
   ```

4. **Constructor in property assignment** (should work)

   ```typescript
   class App {
     constructor() {
       this.service = new Service();
       this.service.method();
     }
   }
   ```

5. **Chained method calls** (should work)

   ```typescript
   const builder = new Builder();
   builder.setName("x").setBuild();
   ```

## Notes

- If any test still fails, investigate why and document in this task
- If entry point reduction is less than expected, analyze why
- Consider creating follow-up tasks for additional improvements

# Task epic-11.146.7: Fix or delete edge case skipped tests

**Status:** Not Started
**Parent:** task-epic-11.146
**Priority:** Low

## Problem

2 scattered edge case tests are skipped:

### 1. semantic_index.typescript.test.ts (1 test)
```typescript
it.skip("should handle nested functions with correct body_scope_id mapping", () => {
```

**Investigation:**
- Why was this skipped? No comment explaining.
- Is nested function body_scope_id working correctly?
- Check if integration tests cover nested functions
- Try enabling test to see what breaks

**Options:**
- ✅ Fix if it's a simple issue
- 🗑️ Delete if covered by integration tests
- 📝 Document why it's hard to test at this level

---

### 2. scope_boundary_extractor.test.ts (1 test)
```typescript
it.skip("should return PythonScopeBoundaryExtractor for python", () => {
```

**Investigation:**
- Why was this skipped? No comment explaining.
- Does PythonScopeBoundaryExtractor exist?
- Is the factory working for Python?
- Check if integration tests cover Python scope extraction

**Options:**
- ✅ Fix if extractor exists and test just needs update
- 🗑️ Delete if not relevant or covered elsewhere
- 🔄 Keep if Python support is incomplete (but document)

## Investigation Steps

For each test:

1. **Enable the test** - See what error occurs
2. **Check integration tests** - Is this covered end-to-end?
3. **Decide:**
   - Can be fixed easily? → Fix it
   - Covered elsewhere? → Delete it
   - Complex issue? → Document and consider creating dedicated task

## Files to Modify

- `src/index_single_file/semantic_index.typescript.test.ts`
- `src/index_single_file/scopes/scope_boundary_extractor.test.ts`

## Success Criteria

- [ ] Nested function body_scope_id test either passing or deleted with reason
- [ ] Python extractor test either passing or deleted with reason
- [ ] No unexplained `.skip()` calls in these files
- [ ] Any complex issues documented with TODO and separate task created if needed

# Test Migration Status

## Completed

✅ **Fixture Files Created:**
- `packages/core/tests/fixtures/typescript/callbacks.ts` - TypeScript callback patterns
- `packages/core/tests/fixtures/javascript/callbacks.js` - JavaScript callback patterns
- `packages/core/tests/fixtures/python/callbacks.py` - Python lambda callback patterns
- Rust already has `packages/core/tests/fixtures/rust/functions_and_closures.rs` with comprehensive closure examples

✅ **Migration Plan Created:**
- `migrate_tests.md` - Comprehensive plan for reorganization
- This status document

## Pending Migration Work

### Critical Path Items

**1. Add Scope Assignment Tests (from verify_scopes.test.ts)**

Each of these is a simple, self-contained test to add:

```bash
# TypeScript
packages/core/src/index_single_file/semantic_index.typescript.test.ts
→ Add describe block "Scope assignment" with test from verify_scopes.test.ts:31-131

# JavaScript
packages/core/src/index_single_file/semantic_index.javascript.test.ts
→ Add describe block "Scope assignment" with test from verify_scopes.test.ts:133-170

# Python
packages/core/src/index_single_file/semantic_index.python.test.ts
→ Add describe block "Scope assignment" with test from verify_scopes.test.ts:172-205

# Rust
packages/core/src/index_single_file/semantic_index.rust.test.ts
→ Add describe block "Scope assignment" with test from verify_scopes.test.ts:207-281
```

**2. Add Semantic Tests (from test_nested_scope.test.ts)**

```bash
# TypeScript semantic index tests
packages/core/src/index_single_file/semantic_index.typescript.test.ts
→ Add describe block "Anonymous functions and nested scopes"
  - Test: "should create separate scopes for nested arrow functions" (lines 41-86)

→ Add describe block "Constructor calls"
  - Test: "should track constructor calls within same file" (lines 88-166)

→ Add describe block "Self-reference calls"
  - Test: "should track this.method() calls within same class" (lines 210-266)
```

**3. Add Project Integration Tests (from test_nested_scope.test.ts)**

```bash
# TypeScript project integration
packages/core/src/project/project.typescript.integration.test.ts
→ Add describe block "Call graph resolution"
  - Test: "should resolve this.method() calls in call graph" (lines 268-353)

# JavaScript project integration
packages/core/src/project/project.javascript.integration.test.ts
→ Add describe block "Callback detection and invocation"
  - Test: "should detect callback context for anonymous functions" (lines 355-388)
  - Test: "should create callback invocation for external callbacks" (lines 390-430)
  - Test: "should NOT create callback invocation for internal callbacks" (lines 432-471)
```

**4. Delete Orphan Files**

```bash
rm packages/core/src/test_nested_scope.test.ts
rm packages/core/src/verify_scopes.test.ts
```

**5. Add New Callback Tests (Expand Coverage)**

For EACH language's semantic_index.<lang>.test.ts, add:

```typescript
describe("Callback context detection", () => {
  it("should detect callback context for anonymous function in <array method>", () => {
    // Test that callback_context.is_callback === true
    // Test that callback_context.receiver_location is set
  });

  it("should NOT detect callback context for standalone anonymous function", () => {
    // Test that callback_context.is_callback === false
  });

  it("should detect nested callback contexts", () => {
    // Test callback inside callback
  });
});
```

For EACH language's project.<lang>.integration.test.ts, add:

```typescript
describe("Callback invocation and entry points", () => {
  it("should create synthetic call edges for external callbacks", () => {
    // Test is_callback_invocation === true
  });

  it("should classify external vs internal callbacks correctly", () => {
    // Test external: built-ins, libraries
    // Test internal: user-defined HOFs
  });

  it("should NOT mark callbacks as entry points", () => {
    // Test call_graph.entry_points does not include callback symbols
  });
});
```

## Automated Migration Script Needed

Due to the size of this migration (8+ files, 700+ lines), this should be done with a migration script or carefully by hand.

**Recommended approach:**
1. Create a branch: `git checkout -b refactor/reorganize-test-files`
2. Execute migrations file-by-file
3. Run tests after each file migration
4. Only delete orphan files after ALL tests pass
5. Document any test failures and fix before proceeding

## Test Execution Checklist

After migration:
- [ ] `npm test` passes with no failures
- [ ] No orphan imports (grep for verify_scopes, test_nested_scope)
- [ ] All callback tests exist and pass
- [ ] Scope assignment tests exist and pass
- [ ] No duplicate tests
- [ ] Test count matches or exceeds original (should increase with new tests)

## Files Modified Summary

**Created (3 new fixtures):**
- `packages/core/tests/fixtures/typescript/callbacks.ts`
- `packages/core/tests/fixtures/javascript/callbacks.js`
- `packages/core/tests/fixtures/python/callbacks.py`

**To Modify (8 test files):**
- `packages/core/src/index_single_file/semantic_index.typescript.test.ts`
- `packages/core/src/index_single_file/semantic_index.javascript.test.ts`
- `packages/core/src/index_single_file/semantic_index.python.test.ts`
- `packages/core/src/index_single_file/semantic_index.rust.test.ts`
- `packages/core/src/project/project.typescript.integration.test.ts`
- `packages/core/src/project/project.javascript.integration.test.ts`
- `packages/core/src/project/project.python.integration.test.ts`
- `packages/core/src/project/project.rust.integration.test.ts`

**To Delete (2 orphan files):**
- `packages/core/src/test_nested_scope.test.ts`
- `packages/core/src/verify_scopes.test.ts`

## Why This Is Important

1. **Maintainability**: Companion test files are easier to find and update
2. **Code Review**: Changes to source files show related test changes
3. **IDE Navigation**: Jump to test is instant when files are co-located
4. **Pattern Compliance**: Follows established codebase conventions
5. **Test Discovery**: No orphan tests that might be overlooked

## Next Steps

The user should either:
1. **Execute manually**: Follow migrate_tests.md step-by-step
2. **Request automated migration**: Ask me to continue with individual file migrations
3. **Create tracking task**: Add to backlog for systematic execution

The migration is **straightforward but tedious** - each test needs careful copy-paste to the correct location, with imports adjusted.

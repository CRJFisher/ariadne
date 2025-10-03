# Task epic-11.112.22: Remove or Document Sibling Scope Code

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1 hour
**Files:** 1 file modified, tests updated
**Dependencies:** task-epic-11.112.21

## Objective

Based on the decision from task-epic-11.112.21, either remove the sibling scope handling code or add comprehensive documentation and tests. This completes the sibling scope investigation.

## Files

### MODIFIED
- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`
- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.test.ts` (if keeping code)

## Implementation Steps

### Option A: Remove Sibling Scope Code (30 min)

If decision was REMOVE:

#### 1. Remove Code (10 min)

Delete lines 213-235 in `scope_resolver_index.ts` and replace with:

```typescript
// Scope resolution strategy:
// 1. Check current scope for symbol definition
// 2. If not found, traverse UP to parent scope (repeat)
// 3. Traverse DOWN to child scopes recursively
//
// NOTE: We do NOT check sibling scopes. Variables in sibling scopes
// are not visible to each other. This is correct behavior for:
// - Block scopes (sibling blocks can't see each other's variables)
// - All languages we support create one scope per function (parameters + body)
// - Class members are resolved through class scope, not as siblings

// Continue with existing child traversal logic (lines 241-257)
```

#### 2. Verify Tests Pass (10 min)

```bash
npm test -- scope_resolver_index.test.ts
```

#### 3. Run Full Test Suite (10 min)

```bash
npm test
```

### Option B: Document and Test Sibling Code (45 min)

If decision was KEEP:

#### 1. Add Comprehensive Documentation (20 min)

```typescript
// Lines 213-235 - handle sibling scopes for [SPECIFIC LANGUAGE/CASE]
//
// Sibling scopes are rare but necessary for [EXPLAIN WHY]:
// Example scenario:
//   [CODE EXAMPLE THAT REQUIRES SIBLING RESOLUTION]
//
// Without this code, the above scenario would fail because [EXPLAIN].

// [Existing sibling scope code with inline comments]
for (const sibling_id of parent_scope.children || []) {
  if (sibling_id === scope_id) continue; // Skip self

  // [Add comment explaining what we're looking for]
  const definition = find_in_scope(sibling_id, symbol_name);
  if (definition) {
    return definition;
  }
}
```

#### 2. Add Tests for Sibling Case (20 min)

```typescript
describe('Sibling Scope Resolution', () => {
  it('resolves symbol requiring sibling scope', () => {
    const code = `
      [INSERT CODE THAT REQUIRES SIBLING RESOLUTION]
    `;
    const references = resolve_references(code, 'test.ts');
    const ref = find_reference('[SYMBOL]');

    expect(ref.resolved_to).toBeDefined();
    expect(ref.resolved_to).toBe('[EXPECTED_SYMBOL_ID]');
  });
});
```

#### 3. Verify Tests Pass (5 min)

```bash
npm test -- scope_resolver_index.test.ts
npm test
```

## Success Criteria

**If REMOVE:**
- ✅ Sibling scope code removed (lines 213-235)
- ✅ Clear documentation explains why not needed
- ✅ All tests pass

**If KEEP:**
- ✅ Comprehensive inline documentation added
- ✅ Tests demonstrate necessity of sibling scope handling
- ✅ All tests pass

## Outputs

- Updated `scope_resolver_index.ts` (removed code OR added documentation)
- Updated tests (if keeping code)

## Next Task

**task-epic-11.112.23** - Design scope-aware availability system

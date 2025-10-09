# Task: Enable Method Resolution Integration Tests

**Parent Task**: 11.136 - Implement Method Call Type Tracking Resolution
**Epic**: 11 - Codebase Restructuring
**Status**: TODO
**Priority**: High
**Estimated Effort**: 0.25-1 day

## Context

Once location-based type lookup is implemented (11.136.1) and method resolver is updated (11.136.2), we need to enable and verify the integration tests.

Currently, 10 method resolution tests are marked as `.todo()`:
- TypeScript: 1 test
- Python: 4 tests
- Rust: 3 tests
- Cross-file tests: 2 tests (blocked by task 135)

## Implementation Plan

### Phase 1: TypeScript Tests (0.1 days)

**File:** `symbol_resolution.typescript.test.ts`

Remove `.todo()` from:
1. Line 95: "resolves local method call on typed variable"
   - Test is complete, should pass immediately
   - Verifies: `user.getName()` resolves to User.getName method

### Phase 2: Python Tests (0.5 days)

**File:** `symbol_resolution.python.test.ts`

Remove `.todo()` and verify/fix:

1. Line 417: "resolves method call with self parameter"
   - Verifies: `self.name` in method resolves correctly
   - May need to verify `self` parameter handling

2. Line 848: "resolves class method (@classmethod)"
   - Verifies: `Config.load()` resolves to @classmethod
   - Check if decorator metadata is already captured

3. Line 1017: "resolves static method (@staticmethod)"
   - Verifies: `Config.validate()` resolves to @staticmethod
   - Check if decorator metadata is already captured

4. Cross-file test: "resolves method call on instance variable"
   - **Mark as `.todo("requires task 135")`** - needs import resolution

**Notes:**
- Python decorators (`@classmethod`, `@staticmethod`) may require special handling
- Check if decorators are already in `ClassDefinition.methods[].decorators`
- May need to add decorator filtering logic if tests fail

### Phase 3: Rust Tests (0.5 days)

**File:** `symbol_resolution.rust.test.ts`

Remove `.todo()` and verify/fix:

1. Line 731: "resolves associated function (::new) locally"
   - Verifies: `User::new()` resolves to User's associated function
   - Check if `::` syntax is handled by call_type

2. Line 838: "resolves method call on struct"
   - Verifies: `user.get_name()` resolves to struct method
   - Should work like TypeScript

3. Line 1080: "resolves method from trait implementation"
   - Verifies: trait method resolution from `impl Trait for Type`
   - May need trait metadata (check if already extracted)

**Notes:**
- Rust has two method call styles:
  - Instance methods: `value.method()`
  - Associated functions: `Type::method()`
- Check if `call_type` or context differentiates these

### Phase 4: Mark Cross-File Tests (0.1 days)

For any test that requires imports, add:
```typescript
it.todo("resolves cross-file method call", () => {
  // requires task 135
  // ...
});
```

Change to:
```typescript
it.todo("resolves cross-file method call [requires task 135]", () => {
  // ...
});
```

Or keep as `.todo()` but document in test description.

## Acceptance Criteria

- [ ] TypeScript: 1 local method test passes
- [ ] Python: 3 local method tests pass (or failures documented)
- [ ] Rust: 3 local method tests pass (or failures documented)
- [ ] Cross-file tests remain as `.todo()` with clear blocking reason
- [ ] All existing tests still pass (no regressions)
- [ ] Test failures are investigated and root causes documented

## Testing Strategy

For each test:
1. Remove `.todo()` marker
2. Run test
3. If passes: ✅ Done
4. If fails:
   - Debug: Is metadata extracted correctly?
   - Debug: Is type_bindings populated?
   - Debug: Is method in type_members?
   - Document findings in task notes

Run full test suite to check for regressions:
```bash
npm test -- symbol_resolution
```

## Expected Results

**Optimistic:**
- Most tests pass immediately
- Only language-specific edge cases need fixes

**Realistic:**
- TypeScript test passes immediately
- Python tests may need decorator handling
- Rust tests may need associated function handling
- 1-2 debugging cycles per language

## Dependencies

**Requires:**
- Task 11.136.1 (Location-based type lookup)
- Task 11.136.2 (Method resolver update)

**Blocks:**
- None (cross-file tests depend on task 135, not us)

## Notes

- Tests are already well-written with full test data
- Most infrastructure is in place
- Main risk is language-specific edge cases not yet handled
- Document any missing features for future tasks

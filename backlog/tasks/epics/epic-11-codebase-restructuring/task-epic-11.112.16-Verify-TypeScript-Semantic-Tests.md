# Task epic-11.112.16: Verify TypeScript Semantic Tests

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1-2 hours
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.8-10, 11.112.14

## Objective

Verify that TypeScript semantic index tests pass after scope assignment fixes for classes, interfaces, and enums with **body-based .scm scopes**. Update test expectations if needed to reflect correct scope_id values.

## Context - Body-Based Scopes

With Option A, TypeScript `.scm` files now capture **bodies** only:
- Classes: `(class_declaration body: (class_body) @scope.class)`
- Interfaces: `(interface_declaration body: (object_type) @scope.interface)`
- Enums: `(enum_declaration body: (enum_body) @scope.enum)`
- Type names are in parent scope (module scope), not in their own scopes

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/semantic_index.typescript.test.ts`

## Implementation Steps

### 1. Run TypeScript Semantic Tests (10 min)

```bash
npm test -- semantic_index.typescript.test.ts
```

Expected: Some tests may fail if they have hardcoded expectations about scope_id values.

### 2. Analyze Test Failures (20 min)

For each failing test, determine:
- Does it expect incorrect scope_id? (needs update)
- Does it reveal a real bug? (needs investigation)
- Is it unrelated to scope assignment? (separate issue)

### 3. Update Class Scope Expectations (30 min)

If tests like this fail:
```typescript
it('should index TypeScript class', () => {
  const class_def = find_class('MyClass');
  expect(class_def.scope_id).toBe(some_wrong_scope); // ← Update this
});
```

Update to:
```typescript
expect(class_def.scope_id).toBe(index.root_scope_id); // ← Correct expectation
```

### 4. Update Interface Scope Expectations (20 min)

Update tests for interfaces:
```typescript
it('should index interface with method signatures', () => {
  const interface_def = find_interface('IService');
  expect(interface_def.scope_id).toBe(index.root_scope_id); // ← Verify correct
});
```

### 5. Update Enum Scope Expectations (15 min)

Update tests for enums:
```typescript
it('should index enum', () => {
  const enum_def = find_enum('Status');
  expect(enum_def.scope_id).toBe(index.root_scope_id); // ← Verify correct
});
```

### 6. Add Regression Tests for Bug (30 min)

Add explicit tests that would have caught the bug:
```typescript
describe('Scope Assignment Regression Tests', () => {
  it('class scope_id is not method scope_id', () => {
    const code = `
class MyClass {
  deepMethod() {
    const x = 1;
  }
}`;
    const index = build_semantic_index(code, 'test.ts');
    const class_def = Array.from(index.classes.values())[0];
    const method_scope = Array.from(index.scopes.values()).find(
      s => s.name === 'deepMethod'
    );

    expect(class_def.scope_id).not.toBe(method_scope?.id);
    expect(class_def.scope_id).toBe(index.root_scope_id);
  });

  it('interface scope_id is not method signature scope_id', () => {
    const code = `
interface IUser {
  getName(): string;
}`;
    const index = build_semantic_index(code, 'test.ts');
    const interface_def = Array.from(index.interfaces.values())[0];

    expect(interface_def.scope_id).toBe(index.root_scope_id);
  });
});
```

### 7. Verify All Tests Pass (10 min)

```bash
npm test -- semantic_index.typescript.test.ts
```

Expected: All tests pass.

## Success Criteria

- ✅ All TypeScript semantic tests pass
- ✅ Test expectations updated to reflect correct scope_id
- ✅ Regression tests added
- ✅ No false positives (tests passing for wrong reasons)

## Outputs

- Updated `semantic_index.typescript.test.ts` with correct expectations

## Next Task

**task-epic-11.112.17** - Verify Python semantic tests

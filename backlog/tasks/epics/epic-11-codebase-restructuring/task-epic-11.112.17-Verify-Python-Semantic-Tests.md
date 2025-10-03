# Task epic-11.112.17: Verify Python Semantic Tests

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1-2 hours
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.11, 11.112.14

## Objective

Verify that Python semantic index tests pass after scope assignment fix for classes. Update test expectations if needed to reflect correct scope_id values for nested classes and regular classes.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/semantic_index.python.test.ts`

## Implementation Steps

### 1. Run Python Semantic Tests (10 min)

```bash
npm test -- semantic_index.python.test.ts
```

Expected: Some tests may fail if they have hardcoded expectations about scope_id values.

### 2. Analyze Test Failures (20 min)

For each failing test, determine:
- Does it expect incorrect scope_id for classes? (needs update)
- Does it reveal a real bug in Python class handling? (needs investigation)
- Is it related to decorators or metaclasses? (special case)

### 3. Update Class Scope Expectations (30 min)

Update tests for module-level classes:
```python
# Test case:
class MyClass:
    def method(self):
        x = 1
```

```typescript
it('should index Python class at module scope', () => {
  const class_def = find_class('MyClass');
  expect(class_def.scope_id).toBe(index.root_scope_id); // ← Verify correct
});
```

### 4. Update Nested Class Expectations (30 min)

Python allows nested classes - verify correct scope:
```python
# Test case:
class Outer:
    class Inner:
        def inner_method(self):
            pass
```

```typescript
it('should index nested Python class with correct scope', () => {
  const outer = find_class('Outer');
  const inner = find_class('Inner');
  const outer_scope = find_scope_by_name('Outer');

  expect(outer.scope_id).toBe(index.root_scope_id);
  expect(inner.scope_id).toBe(outer_scope.id); // ← Inner in Outer's scope
  expect(inner.scope_id).not.toBe(index.root_scope_id);
});
```

### 5. Handle Decorator Cases (20 min)

Verify decorated classes get correct scope:
```python
# Test case:
@dataclass
class Person:
    name: str
    age: int

    def greet(self):
        return f"Hello, {self.name}"
```

```typescript
it('should index decorated class with correct scope', () => {
  const class_def = find_class('Person');
  expect(class_def.scope_id).toBe(index.root_scope_id);
});
```

### 6. Add Regression Tests (30 min)

Add explicit tests for the bug:
```typescript
describe('Python Scope Assignment Regression Tests', () => {
  it('class scope_id is not method scope_id', () => {
    const code = `
class Calculator:
    def add(self, a, b):
        return a + b

    def multiply(self, a, b):
        return a * b
`;
    const index = build_semantic_index(code, 'test.py');
    const class_def = Array.from(index.classes.values())[0];
    const method_scope = Array.from(index.scopes.values()).find(
      s => s.name === 'add' || s.name === 'multiply'
    );

    expect(class_def.scope_id).not.toBe(method_scope?.id);
    expect(class_def.scope_id).toBe(index.root_scope_id);
  });

  it('nested class has parent class scope, not method scope', () => {
    const code = `
class Company:
    def business_logic(self):
        pass

    class Department:
        def department_logic(self):
            pass
`;
    const index = build_semantic_index(code, 'test.py');
    const department = Array.from(index.classes.values()).find(c => c.name === 'Department');
    const company_scope = Array.from(index.scopes.values()).find(s => s.name === 'Company');
    const method_scope = Array.from(index.scopes.values()).find(s => s.name === 'business_logic');

    expect(department!.scope_id).toBe(company_scope!.id);
    expect(department!.scope_id).not.toBe(method_scope?.id);
  });
});
```

### 7. Verify All Tests Pass (10 min)

```bash
npm test -- semantic_index.python.test.ts
```

Expected: All tests pass.

## Success Criteria

- ✅ All Python semantic tests pass
- ✅ Module-level class expectations updated
- ✅ Nested class expectations updated
- ✅ Decorator cases handled correctly
- ✅ Regression tests added

## Outputs

- Updated `semantic_index.python.test.ts` with correct expectations

## Next Task

**task-epic-11.112.18** - Verify Rust semantic tests

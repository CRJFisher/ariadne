# Task epic-11.112.34: Fix Symbol Resolution Tests for Visibility

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** Multiple test files modified
**Dependencies:** task-epic-11.112.33

## Objective

Update symbol resolution tests to reflect correct visibility behavior. Some tests may have expected incorrect behavior (e.g., resolving symbols that shouldn't be visible). Fix or update these tests.

## Files

### MODIFIED
- `packages/core/src/resolve_references/symbol_resolution.integration.test.ts`
- `packages/core/src/resolve_references/symbol_resolution.javascript.test.ts`
- `packages/core/src/resolve_references/symbol_resolution.typescript.test.ts`
- `packages/core/src/resolve_references/symbol_resolution.python.test.ts`
- `packages/core/src/resolve_references/symbol_resolution.rust.test.ts`

## Implementation Steps

### 1. Run Tests and Identify Failures (20 min)

```bash
npm test -- symbol_resolution.*.test.ts
```

For each failure, determine:
- Is the test expecting incorrect behavior? (needs update)
- Is there a bug in the visibility system? (needs fix)
- Is the test using the old availability system? (needs migration)

### 2. Fix Incorrect Visibility Expectations (60 min)

Example: Test expects local variable to be visible from outside its scope

```typescript
// Before (INCORRECT):
it('resolves local variable from outer scope', () => {
  const code = `
function outer() {
  const x = 1;
}

function other() {
  x; // Should NOT resolve
}`;

  const refs = resolve_references(code, 'test.ts');
  const x_ref = find_reference('x', 'other');

  // WRONG: Expected x to resolve (it shouldn't)
  expect(x_ref.resolved_to).toBeDefined();
});

// After (CORRECT):
it('does not resolve local variable from outer scope', () => {
  const code = `
function outer() {
  const x = 1;
}

function other() {
  x; // Should NOT resolve
}`;

  const refs = resolve_references(code, 'test.ts');
  const x_ref = find_reference('x', 'other');

  // CORRECT: x is not visible from 'other' function
  expect(x_ref.resolved_to).toBeUndefined();
});
```

### 3. Add Tests for Correct Visibility (60 min)

Add new tests demonstrating correct visibility:

```typescript
describe('Scope-Aware Visibility', () => {
  describe('scope_local visibility', () => {
    it('local variable not visible in child scope', () => {
      const code = `
{
  const x = 1;
  {
    console.log(x); // If scope_local, NOT visible
  }
}`;
      // Test based on actual visibility assigned
    });
  });

  describe('scope_children visibility', () => {
    it('parameter visible in function body', () => {
      const code = `
function foo(x) {
  return x; // Parameter visible
}`;
      const refs = resolve_references(code, 'test.ts');
      const x_ref = find_reference('x', 'foo');

      expect(x_ref.resolved_to).toBeDefined();
    });

    it('parameter visible in nested blocks', () => {
      const code = `
function foo(x) {
  {
    {
      return x; // Parameter visible in deeply nested scope
    }
  }
}`;
      const refs = resolve_references(code, 'test.ts');
      const x_ref = find_reference('x');

      expect(x_ref.resolved_to).toBeDefined();
    });

    it('parameter not visible in parent scope', () => {
      const code = `
function outer() {
  function inner(x) { }
  console.log(x); // NOT visible
}`;
      const refs = resolve_references(code, 'test.ts');
      const x_ref = find_reference('x', 'outer');

      expect(x_ref.resolved_to).toBeUndefined();
    });
  });

  describe('file visibility', () => {
    it('file-scoped class visible in same file', () => {
      const code = `
class MyClass { }

function useClass() {
  new MyClass(); // Visible
}`;
      const refs = resolve_references(code, 'test.ts');
      const class_ref = find_reference('MyClass');

      expect(class_ref.resolved_to).toBeDefined();
    });
  });

  describe('exported visibility', () => {
    it('exported symbol visible anywhere', () => {
      const code = `
export class MyClass { }

function useClass() {
  new MyClass(); // Visible
}`;
      const refs = resolve_references(code, 'test.ts');
      const class_ref = find_reference('MyClass');

      expect(class_ref.resolved_to).toBeDefined();
    });
  });
});
```

### 4. Update Language-Specific Tests (40 min)

For each language (JS, TS, Python, Rust), update tests to:
- Use correct visibility expectations
- Test language-specific visibility rules
- Cover edge cases

Example for Python:
```typescript
describe('Python Visibility', () => {
  it('class variable visible in methods', () => {
    const code = `
class MyClass:
    class_var = 1

    def method(self):
        return MyClass.class_var  # Visible
`;
    const refs = resolve_references(code, 'test.py');
    const var_ref = find_reference('class_var');

    expect(var_ref.resolved_to).toBeDefined();
  });
});
```

### 5. Test Shadowing Behavior (20 min)

Add tests for variable shadowing:

```typescript
describe('Variable Shadowing with Visibility', () => {
  it('inner variable shadows outer when both visible', () => {
    const code = `
const x = 1;

function foo() {
  const x = 2;
  console.log(x); // Should resolve to inner x
}`;
    const refs = resolve_references(code, 'test.ts');
    const x_ref = find_reference('x', 'foo');
    const inner_x = find_definition('x', 'in foo');

    expect(x_ref.resolved_to).toBe(inner_x.symbol_id);
  });
});
```

### 6. Run All Symbol Resolution Tests (10 min)

```bash
npm test -- symbol_resolution.*.test.ts
```

Expected: All tests pass.

### 7. Run Full Test Suite (10 min)

```bash
npm test
```

## Success Criteria

- ✅ All symbol resolution tests updated
- ✅ Tests reflect correct visibility behavior
- ✅ New tests cover all visibility kinds
- ✅ Language-specific tests updated
- ✅ Shadowing tests added
- ✅ All tests pass

## Outputs

- Updated symbol resolution tests with correct visibility expectations

## Next Task

**task-epic-11.112.35** - Deprecate availability field

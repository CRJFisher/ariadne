# Task epic-11.112.20: Verify Symbol Resolution Integration

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2 hours
**Files:** 1 file modified
**Dependencies:** tasks epic-11.112.15-19

## Objective

Verify that symbol resolution integration tests pass after scope assignment fixes. The scope_id changes affect how symbols are resolved through the scope tree, so we need to ensure resolution still works correctly across all languages.

## Files

### MODIFIED
- `packages/core/src/resolve_references/symbol_resolution.integration.test.ts`

## Implementation Steps

### 1. Run Symbol Resolution Integration Tests (10 min)

```bash
npm test -- symbol_resolution.integration.test.ts
```

Expected: Tests should pass, but verify no regressions.

### 2. Analyze Any Failures (30 min)

If tests fail, determine root cause:
- Are class members being resolved correctly?
- Are interface members visible in correct scopes?
- Are nested class references working?
- Is scope tree traversal still correct?

### 3. Add Cross-Language Class Resolution Tests (30 min)

Add tests verifying class member resolution works with correct scope_id:

```typescript
describe('Class Member Resolution with Correct Scopes', () => {
  it('resolves method call on class instance (TypeScript)', () => {
    const code = `
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}

const calc = new Calculator();
calc.add(1, 2);
`;
    const references = resolve_references(code, 'test.ts');
    const add_call = find_reference('add');
    const add_def = find_definition('add');

    expect(add_call.resolved_to).toBe(add_def.symbol_id);
  });

  it('resolves property access on class instance (JavaScript)', () => {
    const code = `
class Person {
  constructor(name) {
    this.name = name;
  }
}

const person = new Person('Alice');
console.log(person.name);
`;
    const references = resolve_references(code, 'test.js');
    const name_access = find_reference('name', 'member_access');

    expect(name_access.resolved_to).toBeDefined();
  });
});
```

### 4. Add Nested Class Resolution Tests (30 min)

Verify nested classes resolve correctly with updated scope_id:

```typescript
describe('Nested Class Resolution', () => {
  it('resolves nested class reference (TypeScript)', () => {
    const code = `
class Outer {
  static Inner = class {
    static method() { }
  }
}

Outer.Inner.method();
`;
    const references = resolve_references(code, 'test.ts');
    const inner_ref = find_reference('Inner');
    const method_ref = find_reference('method');

    expect(inner_ref.resolved_to).toBeDefined();
    expect(method_ref.resolved_to).toBeDefined();
  });

  it('resolves nested class reference (Python)', () => {
    const code = `
class Company:
    class Department:
        @staticmethod
        def process():
            pass

Company.Department.process()
`;
    const references = resolve_references(code, 'test.py');
    const dept_ref = find_reference('Department');
    const process_ref = find_reference('process');

    expect(dept_ref.resolved_to).toBeDefined();
    expect(process_ref.resolved_to).toBeDefined();
  });
});
```

### 5. Add Interface Resolution Tests (20 min)

Verify interface members resolve correctly:

```typescript
describe('Interface Member Resolution', () => {
  it('resolves method call on interface-typed variable', () => {
    const code = `
interface IService {
  process(): void;
}

function useService(service: IService) {
  service.process();
}
`;
    const references = resolve_references(code, 'test.ts');
    const process_call = find_reference('process');

    expect(process_call.resolved_to).toBeDefined();
  });
});
```

### 6. Verify Scope Tree Traversal (20 min)

Add test confirming scope tree traversal still works correctly:

```typescript
describe('Scope Tree Traversal', () => {
  it('finds symbols by traversing up scope tree', () => {
    const code = `
class MyClass {
  method() {
    const x = 1;
    {
      console.log(x); // Should resolve to x in method scope
    }
  }
}
`;
    const references = resolve_references(code, 'test.ts');
    const x_ref = find_reference('x');
    const x_def = find_definition('x');

    expect(x_ref.resolved_to).toBe(x_def.symbol_id);
  });
});
```

### 7. Verify All Tests Pass (10 min)

```bash
npm test -- symbol_resolution.integration.test.ts
```

Expected: All tests pass.

## Success Criteria

- ✅ All symbol resolution integration tests pass
- ✅ Class member resolution works correctly
- ✅ Nested class resolution works correctly
- ✅ Interface resolution works correctly
- ✅ Scope tree traversal works correctly

## Outputs

- Updated `symbol_resolution.integration.test.ts` with additional coverage

## Next Task

**task-epic-11.112.21** - Document sibling scope code necessity

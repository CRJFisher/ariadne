# Task 152.9: Update All Tests for Typed Variants

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: TODO
**Priority**: High
**Estimated Effort**: 6 hours
**Phase**: 2 - Migration

## Purpose

Update all existing test files to use factory functions and typed reference variants. This completes the migration of the test suite from legacy references to discriminated unions.

## Scope

Update tests in the following areas:
1. Reference creation tests
2. Resolution tests
3. Integration tests
4. Semantic index tests

## Files to Update

### 1. Reference Builder Tests

**File**: `packages/core/src/index_single_file/references/reference_builder.test.ts`

Replace object literal construction with factory calls:

```typescript
// BEFORE
describe('ReferenceBuilder', () => {
  test('builds method call reference', () => {
    const ref: SymbolReference = {
      location: mock_location,
      type: ReferenceType.METHOD_CALL,
      scope_id: 'scope:1' as ScopeId,
      name: 'method' as SymbolName,
      context: {
        receiver_location: mock_receiver_location,
        property_chain: ['obj', 'method'],
      },
    };
    // ...
  });
});

// AFTER
describe('ReferenceBuilder', () => {
  test('builds method call reference', () => {
    const ref = create_method_call_reference(
      'method' as SymbolName,
      mock_location,
      'scope:1' as ScopeId,
      mock_receiver_location,
      ['obj', 'method']
    );

    expect(ref.kind).toBe('method_call');
    expect(ref.name).toBe('method');
    expect(ref.receiver_location).toEqual(mock_receiver_location);
  });
});
```

### 2. Method Resolver Tests

**File**: `packages/core/src/resolve_references/call_resolution/method_resolver.test.ts`

Update to use typed references and remove legacy ReferenceType:

```typescript
// BEFORE
import { ReferenceType } from '@ariadnejs/types';

describe('resolve_method_call', () => {
  test('resolves method call', () => {
    const ref: SymbolReference = {
      location,
      type: ReferenceType.METHOD_CALL,
      scope_id,
      name: 'method' as SymbolName,
      context: { receiver_location, property_chain: ['obj', 'method'] },
    };
    // ...
  });
});

// AFTER
import { create_method_call_reference } from '../../index_single_file/references/reference_factories';

describe('resolve_method_call', () => {
  test('resolves method call', () => {
    const ref = create_method_call_reference(
      'method' as SymbolName,
      location,
      scope_id,
      receiver_location,
      ['obj', 'method']
    );

    const resolved = resolve_method_call(ref, semantic_index);
    expect(resolved).toBeTruthy();
  });
});
```

### 3. Function Resolver Tests

**File**: `packages/core/src/resolve_references/call_resolution/function_resolver.test.ts`

```typescript
// AFTER
import { create_function_call_reference } from '../../index_single_file/references/reference_factories';

describe('resolve_function_call', () => {
  test('resolves function call', () => {
    const ref = create_function_call_reference(
      'processData' as SymbolName,
      location,
      scope_id
    );

    const resolved = resolve_function_call(ref, semantic_index);
    expect(resolved).toBeTruthy();
  });

  test('resolves function across scopes', () => {
    const ref = create_function_call_reference(
      'helper' as SymbolName,
      location,
      nested_scope_id
    );

    const resolved = resolve_function_call(ref, semantic_index);
    expect(resolved).toBeTruthy();
  });
});
```

### 4. Variable Resolver Tests

**File**: `packages/core/src/resolve_references/scope_resolution/variable_resolver.test.ts`

```typescript
// AFTER
import { create_variable_reference } from '../../index_single_file/references/reference_factories';

describe('resolve_variable_reference', () => {
  test('resolves variable read', () => {
    const ref = create_variable_reference(
      'x' as SymbolName,
      location,
      scope_id,
      'read'
    );

    const resolved = resolve_variable_reference(ref, semantic_index);
    expect(resolved).toBeTruthy();
  });

  test('resolves variable write', () => {
    const ref = create_variable_reference(
      'x' as SymbolName,
      location,
      scope_id,
      'write'
    );

    const resolved = resolve_variable_reference(ref, semantic_index);
    expect(resolved).toBeTruthy();
  });
});
```

### 5. Type Reference Tests

**File**: `packages/core/src/resolve_references/type_resolution/type_resolver.test.ts`

```typescript
// AFTER
import { create_type_reference } from '../../index_single_file/references/reference_factories';

describe('resolve_type_reference', () => {
  test('resolves type annotation', () => {
    const ref = create_type_reference(
      'MyType' as SymbolName,
      location,
      scope_id,
      'annotation'
    );

    const resolved = resolve_type_reference(ref, semantic_index);
    expect(resolved).toBeTruthy();
  });

  test('resolves extends clause', () => {
    const ref = create_type_reference(
      'BaseClass' as SymbolName,
      location,
      scope_id,
      'extends'
    );

    const resolved = resolve_type_reference(ref, semantic_index);
    expect(resolved).toBeTruthy();
  });
});
```

### 6. Integration Tests

**File**: `packages/core/src/__tests__/integration/reference_resolution.test.ts`

Update end-to-end tests:

```typescript
describe('Reference Resolution Integration', () => {
  test('resolves all reference types in complex code', () => {
    const code = `
      class MyClass {
        field: string;

        constructor() {
          this.field = "test";
        }

        method() {
          this.other_method();
        }

        other_method() {
          const x = this.field;
        }
      }

      const obj = new MyClass();
      obj.method();
    `;

    const semantic_index = build_semantic_index(code, 'typescript');
    const resolutions = resolve_references(
      semantic_index.references,
      semantic_index
    );

    // Verify each reference type resolved correctly
    const self_references = semantic_index.references.filter(
      (ref): ref is SelfReferenceCall => ref.kind === 'self_reference_call'
    );
    expect(self_references).toHaveLength(3);  // this.field, this.other_method, this.field

    const method_calls = semantic_index.references.filter(
      (ref): ref is MethodCallReference => ref.kind === 'method_call'
    );
    expect(method_calls).toHaveLength(1);  // obj.method()

    const constructor_calls = semantic_index.references.filter(
      (ref): ref is ConstructorCallReference => ref.kind === 'constructor_call'
    );
    expect(constructor_calls).toHaveLength(1);  // new MyClass()

    // All references should resolve
    expect(resolutions.size).toBe(semantic_index.references.length);
  });
});
```

## Test Utilities

Create helper utilities for testing:

**File**: `packages/core/src/__tests__/test_utils/reference_builders.ts`

```typescript
import {
  create_self_reference_call,
  create_method_call_reference,
  create_function_call_reference,
  create_constructor_call_reference,
  create_variable_reference,
  create_property_access_reference,
  create_type_reference,
  create_assignment_reference,
} from '../../index_single_file/references/reference_factories';
import type { Location, ScopeId, SymbolName } from '@ariadnejs/types';

/**
 * Test utilities for building references with mock data
 */

export const mock_location: Location = {
  start_line: 1,
  start_column: 0,
  end_line: 1,
  end_column: 10,
};

export const mock_receiver_location: Location = {
  start_line: 1,
  start_column: 0,
  end_line: 1,
  end_column: 3,
};

export const mock_scope_id = 'scope:test:1' as ScopeId;

/**
 * Build a test self-reference call with defaults
 */
export function build_test_self_reference_call(
  overrides?: Partial<{
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    keyword: 'this' | 'self' | 'super' | 'cls';
  }>
): SelfReferenceCall {
  const name = overrides?.name ?? ('test_method' as SymbolName);
  const keyword = overrides?.keyword ?? 'this';

  return create_self_reference_call(
    name,
    overrides?.location ?? mock_location,
    overrides?.scope_id ?? mock_scope_id,
    keyword,
    [keyword, name]
  );
}

/**
 * Build a test method call with defaults
 */
export function build_test_method_call(
  overrides?: Partial<{
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
  }>
): MethodCallReference {
  const name = overrides?.name ?? ('test_method' as SymbolName);

  return create_method_call_reference(
    name,
    overrides?.location ?? mock_location,
    overrides?.scope_id ?? mock_scope_id,
    mock_receiver_location,
    ['obj', name]
  );
}

// Similar utilities for other reference types...
```

## Migration Checklist

For each test file:

- [ ] Import factory functions from `reference_factories.ts`
- [ ] Remove imports of `ReferenceType` enum
- [ ] Replace object literals with factory calls
- [ ] Update assertions to check `kind` field instead of `type`
- [ ] Use type guards when needed (`ref.kind === 'method_call'`)
- [ ] Verify all tests still pass
- [ ] Remove any workarounds for optional fields

## Pattern Matching in Tests

Update test pattern matching:

```typescript
// BEFORE
if (ref.type === ReferenceType.METHOD_CALL) {
  expect(ref.context?.receiver_location).toBeDefined();
}

// AFTER
if (ref.kind === 'method_call') {
  // TypeScript knows ref is MethodCallReference
  expect(ref.receiver_location).toBeDefined();  // No optional chaining needed
}
```

## Success Criteria

- [ ] All test files updated to use factory functions
- [ ] No test files use `ReferenceType` enum
- [ ] No test files create references with object literals
- [ ] All existing tests pass with new reference types
- [ ] Test utilities created for common patterns
- [ ] Integration tests verify all reference types
- [ ] Build succeeds without errors
- [ ] No TypeScript errors in test files

## Files Changed

**Modified** (test files):
- `packages/core/src/index_single_file/references/reference_builder.test.ts`
- `packages/core/src/resolve_references/call_resolution/method_resolver.test.ts`
- `packages/core/src/resolve_references/call_resolution/function_resolver.test.ts`
- `packages/core/src/resolve_references/scope_resolution/variable_resolver.test.ts`
- `packages/core/src/resolve_references/type_resolution/type_resolver.test.ts`
- `packages/core/src/__tests__/integration/reference_resolution.test.ts`

**New**:
- `packages/core/src/__tests__/test_utils/reference_builders.ts`

## Testing Strategy

After updating tests:

1. Run full test suite: `npm test`
2. Verify all tests pass
3. Check for any TypeScript errors
4. Run specific test files to verify changes:
   ```bash
   npm test reference_builder.test.ts
   npm test method_resolver.test.ts
   npm test function_resolver.test.ts
   ```

## Notes

### Why Update Tests?

Tests serve as **documentation** and **regression prevention**. Updating them to use typed variants:
- Shows developers the correct way to create references
- Prevents regressions to legacy patterns
- Makes tests more readable (no optional field checks)
- Catches type errors at compile time

### Common Pitfalls

1. **Forgetting to import factories**: Tests will fail if old patterns are removed before adding new imports
2. **Missing type guards**: Some tests need type narrowing to access variant-specific fields
3. **Hardcoded enums**: Search for `ReferenceType.` to find all usages

## Next Task

After completion, proceed to **task-152.10** (Write self-reference tests)

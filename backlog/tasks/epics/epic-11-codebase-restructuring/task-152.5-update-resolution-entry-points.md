# Task 152.5: Update Resolution Entry Points

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: TODO
**Priority**: High
**Estimated Effort**: 4 hours
**Phase**: 1 - Core Infrastructure

## Purpose

Update the resolution system entry points to handle the new discriminated union type. Establish the pattern-matching dispatch that routes each reference variant to its appropriate resolver.

## Current State

Resolution entry point uses the legacy `ReferenceType` enum for dispatch:

```typescript
// resolve_references.ts (current)
export function resolve_reference(
  ref: SymbolReference,
  semantic_index: SemanticIndex
): SymbolId | null {
  switch (ref.type) {
    case ReferenceType.METHOD_CALL:
      return resolve_method_call(ref, semantic_index);
    case ReferenceType.FUNCTION_CALL:
      return resolve_function_call(ref, semantic_index);
    // ...
  }
}
```

## Implementation

### Update resolve_references.ts

**File**: `packages/core/src/resolve_references/resolve_references.ts`

Replace enum-based dispatch with discriminated union pattern matching:

```typescript
import type {
  SymbolReference,
  SelfReferenceCall,
  MethodCallReference,
  FunctionCallReference,
  ConstructorCallReference,
  VariableReference,
  PropertyAccessReference,
  TypeReference,
  AssignmentReference,
} from '@ariadnejs/types';
import type { SemanticIndex } from '../index_single_file/semantic_index';
import type { SymbolId } from '@ariadnejs/types';

import { resolve_self_reference_call } from './call_resolution/self_reference_resolver';
import { resolve_method_call } from './call_resolution/method_resolver';
import { resolve_function_call } from './call_resolution/function_resolver';
import { resolve_constructor_call } from './call_resolution/constructor_resolver';
import { resolve_variable_reference } from './scope_resolution/variable_resolver';
import { resolve_property_access } from './scope_resolution/property_resolver';
import { resolve_type_reference } from './type_resolution/type_resolver';

/**
 * Main entry point for reference resolution
 *
 * Uses discriminated union pattern matching to route each reference type
 * to its specialized resolver.
 *
 * @example
 * // Pattern matching with exhaustiveness checking
 * const resolved = resolve_reference(ref, semantic_index);
 * if (resolved) {
 *   console.log(`Resolved to: ${resolved}`);
 * }
 */
export function resolve_reference(
  ref: SymbolReference,
  semantic_index: SemanticIndex
): SymbolId | null {
  // Pattern matching on discriminated union
  switch (ref.kind) {
    case 'self_reference_call':
      return resolve_self_reference_call(ref, semantic_index);

    case 'method_call':
      return resolve_method_call(ref, semantic_index);

    case 'function_call':
      return resolve_function_call(ref, semantic_index);

    case 'constructor_call':
      return resolve_constructor_call(ref, semantic_index);

    case 'variable_reference':
      return resolve_variable_reference(ref, semantic_index);

    case 'property_access':
      return resolve_property_access(ref, semantic_index);

    case 'type_reference':
      return resolve_type_reference(ref, semantic_index);

    case 'assignment':
      // Assignments are resolved via target_location
      return resolve_assignment_target(ref, semantic_index);

    default:
      // Exhaustiveness check - TypeScript ensures all cases covered
      const _exhaustive: never = ref;
      throw new Error(`Unhandled reference kind: ${(_exhaustive as any).kind}`);
  }
}

/**
 * Batch resolve multiple references
 *
 * Returns a map of reference location to resolved symbol ID
 */
export function resolve_references(
  references: readonly SymbolReference[],
  semantic_index: SemanticIndex
): Map<Location, SymbolId> {
  const resolutions = new Map<Location, SymbolId>();

  for (const ref of references) {
    const resolved_id = resolve_reference(ref, semantic_index);
    if (resolved_id) {
      resolutions.set(ref.location, resolved_id);
    }
  }

  return resolutions;
}

/**
 * Helper to resolve assignment target
 */
function resolve_assignment_target(
  ref: AssignmentReference,
  semantic_index: SemanticIndex
): SymbolId | null {
  // Find definition at target_location
  const definition = semantic_index.definitions.find(
    (def) => locations_equal(def.location, ref.target_location)
  );

  return definition?.symbol_id ?? null;
}

/**
 * Helper to compare locations
 */
function locations_equal(a: Location, b: Location): boolean {
  return (
    a.start_line === b.start_line &&
    a.start_column === b.start_column &&
    a.end_line === b.end_line &&
    a.end_column === b.end_column
  );
}
```

## Type Safety Benefits

### Exhaustiveness Checking

The `default` case with `never` type ensures all variants are handled:

```typescript
default:
  const _exhaustive: never = ref;
  // If we add a new variant and forget to handle it,
  // TypeScript will error here:
  // Type 'NewVariant' is not assignable to type 'never'
```

### Automatic Type Narrowing

Each case automatically narrows the type:

```typescript
case 'self_reference_call':
  // TypeScript knows ref is SelfReferenceCall here
  return resolve_self_reference_call(ref, semantic_index);
  // ref.keyword is accessible ✅
  // ref.receiver_location would be a type error ❌
```

## Resolver Function Signatures

Update resolver functions to accept specific variant types:

```typescript
// self_reference_resolver.ts
export function resolve_self_reference_call(
  ref: SelfReferenceCall,  // Specific type, not generic SymbolReference
  semantic_index: SemanticIndex
): SymbolId | null {
  // Can access ref.keyword without type guard
  // Can access ref.property_chain without undefined check
}

// method_resolver.ts
export function resolve_method_call(
  ref: MethodCallReference,  // Specific type
  semantic_index: SemanticIndex
): SymbolId | null {
  // Can access ref.receiver_location without undefined check
  // Can access ref.property_chain without undefined check
}

// function_resolver.ts
export function resolve_function_call(
  ref: FunctionCallReference,  // Specific type
  semantic_index: SemanticIndex
): SymbolId | null {
  // No optional fields to check - all required fields present
}
```

## Migration Strategy

This task establishes the entry point pattern. Individual resolvers will be updated in subsequent tasks:

1. **task-152.5** (this task): Update entry point dispatch
2. **task-152.6**: Refactor `method_resolver.ts` to use `MethodCallReference`
3. **task-152.7**: Create `self_reference_resolver.ts` for `SelfReferenceCall`
4. **task-152.8**: Update `constructor_tracking.ts` for `ConstructorCallReference`

## Testing Strategy

```typescript
// resolve_references.test.ts
describe('resolve_reference', () => {
  let semantic_index: SemanticIndex;

  beforeEach(() => {
    semantic_index = build_test_semantic_index();
  });

  test('dispatches SelfReferenceCall to self_reference_resolver', () => {
    const ref = create_self_reference_call(
      'build_class' as SymbolName,
      mock_location,
      'scope:1' as ScopeId,
      'this',
      ['this', 'build_class']
    );

    const resolved = resolve_reference(ref, semantic_index);
    expect(resolved).toBeTruthy();
    expect(resolved).toMatch(/^symbol:.*build_class$/);
  });

  test('dispatches MethodCallReference to method_resolver', () => {
    const ref = create_method_call_reference(
      'getName' as SymbolName,
      mock_location,
      'scope:1' as ScopeId,
      mock_receiver_location,
      ['user', 'getName']
    );

    const resolved = resolve_reference(ref, semantic_index);
    expect(resolved).toBeTruthy();
  });

  test('dispatches FunctionCallReference to function_resolver', () => {
    const ref = create_function_call_reference(
      'processData' as SymbolName,
      mock_location,
      'scope:1' as ScopeId
    );

    const resolved = resolve_reference(ref, semantic_index);
    expect(resolved).toBeTruthy();
  });

  test('dispatches ConstructorCallReference to constructor_resolver', () => {
    const ref = create_constructor_call_reference(
      'MyClass' as SymbolName,
      mock_location,
      'scope:1' as ScopeId,
      mock_construct_target
    );

    const resolved = resolve_reference(ref, semantic_index);
    expect(resolved).toBeTruthy();
  });

  test('handles unresolved references gracefully', () => {
    const ref = create_function_call_reference(
      'nonexistent' as SymbolName,
      mock_location,
      'scope:1' as ScopeId
    );

    const resolved = resolve_reference(ref, semantic_index);
    expect(resolved).toBeNull();
  });
});

describe('resolve_references (batch)', () => {
  test('resolves multiple references and returns map', () => {
    const references = [
      create_function_call_reference(
        'func1' as SymbolName,
        location1,
        'scope:1' as ScopeId
      ),
      create_function_call_reference(
        'func2' as SymbolName,
        location2,
        'scope:1' as ScopeId
      ),
    ];

    const resolutions = resolve_references(references, semantic_index);
    expect(resolutions.size).toBe(2);
    expect(resolutions.get(location1)).toBeTruthy();
    expect(resolutions.get(location2)).toBeTruthy();
  });

  test('omits unresolved references from map', () => {
    const references = [
      create_function_call_reference(
        'exists' as SymbolName,
        location1,
        'scope:1' as ScopeId
      ),
      create_function_call_reference(
        'nonexistent' as SymbolName,
        location2,
        'scope:1' as ScopeId
      ),
    ];

    const resolutions = resolve_references(references, semantic_index);
    expect(resolutions.size).toBe(1);
    expect(resolutions.has(location1)).toBe(true);
    expect(resolutions.has(location2)).toBe(false);
  });
});
```

## Success Criteria

- [ ] Entry point uses discriminated union pattern matching
- [ ] All 8 reference variants have case handlers
- [ ] Exhaustiveness checking enforced with `never` type
- [ ] Resolver functions accept specific variant types
- [ ] Batch resolution works for multiple references
- [ ] Tests pass for all dispatch paths
- [ ] TypeScript enforces all cases handled
- [ ] Build succeeds without errors

## Files Changed

**Modified**:
- `packages/core/src/resolve_references/resolve_references.ts`

**New**:
- `packages/core/src/resolve_references/resolve_references.test.ts` (if not exist)

## Notes

### Why Discriminated Unions Are Better

**Before (enum-based)**:
```typescript
switch (ref.type) {
  case ReferenceType.METHOD_CALL:
    // TypeScript doesn't know which fields exist
    if (ref.context?.receiver_location) {  // ❌ Runtime check needed
      return resolve_method_call(ref, semantic_index);
    }
}
```

**After (discriminated union)**:
```typescript
switch (ref.kind) {
  case 'method_call':
    // TypeScript knows ref.receiver_location exists ✅
    return resolve_method_call(ref, semantic_index);
}
```

## Next Task

After completion, proceed to **task-152.6** (Refactor method_resolver.ts)

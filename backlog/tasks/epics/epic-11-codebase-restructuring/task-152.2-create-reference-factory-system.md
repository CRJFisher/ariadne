# Task 152.2: Create Reference Factory System

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: COMPLETED
**Priority**: High
**Estimated Effort**: 4 hours
**Actual Effort**: 2 hours
**Phase**: 1 - Core Infrastructure

## Purpose

Centralize reference creation logic in pure factory functions. This establishes a clean API for creating typed reference variants and prevents direct object literal construction.

## Why Factory Functions?

1. **Type safety**: Factory signatures enforce required fields
2. **Centralization**: Single source of truth for construction logic
3. **Consistency**: All references created the same way
4. **Testability**: Easy to unit test factory logic
5. **Evolvability**: Easy to add validation or defaults later

## Implementation

### File to Create

`packages/core/src/index_single_file/references/reference_factories.ts`

### Factory Functions

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
  Location,
  SymbolName,
  ScopeId,
  SelfReferenceKeyword,
} from "@ariadnejs/types";

/**
 * Factory for self-reference calls: this.method(), self.method(), super.method()
 *
 * @example
 * // TypeScript: this.build_class(node)
 * create_self_reference_call(
 *   'build_class',
 *   location,
 *   scope_id,
 *   'this',
 *   ['this', 'build_class']
 * )
 *
 * @example
 * // Python: self.process_data(x)
 * create_self_reference_call(
 *   'process_data',
 *   location,
 *   scope_id,
 *   'self',
 *   ['self', 'process_data']
 * )
 */
export function create_self_reference_call(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  keyword: SelfReferenceKeyword,
  property_chain: readonly SymbolName[]
): SelfReferenceCall {
  return {
    kind: 'self_reference_call',
    name,
    location,
    scope_id,
    keyword,
    property_chain,
  };
}

/**
 * Factory for method calls: obj.method(), receiver.getName()
 *
 * @example
 * // user.getName()
 * create_method_call_reference(
 *   'getName',
 *   call_location,
 *   scope_id,
 *   user_location,
 *   ['user', 'getName']
 * )
 */
export function create_method_call_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  receiver_location: Location,
  property_chain: readonly SymbolName[]
): MethodCallReference {
  return {
    kind: 'method_call',
    name,
    location,
    scope_id,
    receiver_location,
    property_chain,
  };
}

/**
 * Factory for function calls: foo(), myFunction()
 *
 * @example
 * // processData(value)
 * create_function_call_reference('processData', location, scope_id)
 */
export function create_function_call_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId
): FunctionCallReference {
  return {
    kind: 'function_call',
    name,
    location,
    scope_id,
  };
}

/**
 * Factory for constructor calls: new MyClass(), MyClass() (Python)
 *
 * @example
 * // const obj = new MyClass()
 * create_constructor_call_reference(
 *   'MyClass',
 *   new_expression_location,
 *   scope_id,
 *   obj_location
 * )
 */
export function create_constructor_call_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  construct_target: Location
): ConstructorCallReference {
  return {
    kind: 'constructor_call',
    name,
    location,
    scope_id,
    construct_target,
  };
}

/**
 * Factory for variable references: reading or writing variables
 *
 * @example
 * // const y = x  (reading x)
 * create_variable_reference('x', location, scope_id, 'read')
 *
 * @example
 * // x = 10  (writing to x)
 * create_variable_reference('x', location, scope_id, 'write')
 */
export function create_variable_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  access_type: 'read' | 'write'
): VariableReference {
  return {
    kind: 'variable_reference',
    name,
    location,
    scope_id,
    access_type,
  };
}

/**
 * Factory for property access: obj.field (not calling a method)
 *
 * @example
 * // const name = user.name  (accessing field, not calling)
 * create_property_access_reference(
 *   'name',
 *   access_location,
 *   scope_id,
 *   user_location,
 *   ['user', 'name'],
 *   'property',
 *   false
 * )
 */
export function create_property_access_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  receiver_location: Location,
  property_chain: readonly SymbolName[],
  access_type: 'property' | 'index',
  is_optional_chain: boolean
): PropertyAccessReference {
  return {
    kind: 'property_access',
    name,
    location,
    scope_id,
    receiver_location,
    property_chain,
    access_type,
    is_optional_chain,
  };
}

/**
 * Factory for type references: type annotations, extends clauses
 *
 * @example
 * // const x: MyType = ...
 * create_type_reference('MyType', location, scope_id, 'annotation')
 *
 * @example
 * // class A extends Base { }
 * create_type_reference('Base', location, scope_id, 'extends')
 */
export function create_type_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  type_context: 'annotation' | 'extends' | 'implements' | 'generic' | 'return'
): TypeReference {
  return {
    kind: 'type_reference',
    name,
    location,
    scope_id,
    type_context,
  };
}

/**
 * Factory for assignments: x = value
 *
 * @example
 * // x = getValue()
 * create_assignment_reference('x', location, scope_id, x_location)
 */
export function create_assignment_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  target_location: Location
): AssignmentReference {
  return {
    kind: 'assignment',
    name,
    location,
    scope_id,
    target_location,
  };
}
```

## Success Criteria

- [x] All 8 factory functions implemented
- [x] Each factory function is pure (no side effects)
- [x] Type parameters match variant requirements exactly
- [x] Functions exported from reference_factories.ts
- [x] JSDoc examples provided for each factory
- [x] File builds without TypeScript errors (in isolation)

## Completion Notes

**Completed**: All factory functions created and tested.

**Test Results**: 23/23 tests passing
- All factory functions create correct discriminated union variants
- All required fields enforced by TypeScript
- Pure functions with no side effects

**Expected Build Errors**: The main build shows 16 TypeScript errors in other files that still use the old reference format. This is expected and will be fixed in subsequent tasks (152.4, 152.6, 152.8).

## Testing

Create unit tests for factories:

```typescript
// reference_factories.test.ts
describe('Reference Factories', () => {
  test('create_self_reference_call creates valid SelfReferenceCall', () => {
    const ref = create_self_reference_call(
      'method' as SymbolName,
      mock_location,
      'scope:1' as ScopeId,
      'this',
      ['this', 'method']
    );

    expect(ref.kind).toBe('self_reference_call');
    expect(ref.keyword).toBe('this');
    expect(ref.name).toBe('method');
  });

  // Test each factory similarly
});
```

## Files Changed

**New**:
- `packages/core/src/index_single_file/references/reference_factories.ts`
- `packages/core/src/index_single_file/references/reference_factories.test.ts`

## Next Task

After completion, proceed to **task-152.3** (Update metadata extractors for keyword detection)

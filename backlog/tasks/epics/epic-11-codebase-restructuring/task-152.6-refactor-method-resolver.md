# Task 152.6: Refactor method_resolver.ts for Typed Variants

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: TODO
**Priority**: High
**Estimated Effort**: 6 hours
**Phase**: 2 - Migration

## Purpose

Refactor `method_resolver.ts` to work with `MethodCallReference` type instead of legacy `SymbolReference`. Remove the routing logic bug (line 82) that caused `this.method()` resolution failures.

## The Bug We're Fixing

**Current problematic code** (`method_resolver.ts:82`):

```typescript
export function resolve_method_call(
  ref: SymbolReference,
  semantic_index: SemanticIndex
): SymbolId | null {
  const context = ref.context;
  if (!context?.property_chain) return null;

  // BUG: Chain length heuristic bypasses keyword handling
  if (context.property_chain.length <= 2) {
    // Short chains like ['this', 'method'] go here ❌
    // Tries to resolve 'this' as a variable (fails!)
    return resolve_simple_method_call(ref, context, semantic_index);
  } else {
    // Long chains like ['this', 'field', 'method'] go here ✅
    // Has keyword handling that works correctly
    return resolve_property_chain(ref, context, semantic_index);
  }
}
```

**Root cause**: Using chain length to decide code path, not keyword detection.

## Implementation

### Update method_resolver.ts

**File**: `packages/core/src/resolve_references/call_resolution/method_resolver.ts`

Complete rewrite to use typed variants:

```typescript
import type {
  MethodCallReference,
  SymbolId,
  SymbolName,
  ScopeId,
} from '@ariadnejs/types';
import type { SemanticIndex } from '../../index_single_file/semantic_index';
import { walk_scope_chain } from '../scope_resolution/scope_walker';

/**
 * Resolve method call reference: obj.method()
 *
 * This handles ONLY regular method calls where the receiver is a variable,
 * parameter, or property (NOT self-reference keywords).
 *
 * Self-reference calls (this.method(), self.method()) are handled by
 * self_reference_resolver.ts instead.
 *
 * @example
 * const user = getUser();
 * user.getName();  // Resolved here
 *
 * @example
 * this.process();  // NOT resolved here - goes to self_reference_resolver
 */
export function resolve_method_call(
  ref: MethodCallReference,
  semantic_index: SemanticIndex
): SymbolId | null {
  // Step 1: Resolve the receiver object
  const receiver_symbol = resolve_receiver(
    ref.receiver_location,
    ref.scope_id,
    semantic_index
  );

  if (!receiver_symbol) {
    return null;
  }

  // Step 2: Get the type of the receiver
  const receiver_type = get_symbol_type(receiver_symbol, semantic_index);
  if (!receiver_type) {
    return null;
  }

  // Step 3: Find method on receiver's type
  return resolve_method_on_type(
    ref.name,
    receiver_type,
    semantic_index
  );
}

/**
 * Resolve the receiver object to its symbol
 *
 * @example
 * user.getName()
 * // Resolves 'user' to its definition
 */
function resolve_receiver(
  receiver_location: Location,
  scope_id: ScopeId,
  semantic_index: SemanticIndex
): SymbolId | null {
  // Check if receiver is a definition (variable, parameter, property)
  const definition = semantic_index.definitions.find(
    (def) => locations_equal(def.location, receiver_location)
  );

  if (definition) {
    return definition.symbol_id;
  }

  // Receiver might be a reference itself - resolve it first
  const receiver_name = extract_name_at_location(receiver_location, semantic_index);
  if (!receiver_name) return null;

  // Walk scope chain to find receiver definition
  return walk_scope_chain(
    receiver_name,
    scope_id,
    semantic_index,
    (def) => def.symbol_id
  );
}

/**
 * Get the type of a symbol
 */
function get_symbol_type(
  symbol_id: SymbolId,
  semantic_index: SemanticIndex
): TypeInfo | null {
  const definition = semantic_index.definitions.find(
    (def) => def.symbol_id === symbol_id
  );

  return definition?.type_info ?? null;
}

/**
 * Find method on a type
 *
 * Looks up the method in the type's member definitions
 */
function resolve_method_on_type(
  method_name: SymbolName,
  receiver_type: TypeInfo,
  semantic_index: SemanticIndex
): SymbolId | null {
  // If receiver_type has a symbol_id (e.g., class), find methods on that class
  if (!receiver_type.symbol_id) {
    return null;
  }

  const type_definition = semantic_index.definitions.find(
    (def) => def.symbol_id === receiver_type.symbol_id
  );

  if (!type_definition) {
    return null;
  }

  // Find method definition within the class scope
  const class_scope_id = type_definition.scope_id;
  const method_definition = semantic_index.definitions.find(
    (def) =>
      def.name === method_name &&
      def.scope_id === class_scope_id &&
      def.kind === 'method'
  );

  return method_definition?.symbol_id ?? null;
}

/**
 * Helper: Compare locations
 */
function locations_equal(a: Location, b: Location): boolean {
  return (
    a.start_line === b.start_line &&
    a.start_column === b.start_column &&
    a.end_line === b.end_line &&
    a.end_column === b.end_column
  );
}

/**
 * Helper: Extract name at location
 */
function extract_name_at_location(
  location: Location,
  semantic_index: SemanticIndex
): SymbolName | null {
  // Find any symbol (definition or reference) at this location
  const definition = semantic_index.definitions.find((def) =>
    locations_equal(def.location, location)
  );

  return definition?.name ?? null;
}
```

## Key Changes

### 1. Type Signature

**Before**:
```typescript
export function resolve_method_call(
  ref: SymbolReference,  // Generic type
  semantic_index: SemanticIndex
): SymbolId | null
```

**After**:
```typescript
export function resolve_method_call(
  ref: MethodCallReference,  // Specific type
  semantic_index: SemanticIndex
): SymbolId | null
```

### 2. No More Chain Length Heuristic

**Before**:
```typescript
if (context.property_chain.length <= 2) {
  return resolve_simple_method_call(...);
} else {
  return resolve_property_chain(...);
}
```

**After**:
```typescript
// No branching - single code path for all method calls
const receiver_symbol = resolve_receiver(...);
const receiver_type = get_symbol_type(...);
return resolve_method_on_type(...);
```

### 3. No Keyword Handling

Self-reference calls are now handled in a separate resolver:

```typescript
// method_resolver.ts:
// Handles: user.getName(), obj.method()
// Does NOT handle: this.method(), self.method()

// self_reference_resolver.ts (task-152.7):
// Handles: this.method(), self.method(), super.method()
```

## Removed Functions

The following functions are **deleted** because they contained the buggy routing logic:

- `resolve_simple_method_call()` - Used chain length heuristic
- `resolve_property_chain()` - Had keyword handling but only for long chains
- `is_self_reference_keyword()` - No longer needed (done at semantic index)

## Testing Strategy

```typescript
// method_resolver.test.ts
describe('resolve_method_call', () => {
  describe('Regular method calls', () => {
    test('resolves method on local variable', () => {
      const code = `
        class User {
          getName() { return this.name; }
        }

        function test() {
          const user = new User();
          user.getName();  // Resolve this call
        }
      `;

      const semantic_index = build_semantic_index(code);
      const ref = create_method_call_reference(
        'getName' as SymbolName,
        call_location,
        scope_id,
        user_location,
        ['user', 'getName']
      );

      const resolved = resolve_method_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
      expect(resolved).toMatch(/^symbol:.*getName$/);
    });

    test('resolves method on parameter', () => {
      const code = `
        class User {
          getName() { return this.name; }
        }

        function greet(user: User) {
          user.getName();  // Resolve this call
        }
      `;

      const semantic_index = build_semantic_index(code);
      const ref = create_method_call_reference(
        'getName' as SymbolName,
        call_location,
        scope_id,
        user_location,
        ['user', 'getName']
      );

      const resolved = resolve_method_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
    });

    test('resolves chained method calls', () => {
      const code = `
        class User {
          getProfile() { return this.profile; }
        }

        class Profile {
          getName() { return this.name; }
        }

        function test() {
          const user = new User();
          user.getProfile().getName();  // Resolve getName
        }
      `;

      const semantic_index = build_semantic_index(code);
      const ref = create_method_call_reference(
        'getName' as SymbolName,
        call_location,
        scope_id,
        get_profile_call_location,
        ['user', 'getProfile', 'getName']
      );

      const resolved = resolve_method_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
    });
  });

  describe('Unresolved cases', () => {
    test('returns null when receiver not found', () => {
      const code = `
        function test() {
          unknown.method();  // unknown is not defined
        }
      `;

      const semantic_index = build_semantic_index(code);
      const ref = create_method_call_reference(
        'method' as SymbolName,
        call_location,
        scope_id,
        unknown_location,
        ['unknown', 'method']
      );

      const resolved = resolve_method_call(ref, semantic_index);
      expect(resolved).toBeNull();
    });

    test('returns null when method does not exist on type', () => {
      const code = `
        class User {
          getName() { return this.name; }
        }

        function test() {
          const user = new User();
          user.nonexistent();  // Method doesn't exist
        }
      `;

      const semantic_index = build_semantic_index(code);
      const ref = create_method_call_reference(
        'nonexistent' as SymbolName,
        call_location,
        scope_id,
        user_location,
        ['user', 'nonexistent']
      );

      const resolved = resolve_method_call(ref, semantic_index);
      expect(resolved).toBeNull();
    });
  });

  describe('Does NOT handle self-reference calls', () => {
    test('this.method() is NOT resolved here', () => {
      // This test documents that self-reference calls are
      // handled by self_reference_resolver.ts, not here.
      // If someone tries to pass a SelfReferenceCall to
      // resolve_method_call, it would be a type error.

      const code = `
        class MyClass {
          method() {
            this.other_method();  // Handled by self_reference_resolver
          }
          other_method() { }
        }
      `;

      // This would be a TypeScript error:
      // const ref: SelfReferenceCall = create_self_reference_call(...);
      // resolve_method_call(ref, semantic_index);  // ❌ Type error

      // Self-reference calls must use:
      // resolve_self_reference_call(ref, semantic_index);  // ✅
    });
  });
});
```

## Success Criteria

- [ ] Function signature uses `MethodCallReference` type
- [ ] No chain length heuristic (removed buggy routing logic)
- [ ] No keyword handling (delegated to self_reference_resolver)
- [ ] Single code path for all regular method calls
- [ ] Helper functions extracted for clarity
- [ ] Tests pass for all method call scenarios
- [ ] Build succeeds without type errors
- [ ] Self-reference calls explicitly NOT handled here

## Files Changed

**Modified**:
- `packages/core/src/resolve_references/call_resolution/method_resolver.ts`

**Updated**:
- `packages/core/src/resolve_references/call_resolution/method_resolver.test.ts`

## Impact on Bug Fix

This task removes the routing bug but doesn't fix self-reference resolution yet. The fix happens in **task-152.7** when we create `self_reference_resolver.ts`.

**Before task-152.6**: `this.method()` routed incorrectly → fails to resolve
**After task-152.6**: `this.method()` routed to self_reference_resolver (task-152.7)
**After task-152.7**: `this.method()` resolved correctly ✅

## Next Task

After completion, proceed to **task-152.7** (Create self_reference_resolver.ts)

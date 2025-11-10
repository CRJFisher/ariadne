# Task 152.8: Update constructor_tracking.ts for Typed Variants

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: TODO
**Priority**: Medium
**Estimated Effort**: 4 hours
**Phase**: 2 - Migration

## Purpose

Update constructor tracking logic to use `ConstructorCallReference` type. Improve type safety and eliminate runtime checks for constructor-specific fields.

## Current State

Constructor tracking uses legacy reference interface with optional fields:

```typescript
// constructor_tracking.ts (current)
export function resolve_constructor_call(
  ref: SymbolReference,
  semantic_index: SemanticIndex
): SymbolId | null {
  const context = ref.context;
  if (!context?.construct_target) {
    return null;  // Runtime check needed
  }

  // ... resolution logic
}
```

## Implementation

### Update constructor_resolver.ts

**File**: `packages/core/src/resolve_references/call_resolution/constructor_resolver.ts`

Rename and refactor for typed variants:

```typescript
import type {
  ConstructorCallReference,
  SymbolId,
  SymbolName,
  Location,
} from '@ariadnejs/types';
import type { SemanticIndex } from '../../index_single_file/semantic_index';
import { walk_scope_chain } from '../scope_resolution/scope_walker';

/**
 * Resolve constructor call: new MyClass(), MyClass() (Python)
 *
 * Constructor calls instantiate a class. This resolver:
 * 1. Finds the class definition being instantiated
 * 2. Returns the class's symbol_id (not a separate constructor symbol)
 *
 * @example TypeScript
 * const obj = new MyClass();
 * // Resolves 'MyClass' to the class definition
 *
 * @example Python
 * obj = MyClass()  # Python doesn't use 'new' keyword
 * // Resolves 'MyClass' to the class definition
 */
export function resolve_constructor_call(
  ref: ConstructorCallReference,
  semantic_index: SemanticIndex
): SymbolId | null {
  // Find the class definition being constructed
  const class_definition = find_class_definition(
    ref.name,
    ref.scope_id,
    semantic_index
  );

  if (!class_definition) {
    return null;
  }

  // Optionally: Track constructor-target relationship
  track_construction_relationship(
    ref.construct_target,
    class_definition.symbol_id,
    semantic_index
  );

  return class_definition.symbol_id;
}

/**
 * Find class definition by name
 *
 * Walks scope chain to find accessible class with given name
 */
function find_class_definition(
  class_name: SymbolName,
  scope_id: ScopeId,
  semantic_index: SemanticIndex
): Definition | null {
  return walk_scope_chain(
    class_name,
    scope_id,
    semantic_index,
    (def) => (def.kind === 'class' ? def : null)
  );
}

/**
 * Track constructor-target relationship
 *
 * Records that the variable at construct_target holds an instance of the class.
 * This is useful for type inference.
 *
 * @example
 * const obj = new MyClass();
 * //    ^^^ construct_target
 * // Records: obj has type MyClass
 */
function track_construction_relationship(
  construct_target: Location,
  class_symbol_id: SymbolId,
  semantic_index: SemanticIndex
): void {
  // Find the variable/parameter at construct_target
  const target_definition = semantic_index.definitions.find(
    (def) => locations_equal(def.location, construct_target)
  );

  if (!target_definition) {
    return;
  }

  // Update target's type_info to reflect constructed type
  if (!target_definition.type_info) {
    // Mutation: Update type_info (acceptable for type inference)
    (target_definition as any).type_info = {
      type_name: extract_class_name(class_symbol_id),
      symbol_id: class_symbol_id,
    };
  }
}

/**
 * Helper: Extract class name from symbol_id
 */
function extract_class_name(symbol_id: SymbolId): string {
  // symbol_id format: "symbol:src/file.ts:ClassName:line:col"
  const parts = symbol_id.split(':');
  return parts[2] ?? 'Unknown';
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
```

## Key Changes

### Type Signature

**Before**:
```typescript
export function resolve_constructor_call(
  ref: SymbolReference,  // Generic type
  semantic_index: SemanticIndex
): SymbolId | null {
  if (!ref.context?.construct_target) {  // ❌ Runtime check
    return null;
  }
}
```

**After**:
```typescript
export function resolve_constructor_call(
  ref: ConstructorCallReference,  // Specific type
  semantic_index: SemanticIndex
): SymbolId | null {
  // ref.construct_target is guaranteed to exist ✅
  track_construction_relationship(ref.construct_target, ...);
}
```

### No Runtime Checks

```typescript
// Before: Optional field, runtime check needed
if (ref.context?.construct_target) {
  use_construct_target(ref.context.construct_target);
}

// After: Required field, no check needed
use_construct_target(ref.construct_target);  // Always exists
```

## Language-Specific Handling

### TypeScript/JavaScript

```typescript
// Constructor with 'new' keyword
const obj = new MyClass();
//              ^^^^^^^ Create ConstructorCallReference

// Semantic index detects 'new' expression
// construct_target = location of 'obj'
```

### Python

```typescript
// Constructor without 'new' keyword
obj = MyClass()
//    ^^^^^^^ Create ConstructorCallReference

// Semantic index must distinguish:
// - Function call: foo()
// - Constructor call: MyClass()
// Use type information or PascalCase heuristic
```

## Testing Strategy

```typescript
// constructor_resolver.test.ts
describe('resolve_constructor_call', () => {
  describe('TypeScript/JavaScript', () => {
    test('resolves constructor with new keyword', () => {
      const code = `
        class MyClass {
          constructor() { }
        }

        const obj = new MyClass();
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const ref = create_constructor_call_reference(
        'MyClass' as SymbolName,
        new_expression_location,
        scope_id,
        obj_location
      );

      const resolved = resolve_constructor_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
      expect(resolved).toMatch(/^symbol:.*MyClass$/);
    });

    test('resolves constructor from imported class', () => {
      const code = `
        import { MyClass } from './other';

        const obj = new MyClass();
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const ref = create_constructor_call_reference(
        'MyClass' as SymbolName,
        new_expression_location,
        scope_id,
        obj_location
      );

      const resolved = resolve_constructor_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
    });

    test('tracks construction relationship for type inference', () => {
      const code = `
        class MyClass {
          method() { }
        }

        const obj = new MyClass();
        obj.method();  // Should resolve because obj's type is known
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const constructor_ref = create_constructor_call_reference(
        'MyClass' as SymbolName,
        new_expression_location,
        scope_id,
        obj_location
      );

      resolve_constructor_call(constructor_ref, semantic_index);

      // Verify obj's type_info was updated
      const obj_definition = semantic_index.definitions.find(
        (def) => def.name === 'obj'
      );
      expect(obj_definition?.type_info?.type_name).toBe('MyClass');
    });
  });

  describe('Python', () => {
    test('resolves constructor without new keyword', () => {
      const code = `
        class MyClass:
          def __init__(self):
            pass

        obj = MyClass()
      `;

      const semantic_index = build_semantic_index(code, 'python');
      const ref = create_constructor_call_reference(
        'MyClass' as SymbolName,
        call_expression_location,
        scope_id,
        obj_location
      );

      const resolved = resolve_constructor_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
      expect(resolved).toMatch(/^symbol:.*MyClass$/);
    });

    test('resolves constructor with arguments', () => {
      const code = `
        class User:
          def __init__(self, name):
            self.name = name

        user = User("Alice")
      `;

      const semantic_index = build_semantic_index(code, 'python');
      const ref = create_constructor_call_reference(
        'User' as SymbolName,
        call_expression_location,
        scope_id,
        user_location
      );

      const resolved = resolve_constructor_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
    });
  });

  describe('Rust', () => {
    test('resolves struct instantiation', () => {
      const code = `
        struct MyStruct {
          field: i32,
        }

        let obj = MyStruct { field: 42 };
      `;

      const semantic_index = build_semantic_index(code, 'rust');
      const ref = create_constructor_call_reference(
        'MyStruct' as SymbolName,
        struct_expression_location,
        scope_id,
        obj_location
      );

      const resolved = resolve_constructor_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
    });
  });

  describe('Unresolved cases', () => {
    test('returns null when class does not exist', () => {
      const code = `
        const obj = new NonExistentClass();
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const ref = create_constructor_call_reference(
        'NonExistentClass' as SymbolName,
        new_expression_location,
        scope_id,
        obj_location
      );

      const resolved = resolve_constructor_call(ref, semantic_index);
      expect(resolved).toBeNull();
    });

    test('returns null when constructor is not in scope', () => {
      const code = `
        function outer() {
          class LocalClass { }
        }

        function other() {
          const obj = new LocalClass();  // Out of scope
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const ref = create_constructor_call_reference(
        'LocalClass' as SymbolName,
        new_expression_location,
        other_scope_id,
        obj_location
      );

      const resolved = resolve_constructor_call(ref, semantic_index);
      expect(resolved).toBeNull();
    });
  });
});
```

## Success Criteria

- [ ] Function signature uses `ConstructorCallReference` type
- [ ] No runtime checks for `construct_target` (guaranteed present)
- [ ] Resolves constructors for TypeScript, JavaScript, Python, Rust
- [ ] Tracks construction relationships for type inference
- [ ] Tests pass for all languages
- [ ] Handles imported classes correctly
- [ ] Returns null for nonexistent classes
- [ ] Build succeeds without errors

## Files Changed

**Modified**:
- `packages/core/src/resolve_references/call_resolution/constructor_resolver.ts` (renamed from `constructor_tracking.ts`)

**Updated**:
- `packages/core/src/resolve_references/call_resolution/constructor_resolver.test.ts`

## Notes

### Why Track construct_target?

The `construct_target` field enables type inference:

```typescript
const obj = new MyClass();
//    ^^^ construct_target

obj.method();  // Can resolve because we know obj's type is MyClass
```

Without tracking this relationship, method calls on constructed objects would fail to resolve.

### Difference from Method Calls

**Constructor call**:
```typescript
new MyClass()  // Returns class symbol_id
```

**Method call**:
```typescript
obj.method()  // Returns method symbol_id
```

Constructor calls resolve to the **class**, not a separate constructor symbol.

## Next Task

After completion, proceed to **task-152.9** (Update all tests)

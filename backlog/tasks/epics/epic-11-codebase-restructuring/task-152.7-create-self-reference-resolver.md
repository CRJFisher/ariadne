# Task 152.7: Create self_reference_resolver.ts

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: TODO
**Priority**: Critical
**Estimated Effort**: 8 hours
**Phase**: 3 - Self-Reference Bug Fix

## Purpose

Create a dedicated resolver for self-reference calls (`this.method()`, `self.method()`, `super.method()`). This is the **actual bug fix** that resolves 42 instances (31%) of misidentified symbols.

## The Bug This Fixes

**Problem**: `this.method()` calls were treated as variable references, looking for a variable named `this` instead of resolving to methods on the containing class.

**Solution**: Dedicated resolver that:
1. Detects self-reference keywords (`this`, `self`, `super`, `cls`)
2. Finds the containing class by walking up the scope tree
3. Resolves methods within that class's scope

## Implementation

### Create self_reference_resolver.ts

**File**: `packages/core/src/resolve_references/call_resolution/self_reference_resolver.ts`

```typescript
import type {
  SelfReferenceCall,
  SymbolId,
  SymbolName,
  ScopeId,
  SelfReferenceKeyword,
} from '@ariadnejs/types';
import type { SemanticIndex } from '../../index_single_file/semantic_index';
import { find_containing_class_scope } from '../scope_resolution/scope_walker';

/**
 * Resolve self-reference call: this.method(), self.method(), super.method()
 *
 * This handles method calls where the receiver is a self-reference keyword
 * that refers to the containing class or parent class.
 *
 * @example TypeScript
 * class Builder {
 *   process() {
 *     this.build_class(node);  // Resolves to build_class method
 *   }
 *   build_class(node) { }
 * }
 *
 * @example Python
 * class IndexBuilder:
 *   def process(self):
 *     self.build_class(node)  # Resolves to build_class method
 *
 *   def build_class(self, node):
 *     pass
 *
 * @example Super calls
 * class Child extends Parent {
 *   process() {
 *     super.process();  // Resolves to Parent.process
 *   }
 * }
 */
export function resolve_self_reference_call(
  ref: SelfReferenceCall,
  semantic_index: SemanticIndex
): SymbolId | null {
  // Dispatch based on keyword type
  switch (ref.keyword) {
    case 'this':
    case 'self':
    case 'cls':
      return resolve_this_or_self_call(ref, semantic_index);

    case 'super':
      return resolve_super_call(ref, semantic_index);

    default:
      const _exhaustive: never = ref.keyword;
      throw new Error(`Unhandled self-reference keyword: ${_exhaustive}`);
  }
}

/**
 * Resolve this.method() or self.method()
 *
 * Steps:
 * 1. Find containing class by walking up scope tree
 * 2. Find method definition within that class scope
 */
function resolve_this_or_self_call(
  ref: SelfReferenceCall,
  semantic_index: SemanticIndex
): SymbolId | null {
  // Find the class/struct scope containing this reference
  const class_scope_id = find_containing_class_scope(
    ref.scope_id,
    semantic_index
  );

  if (!class_scope_id) {
    // Not in a class context - unresolved
    return null;
  }

  // Find method definition in the class scope
  return find_method_in_scope(ref.name, class_scope_id, semantic_index);
}

/**
 * Resolve super.method()
 *
 * Steps:
 * 1. Find containing class
 * 2. Find parent class from extends/inherits clause
 * 3. Find method definition in parent class
 */
function resolve_super_call(
  ref: SelfReferenceCall,
  semantic_index: SemanticIndex
): SymbolId | null {
  // Find the class scope containing this reference
  const class_scope_id = find_containing_class_scope(
    ref.scope_id,
    semantic_index
  );

  if (!class_scope_id) {
    return null;
  }

  // Find the class definition to get its parent
  const class_definition = semantic_index.definitions.find(
    (def) => def.scope_id === class_scope_id && def.kind === 'class'
  );

  if (!class_definition) {
    return null;
  }

  // Get parent class from type_info (set during inheritance processing)
  const parent_class_id = get_parent_class(class_definition, semantic_index);
  if (!parent_class_id) {
    return null;
  }

  // Find parent class definition
  const parent_definition = semantic_index.definitions.find(
    (def) => def.symbol_id === parent_class_id
  );

  if (!parent_definition) {
    return null;
  }

  // Find method in parent class scope
  return find_method_in_scope(
    ref.name,
    parent_definition.scope_id,
    semantic_index
  );
}

/**
 * Find method definition in a specific scope
 */
function find_method_in_scope(
  method_name: SymbolName,
  scope_id: ScopeId,
  semantic_index: SemanticIndex
): SymbolId | null {
  const method_definition = semantic_index.definitions.find(
    (def) =>
      def.name === method_name &&
      def.scope_id === scope_id &&
      (def.kind === 'method' || def.kind === 'function')  // Functions inside classes
  );

  return method_definition?.symbol_id ?? null;
}

/**
 * Get parent class symbol from a class definition
 */
function get_parent_class(
  class_definition: Definition,
  semantic_index: SemanticIndex
): SymbolId | null {
  // Parent class info stored in type_info during semantic index
  // Look for 'extends' or 'inherits' relationships
  const parent_ref = semantic_index.references.find(
    (ref) =>
      ref.kind === 'type_reference' &&
      ref.type_context === 'extends' &&
      ref.scope_id === class_definition.scope_id
  );

  if (!parent_ref) {
    return null;
  }

  // Resolve parent class name to its symbol
  return resolve_type_reference(parent_ref, semantic_index);
}

/**
 * Helper to resolve type reference (simplified)
 */
function resolve_type_reference(
  ref: TypeReference,
  semantic_index: SemanticIndex
): SymbolId | null {
  // Find class definition with matching name in accessible scopes
  const class_def = semantic_index.definitions.find(
    (def) => def.name === ref.name && def.kind === 'class'
  );

  return class_def?.symbol_id ?? null;
}
```

### Update scope_walker.ts

**File**: `packages/core/src/resolve_references/scope_resolution/scope_walker.ts`

Add helper function for finding containing class:

```typescript
/**
 * Find the class scope containing a given scope
 *
 * Walks up the scope tree until it finds a scope with scope_type === 'class'
 *
 * @example
 * class MyClass {           // class_scope
 *   method() {              // method_scope
 *     if (true) {           // block_scope <- start here
 *       this.other();       // reference location
 *     }
 *   }
 * }
 * // Returns class_scope
 */
export function find_containing_class_scope(
  start_scope_id: ScopeId,
  semantic_index: SemanticIndex
): ScopeId | null {
  let current_scope_id: ScopeId | null = start_scope_id;

  while (current_scope_id) {
    const scope = semantic_index.scopes.find(
      (s) => s.scope_id === current_scope_id
    );

    if (!scope) {
      return null;
    }

    // Check if this is a class scope
    if (scope.scope_type === 'class') {
      return current_scope_id;
    }

    // Move up to parent scope
    current_scope_id = scope.parent_scope_id;
  }

  return null;
}
```

## Key Algorithm

### For `this.method()` / `self.method()`

```
1. Reference: this.build_class() at line 123
   ↓
2. Find scope containing reference: method_scope
   ↓
3. Walk up scope tree to find class_scope
   ↓
4. Find method definition in class_scope with name 'build_class'
   ↓
5. Return method's symbol_id
```

### For `super.method()`

```
1. Reference: super.process() at line 456
   ↓
2. Find scope containing reference: method_scope
   ↓
3. Walk up scope tree to find class_scope (Child class)
   ↓
4. Find Child class definition
   ↓
5. Get parent class from extends clause (Parent class)
   ↓
6. Find parent class definition
   ↓
7. Find method 'process' in parent class scope
   ↓
8. Return parent method's symbol_id
```

## Testing Strategy

```typescript
// self_reference_resolver.test.ts
describe('resolve_self_reference_call', () => {
  describe('this.method() - TypeScript/JavaScript', () => {
    test('resolves method on same class', () => {
      const code = `
        class Builder {
          process() {
            this.build_class(node);
          }

          build_class(node) {
            console.log('building');
          }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const ref = create_self_reference_call(
        'build_class' as SymbolName,
        call_location,
        method_scope_id,
        'this',
        ['this', 'build_class']
      );

      const resolved = resolve_self_reference_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
      expect(resolved).toMatch(/^symbol:.*build_class$/);
    });

    test('resolves method from nested scope', () => {
      const code = `
        class MyClass {
          method() {
            if (true) {
              this.other_method();  // In nested block scope
            }
          }

          other_method() { }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const ref = create_self_reference_call(
        'other_method' as SymbolName,
        call_location,
        block_scope_id,  // Inside if block
        'this',
        ['this', 'other_method']
      );

      const resolved = resolve_self_reference_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
    });

    test('resolves property access followed by method call', () => {
      const code = `
        class MyClass {
          registry = { };

          method() {
            this.registry.get('key');  // this.registry is property access
          }
        }
      `;

      // NOTE: this.registry.get would be split into:
      // 1. PropertyAccessReference: this.registry
      // 2. MethodCallReference: registry.get
      // Not a SelfReferenceCall for .get()
    });
  });

  describe('self.method() - Python', () => {
    test('resolves method on same class', () => {
      const code = `
        class IndexBuilder:
          def process(self):
            self.build_class(node)

          def build_class(self, node):
            pass
      `;

      const semantic_index = build_semantic_index(code, 'python');
      const ref = create_self_reference_call(
        'build_class' as SymbolName,
        call_location,
        method_scope_id,
        'self',
        ['self', 'build_class']
      );

      const resolved = resolve_self_reference_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
      expect(resolved).toMatch(/^symbol:.*build_class$/);
    });

    test('resolves classmethod with cls', () => {
      const code = `
        class MyClass:
          @classmethod
          def create(cls):
            return cls.default_instance()

          @classmethod
          def default_instance(cls):
            return MyClass()
      `;

      const semantic_index = build_semantic_index(code, 'python');
      const ref = create_self_reference_call(
        'default_instance' as SymbolName,
        call_location,
        method_scope_id,
        'cls',
        ['cls', 'default_instance']
      );

      const resolved = resolve_self_reference_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
    });
  });

  describe('super.method()', () => {
    test('resolves method on parent class - TypeScript', () => {
      const code = `
        class Parent {
          process() {
            console.log('parent');
          }
        }

        class Child extends Parent {
          process() {
            super.process();
          }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const ref = create_self_reference_call(
        'process' as SymbolName,
        call_location,
        child_method_scope_id,
        'super',
        ['super', 'process']
      );

      const resolved = resolve_self_reference_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
      // Should resolve to Parent.process, not Child.process
      const parent_process_id = find_symbol_in_code(code, 'Parent', 'process');
      expect(resolved).toBe(parent_process_id);
    });

    test('resolves method on parent class - Python', () => {
      const code = `
        class Parent:
          def process(self):
            pass

        class Child(Parent):
          def process(self):
            super().process()
      `;

      const semantic_index = build_semantic_index(code, 'python');
      const ref = create_self_reference_call(
        'process' as SymbolName,
        call_location,
        child_method_scope_id,
        'super',
        ['super', 'process']
      );

      const resolved = resolve_self_reference_call(ref, semantic_index);
      expect(resolved).toBeTruthy();
    });
  });

  describe('Unresolved cases', () => {
    test('returns null when not in class context', () => {
      const code = `
        function standalone() {
          this.method();  // 'this' outside class
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const ref = create_self_reference_call(
        'method' as SymbolName,
        call_location,
        function_scope_id,
        'this',
        ['this', 'method']
      );

      const resolved = resolve_self_reference_call(ref, semantic_index);
      expect(resolved).toBeNull();
    });

    test('returns null when method does not exist', () => {
      const code = `
        class MyClass {
          method() {
            this.nonexistent();  // Method doesn't exist
          }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const ref = create_self_reference_call(
        'nonexistent' as SymbolName,
        call_location,
        method_scope_id,
        'this',
        ['this', 'nonexistent']
      );

      const resolved = resolve_self_reference_call(ref, semantic_index);
      expect(resolved).toBeNull();
    });

    test('returns null when super called but no parent class', () => {
      const code = `
        class OnlyChild {
          method() {
            super.process();  // No parent class
          }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const ref = create_self_reference_call(
        'process' as SymbolName,
        call_location,
        method_scope_id,
        'super',
        ['super', 'process']
      );

      const resolved = resolve_self_reference_call(ref, semantic_index);
      expect(resolved).toBeNull();
    });
  });
});
```

## Success Criteria

- [ ] Resolves `this.method()` calls in TypeScript/JavaScript
- [ ] Resolves `self.method()` calls in Python
- [ ] Resolves `cls.method()` calls in Python classmethods
- [ ] Resolves `super.method()` calls in all languages
- [ ] Works from nested scopes (finds containing class)
- [ ] Returns null for non-class contexts
- [ ] Returns null for nonexistent methods
- [ ] All tests pass
- [ ] Build succeeds without errors

## Impact

**Before this task**: 42 instances of `this.method()` / `self.method()` fail to resolve
**After this task**: All 42 instances resolve correctly ✅

**Estimated accuracy improvement**: 31% (42 out of 135 misidentifications)

## Files Changed

**New**:
- `packages/core/src/resolve_references/call_resolution/self_reference_resolver.ts`
- `packages/core/src/resolve_references/call_resolution/self_reference_resolver.test.ts`

**Modified**:
- `packages/core/src/resolve_references/scope_resolution/scope_walker.ts`

## Next Task

After completion, proceed to **task-152.8** (Update constructor_tracking.ts)

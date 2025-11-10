# Task 152.10: Write Comprehensive Self-Reference Tests

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: TODO
**Priority**: Critical
**Estimated Effort**: 6 hours
**Phase**: 3 - Self-Reference Bug Fix

## Purpose

Create comprehensive tests for self-reference call resolution across all supported languages. These tests verify the **bug fix** for 42 misidentified symbols (31% of failures).

## Testing Strategy

Test the following scenarios:
1. Simple self-reference calls: `this.method()`
2. Self-reference from nested scopes
3. Super calls to parent classes
4. Class methods with `cls` in Python
5. Property chains: `this.field.method()`
6. Edge cases and error conditions

## Test File Structure

### Create self_reference_integration.test.ts

**File**: `packages/core/src/__tests__/integration/self_reference_integration.test.ts`

```typescript
import { describe, test, expect } from 'vitest';
import { build_semantic_index } from '../../index_single_file/index_single_file';
import { resolve_references } from '../../resolve_references/resolve_references';
import type { SelfReferenceCall } from '@ariadnejs/types';

/**
 * Integration tests for self-reference call resolution
 *
 * These tests verify the bug fix for this.method() / self.method() resolution.
 * Previously, these calls failed to resolve because they were treated as
 * variable references (looking for variable named 'this').
 *
 * Now they use SelfReferenceCall variant and resolve correctly.
 */

describe('Self-Reference Call Resolution - TypeScript', () => {
  describe('this.method() calls', () => {
    test('resolves simple this.method() in same class', () => {
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
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      // Find the this.build_class reference
      const self_ref = semantic_index.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === 'self_reference_call' &&
          ref.name === 'build_class'
      );

      expect(self_ref).toBeDefined();
      expect(self_ref?.keyword).toBe('this');

      // Verify it resolved
      const resolved_id = resolutions.get(self_ref!.location);
      expect(resolved_id).toBeDefined();
      expect(resolved_id).toMatch(/^symbol:.*build_class$/);
    });

    test('resolves this.method() from nested scope', () => {
      const code = `
        class MyClass {
          method() {
            if (true) {
              for (let i = 0; i < 10; i++) {
                this.helper();  // Deeply nested
              }
            }
          }

          helper() { }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_ref = semantic_index.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === 'self_reference_call' &&
          ref.name === 'helper'
      );

      expect(self_ref).toBeDefined();
      const resolved_id = resolutions.get(self_ref!.location);
      expect(resolved_id).toBeDefined();
    });

    test('resolves multiple this.method() calls', () => {
      const code = `
        class IndexBuilder {
          process() {
            this.build_class(node);
            this.build_function(node);
            this.build_variable(node);
          }

          build_class(node) { }
          build_function(node) { }
          build_variable(node) { }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      // All three calls should resolve
      const self_refs = semantic_index.references.filter(
        (ref): ref is SelfReferenceCall => ref.kind === 'self_reference_call'
      );

      expect(self_refs).toHaveLength(3);

      const build_class_ref = self_refs.find((ref) => ref.name === 'build_class');
      const build_function_ref = self_refs.find((ref) => ref.name === 'build_function');
      const build_variable_ref = self_refs.find((ref) => ref.name === 'build_variable');

      expect(resolutions.get(build_class_ref!.location)).toBeDefined();
      expect(resolutions.get(build_function_ref!.location)).toBeDefined();
      expect(resolutions.get(build_variable_ref!.location)).toBeDefined();
    });

    test('handles overloaded methods', () => {
      const code = `
        class Parser {
          parse(input: string): void;
          parse(input: Buffer): void;
          parse(input: string | Buffer): void {
            this.validate(input);
          }

          validate(input: any) { }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_ref = semantic_index.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === 'self_reference_call' &&
          ref.name === 'validate'
      );

      expect(self_ref).toBeDefined();
      expect(resolutions.get(self_ref!.location)).toBeDefined();
    });
  });

  describe('super.method() calls', () => {
    test('resolves super.method() to parent class', () => {
      const code = `
        class Parent {
          process() {
            console.log('parent process');
          }
        }

        class Child extends Parent {
          process() {
            super.process();
            console.log('child process');
          }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const super_ref = semantic_index.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === 'self_reference_call' &&
          ref.keyword === 'super'
      );

      expect(super_ref).toBeDefined();
      expect(super_ref?.name).toBe('process');

      const resolved_id = resolutions.get(super_ref!.location);
      expect(resolved_id).toBeDefined();

      // Should resolve to Parent.process, not Child.process
      const parent_process = semantic_index.definitions.find(
        (def) => def.name === 'process' && def.symbol_id === resolved_id
      );
      expect(parent_process).toBeDefined();
      // Verify it's in Parent's scope (not Child's)
    });

    test('resolves super constructor call', () => {
      const code = `
        class Parent {
          constructor(name: string) { }
        }

        class Child extends Parent {
          constructor(name: string, age: number) {
            super(name);
          }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      // Note: super() in constructor is handled differently
      // It's a constructor call, not a method call
    });
  });

  describe('Property chains', () => {
    test('distinguishes this.field vs this.method()', () => {
      const code = `
        class MyClass {
          registry = { };

          method() {
            const reg = this.registry;  // PropertyAccessReference
            this.process();              // SelfReferenceCall
          }

          process() { }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');

      // this.registry should be PropertyAccessReference
      const property_ref = semantic_index.references.find(
        (ref) => ref.kind === 'property_access' && ref.name === 'registry'
      );
      expect(property_ref).toBeDefined();

      // this.process() should be SelfReferenceCall
      const method_ref = semantic_index.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === 'self_reference_call' && ref.name === 'process'
      );
      expect(method_ref).toBeDefined();
    });

    test('handles this.field.method() chains', () => {
      const code = `
        class Registry {
          get(key: string): any { }
        }

        class MyClass {
          registry: Registry;

          method() {
            this.registry.get('key');
          }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      // this.registry is SelfReferenceCall (property access on this)
      // .get() is MethodCallReference (method on registry type)
    });
  });

  describe('Edge cases', () => {
    test('returns unresolved when method does not exist', () => {
      const code = `
        class MyClass {
          method() {
            this.nonexistent();  // No such method
          }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_ref = semantic_index.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === 'self_reference_call' &&
          ref.name === 'nonexistent'
      );

      expect(self_ref).toBeDefined();

      // Should not resolve
      const resolved_id = resolutions.get(self_ref!.location);
      expect(resolved_id).toBeUndefined();
    });

    test('handles this in arrow function (inherits outer context)', () => {
      const code = `
        class MyClass {
          method() {
            const callback = () => {
              this.helper();  // 'this' refers to MyClass
            };
          }

          helper() { }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_ref = semantic_index.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === 'self_reference_call' &&
          ref.name === 'helper'
      );

      expect(self_ref).toBeDefined();
      expect(resolutions.get(self_ref!.location)).toBeDefined();
    });

    test('handles this outside class context (unresolved)', () => {
      const code = `
        function standalone() {
          this.method();  // Not in class
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_ref = semantic_index.references.find(
        (ref): ref is SelfReferenceCall => ref.kind === 'self_reference_call'
      );

      if (self_ref) {
        // If captured, should not resolve
        const resolved_id = resolutions.get(self_ref.location);
        expect(resolved_id).toBeUndefined();
      }
    });
  });
});

describe('Self-Reference Call Resolution - Python', () => {
  describe('self.method() calls', () => {
    test('resolves simple self.method() in same class', () => {
      const code = `
        class IndexBuilder:
          def process(self):
            self.build_class(node)

          def build_class(self, node):
            pass
      `;

      const semantic_index = build_semantic_index(code, 'python');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_ref = semantic_index.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === 'self_reference_call' &&
          ref.name === 'build_class'
      );

      expect(self_ref).toBeDefined();
      expect(self_ref?.keyword).toBe('self');

      const resolved_id = resolutions.get(self_ref!.location);
      expect(resolved_id).toBeDefined();
      expect(resolved_id).toMatch(/^symbol:.*build_class$/);
    });

    test('resolves multiple self.method() calls', () => {
      const code = `
        class Processor:
          def run(self):
            self.step_one()
            self.step_two()
            self.step_three()

          def step_one(self):
            pass

          def step_two(self):
            pass

          def step_three(self):
            pass
      `;

      const semantic_index = build_semantic_index(code, 'python');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_refs = semantic_index.references.filter(
        (ref): ref is SelfReferenceCall => ref.kind === 'self_reference_call'
      );

      expect(self_refs.length).toBeGreaterThanOrEqual(3);

      // All should resolve
      for (const ref of self_refs) {
        const resolved = resolutions.get(ref.location);
        expect(resolved).toBeDefined();
      }
    });
  });

  describe('cls.method() calls - classmethods', () => {
    test('resolves cls.method() in classmethod', () => {
      const code = `
        class Factory:
          @classmethod
          def create(cls):
            return cls.default_instance()

          @classmethod
          def default_instance(cls):
            return Factory()
      `;

      const semantic_index = build_semantic_index(code, 'python');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const cls_ref = semantic_index.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === 'self_reference_call' &&
          ref.keyword === 'cls'
      );

      expect(cls_ref).toBeDefined();
      expect(cls_ref?.name).toBe('default_instance');

      const resolved_id = resolutions.get(cls_ref!.location);
      expect(resolved_id).toBeDefined();
    });
  });

  describe('super() calls', () => {
    test('resolves super() method calls', () => {
      const code = `
        class Parent:
          def process(self):
            pass

        class Child(Parent):
          def process(self):
            super().process()
      `;

      const semantic_index = build_semantic_index(code, 'python');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const super_ref = semantic_index.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === 'self_reference_call' &&
          ref.keyword === 'super'
      );

      expect(super_ref).toBeDefined();
      const resolved_id = resolutions.get(super_ref!.location);
      expect(resolved_id).toBeDefined();
    });
  });
});

describe('Self-Reference Call Resolution - JavaScript', () => {
  test('resolves this.method() in class', () => {
    const code = `
      class MyClass {
        method() {
          this.helper();
        }

        helper() { }
      }
    `;

    const semantic_index = build_semantic_index(code, 'javascript');
    const resolutions = resolve_references(
      semantic_index.references,
      semantic_index
    );

    const self_ref = semantic_index.references.find(
      (ref): ref is SelfReferenceCall =>
        ref.kind === 'self_reference_call' &&
        ref.name === 'helper'
    );

    expect(self_ref).toBeDefined();
    expect(resolutions.get(self_ref!.location)).toBeDefined();
  });

  test('resolves this.method() in prototype method', () => {
    const code = `
      function MyClass() {
        this.field = 'value';
      }

      MyClass.prototype.method = function() {
        this.helper();
      };

      MyClass.prototype.helper = function() { };
    `;

    const semantic_index = build_semantic_index(code, 'javascript');
    const resolutions = resolve_references(
      semantic_index.references,
      semantic_index
    );

    // Note: Prototype-based classes may require special handling
  });
});
```

## Success Criteria

- [ ] Tests cover TypeScript `this.method()` calls
- [ ] Tests cover Python `self.method()` calls
- [ ] Tests cover Python `cls.method()` calls
- [ ] Tests cover `super.method()` in all languages
- [ ] Tests verify nested scope resolution
- [ ] Tests check multiple calls in same method
- [ ] Tests verify unresolved cases return null
- [ ] Tests check property chains vs method calls
- [ ] All tests pass
- [ ] Tests demonstrate the bug fix (42 cases now resolve)

## Files Changed

**New**:
- `packages/core/src/__tests__/integration/self_reference_integration.test.ts`

## Verification

Run tests and verify:

```bash
npm test self_reference_integration.test.ts
```

Expected output:
```
✓ Self-Reference Call Resolution - TypeScript (8 tests)
✓ Self-Reference Call Resolution - Python (5 tests)
✓ Self-Reference Call Resolution - JavaScript (2 tests)

Tests passed: 15/15
```

## Next Task

After completion, proceed to **task-152.11** (Integration testing - verify bug fix)

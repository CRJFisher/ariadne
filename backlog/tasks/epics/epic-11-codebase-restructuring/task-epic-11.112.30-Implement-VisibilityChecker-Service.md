# Task epic-11.112.30: Implement VisibilityChecker Service

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2 hours
**Files:** 2 files created
**Dependencies:** task-epic-11.112.29

## Objective

Create the `VisibilityChecker` service that determines whether a definition is visible from a given reference scope. This is the core logic of the scope-aware visibility system.

## Files

### CREATED
- `packages/core/src/resolve_references/visibility_checker/visibility_checker.ts`
- `packages/core/src/resolve_references/visibility_checker/visibility_checker.test.ts`

## Implementation Steps

### 1. Create Core VisibilityChecker (45 min)

```typescript
// visibility_checker.ts

import type {
  ScopeId,
  VisibilityKind,
  SemanticIndex,
  Location,
} from '@ariadnejs/types';

export interface Definition {
  defining_scope_id: ScopeId;
  visibility: VisibilityKind;
  location: Location;
}

/**
 * Checks whether a definition is visible from a reference location.
 */
export class VisibilityChecker {
  constructor(private index: SemanticIndex) {}

  /**
   * Check if a definition is visible from the given reference scope.
   *
   * @param definition - The definition to check
   * @param reference_scope_id - The scope where the reference occurs
   * @returns true if visible, false otherwise
   */
  is_visible(
    definition: Definition,
    reference_scope_id: ScopeId
  ): boolean {
    switch (definition.visibility.kind) {
      case "scope_local":
        return this.check_scope_local(definition, reference_scope_id);

      case "scope_children":
        return this.check_scope_children(definition, reference_scope_id);

      case "file":
        return this.check_file(definition, reference_scope_id);

      case "exported":
        return this.check_exported(definition, reference_scope_id);
    }
  }

  /**
   * scope_local: Visible only in the exact defining scope
   */
  private check_scope_local(
    definition: Definition,
    reference_scope_id: ScopeId
  ): boolean {
    return definition.defining_scope_id === reference_scope_id;
  }

  /**
   * scope_children: Visible in defining scope and all child scopes
   */
  private check_scope_children(
    definition: Definition,
    reference_scope_id: ScopeId
  ): boolean {
    // Check if reference is in defining scope
    if (definition.defining_scope_id === reference_scope_id) {
      return true;
    }

    // Check if reference is in a child of defining scope
    return this.is_ancestor_of(
      definition.defining_scope_id,
      reference_scope_id
    );
  }

  /**
   * file: Visible anywhere in the same file
   */
  private check_file(
    definition: Definition,
    reference_scope_id: ScopeId
  ): boolean {
    const reference_scope = this.index.scopes.get(reference_scope_id);
    if (!reference_scope) return false;

    // Same file if file paths match
    return definition.location.file_path === reference_scope.location.file_path;
  }

  /**
   * exported: Visible from any file (requires import)
   */
  private check_exported(
    definition: Definition,
    reference_scope_id: ScopeId
  ): boolean {
    // Exported symbols are visible from anywhere
    // Import resolution is handled separately
    return true;
  }

  /**
   * Check if potential_ancestor is an ancestor of scope_id.
   * Traverses up the scope tree from scope_id.
   */
  private is_ancestor_of(
    potential_ancestor: ScopeId,
    scope_id: ScopeId
  ): boolean {
    let current_id: ScopeId | undefined = scope_id;

    while (current_id) {
      const current_scope = this.index.scopes.get(current_id);
      if (!current_scope) break;

      // Check parent
      if (current_scope.parent_scope_id === potential_ancestor) {
        return true;
      }

      // Move up to parent
      current_id = current_scope.parent_scope_id;
    }

    return false;
  }
}
```

### 2. Create Test File (45 min)

```typescript
// visibility_checker.test.ts

import { describe, it, expect } from 'vitest';
import { VisibilityChecker } from './visibility_checker';
import { build_semantic_index } from '../../index_single_file';
import type { SemanticIndex } from '@ariadnejs/types';

describe('VisibilityChecker', () => {
  describe('scope_local', () => {
    it('is visible in same scope', () => {
      const code = `
function outer() {
  const x = 1;
  console.log(x);
}`;
      const index = build_semantic_index(code, 'test.ts');
      const checker = new VisibilityChecker(index);

      const x_def = Array.from(index.variables.values()).find(v => v.name === 'x')!;
      const outer_scope = Array.from(index.scopes.values()).find(s => s.name === 'outer')!;

      // x is visible in outer scope (where it's defined)
      expect(checker.is_visible(x_def, outer_scope.id)).toBe(true);
    });

    it('is not visible in child scope', () => {
      const code = `
{
  const x = 1;
  {
    console.log(x); // Not visible if scope_local
  }
}`;
      const index = build_semantic_index(code, 'test.ts');
      const checker = new VisibilityChecker(index);

      const x_def = Array.from(index.variables.values()).find(v => v.name === 'x')!;
      const block_scopes = Array.from(index.scopes.values()).filter(s => s.type === 'block');
      const outer_block = block_scopes[0];
      const inner_block = block_scopes[1];

      // If x has scope_local visibility, it's NOT visible in inner block
      // (This test assumes x was marked as scope_local, not scope_children)
      if (x_def.visibility.kind === 'scope_local') {
        expect(checker.is_visible(x_def, inner_block.id)).toBe(false);
      }
    });
  });

  describe('scope_children', () => {
    it('is visible in defining scope', () => {
      const code = `
function foo(x) {
  return x;
}`;
      const index = build_semantic_index(code, 'test.ts');
      const checker = new VisibilityChecker(index);

      const x_param = Array.from(index.variables.values()).find(v => v.name === 'x')!;
      const foo_scope = Array.from(index.scopes.values()).find(s => s.name === 'foo')!;

      expect(checker.is_visible(x_param, foo_scope.id)).toBe(true);
    });

    it('is visible in child scope', () => {
      const code = `
function foo(x) {
  {
    console.log(x);
  }
}`;
      const index = build_semantic_index(code, 'test.ts');
      const checker = new VisibilityChecker(index);

      const x_param = Array.from(index.variables.values()).find(v => v.name === 'x')!;
      const block_scope = Array.from(index.scopes.values()).find(s => s.type === 'block')!;

      // Parameter is visible in block scope (child of function)
      expect(checker.is_visible(x_param, block_scope.id)).toBe(true);
    });

    it('is not visible in parent scope', () => {
      const code = `
function outer() {
  function inner(x) {
    return x;
  }
  console.log(x); // Not visible
}`;
      const index = build_semantic_index(code, 'test.ts');
      const checker = new VisibilityChecker(index);

      const x_param = Array.from(index.variables.values()).find(v => v.name === 'x')!;
      const outer_scope = Array.from(index.scopes.values()).find(s => s.name === 'outer')!;

      // x is parameter of inner, not visible in outer
      expect(checker.is_visible(x_param, outer_scope.id)).toBe(false);
    });
  });

  describe('file', () => {
    it('is visible anywhere in same file', () => {
      const code = `
class MyClass { }

function useClass() {
  const instance = new MyClass();
}`;
      const index = build_semantic_index(code, 'test.ts');
      const checker = new VisibilityChecker(index);

      const class_def = Array.from(index.classes.values()).find(c => c.name === 'MyClass')!;
      const func_scope = Array.from(index.scopes.values()).find(s => s.name === 'useClass')!;

      // Class visible in function scope (same file)
      expect(checker.is_visible(class_def, func_scope.id)).toBe(true);
    });
  });

  describe('exported', () => {
    it('is visible from any scope', () => {
      const code = `
export class MyClass { }

function useClass() {
  const instance = new MyClass();
}`;
      const index = build_semantic_index(code, 'test.ts');
      const checker = new VisibilityChecker(index);

      const class_def = Array.from(index.classes.values()).find(c => c.name === 'MyClass')!;
      const func_scope = Array.from(index.scopes.values()).find(s => s.name === 'useClass')!;

      // Exported class visible everywhere
      expect(checker.is_visible(class_def, func_scope.id)).toBe(true);
    });
  });
});
```

### 3. Run Tests (10 min)

```bash
npm test -- visibility_checker.test.ts
```

Expected: All tests pass.

### 4. Export from Index (5 min)

```typescript
// In packages/core/src/resolve_references/visibility_checker/index.ts
export { VisibilityChecker } from './visibility_checker';
export type { Definition } from './visibility_checker';
```

### 5. Run Type Checker (5 min)

```bash
npx tsc --noEmit
```

## Success Criteria

- ✅ VisibilityChecker class implemented
- ✅ All visibility kinds handled correctly
- ✅ Scope tree traversal works
- ✅ Tests cover all visibility kinds
- ✅ All tests pass
- ✅ Exported from module

## Outputs

- `visibility_checker.ts` with core logic
- `visibility_checker.test.ts` with comprehensive tests

## Next Task

**task-epic-11.112.31** - Add scope tree utilities

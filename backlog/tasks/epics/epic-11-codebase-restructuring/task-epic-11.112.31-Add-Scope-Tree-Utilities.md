# Task epic-11.112.31: Add Scope Tree Utilities

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1-2 hours
**Files:** 2 files created
**Dependencies:** task-epic-11.112.30

## Objective

Create utility functions for working with the scope tree, including traversal, ancestor checking, and scope path operations. These utilities support the VisibilityChecker and other scope-aware code.

## Files

### CREATED
- `packages/core/src/resolve_references/scope_tree_utils/scope_tree_utils.ts`
- `packages/core/src/resolve_references/scope_tree_utils/scope_tree_utils.test.ts`

## Implementation Steps

### 1. Create Scope Tree Utilities (60 min)

```typescript
// scope_tree_utils.ts

import type { ScopeId, Scope, SemanticIndex } from '@ariadnejs/types';

/**
 * Get all ancestor scopes from a given scope up to root.
 *
 * @param scope_id - Starting scope
 * @param index - Semantic index containing scope tree
 * @returns Array of scope IDs from scope_id up to root (inclusive)
 *
 * @example
 * // For scope tree: root -> function -> block
 * get_scope_ancestors(block_id, index)
 * // Returns: [block_id, function_id, root_id]
 */
export function get_scope_ancestors(
  scope_id: ScopeId,
  index: SemanticIndex
): ScopeId[] {
  const ancestors: ScopeId[] = [];
  let current_id: ScopeId | undefined = scope_id;

  while (current_id) {
    ancestors.push(current_id);
    const current_scope = index.scopes.get(current_id);
    if (!current_scope) break;
    current_id = current_scope.parent_scope_id;
  }

  return ancestors;
}

/**
 * Get all descendant scopes from a given scope.
 *
 * @param scope_id - Starting scope
 * @param index - Semantic index containing scope tree
 * @returns Array of all descendant scope IDs
 */
export function get_scope_descendants(
  scope_id: ScopeId,
  index: SemanticIndex
): ScopeId[] {
  const descendants: ScopeId[] = [];
  const scope = index.scopes.get(scope_id);
  if (!scope || !scope.children) return descendants;

  // BFS traversal
  const queue: ScopeId[] = [...scope.children];

  while (queue.length > 0) {
    const current_id = queue.shift()!;
    descendants.push(current_id);

    const current_scope = index.scopes.get(current_id);
    if (current_scope?.children) {
      queue.push(...current_scope.children);
    }
  }

  return descendants;
}

/**
 * Check if potential_ancestor is an ancestor of scope_id.
 *
 * @param potential_ancestor - Scope ID to check
 * @param scope_id - Starting scope
 * @param index - Semantic index containing scope tree
 * @returns true if potential_ancestor is an ancestor
 */
export function is_ancestor_of(
  potential_ancestor: ScopeId,
  scope_id: ScopeId,
  index: SemanticIndex
): boolean {
  const ancestors = get_scope_ancestors(scope_id, index);
  return ancestors.includes(potential_ancestor);
}

/**
 * Check if potential_descendant is a descendant of scope_id.
 *
 * @param scope_id - Starting scope
 * @param potential_descendant - Scope ID to check
 * @param index - Semantic index containing scope tree
 * @returns true if potential_descendant is a descendant
 */
export function is_descendant_of(
  scope_id: ScopeId,
  potential_descendant: ScopeId,
  index: SemanticIndex
): boolean {
  const descendants = get_scope_descendants(scope_id, index);
  return descendants.includes(potential_descendant);
}

/**
 * Get the common ancestor scope of two scopes.
 *
 * @param scope_id1 - First scope
 * @param scope_id2 - Second scope
 * @param index - Semantic index containing scope tree
 * @returns Scope ID of nearest common ancestor, or undefined if no common ancestor
 */
export function get_common_ancestor(
  scope_id1: ScopeId,
  scope_id2: ScopeId,
  index: SemanticIndex
): ScopeId | undefined {
  const ancestors1 = get_scope_ancestors(scope_id1, index);
  const ancestors2 = get_scope_ancestors(scope_id2, index);

  // Find first common ancestor (starting from root)
  for (let i = Math.min(ancestors1.length, ancestors2.length) - 1; i >= 0; i--) {
    const ancestor1 = ancestors1[ancestors1.length - 1 - i];
    const ancestor2 = ancestors2[ancestors2.length - 1 - i];

    if (ancestor1 === ancestor2) {
      // Continue to find the nearest (deepest) common ancestor
      for (let j = i; j >= 0; j--) {
        const a1 = ancestors1[ancestors1.length - 1 - j];
        const a2 = ancestors2[ancestors2.length - 1 - j];
        if (a1 !== a2) {
          return ancestors1[ancestors1.length - j];
        }
      }
      return ancestor1;
    }
  }

  return undefined;
}

/**
 * Get the depth of a scope (distance from root).
 *
 * @param scope_id - Scope to measure
 * @param index - Semantic index containing scope tree
 * @returns Depth (0 for root, 1 for direct children of root, etc.)
 */
export function get_scope_depth(
  scope_id: ScopeId,
  index: SemanticIndex
): number {
  return get_scope_ancestors(scope_id, index).length - 1;
}

/**
 * Check if two scopes are in the same file.
 *
 * @param scope_id1 - First scope
 * @param scope_id2 - Second scope
 * @param index - Semantic index containing scope tree
 * @returns true if both scopes are in the same file
 */
export function same_file(
  scope_id1: ScopeId,
  scope_id2: ScopeId,
  index: SemanticIndex
): boolean {
  const scope1 = index.scopes.get(scope_id1);
  const scope2 = index.scopes.get(scope_id2);

  if (!scope1 || !scope2) return false;

  return scope1.location.file_path === scope2.location.file_path;
}
```

### 2. Create Test File (40 min)

```typescript
// scope_tree_utils.test.ts

import { describe, it, expect } from 'vitest';
import { build_semantic_index } from '../../index_single_file';
import {
  get_scope_ancestors,
  get_scope_descendants,
  is_ancestor_of,
  is_descendant_of,
  get_common_ancestor,
  get_scope_depth,
  same_file,
} from './scope_tree_utils';

describe('Scope Tree Utilities', () => {
  const code = `
function outer() {
  const x = 1;

  function inner() {
    const y = 2;
    {
      const z = 3;
    }
  }
}`;

  describe('get_scope_ancestors', () => {
    it('returns ancestors from scope to root', () => {
      const index = build_semantic_index(code, 'test.ts');
      const block_scope = Array.from(index.scopes.values()).find(
        s => s.type === 'block'
      )!;

      const ancestors = get_scope_ancestors(block_scope.id, index);

      expect(ancestors.length).toBeGreaterThan(0);
      expect(ancestors[0]).toBe(block_scope.id);
      expect(ancestors[ancestors.length - 1]).toBe(index.root_scope_id);
    });
  });

  describe('get_scope_descendants', () => {
    it('returns all descendant scopes', () => {
      const index = build_semantic_index(code, 'test.ts');
      const outer_scope = Array.from(index.scopes.values()).find(
        s => s.name === 'outer'
      )!;

      const descendants = get_scope_descendants(outer_scope.id, index);

      // Should include inner function scope and block scope
      expect(descendants.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('is_ancestor_of', () => {
    it('returns true when ancestor relationship exists', () => {
      const index = build_semantic_index(code, 'test.ts');
      const outer_scope = Array.from(index.scopes.values()).find(
        s => s.name === 'outer'
      )!;
      const inner_scope = Array.from(index.scopes.values()).find(
        s => s.name === 'inner'
      )!;

      expect(is_ancestor_of(outer_scope.id, inner_scope.id, index)).toBe(true);
    });

    it('returns false when no ancestor relationship', () => {
      const index = build_semantic_index(code, 'test.ts');
      const outer_scope = Array.from(index.scopes.values()).find(
        s => s.name === 'outer'
      )!;
      const inner_scope = Array.from(index.scopes.values()).find(
        s => s.name === 'inner'
      )!;

      // inner is not ancestor of outer (reversed)
      expect(is_ancestor_of(inner_scope.id, outer_scope.id, index)).toBe(false);
    });
  });

  describe('get_common_ancestor', () => {
    it('finds nearest common ancestor', () => {
      const index = build_semantic_index(code, 'test.ts');
      const inner_scope = Array.from(index.scopes.values()).find(
        s => s.name === 'inner'
      )!;
      const block_scope = Array.from(index.scopes.values()).find(
        s => s.type === 'block'
      )!;

      const common = get_common_ancestor(inner_scope.id, block_scope.id, index);

      // Common ancestor should be inner (since block is child of inner)
      expect(common).toBe(inner_scope.id);
    });
  });

  describe('get_scope_depth', () => {
    it('returns correct depth', () => {
      const index = build_semantic_index(code, 'test.ts');

      const root_depth = get_scope_depth(index.root_scope_id, index);
      expect(root_depth).toBe(0);

      const outer_scope = Array.from(index.scopes.values()).find(
        s => s.name === 'outer'
      )!;
      const outer_depth = get_scope_depth(outer_scope.id, index);
      expect(outer_depth).toBeGreaterThan(0);
    });
  });

  describe('same_file', () => {
    it('returns true for scopes in same file', () => {
      const index = build_semantic_index(code, 'test.ts');
      const outer_scope = Array.from(index.scopes.values()).find(
        s => s.name === 'outer'
      )!;
      const inner_scope = Array.from(index.scopes.values()).find(
        s => s.name === 'inner'
      )!;

      expect(same_file(outer_scope.id, inner_scope.id, index)).toBe(true);
    });
  });
});
```

### 3. Run Tests (10 min)

```bash
npm test -- scope_tree_utils.test.ts
```

### 4. Export from Index (5 min)

```typescript
// In packages/core/src/resolve_references/scope_tree_utils/index.ts
export * from './scope_tree_utils';
```

## Success Criteria

- ✅ Scope tree utility functions implemented
- ✅ Ancestor/descendant checking works
- ✅ Common ancestor finding works
- ✅ Tests cover all utilities
- ✅ All tests pass

## Outputs

- `scope_tree_utils.ts` with utility functions
- `scope_tree_utils.test.ts` with comprehensive tests

## Next Task

**task-epic-11.112.32** - Update VisibilityChecker to use utilities

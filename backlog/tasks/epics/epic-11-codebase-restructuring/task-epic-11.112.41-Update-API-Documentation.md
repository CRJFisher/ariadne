# Task epic-11.112.41: Update API Documentation

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1-2 hours
**Files:** Multiple files modified
**Dependencies:** task-epic-11.112.40

## Objective

Update all API documentation to reflect the new `defining_scope_id` and `visibility` fields. Ensure JSDoc comments, type documentation, and examples are accurate and complete.

## Files

### MODIFIED
- `packages/ariadne-types/src/semantic_index.ts` (JSDoc)
- `docs/api/semantic-index.md`
- `docs/api/symbol-resolution.md`
- `docs/api/visibility-checker.md` (new)
- `docs/api/scope-tree-utils.md` (new)

## Implementation Steps

### 1. Update Type Definition JSDoc (40 min)

Enhance JSDoc in `semantic_index.ts`:

```typescript
/**
 * A function definition in the semantic index.
 *
 * @example
 * ```typescript
 * const func: FunctionDefinition = {
 *   symbol_id: "func:foo:file.ts:1:0",
 *   name: "foo",
 *   location: { file_path: "file.ts", start_line: 1, ... },
 *   defining_scope_id: file_scope_id,
 *   visibility: { kind: "file" },
 *   parameters: [...],
 *   return_type: { ... }
 * };
 * ```
 */
export interface FunctionDefinition {
  /** Unique identifier for this function symbol */
  symbol_id: SymbolId;

  /** Function name as it appears in source code */
  name: string;

  /** Location in source code where function is defined */
  location: Location;

  /**
   * The scope where this function is DEFINED.
   *
   * For file-level functions, this is the file/module scope.
   * For nested functions, this is the parent function's scope.
   *
   * @see get_defining_scope_id - How this is determined
   */
  defining_scope_id: ScopeId;

  /**
   * Visibility determines where this function can be referenced from.
   *
   * Common values:
   * - `{ kind: "file" }` - File-scoped function (not exported)
   * - `{ kind: "exported" }` - Exported function (visible from other files)
   * - `{ kind: "scope_local" }` - Nested function (only visible in defining scope)
   *
   * @see VisibilityKind
   * @see VisibilityChecker.is_visible
   */
  visibility: VisibilityKind;

  /** Function parameters */
  parameters: ParameterDefinition[];

  /** Return type (if available, e.g., TypeScript) */
  return_type?: TypeReference;
}
```

Apply similar comprehensive JSDoc to:
- ClassDefinition
- InterfaceDefinition
- EnumDefinition
- VariableDefinition
- MethodDefinition
- All other definition types

### 2. Create VisibilityChecker API Documentation (30 min)

Create `docs/api/visibility-checker.md`:

```markdown
# VisibilityChecker API

## Overview

`VisibilityChecker` determines whether a definition is visible from a given reference location based on scope-aware visibility rules.

## Import

```typescript
import { VisibilityChecker } from '@ariadnejs/core';
```

## Constructor

### `new VisibilityChecker(index: SemanticIndex)`

Creates a new visibility checker.

**Parameters:**
- `index`: The semantic index containing scope tree and definitions

**Example:**
```typescript
const index = build_semantic_index(code, 'file.ts');
const checker = new VisibilityChecker(index);
```

## Methods

### `is_visible(definition, reference_scope_id): boolean`

Check if a definition is visible from a reference scope.

**Parameters:**
- `definition`: Definition to check (must have `defining_scope_id` and `visibility`)
- `reference_scope_id`: Scope where reference occurs

**Returns:** `true` if visible, `false` otherwise

**Example:**
```typescript
const is_visible = checker.is_visible(
  class_definition,
  reference_scope_id
);

if (is_visible) {
  // Reference can resolve to this definition
}
```

## Visibility Rules

### scope_local
Visible only in exact defining scope.

```typescript
{
  const x = 1; // defining_scope_id = block_scope
  console.log(x); // ✓ reference_scope_id = block_scope → visible

  {
    console.log(x); // ✗ reference_scope_id = inner_block → not visible
  }
}
```

### scope_children
Visible in defining scope and all child scopes.

```typescript
function foo(param) { // param: scope_children, defining_scope_id = foo_scope
  console.log(param); // ✓ reference_scope_id = foo_scope → visible

  {
    console.log(param); // ✓ reference_scope_id = block_scope (child) → visible
  }
}

console.log(param); // ✗ reference_scope_id = file_scope (parent) → not visible
```

### file
Visible anywhere in same file.

```typescript
// file1.ts
class MyClass { } // visibility: file, defining_scope_id = file_scope

function useClass() {
  new MyClass(); // ✓ Same file → visible
}

// file2.ts
new MyClass(); // ✗ Different file → not visible
```

### exported
Visible from any file.

```typescript
// file1.ts
export class MyClass { } // visibility: exported

// file2.ts
import { MyClass } from './file1';
new MyClass(); // ✓ Exported → visible
```

## Usage Patterns

### Pattern 1: Symbol Resolution

```typescript
function resolve_reference(
  name: string,
  reference_scope_id: ScopeId
): SymbolId | undefined {
  const candidates = find_definitions_by_name(name);
  const checker = new VisibilityChecker(index);

  const visible = candidates.filter(def =>
    checker.is_visible(def, reference_scope_id)
  );

  return visible[0]?.symbol_id;
}
```

### Pattern 2: Filtering Definitions

```typescript
function get_visible_classes(
  scope_id: ScopeId
): ClassDefinition[] {
  const checker = new VisibilityChecker(index);

  return Array.from(index.classes.values()).filter(cls =>
    checker.is_visible(cls, scope_id)
  );
}
```

## See Also

- [VisibilityKind](./types.md#visibilitykind) - Visibility type definition
- [Scope Tree Utilities](./scope-tree-utils.md) - Scope traversal helpers
- [Symbol Resolution](./symbol-resolution.md) - How visibility is used
```

### 3. Create Scope Tree Utils API Documentation (25 min)

Create `docs/api/scope-tree-utils.md`:

```markdown
# Scope Tree Utilities API

## Overview

Utilities for traversing and analyzing the scope tree.

## Import

```typescript
import {
  get_scope_ancestors,
  get_scope_descendants,
  is_ancestor_of,
  is_descendant_of,
  get_common_ancestor,
  get_scope_depth,
  same_file,
} from '@ariadnejs/core';
```

## Functions

### `get_scope_ancestors(scope_id, index): ScopeId[]`

Get all ancestor scopes from scope to root.

**Returns:** Array from scope_id to root (inclusive)

**Example:**
```typescript
// Scope tree: root -> function -> block
const ancestors = get_scope_ancestors(block_id, index);
// Returns: [block_id, function_id, root_id]
```

### `get_scope_descendants(scope_id, index): ScopeId[]`

Get all descendant scopes.

**Returns:** Array of all descendant scope IDs

### `is_ancestor_of(potential_ancestor, scope_id, index): boolean`

Check if potential_ancestor is an ancestor of scope_id.

**Example:**
```typescript
if (is_ancestor_of(function_scope, block_scope, index)) {
  // block is inside function
}
```

### `get_common_ancestor(scope_id1, scope_id2, index): ScopeId | undefined`

Find nearest common ancestor.

### `get_scope_depth(scope_id, index): number`

Get depth from root (root = 0, children = 1, etc.)

### `same_file(scope_id1, scope_id2, index): boolean`

Check if two scopes are in same file.

## See Also

- [VisibilityChecker](./visibility-checker.md)
- [Semantic Index](./semantic-index.md)
```

### 4. Update Semantic Index API Doc (15 min)

Update `docs/api/semantic-index.md` with new fields.

### 5. Update Symbol Resolution API Doc (15 min)

Update `docs/api/symbol-resolution.md` to mention visibility filtering.

### 6. Add API Overview (10 min)

Update `docs/api/README.md` with links to new docs.

## Success Criteria

- ✅ Comprehensive JSDoc for all types
- ✅ VisibilityChecker API documented
- ✅ Scope tree utilities API documented
- ✅ Existing API docs updated
- ✅ Examples clear and accurate
- ✅ Cross-references added

## Outputs

- Updated API documentation
- New VisibilityChecker docs
- New scope tree utilities docs

## Next Task

**task-epic-11.112.42** - Final cleanup and validation

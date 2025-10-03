# Task epic-11.112.27: Add VisibilityKind Type Definition

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1 hour
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.26

## Objective

Add the new `VisibilityKind` type and related types to `@ariadnejs/types`. This introduces the reference-centric visibility system alongside the existing `Availability` type (which will be removed in a later task).

## Files

### MODIFIED
- `packages/ariadne-types/src/semantic_index.ts`

## Implementation Steps

### 1. Add VisibilityKind Type (15 min)

```typescript
// In semantic_index.ts

/**
 * Visibility determines how far a symbol can be seen from its defining scope.
 * This is reference-centric: visibility is evaluated relative to the reference location.
 */
export type VisibilityKind =
  /** Visible only in the exact scope where defined */
  | { kind: "scope_local" }
  /** Visible in defining scope and all child scopes */
  | { kind: "scope_children" }
  /** Visible anywhere in the same file */
  | { kind: "file" }
  /** Visible from other files (exported) */
  | { kind: "exported"; export_kind: ExportKind };
```

### 2. Add ExportKind Type (10 min)

```typescript
/**
 * Type of export for symbols visible from other files.
 */
export type ExportKind =
  /** Named export: `export { foo }` or `export function foo() {}` */
  | { kind: "named"; export_name: string }
  /** Default export: `export default foo` */
  | { kind: "default" }
  /** Namespace export: `export * as ns from 'module'` */
  | { kind: "namespace"; namespace: string };
```

### 3. Add WithVisibility Interface (10 min)

```typescript
/**
 * Base interface for definitions that support scope-aware visibility.
 */
export interface WithVisibility {
  /**
   * The scope where this symbol is defined.
   * Used in conjunction with visibility to determine if symbol is visible from a reference.
   */
  defining_scope_id: ScopeId;

  /**
   * How far this symbol can be seen from its defining scope.
   */
  visibility: VisibilityKind;
}
```

### 4. Add Visibility Helper Types (10 min)

```typescript
/**
 * Helper to create scope_local visibility
 */
export function scope_local_visibility(): VisibilityKind {
  return { kind: "scope_local" };
}

/**
 * Helper to create scope_children visibility
 */
export function scope_children_visibility(): VisibilityKind {
  return { kind: "scope_children" };
}

/**
 * Helper to create file visibility
 */
export function file_visibility(): VisibilityKind {
  return { kind: "file" };
}

/**
 * Helper to create exported visibility
 */
export function exported_visibility(export_kind: ExportKind): VisibilityKind {
  return { kind: "exported", export_kind };
}
```

### 5. Add Documentation (10 min)

Add comprehensive JSDoc explaining the visibility system:

```typescript
/**
 * # Scope-Aware Visibility System
 *
 * The visibility system determines whether a symbol definition is visible
 * from a given reference location. Unlike the old `Availability` system,
 * visibility is **reference-centric**: we evaluate visibility based on
 * WHERE the symbol is being referenced from.
 *
 * ## Visibility Kinds
 *
 * ### scope_local
 * The symbol is visible ONLY in the exact scope where it's defined.
 * - Example: Local variable in a block scope
 * - Reference from same scope: ✓ visible
 * - Reference from child scope: ✗ not visible
 * - Reference from parent scope: ✗ not visible
 *
 * ### scope_children
 * The symbol is visible in the defining scope AND all child scopes.
 * - Example: Function parameter (visible in function body)
 * - Example: Function defined in another function
 * - Reference from defining scope: ✓ visible
 * - Reference from child scope: ✓ visible
 * - Reference from parent scope: ✗ not visible
 * - Reference from sibling scope: ✗ not visible
 *
 * ### file
 * The symbol is visible anywhere in the same file.
 * - Example: Class defined at file scope (not exported)
 * - Example: File-scoped variable
 * - Reference from same file: ✓ visible
 * - Reference from other file: ✗ not visible
 *
 * ### exported
 * The symbol is visible from other files.
 * - Example: Exported class, function, variable
 * - Reference from same file: ✓ visible
 * - Reference from other file (with import): ✓ visible
 *
 * ## Migration from Availability
 *
 * Old `Availability` → New `VisibilityKind`:
 * - "local" (parameter) → scope_children
 * - "local" (variable) → scope_local or scope_children (depends on context)
 * - "file" → file
 * - "file-export" → exported
 */
```

### 6. Run Type Checker (5 min)

```bash
npx tsc --noEmit
```

Expected: Types compile successfully.

## Success Criteria

- ✅ VisibilityKind type added
- ✅ ExportKind type added
- ✅ WithVisibility interface added
- ✅ Helper functions added
- ✅ Comprehensive documentation added
- ✅ Types compile

## Outputs

- New visibility types in `semantic_index.ts`

## Next Task

**task-epic-11.112.28** - Add visibility field to definition types

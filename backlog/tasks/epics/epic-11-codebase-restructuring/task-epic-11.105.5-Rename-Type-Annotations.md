# Task 105.5: Rename local_type_annotations → type_annotations

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 1 hour
**Parent:** task-epic-11.105
**Dependencies:** task-epic-11.105.2, task-epic-11.105.3, task-epic-11.105.4

## Objective

Rename `local_type_annotations` to `type_annotations` for clearer, more consistent naming. Remove the "local_" prefix since all semantic index data is local (single-file).

## Rationale

With `local_types` and `local_type_tracking` removed, the "local_" prefix is:
- Redundant (everything in semantic index is local/single-file)
- Inconsistent (we don't say `local_classes` or `local_functions`)
- Verbose for no benefit

## Changes

### 1. Rename Interface Field (5 min)

**File:** `src/index_single_file/semantic_index.ts`

```typescript
export interface SemanticIndex {
  // BEFORE
  readonly local_type_annotations: LocalTypeAnnotation[];

  // AFTER
  readonly type_annotations: TypeAnnotation[];
}
```

### 2. Rename Type Definition (5 min)

**File:** `src/index_single_file/references/type_annotation_references/type_annotation_references.ts`

```typescript
// BEFORE
export interface LocalTypeAnnotation { ... }

// AFTER
export interface TypeAnnotation { ... }

// Add export alias for backwards compatibility (temporary)
export type LocalTypeAnnotation = TypeAnnotation;
```

### 3. Rename Function (5 min)

Same file:

```typescript
// BEFORE
export function process_type_annotations(...): LocalTypeAnnotation[] { ... }

// AFTER
export function extract_type_annotations(...): TypeAnnotation[] { ... }

// Backwards compatibility alias (temporary)
export const process_type_annotations = extract_type_annotations;
```

### 4. Update All Imports (20 min)

Find all files that import the renamed types:

```bash
grep -r "LocalTypeAnnotation" packages/core/src --include="*.ts" -l
```

For each file, update:
```typescript
// BEFORE
import { LocalTypeAnnotation } from "...";

// AFTER
import { TypeAnnotation } from "...";
```

**Files likely affected:**
- `src/index_single_file/semantic_index.ts`
- `src/resolve_references/local_type_context/local_type_context.ts`
- `src/resolve_references/method_resolution_simple/enhanced_context.ts`
- Test files

### 5. Update All Usage (15 min)

Replace all occurrences:

```bash
# Find all usage
grep -r "local_type_annotations" packages/core/src --include="*.ts" -l

# In each file, replace:
# local_type_annotations → type_annotations
# LocalTypeAnnotation → TypeAnnotation
```

**Common patterns:**
```typescript
// BEFORE
index.local_type_annotations.forEach(...)
const annotation: LocalTypeAnnotation = ...

// AFTER
index.type_annotations.forEach(...)
const annotation: TypeAnnotation = ...
```

### 6. Update build_semantic_index (5 min)

**File:** `src/index_single_file/semantic_index.ts`

```typescript
// BEFORE
const local_type_annotations = process_type_annotations(
  grouped.types,
  root_scope,
  scopes,
  file_path
);

return {
  // ...
  local_type_annotations,
};

// AFTER
const type_annotations = extract_type_annotations(
  grouped.types,
  root_scope,
  scopes,
  file_path
);

return {
  // ...
  type_annotations,
};
```

### 7. Update Tests (10 min)

Update test files:
- `type_annotation_references.test.ts`
- `local_type_context.test.ts`
- `semantic_index.*.test.ts`

Replace all occurrences of:
- `local_type_annotations` → `type_annotations`
- `LocalTypeAnnotation` → `TypeAnnotation`

## Validation

### 1. Type Checking
```bash
npm run build
# Should compile without errors
```

### 2. Find Remaining Old Names
```bash
# Should find ONLY backwards compatibility exports
grep -r "LocalTypeAnnotation\|local_type_annotations" packages/core/src --include="*.ts"
```

### 3. Run Tests
```bash
npm test
# All tests should pass
```

### 4. Verify Semantic Index
```typescript
// Quick smoke test
const index = build_semantic_index(file, tree, "typescript");
expect(index.type_annotations).toBeDefined();
expect(index.local_type_annotations).toBeUndefined();
```

## Deliverables

- [ ] `local_type_annotations` → `type_annotations` in interface
- [ ] `LocalTypeAnnotation` → `TypeAnnotation` type name
- [ ] `process_type_annotations` → `extract_type_annotations` function name
- [ ] All imports and usage updated
- [ ] Backwards compatibility exports in place (temporary)
- [ ] All tests pass

## Cleanup Later

After this task, the backwards compatibility exports can be removed:

```typescript
// TODO: Remove in task 105.11
export type LocalTypeAnnotation = TypeAnnotation;
export const process_type_annotations = extract_type_annotations;
```

## Next Steps

- Task 105.6: Extract constructor_calls directly (flatten structure)

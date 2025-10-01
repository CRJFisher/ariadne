# Task 105.2: Remove local_types from Semantic Index

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1.5 hours
**Parent:** task-epic-11.105
**Dependencies:** task-epic-11.105.1

## Objective

Remove `local_types` field from `SemanticIndex` interface and delete the entire `type_members` module (689 LOC). This structure duplicates data already in `ClassDefinition.methods[]`.

## Problem

`local_types: LocalTypeInfo[]` provides:
- Class/interface members (methods, properties)
- Extends/implements clauses
- Rust-specific generic parameters

All of this is already in `ClassDefinition`, `InterfaceDefinition`, etc.

## Changes

### 1. Update SemanticIndex Interface (5 min)

**File:** `src/index_single_file/semantic_index.ts`

```typescript
export interface SemanticIndex {
  // ... existing fields ...

  // ❌ REMOVE
  readonly local_types: LocalTypeInfo[];
}
```

### 2. Remove Extraction Phase (10 min)

**File:** `src/index_single_file/semantic_index.ts`

Remove Phase 6 from `build_semantic_index()`:

```typescript
// ❌ DELETE Phase 6
const local_types = extract_type_members(
  classes,
  interfaces,
  types,
  enums,
  scopes,
  file_path,
  grouped.definitions,
  grouped.types
);

// ❌ DELETE from return
return {
  // ...
  local_types,  // Remove this
};
```

### 3. Delete Module (5 min)

Delete entire directory:
```bash
rm -rf packages/core/src/index_single_file/definitions/type_members/
```

**Files deleted:**
- `type_members.ts` (689 LOC)
- `type_members.test.ts`
- `index.ts`

### 4. Update Imports (10 min)

Remove imports in:
- `src/index_single_file/semantic_index.ts`

```typescript
// ❌ REMOVE
import { extract_type_members, LocalTypeInfo } from "./definitions/type_members";
```

### 5. Fix Compilation Errors (30 min)

Run build and fix errors:

```bash
npm run build 2>&1 | tee build-errors.log
```

Expected errors:
- `enhanced_context.ts` - Uses `local_types`
- Test files - Use `local_types` for validation

For each error:
- If in production code: Update to use `index.classes` instead
- If in tests: Mark as TODO for task 105.8

### 6. Handle enhanced_context.ts (30 min)

**File:** `src/resolve_references/method_resolution_simple/enhanced_context.ts`

This file uses `local_types`. Options:

**Option A: Deprecate enhanced_context**
- Add deprecation comment
- Update to not use `local_types` (pass empty array)

**Option B: Remove enhanced_context**
- Check if it's used in production
- If not, delete it

Check usage:
```bash
grep -r "enhanced_context" packages/core/src --include="*.ts" | grep -v test
```

### 7. Update Tests Minimally (10 min)

For now, just make tests compile (don't fix properly yet):

```typescript
// Temporary: Comment out tests that fail
test.skip('validates type members', () => {
  // Will fix in task 105.8
});
```

## Validation

### Compilation
```bash
npm run build
# Should succeed with warnings about skipped tests
```

### Test Status
```bash
npm test 2>&1 | grep -E "PASS|FAIL|SKIP"
# Some tests will be skipped - expected
```

### Verify Deletion
```bash
# Should find NO results
grep -r "local_types" packages/core/src --include="*.ts" | grep -v test | grep -v enhanced
```

## Deliverables

- [ ] `local_types` removed from interface
- [ ] `extract_type_members()` deleted
- [ ] `/type_members/` directory deleted
- [ ] Code compiles (tests may be skipped)
- [ ] Documented what tests need migration (for 105.8)

## Rollback

If issues found:
```bash
git revert HEAD
```

Original code preserved in:
- Git commit before this task
- Can restore if needed

## Next Steps

- Task 105.3: Remove local_type_tracking
- Task 105.8: Migrate tests to use index.classes

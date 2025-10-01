# Task 105.3: Remove local_type_tracking from Semantic Index

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1 hour
**Parent:** task-epic-11.105
**Dependencies:** task-epic-11.105.1

## Objective

Remove `local_type_tracking` field from `SemanticIndex` interface and delete the `type_tracking` module (342 LOC). This structure is only used in abandoned `enhanced_context.ts` and overlaps with `type_annotations`.

## Problem

`local_type_tracking: LocalTypeTracking` provides:
- Variable type annotations (overlaps with `local_type_annotations`)
- Variable declarations (already in symbols)
- Assignment patterns (not implemented properly)

**Used only in:** `enhanced_context.ts` (abandoned experiment)

## Changes

### 1. Update SemanticIndex Interface (5 min)

**File:** `src/index_single_file/semantic_index.ts`

```typescript
export interface SemanticIndex {
  // ... existing fields ...

  // ❌ REMOVE
  readonly local_type_tracking: LocalTypeTracking;
}
```

### 2. Remove Extraction Phase (10 min)

**File:** `src/index_single_file/semantic_index.ts`

Remove Phase 8 from `build_semantic_index()`:

```typescript
// ❌ DELETE Phase 8
const local_type_tracking = extract_type_tracking(
  grouped.assignments,
  scopes,
  file_path
);

// ❌ DELETE from return
return {
  // ...
  local_type_tracking,  // Remove this
};
```

### 3. Delete Module (5 min)

Delete directory:
```bash
rm -rf packages/core/src/index_single_file/references/type_tracking/
```

**Files deleted:**
- `type_tracking.ts` (342 LOC)
- `type_tracking.test.ts`
- `index.ts`

### 4. Update Imports (5 min)

Remove imports in:
- `src/index_single_file/semantic_index.ts`

```typescript
// ❌ REMOVE
import { extract_type_tracking, LocalTypeTracking } from "./references/type_tracking";
```

### 5. Handle enhanced_context.ts (20 min)

**File:** `src/resolve_references/method_resolution_simple/enhanced_context.ts`

This is the ONLY production file that uses `local_type_tracking`.

Check if `enhanced_context.ts` is used:
```bash
grep -r "enhanced_context\|build_enhanced_context" packages/core/src --include="*.ts" | grep -v test
```

**If NOT used in production:**
```bash
# Delete it
rm packages/core/src/resolve_references/method_resolution_simple/enhanced_context.ts
rm packages/core/src/resolve_references/method_resolution_simple/enhanced_*.ts
```

**If used in production:**
```typescript
// Update to use type_annotations instead
function build_enhanced_context(...) {
  // Remove references to type_tracking
  const type_tracking = {
    annotations: [],
    declarations: [],
    assignments: []
  };  // Stub for compatibility
}
```

### 6. Fix Compilation Errors (10 min)

```bash
npm run build 2>&1 | tee build-errors.log
```

Fix any remaining references:
- Update to use `type_annotations` instead
- Or remove if in dead code

### 7. Update Test Utilities (5 min)

Check test factory/utility files:

**File:** `src/resolve_references/test_utilities.ts`

Remove `local_type_tracking` from mock objects:

```typescript
function create_mock_semantic_index(): SemanticIndex {
  return {
    // ...
    // ❌ REMOVE
    local_type_tracking: {
      annotations: [],
      declarations: [],
      assignments: []
    }
  };
}
```

## Validation

### Compilation
```bash
npm run build
# Should succeed
```

### No References Remaining
```bash
# Should find ONLY test files
grep -r "local_type_tracking" packages/core/src --include="*.ts"
# Or no results if enhanced_context deleted
```

### Tests
```bash
npm test
# Related tests deleted, others should pass
```

## Deliverables

- [ ] `local_type_tracking` removed from interface
- [ ] `extract_type_tracking()` deleted
- [ ] `/type_tracking/` directory deleted
- [ ] `enhanced_context.ts` handled (deleted or updated)
- [ ] Code compiles and tests pass

## Decision Points

**Decision: What to do with enhanced_context.ts?**

Check usage:
```bash
grep -r "from.*enhanced_context" packages/core/src --include="*.ts" | grep -v test
```

- If no production usage → DELETE it
- If used → Update to work without type_tracking

Document decision in commit message.

## Next Steps

- Task 105.4: Remove unused type_flow fields

# Task epic-11.112.36: Update Code to Use visibility

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** Multiple files modified
**Dependencies:** task-epic-11.112.35

## Objective

Update all codebase references from `availability` to `visibility`. This includes updating code that reads the field, checks it, or uses it for any purpose.

## Files

### MODIFIED
- All files that access `.availability` on definitions
- Builder configs (if still accessing it)
- Any utility functions

## Implementation Steps

### 1. Find All availability Accesses (10 min)

```bash
# Find all .availability accesses
grep -r "\.availability" packages/core/src/ --include="*.ts" | grep -v "test.ts" | grep -v "types"
```

### 2. Update Availability Checks (60 min)

Replace simple availability checks with visibility:

```typescript
// Before:
if (definition.availability === "file-export") {
  // exported symbol
}

// After:
if (definition.visibility.kind === "exported") {
  // exported symbol
}
```

Common patterns:
```typescript
// Pattern 1: Checking for exported
definition.availability === "file-export"
→
definition.visibility.kind === "exported"

// Pattern 2: Checking for local
definition.availability === "local"
→
definition.visibility.kind === "scope_local" || definition.visibility.kind === "scope_children"

// Pattern 3: Checking for file-scoped
definition.availability === "file"
→
definition.visibility.kind === "file"
```

### 3. Update Availability-Based Logic (60 min)

If there's code that uses availability for filtering or logic:

```typescript
// Before:
const exported_symbols = definitions.filter(def =>
  def.availability === "file-export"
);

// After:
const exported_symbols = definitions.filter(def =>
  def.visibility.kind === "exported"
);
```

### 4. Update Builder Configs (20 min)

If builder configs still access availability (they shouldn't after task-epic-11.112.29):

```typescript
// Should already be using visibility from task-epic-11.112.29
// But verify no remaining availability accesses:
grep -r "\.availability" packages/core/src/index_single_file/query_code_tree/language_configs/ --include="*.ts"
```

### 5. Update Utility Functions (30 min)

If there are utility functions that work with availability:

```typescript
// Before:
export function is_exported(definition: Definition): boolean {
  return definition.availability === "file-export";
}

// After:
export function is_exported(definition: Definition): boolean {
  return definition.visibility.kind === "exported";
}

// Or better, add new visibility-specific helpers:
export function has_exported_visibility(definition: Definition): boolean {
  return definition.visibility.kind === "exported";
}

export function has_file_visibility(definition: Definition): boolean {
  return definition.visibility.kind === "file";
}
```

### 6. Update Comments and Documentation (20 min)

Update comments that mention availability:

```typescript
// Before:
// Check if symbol has "file-export" availability

// After:
// Check if symbol has exported visibility
```

### 7. Run Type Checker (5 min)

```bash
npx tsc --noEmit
```

Expected: No errors. May still have deprecation warnings from tests.

### 8. Run Tests (10 min)

```bash
npm test
```

Expected: Tests pass.

### 9. Verify No Remaining availability Accesses (5 min)

```bash
# Should only find in tests and type definitions
grep -r "\.availability" packages/core/src/ --include="*.ts" | grep -v "test.ts" | grep -v "semantic_index.ts"
```

## Success Criteria

- ✅ All production code uses `visibility` instead of `availability`
- ✅ Availability checks converted to visibility checks
- ✅ Utility functions updated
- ✅ Comments updated
- ✅ Type checker passes
- ✅ Tests pass
- ✅ No `availability` accesses outside types and tests

## Outputs

- Production code migrated to `visibility`

## Next Task

**task-epic-11.112.37** - Remove availability field

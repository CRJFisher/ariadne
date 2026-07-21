# Task: Delete TypeContext Infrastructure

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.144 - Merge TypeContext into TypeRegistry
**Status**: Completed
**Priority**: High
**Complexity**: Low

## Overview

Delete obsolete TypeContext infrastructure now that TypeRegistry implements all functionality directly. This includes the TypeContext interface, build_type_context_eager(), and related files.

## Context

After completing tasks 11.144.1-4, the TypeContext infrastructure is no longer used:
- TypeRegistry implements all TypeContext methods directly
- Call resolvers use TypeRegistry instead of TypeContext interface
- build_type_context_eager() is no longer called

**Files to Delete:**
1. `packages/core/src/project/type_context_eager.ts` (~198 lines)
2. `packages/core/src/resolve_references/type_resolution/type_context.ts` (interface)
3. Old `build_type_context()` implementation (if still exists)

**Code Savings:** ~250-300 lines of obsolete adapter code

## Goals

1. Delete type_context_eager.ts
2. Delete type_context.ts (interface)
3. Remove all imports of TypeContext
4. Update index.ts exports
5. Verify all tests still pass
6. Verify no references to deleted code remain

## Implementation

### 1. Verify No Remaining Usage

Before deleting, verify TypeContext is not used:

```bash
# Search for TypeContext imports
grep -r "import.*TypeContext" packages/core/src --include="*.ts" | grep -v ".test.ts"

# Should only find:
# - type_context_eager.ts (being deleted)
# - type_context.ts (being deleted)
# - Any test files (will update)

# Search for build_type_context_eager usage
grep -r "build_type_context_eager" packages/core/src --include="*.ts"

# Should only find:
# - type_context_eager.ts (being deleted)
# - resolution_registry.ts (already removed in task 11.144.4)
```

If any usage remains, update those files first before deleting.

### 2. Delete type_context_eager.ts

```bash
git rm packages/core/src/project/type_context_eager.ts
```

Verify file is gone:
```bash
ls packages/core/src/project/type_context_eager.ts
# Should return: No such file or directory
```

### 3. Delete type_context.ts Interface

```bash
git rm packages/core/src/resolve_references/type_resolution/type_context.ts
```

### 4. Check for Old build_type_context()

The old lazy build_type_context() implementation may still exist:

```bash
find packages/core/src/resolve_references/type_resolution -name "*.ts" | grep -v test
```

If `type_context.ts` contained the old implementation, it's already deleted. If there's a separate file, delete it:

```bash
# If exists
git rm packages/core/src/resolve_references/type_resolution/build_type_context.ts
```

### 5. Update Exports in index.ts Files

Remove TypeContext from exports:

**packages/core/src/resolve_references/type_resolution/index.ts:**
```typescript
// OLD
export type { TypeContext } from "./type_context";
export { build_type_context } from "./type_context";

// NEW
// Remove these exports entirely
// Or if file is now empty, delete the file
```

**packages/core/src/resolve_references/index.ts:**
```typescript
// If it re-exports TypeContext, remove it
// OLD
export type { TypeContext } from "./type_resolution";

// NEW (remove)
```

**packages/core/src/project/index.ts:**
```typescript
// Verify TypeContext is not exported
// Should only export registries:
export { DefinitionRegistry } from "./definition_registry";
export { TypeRegistry } from "./type_registry";
export { ScopeRegistry } from "./scope_registry";
export { ExportRegistry } from "./export_registry";
export { ImportGraph } from "./import_graph";
export { ResolutionRegistry } from "./resolution_registry";
export { Project } from "./project";
```

**packages/core/src/index.ts:**
```typescript
// Verify TypeContext is not in main exports
// If it is, remove it
```

### 6. Update Test Files

Update test files that import TypeContext:

**type_context.test.ts:**
- Either delete the entire file (if testing old implementation)
- Or convert to test TypeRegistry methods directly

```typescript
// OLD
import { build_type_context_eager } from "../type_context_eager";
import type { TypeContext } from "./type_context";

describe("TypeContext", () => {
  it("should ...", () => {
    const type_context = build_type_context_eager(...);
    // tests
  });
});

// NEW - Move to type_registry.test.ts
describe("TypeRegistry - TypeContext Methods", () => {
  it("should ...", () => {
    const types = new TypeRegistry();
    types.update_file(file_id, index, definitions, resolutions);
    // Same tests but using TypeRegistry directly
  });
});
```

### 7. Clean Up Empty Directories

If `type_resolution` directory is now empty:

```bash
# Check contents
ls packages/core/src/resolve_references/type_resolution/

# If only index.ts remains and it's empty, delete directory
git rm -r packages/core/src/resolve_references/type_resolution/
```

### 8. Update Documentation

Update any documentation that mentions TypeContext:

**packages/core/src/resolve_references/README.md:**
```markdown
<!-- OLD -->
## Type Resolution
Uses TypeContext to track symbol types and resolve method calls.

<!-- NEW -->
## Type Resolution
Uses TypeRegistry to track symbol types and resolve method calls.
```

## Testing

### 1. Verify Compilation

```bash
npm run build --workspace=@ariadnejs/core
```

Should compile without errors. If there are errors about missing TypeContext, find and fix those references.

### 2. Run All Tests

```bash
npm test --workspace=@ariadnejs/core
```

All tests should pass. If tests fail:
- Check for test files still importing TypeContext
- Update them to use TypeRegistry directly
- Or delete obsolete test files

### 3. Search for Remaining References

```bash
# Should find nothing
grep -r "TypeContext" packages/core/src --include="*.ts"
grep -r "type_context_eager" packages/core/src --include="*.ts"
grep -r "build_type_context" packages/core/src --include="*.ts"
```

## Verification Checklist

Run through this checklist:

- [ ] `type_context_eager.ts` deleted
- [ ] `type_context.ts` deleted
- [ ] No remaining imports of TypeContext
- [ ] No remaining calls to build_type_context_eager()
- [ ] Exports updated (TypeContext removed)
- [ ] Tests updated or deleted
- [ ] Empty directories removed
- [ ] Documentation updated
- [ ] Project compiles
- [ ] All tests pass
- [ ] No grep matches for "TypeContext"

## Success Criteria

- [ ] type_context_eager.ts deleted
- [ ] type_context.ts deleted
- [ ] Old build_type_context() deleted (if exists)
- [ ] All TypeContext imports removed
- [ ] Index.ts files updated
- [ ] Test files updated or deleted
- [ ] Documentation updated
- [ ] All tests passing
- [ ] No compilation errors
- [ ] No references to deleted code

## Notes

- This task should be straightforward - just deletions and cleanup
- If you find unexpected TypeContext usage, stop and update those files first
- Saves ~250-300 lines of obsolete code
- Completes the consolidation started in task 11.144.1
- After this task, TypeRegistry is the sole authority for type information

## Dependencies

- **Requires**: task-epic-11.144.4 completed (call resolvers must use TypeRegistry)
- **Blocks**: task-epic-11.144.6 (cleanup of name-based storage)

## Estimated Effort

- Deletions: 15-30 minutes
- Test updates: 30-45 minutes
- Verification: 15-30 minutes
- **Total**: 1-1.5 hours

## Rollback Plan

If something breaks:
1. Use `git revert` to restore deleted files
2. Fix the issue found
3. Re-attempt deletion

The changes are safe because previous tasks ensured TypeContext is not used anywhere.

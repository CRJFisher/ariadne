# Task 152.12: Remove Legacy Code

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: TODO
**Priority**: Medium
**Estimated Effort**: 3 hours
**Phase**: 4 - Cleanup

## Purpose

Remove all legacy code related to the old monolithic `SymbolReference` interface. This includes deprecated types, enums, and migration compatibility layers.

## Scope

Remove the following legacy code:

1. `LegacySymbolReference` interface
2. `ReferenceContext` interface
3. `ReferenceType` enum
4. Backward compatibility type guards
5. Migration notes in comments

## Files to Clean Up

### 1. Remove Legacy Types from symbol_references.ts

**File**: `packages/types/src/symbol_references.ts`

Delete the following sections:

```typescript
// DELETE THIS SECTION (lines 260-295):

/**
 * Backward compatibility: Old ReferenceContext interface
 *
 * DEPRECATED: This interface is kept temporarily for migration purposes.
 * New code should use the typed reference variants above.
 *
 * Will be removed once all code is migrated to discriminated unions.
 */
export interface ReferenceContext {
  readonly receiver_location?: Location;
  readonly property_chain?: readonly SymbolName[];
  readonly construct_target?: Location;
}

/**
 * Legacy SymbolReference interface
 *
 * DEPRECATED: Kept for backward compatibility during migration.
 * Use the discriminated union type above for new code.
 */
export interface LegacySymbolReference {
  readonly location: Location;
  readonly type: ReferenceType;
  readonly scope_id: ScopeId;
  readonly name: SymbolName;
  readonly context?: ReferenceContext;
  readonly type_info?: TypeInfo;
  readonly call_type?: "function" | "method" | "constructor" | "super";
  readonly assignment_type?: TypeInfo;
  readonly return_type?: TypeInfo;
  readonly member_access?: {
    object_type?: TypeInfo;
    access_type: "property" | "method" | "index";
    is_optional_chain: boolean;
  };
}
```

### 2. Remove ReferenceType Enum

**File**: `packages/types/src/semantic_index.ts`

Delete the `ReferenceType` enum:

```typescript
// DELETE THIS:

/**
 * DEPRECATED: Use discriminated union 'kind' field instead
 */
export enum ReferenceType {
  FUNCTION_CALL = "function_call",
  METHOD_CALL = "method_call",
  CONSTRUCTOR_CALL = "constructor_call",
  VARIABLE_READ = "variable_read",
  VARIABLE_WRITE = "variable_write",
  PROPERTY_ACCESS = "property_access",
  TYPE_REFERENCE = "type_reference",
}
```

### 3. Remove Compatibility Exports

**File**: `packages/types/src/index.ts`

Remove exports of deprecated types:

```typescript
// DELETE THESE EXPORTS:
export type { LegacySymbolReference, ReferenceContext } from './symbol_references';
export { ReferenceType } from './semantic_index';
```

Keep only the new exports:

```typescript
// KEEP:
export type {
  SymbolReference,
  SelfReferenceCall,
  MethodCallReference,
  FunctionCallReference,
  ConstructorCallReference,
  VariableReference,
  PropertyAccessReference,
  TypeReference,
  AssignmentReference,
  SelfReferenceKeyword,
} from './symbol_references';

export {
  is_self_reference_call,
  is_method_call,
  is_function_call,
  is_constructor_call,
  is_variable_reference,
  is_property_access,
  is_type_reference,
  is_assignment,
} from './symbol_references';
```

### 4. Remove Migration Comments

Search for and remove migration-related comments:

```bash
# Find files with migration comments
grep -r "DEPRECATED" packages/core/src --include="*.ts"
grep -r "legacy" packages/core/src --include="*.ts"
grep -r "backward compatibility" packages/core/src --include="*.ts"
grep -r "Will be removed" packages/core/src --include="*.ts"
```

Remove comments like:

```typescript
// DELETE THESE:

// DEPRECATED: Use discriminated union instead
// TODO: Remove after migration to discriminated unions
// Legacy code - will be removed
// Backward compatibility layer
```

### 5. Clean Up Unused Imports

After removing legacy types, clean up imports:

```typescript
// BEFORE (in various files):
import { ReferenceType, LegacySymbolReference } from '@ariadnejs/types';

// AFTER:
// Remove entire import if nothing else needed, or remove unused types
```

Run ESLint to find unused imports:

```bash
npm run lint -- --fix
```

## Verification Steps

### 1. Build Verification

Ensure the build succeeds after deletions:

```bash
npm run build
```

Expected: No errors related to missing types.

### 2. Type Check

Run TypeScript type checking:

```bash
npx tsc --noEmit
```

Expected: No errors about `ReferenceType` or `LegacySymbolReference` being used.

### 3. Search for Remaining Usage

Verify no code still references legacy types:

```bash
# Should return 0 results:
grep -r "ReferenceType\." packages/core/src --include="*.ts"
grep -r "LegacySymbolReference" packages/core/src --include="*.ts"
grep -r "ReferenceContext" packages/core/src --include="*.ts"
```

### 4. Test Suite

Run full test suite:

```bash
npm test
```

Expected: All tests pass.

## Files Changed

**Modified**:
- `packages/types/src/symbol_references.ts` - Remove legacy interfaces
- `packages/types/src/semantic_index.ts` - Remove ReferenceType enum
- `packages/types/src/index.ts` - Remove deprecated exports
- Various files - Remove migration comments and unused imports

## Cleanup Checklist

- [ ] `LegacySymbolReference` interface deleted
- [ ] `ReferenceContext` interface deleted
- [ ] `ReferenceType` enum deleted
- [ ] Deprecated exports removed from index.ts
- [ ] Migration comments removed
- [ ] Unused imports cleaned up
- [ ] Build succeeds
- [ ] Type check passes
- [ ] No grep results for legacy types
- [ ] All tests pass

## Expected Code Reduction

Estimated lines of code deleted:
- Legacy interfaces: ~50 lines
- ReferenceType enum: ~10 lines
- Migration comments: ~30 lines
- Unused imports: ~20 lines
- **Total: ~110 lines removed**

## Migration Notes Removal

Remove documentation blocks like:

```typescript
// DELETE:

/**
 * MIGRATION NOTES
 *
 * This file has been migrated from legacy SymbolReference to discriminated unions.
 * Old code used ReferenceType enum. New code uses 'kind' field.
 *
 * Before:
 *   if (ref.type === ReferenceType.METHOD_CALL) { }
 *
 * After:
 *   if (ref.kind === 'method_call') { }
 */
```

These notes were useful during migration but are no longer needed.

## Success Criteria

- [ ] All legacy types deleted
- [ ] All legacy enums deleted
- [ ] All migration comments removed
- [ ] No references to deleted types in codebase
- [ ] Build succeeds without errors
- [ ] Tests pass
- [ ] Code is cleaner and more maintainable

## Rationale

From CLAUDE.md:
> DO NOT SUPPORT BACKWARD COMPATIBILITY - JUST _CHANGE_ THE CODE.

We don't need to keep deprecated code around. Once the migration is complete, remove all traces of the old system.

**Benefits**:
1. **Less cognitive load**: Developers don't see deprecated patterns
2. **Cleaner codebase**: No dead code or misleading comments
3. **Faster builds**: Less code to compile
4. **Better IDE experience**: No confusing autocomplete suggestions

## Next Task

After completion, proceed to **task-152.13** (Update documentation)

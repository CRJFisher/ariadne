# Task: Fix type_members Exports

**Task ID**: task-epic-11.92.10.1
**Parent**: task-epic-11.92.10
**Status**: Pending
**Priority**: Medium
**Created**: 2025-01-22
**Estimated Effort**: 1 hour

## Summary

Fix missing exports in type_members/index.ts for LocalMemberInfo and LocalParameterInfo types that are needed by other modules.

## Problem

Two TypeScript errors (TS2459):
- Line 6: Module declares 'LocalMemberInfo' locally but it is not exported
- Line 7: Module declares 'LocalParameterInfo' locally but it is not exported

Test file cannot import these types:
- `type_members.test.ts` Line 21: Cannot import LocalMemberInfo

## Current Structure

```typescript
// type_members/index.ts
import { LocalMemberInfo } from "./type_members"; // Imported but not exported
import { LocalParameterInfo } from "./type_members"; // Imported but not exported

// Only functions are exported, not types
export { extract_type_members } from "./type_members";
```

## Solution

Add type exports to index.ts:

```typescript
// type_members/index.ts

// Export functions
export { extract_type_members } from "./type_members";

// Export types
export type {
  LocalMemberInfo,
  LocalParameterInfo
} from "./type_members";
```

## Implementation Steps

1. **Analyze current exports** (15 min)
   - Check what's currently exported
   - Verify what consumers need
   - Ensure no naming conflicts

2. **Add type exports** (15 min)
   - Export LocalMemberInfo type
   - Export LocalParameterInfo type
   - Use `export type` for clarity

3. **Update imports in consumers** (15 min)
   - Update test file imports
   - Check other consumers
   - Ensure imports work correctly

4. **Verify no breaking changes** (15 min)
   - Check existing consumers still work
   - Ensure backwards compatibility
   - Document any changes

## Detailed Fix

```typescript
// src/semantic_index/type_members/index.ts
// Before
export { extract_type_members } from "./type_members";

// After
export { extract_type_members } from "./type_members";
export type {
  LocalMemberInfo,
  LocalParameterInfo,
  // Add any other types that should be public
  LocalTypeMembers,
  MemberKind
} from "./type_members";

// Alternative approach if re-export doesn't work
import type {
  LocalMemberInfo as _LocalMemberInfo,
  LocalParameterInfo as _LocalParameterInfo
} from "./type_members";

export type LocalMemberInfo = _LocalMemberInfo;
export type LocalParameterInfo = _LocalParameterInfo;
```

## Test File Updates

```typescript
// src/semantic_index/type_members/type_members.test.ts
// Before
import { LocalMemberInfo } from "./type_members"; // Direct import

// After
import type { LocalMemberInfo } from "./index"; // Import from index
// Or
import type { LocalMemberInfo } from "."; // Shorter form
```

## Success Criteria

- [ ] LocalMemberInfo exported from index.ts
- [ ] LocalParameterInfo exported from index.ts
- [ ] Test file imports work correctly
- [ ] No TypeScript errors TS2459
- [ ] Existing consumers unaffected
- [ ] Build passes successfully

## Files to Modify

- `src/semantic_index/type_members/index.ts`
- `src/semantic_index/type_members/type_members.test.ts`

## Testing

```bash
# Verify exports
npx tsc --noEmit src/semantic_index/type_members/index.ts

# Run tests
npx vitest run src/semantic_index/type_members/

# Full build check
npm run build
```

## Dependencies

- Related to task-epic-11.92.6.5 (LocalMemberInfo interface alignment)
- May affect consumers of these types

## Notes

- Use `export type` for type-only exports
- Consider if these types should be part of public API
- Document which types are public vs internal
- May need to coordinate with type_members module owner
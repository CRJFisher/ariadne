# Task: Align LocalMemberInfo Interfaces

**Task ID**: task-epic-11.92.6.5
**Parent**: task-epic-11.92.6
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 2 hours

## Summary

Resolve interface divergence between semantic_index and type_resolution versions of LocalMemberInfo, and fix export issues in type_members module.

## Problem

Two incompatible versions of LocalMemberInfo exist:

**Semantic Index Version:**
```typescript
interface LocalMemberInfo {
  kind: "method" | "constructor" | "property" | "field";
  // Missing: symbol_id
}
```

**Type Resolution Version:**
```typescript
interface LocalMemberInfo {
  kind: "method" | "property" | "field" | "getter" | "setter";
  symbol_id?: SymbolId;
  // Different kind values, includes symbol_id
}
```

Additionally:
- `type_members/index.ts`: Lines 6-7 - LocalMemberInfo and LocalParameterInfo not exported
- `type_members/type_members.test.ts`: Line 21 - Cannot import LocalMemberInfo

## Solution Approach

1. **Option A: Unify interfaces (Preferred)**
   - Create single LocalMemberInfo interface
   - Support all needed `kind` values
   - Make symbol_id optional for compatibility

2. **Option B: Create conversion utilities**
   - Keep separate interfaces
   - Add conversion functions
   - Document which to use when

3. **Option C: Namespace interfaces**
   - `SemanticLocalMemberInfo`
   - `ResolvedLocalMemberInfo`
   - Clear distinction in naming

## Implementation Steps

1. **Analyze usage patterns**
   - Find all LocalMemberInfo usage
   - Determine required properties
   - Identify compatibility constraints

2. **Implement chosen solution**
   ```typescript
   // Unified interface approach
   export interface LocalMemberInfo {
     kind: "method" | "constructor" | "property" | "field" | "getter" | "setter";
     symbol_id?: SymbolId;
     location: Location;
     is_static?: boolean;
     is_optional?: boolean;
   }
   ```

3. **Fix exports**
   ```typescript
   // type_members/index.ts
   export type { LocalMemberInfo, LocalParameterInfo } from "./type_members";
   ```

4. **Update all usages**
   - Fix imports
   - Adjust property access
   - Handle optional properties

## Success Criteria

- [ ] LocalMemberInfo interface consistent across codebase
- [ ] Exports properly configured in type_members/index.ts
- [ ] All imports resolve correctly
- [ ] No TypeScript errors related to LocalMemberInfo
- [ ] Tests pass with unified interface

## Files to Modify

- `src/semantic_index/type_members/index.ts` - Add exports
- `src/semantic_index/type_members/type_members.ts` - Update interface
- `src/symbol_resolution/type_resolution/types.ts` - Align interface
- All files importing LocalMemberInfo - Update usage

## Testing

```bash
# Verify exports
npm run build

# Check specific module
npx tsc --noEmit src/semantic_index/type_members/index.ts

# Run affected tests
npx vitest run src/semantic_index/type_members/
npx vitest run src/symbol_resolution/type_resolution/
```

## Dependencies

- Blocks other type_members related fixes
- Related to task-epic-11.92.10.1 (type_members exports)

## Migration Guide

If interfaces are unified:
```typescript
// Before
const member: SemanticLocalMemberInfo = {
  kind: "constructor",
  ...
};

// After
const member: LocalMemberInfo = {
  kind: "constructor",
  symbol_id: undefined, // Explicitly undefined if not available
  ...
};
```

## Notes

- Consider long-term maintainability
- Document the decision rationale
- Ensure no loss of type safety
- May require coordination across teams
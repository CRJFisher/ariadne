# Task 11.100.0.5.23.1: Fix Types Package Build Errors

## Parent Task
11.100.0.5.23 - Symbol Refactor - Function Parameters

## Priority
**HIGH** - Blocking builds, must be completed before merging Symbol Refactor work

## Issue Summary
Multiple build errors in packages/types preventing successful compilation:

### Duplicate Export Conflicts
```typescript
Module "./branded_types" has already exported a member named 'is_symbol_id'
Module "./symbol_utils" has already exported a member named 'Symbol'
Module "./branded_types" has already exported a member named 'ResolutionReason'
Module "./branded_types" has already exported a member named 'build_scope_path'
```

### Import Path Inconsistencies  
```typescript
// Found in multiple files:
import { ... } from "./branded-types";  // ❌ Wrong - file doesn't exist
import { ... } from "./branded_types";  // ✅ Correct - actual filename
```

### Function Name Mismatches
```typescript
// Type validation errors:
Cannot find name 'validateLocation'. Did you mean 'validate_location'?
Cannot find name 'validateLanguage'. Did you mean 'validate_language'?
Cannot find name 'validateASTNode'. Did you mean 'validate_ast_node'?
```

## Root Cause Analysis
The errors stem from recent file renames and reorganization:
1. `branded-types.ts` was renamed to `branded_types.ts` but imports weren't updated
2. Duplicate exports exist in `index.ts` from multiple modules
3. Function names were changed to snake_case but not consistently updated

## Work Required

### Phase 1: Import Path Fixes
- [ ] Update all imports from `./branded-types` to `./branded_types` 
- [ ] Verify file exists and exports match
- [ ] Check for other inconsistent import paths

### Phase 2: Duplicate Export Resolution
- [ ] Audit packages/types/src/index.ts for duplicate exports
- [ ] Create export conflict resolution map
- [ ] Remove duplicates while preserving API compatibility
- [ ] Test that external packages can still import correctly

### Phase 3: Function Name Consistency
- [ ] Update type validation function references:
  - `validateLocation` → `validate_location`
  - `validateLanguage` → `validate_language` 
  - `validateASTNode` → `validate_ast_node`
- [ ] Verify no other camelCase/snake_case mismatches exist

### Phase 4: Verification
- [ ] `npm run build` succeeds in packages/types
- [ ] `npm run build` succeeds in packages/core  
- [ ] No TypeScript compilation errors
- [ ] External imports still work correctly

## Files to Update
Based on error analysis:
- `packages/types/src/index.ts` - Remove duplicate exports
- `packages/types/src/definitions.ts` - Fix import path
- `packages/types/src/symbol_scope.ts` - Fix import path  
- `packages/types/src/type_analysis.ts` - Fix import path
- `packages/types/src/type_validation.ts` - Fix function names

## Success Criteria
- ✅ All TypeScript compilation errors resolved
- ✅ `packages/types` builds successfully  
- ✅ `packages/core` builds successfully
- ✅ No breaking changes to external API
- ✅ Existing imports continue to work

## Dependencies
**Blocks**: All Symbol Refactor work - must complete before merging

## Estimated Time
4-6 hours

## Risk Assessment
- **Low Risk**: Mostly mechanical fixes (import paths, export deduplication)
- **Medium Risk**: Must preserve external API compatibility
- **Mitigation**: Test builds after each phase

## Notes
This is a prerequisite for the Symbol Refactor work completed in the parent task. The build errors prevent proper testing and deployment of the SymbolId overloads.
---
id: task-epic-11.100.0.5.19.24
title: Fix import/export type issues
status: To Do
assignee: []
created_date: "2025-01-13"
labels: ["type-system", "exports"]
dependencies: ["task-epic-11.100.0.5.19.2"]
parent_task_id: task-epic-11.100.0.5.19.2
priority: medium
---

## Description

Fix import and export issues where types are not properly exported or have been removed during the type cleanup, causing compilation errors in dependent modules.

## Current Errors

### 1. ImportInfo Not Exported
```
error TS2305: Module '"@ariadnejs/types"' has no exported member 'ImportInfo'.
```
**Affected files:**
- `src/type_analysis/type_tracking/import_type_resolver.test.ts`
- `src/type_analysis/type_tracking/import_type_resolver.ts`
- `src/type_analysis/type_tracking/index.ts`
- `src/type_analysis/type_tracking/type_tracking.typescript.integration.test.ts`

### 2. TypeInfo Not Exported
```
error TS2459: Module '"./type_tracking"' declares 'TypeInfo' locally, but it is not exported.
```
**Affected files:**
- `src/type_analysis/type_tracking/index.ts` (lines 17, 96)
- `src/type_analysis/type_tracking/type_tracking.javascript.ts`
- `src/type_analysis/type_tracking/type_tracking.python.ts`
- `src/type_analysis/type_tracking/type_tracking.rust.ts`
- `src/type_analysis/type_tracking/type_tracking.typescript.ts`
- `src/type_analysis/type_tracking/type_tracking_utils.ts`

### 3. ClassName Not Found
```
error TS2304: Cannot find name 'ClassName'.
```
**Affected files:**
- `src/type_analysis/type_tracking/type_tracking.test.ts` (line 112)

## Root Cause Analysis

1. **ImportInfo**: Was marked as deprecated in `modules.ts` but still needed by type tracking
2. **TypeInfo**: Local type in `type_tracking.ts` that needs to be exported for other modules
3. **ClassName**: Legacy type that may have been removed or not properly imported

## Solution Approaches

### Option 1: Restore Missing Exports
Add missing types back to the exports in `packages/types/src/index.ts`:
```typescript
// Re-export deprecated types for backward compatibility
export { ImportInfo, ExportInfo } from './modules';
export { TypeInfo } from './type_tracking'; // If this file exists
```

### Option 2: Update Import Statements
Change imports to use the new type locations:
```typescript
// Instead of importing from @ariadnejs/types
import { ImportInfo } from '@ariadnejs/types/modules';

// Or use new types
import { Import } from '@ariadnejs/types';
```

### Option 3: Export Local Types
Export `TypeInfo` from the module where it's declared:
```typescript
// In type_tracking.ts
export interface TypeInfo {
  // ... type definition
}
```

## Files to Update

### 1. packages/types/src/index.ts
Add missing exports for backward compatibility:
```typescript
// Temporary exports for backward compatibility
export { ImportInfo, ExportInfo } from './modules';
```

### 2. packages/core/src/type_analysis/type_tracking/type_tracking.ts
Export the TypeInfo interface:
```typescript
export interface TypeInfo {
  // ... existing definition
}
```

### 3. Update Import Statements
Update all files importing missing types to use correct import paths or new type names.

### 4. Fix ClassName Reference
Determine correct type for ClassName and add proper import:
```typescript
import { ClassName } from '@ariadnejs/types'; // Or correct source
```

## Acceptance Criteria

- [ ] All ImportInfo import errors resolved
- [ ] TypeInfo properly exported and accessible
- [ ] ClassName type properly imported and available
- [ ] All type tracking modules compile without import/export errors
- [ ] Backward compatibility maintained for deprecated types
- [ ] No missing export errors in type system

## Implementation Strategy

1. **Immediate Fix**: Add temporary exports to maintain compilation
2. **Type Migration**: Update code to use new type system where possible
3. **Legacy Support**: Maintain deprecated types until full migration complete
4. **Documentation**: Mark temporary exports with deprecation warnings

## Priority Order

1. Fix ImportInfo exports (blocking multiple modules)
2. Export TypeInfo from type_tracking module
3. Resolve ClassName type reference
4. Clean up and optimize import statements
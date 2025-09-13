---
id: task-epic-11.100.0.5.19.12
title: Update class_detection module for new types
status: Completed
assignee: []
created_date: '2025-01-12'
completed_date: '2025-09-13'
labels: ['ast-processing', 'class-analysis']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the class_detection module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature ✅ COMPLETED
**Actual File**: `packages/core/src/inheritance/class_detection/index.ts`

```typescript
// OLD
export function find_class_definitions(
  context: ClassDetectionContext
): ClassDefinition[]

// NEW
export function find_class_definitions(
  context: ClassDetectionContext
): TypeDefinition[]
```

### 2. Clear Function Body ✅ COMPLETED
Replaced implementation with:
```typescript
export function find_class_definitions(
  context: ClassDetectionContext
): TypeDefinition[] {
  // TODO: Implement using new query-based system
  // See task 11.100.8 for implementation details
  return [];
}
```

### 3. Update Task Documentation ⚠️ PARTIAL
**Note**: Referenced task `11.100.8` does not exist for class_detection. The class_detection refactoring was completed in `task-epic-11.86-refactor-class-detection.md` which is already marked as completed.

## Acceptance Criteria

- [x] Function signature returns `TypeDefinition[]`
- [x] Function body is cleared and ready for refactoring
- [x] Task 11.100.8 documentation updated (N/A - task doesn't exist, class_detection refactoring already completed in task-epic-11.86)
- [x] References to type creation functions added (N/A - will be handled during future query-based implementation)
- [x] Module compiles without errors (syntax-wise - pre-existing type errors from migration remain)

## Implementation Notes

### Decisions Made During Implementation

1. **Actual Function Location**: The task referenced `extract_classes` in `class_extraction.ts`, but the actual function to update was `find_class_definitions` in `packages/core/src/inheritance/class_detection/index.ts`.

2. **Import Updates**: Updated imports to include `TypeDefinition` from `@ariadnejs/types` and removed unused imports for language-specific handlers and configurations since the function body was cleared.

3. **Helper Function Removal**: Removed all helper functions (`enhance_class_with_bespoke`, `enhance_class_body_bespoke`, etc.) as they are no longer needed with the cleared implementation and will be replaced by the new query-based system.

4. **Task Reference Correction**: The referenced `task-epic-11.100.8` for class_detection doesn't exist. The class_detection module was already refactored in `task-epic-11.86-refactor-class-detection.md` which is marked as completed.

5. **Compilation Status**: The module compiles syntactically but has pre-existing type errors from the ongoing type system migration (Task 11.100.0.5.19). These errors are not caused by this task's changes.

### Files Modified

- `packages/core/src/inheritance/class_detection/index.ts`
  - Updated function signature: `find_class_definitions(): TypeDefinition[]`
  - Cleared function body with TODO comment
  - Removed unused imports and helper functions
  - Reduced file size from ~257 lines to ~23 lines

## Sub-Tasks Identified for Future Work

Based on compilation errors and integration requirements discovered during this task:

### 1. Fix Call Graph Type Migrations
**Issue**: Multiple compilation errors in call_graph modules due to incomplete type migration
- `call_chain_analysis.ts` - Missing properties in CallChain, CallChainNode types
- `constructor_calls` modules - Missing ConstructorCall properties across languages
- Type mismatches between SymbolId and string usage

**Files needing updates**:
- `src/call_graph/call_chain_analysis/call_chain_analysis.ts`
- `src/call_graph/call_chain_analysis/call_chain_analysis.test.ts`
- `src/call_graph/constructor_calls/*.ts` (all language modules)

### 2. Implement TypeDefinition Factory Functions
**Issue**: Task referenced `type_analysis_types.ts` factory functions that don't exist
- Need `createClassDefinition()` function
- Need `toTypeName()` function
- Need proper TypeDefinition creation utilities

**Files to create**:
- Factory functions in appropriate types module
- Documentation for TypeDefinition creation patterns

### 3. Implement Query-Based Class Detection
**Issue**: Function body cleared but new implementation not yet created
- Design tree-sitter queries for class detection
- Implement TypeDefinition creation from query results
- Handle language-specific patterns (decorators, traits, etc.)

**Files needing implementation**:
- `packages/core/src/inheritance/class_detection/queries/` directory
- Updated `class_detection.ts` with query-based logic
- Integration with existing language configs

### 4. Fix Resolution and Reference Type Mismatches
**Issue**: Inconsistent usage of Resolution, ResolvedReference, and SymbolId types
- `call_chain_analysis.ts` mixing ResolvedReference and SymbolId
- Missing resolution_path properties in Resolution objects
- Type safety issues with branded types

**Areas needing fixes**:
- Resolution type usage patterns
- SymbolId vs string conversions
- ResolvedReference vs SymbolId usage

### 5. Update Integration Points
**Issue**: class_detection is used by other modules that need TypeDefinition handling
- `file_analyzer.ts` integration
- Class hierarchy building
- Method override detection

**Integration points to verify**:
- Downstream consumers of `find_class_definitions()`
- Type compatibility with existing class processing pipelines

### 6. Comprehensive Testing After Type Migration
**Issue**: Need end-to-end testing once type migration is complete
- Verify all languages work with new TypeDefinition system
- Test class detection across complex inheritance scenarios
- Validate integration with broader AST processing pipeline

### Next Steps

The class_detection module is now prepared for the new query-based implementation. Priority should be given to:

1. **High Priority**: Fix compilation errors (Sub-tasks 1, 4)
2. **Medium Priority**: Implement factory functions (Sub-task 2)
3. **Medium Priority**: Implement query-based class detection (Sub-task 3)
4. **Low Priority**: Integration testing (Sub-tasks 5, 6)
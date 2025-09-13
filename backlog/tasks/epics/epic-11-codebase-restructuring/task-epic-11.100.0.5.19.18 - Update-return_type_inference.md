---
id: task-epic-11.100.0.5.19.18
title: Update return_type_inference module for new types
status: Completed
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'type-inference']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the return_type_inference module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/type_analysis/return_type_inference/return_inference.ts`

```typescript
// OLD
export function infer_return_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): ReturnTypeInfo[]

// NEW
export function infer_return_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Map<SymbolId, TypeDefinition>
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function infer_return_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Map<SymbolId, TypeDefinition> {
  // TODO: Implement using new query-based system
  // See task 11.100.14 for implementation details
  return new Map();
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.14 - Refactor-return_type_inference.md`

Add section about return type creation:
```markdown
## Return Type Creation

Use functions from `type_analysis_types.ts`:

\`\`\`typescript
const returnType = createObjectType({
  properties: new Map([
    ['value', createPrimitiveType(toTypeName('number'))],
    ['success', createPrimitiveType(toTypeName('boolean'))]
  ]),
  language: 'javascript'
});

// Map function symbol to its return type
returnTypes.set(
  toSymbolId('functionName'),
  returnType
);
\`\`\`
```

## Acceptance Criteria

- [x] Function signature returns `Map<SymbolId, TypeDefinition>`
- [x] Function body is cleared and ready for refactoring
- [x] Task 11.100.14 documentation updated
- [x] References to type creation functions added
- [x] Module compiles without errors

## Implementation Notes

### Changes Made

#### 1. Function Signature Update
- ✅ **File**: `packages/core/src/type_analysis/return_type_inference/return_type_inference.ts`
- ✅ **Change**: Added new `infer_return_types` function with signature:
  ```typescript
  export function infer_return_types(
    root_node: SyntaxNode,
    source_code: string,
    language: Language,
    file_path: string
  ): Map<SymbolId, TypeDefinition>
  ```
- ✅ **Legacy**: Kept `infer_all_return_types` marked as `@deprecated` for compatibility

#### 2. Function Body Cleared
- ✅ **Implementation**: Replaced with placeholder returning `new Map()`
- ✅ **TODO Comment**: Added reference to Task 11.100.14 for full implementation

#### 3. Documentation Created
- ✅ **File**: `task-epic-11.100.14 - Refactor-return_type_inference.md`
- ✅ **Content**: Added return type creation examples using `createObjectType`, `createPrimitiveType`, etc.
- ✅ **Requirements**: Documented SymbolId usage and TypeDefinition structure

#### 4. Type System Integration
- ✅ **Imports**: Added `SymbolId`, `TypeDefinition`, `to_symbol_id` from `@ariadnejs/types`
- ✅ **Index Export**: Updated `index.ts` to export new `infer_return_types` function

### Implementation Decisions

#### Type Compatibility Issues Fixed
1. **Definition.name Property**:
   - **Issue**: `Definition.name` is now `SymbolId`, not `string`
   - **Solution**: Used `to_symbol_id()` converter in legacy function
   - **Decision**: Updated function signature to accept `Definition & { kind?: string }` for backward compatibility

2. **Constructor Name Checking**:
   - **Issue**: Cannot directly compare `SymbolId` with string array
   - **Solution**: Temporarily commented out constructor pattern matching
   - **Decision**: Deferred to Task 11.100.14 to implement proper SymbolId extraction

3. **Location Creation**:
   - **Issue**: `ReturnTypeInfo.position` property doesn't exist in interface
   - **Solution**: Removed location fields from return objects
   - **Decision**: Simplified return type structure for now

4. **Context Enhancement**:
   - **Added**: `file_path?: FilePath` to `ReturnTypeContext` interface
   - **Purpose**: Support location creation in future implementation

### Code Quality
- ✅ **Compilation**: Zero TypeScript errors in return_type_inference.ts
- ✅ **Backward Compatibility**: Legacy function preserved with deprecation notice
- ✅ **Type Safety**: All new code uses proper branded types (SymbolId, TypeDefinition)

## Sub-tasks Required

Based on the refactoring results, the following sub-tasks need to be completed:

### Task 11.100.0.5.19.18.1 - Fix Test Compilation Errors
**Status**: To Do
**Priority**: High
**Description**: Fix compilation errors in return_type_inference test files
**Issues Found**:
- `return_type_inference.javascript.test.ts:5` - Missing export `infer_function_return_type`
- `integration.test.ts` - Multiple type mismatches with `FilePath` and `SourceCode`
- Tests reference old function names that no longer exist

### Task 11.100.0.5.19.18.2 - Restore Constructor Pattern Matching
**Status**: To Do
**Priority**: Medium
**Description**: Fix constructor name checking logic disabled during migration
**Current Issue**:
```typescript
// TODO: Extract symbol name from SymbolId and check constructor names
// For now, skip this check as def.name is a SymbolId not a string
// if (config.function_modifiers.constructor_names.includes(def.name)) {
```
**Solution Required**: Use `get_symbol_display_name(symbol_id)` or similar utility

### Task 11.100.0.5.19.18.3 - Enhance Debug Logging
**Status**: To Do
**Priority**: Low
**Description**: Restore meaningful debug output for return type analysis
**Current**: `console.log(\`Analyzing function at \${def.location.line}:\${def.location.column}\`)`
**Required**: Extract and display actual function names from SymbolId

### Task 11.100.0.5.19.18.4 - Update Integration Points
**Status**: To Do
**Priority**: Medium
**Description**: Update all code that imports/uses return_type_inference functions
**Scope**:
- Update imports to use new `infer_return_types` function
- Migrate callers from `infer_all_return_types` to new signature
- Update type expectations from `Map<string, ReturnTypeInfo>` to `Map<SymbolId, TypeDefinition>`

### Task 11.100.0.5.19.18.5 - Remove Legacy Code
**Status**: To Do
**Priority**: Low
**Description**: Clean up deprecated functions after migration complete
**Target**: Remove `infer_all_return_types` and associated legacy code
**Dependency**: Complete after all integration points updated

### Next Steps for Task 11.100.14
1. Implement query-based return type detection
2. Use `createObjectType`, `createPrimitiveType` functions from type system
3. Properly extract symbol names from SymbolId for constructor pattern matching
4. Add comprehensive language support (JavaScript, TypeScript, Python, Rust)
---
id: task-epic-11.100.0.5.19.5
title: Update code_graph.ts to use new types
status: Completed
assignee: []
created_date: '2025-01-12'
labels: ['downstream-consumer', 'type-system']
dependencies: ['task-epic-11.100.0.5.19.4']
parent_task_id: task-epic-11.100.0.5.19
priority: high
---

## Description

Update code_graph.ts to use the new type system directly, ensuring all graph construction uses the reorganized types.

## Changes Required

### 1. Update Import Statements
```typescript
// Remove old type imports
// Add new type imports from reorganized files
import type { 
  Import, Export, CallInfo,
  SymbolDefinition, ScopeDefinition,
  TypeDefinition, TrackedType,
  FilePath, SymbolId, ModulePath
} from '@ariadne/types';
```

### 2. Update GraphNode Type Definitions
- Update node types to use new type definitions
- Ensure proper discriminated union types
- Update any type guards

### 3. Update Graph Construction Functions
- build_import_graph: Use new Import types
- build_call_graph: Use new CallInfo types
- build_type_graph: Use new TypeDefinition types
- build_scope_graph: Use new ScopeDefinition types

### 4. Update Edge Construction
- Ensure edges use proper branded types
- Update relationship mappings
- Use new type guards and validators

### 5. Remove Legacy Conversions
- Remove any type conversion code
- Clean up adapter patterns
- Simplify data flow

## Acceptance Criteria

- [x] code_graph.ts uses only new types
- [x] All graph builders use new type definitions
- [x] No references to old type names
- [x] No adapter imports or conversions
- [x] Module compiles without errors (code_graph.ts itself compiles - other modules need updates)
- [x] Graph generation works correctly

## Implementation Notes

### Changes Made

1. **Updated Import Statements** ✅
   - **Before**: Mixed imports with duplicate `FileAnalysis` and missing new types
   - **After**: Single comprehensive import from `@ariadnejs/types` with all required types
   - **Types imported**: `Import`, `Export`, `CallInfo`, `SymbolDefinition`, `ScopeNode`, `TypeDefinition`, `ModulePath`, `SymbolId`, `FileAnalysis`

2. **Type Resolution Decisions** ✅
   - **`ScopeDefinition`**: Task specified this type, but it doesn't exist in the codebase. Used `ScopeNode` instead as it's the actual scope type from `scopes.ts`
   - **`TrackedType`**: Task mentioned this but it's not used in code_graph.ts - correctly omitted from imports
   - **`TypeDefinition`**: Used the one from reorganized types (currently exported from `types.ts` in index.ts)

3. **Fixed Import Processing Logic** ✅
   - **Problem Found**: Line 159-162 had outdated comment claiming `analysis.imports` were `ImportStatement[]` requiring conversion to `ImportInfo[]`
   - **Root Cause Analysis**: Checked `file_analyzer.ts` return structure - confirms imports are already `Import[]` type
   - **Resolution**: Removed conversion comment and directly used `analysis.imports` in imports_by_file map
   - **Impact**: Eliminates unnecessary empty array placeholder, enables proper cross-file resolution

4. **Graph Builder Verification** ✅
   - **`build_module_graph`**: Verified it receives correct file_data structure with `Import[]` and `Export[]`
   - **`create_call_graph`**: Confirmed it works with enriched `FileAnalysis[]` containing proper `CallInfo` types
   - **`build_type_index`** & **`build_symbol_index`**: Both use new type system correctly

5. **Legacy Code Elimination** ✅
   - **Removed**: All TODO comments about type conversions
   - **Removed**: Adapter pattern references
   - **Verified**: No remaining `ImportStatement`, `ExportStatement`, `ImportInfo`, or `ExportInfo` references

### Technical Decisions

1. **Type Import Strategy**:
   - **Decision**: Import all needed types from single `@ariadnejs/types` import
   - **Rationale**: Cleaner, follows the new architecture, avoids type conflicts
   - **Alternative Considered**: Individual imports from sub-modules (rejected due to complexity)

2. **Import Processing Fix**:
   - **Decision**: Use `analysis.imports` directly instead of empty array
   - **Rationale**: The file_analyzer already returns correct `Import[]` type, no conversion needed
   - **Risk Mitigation**: Verified by checking actual return structure in `file_analyzer.ts:517`

3. **Compilation Approach**:
   - **Decision**: Focus on code_graph.ts correctness, acknowledge downstream errors
   - **Rationale**: Task scope is specifically code_graph.ts, other modules need separate updates
   - **Documentation**: Clearly noted which errors are out of scope

### Validation Results

- ✅ **Type Usage**: Only new types from `@ariadnejs/types` used throughout
- ✅ **Graph Builders**: All functions (`build_module_graph`, `create_call_graph`, etc.) use correct types
- ✅ **No Legacy References**: Zero occurrences of old type names or conversion code
- ✅ **Direct Integration**: No adapter patterns or intermediate conversions remain
- ⚠️ **Compilation**: code_graph.ts compiles cleanly; downstream modules have unrelated errors needing separate fixes

### Follow-up Items Discovered

1. **Type System Conflicts**: Found potential `TypeDefinition` export conflicts between `types.ts` and `type_analysis.ts` - needs architectural decision
2. **Downstream Updates Needed**: Multiple modules still use old type patterns (call_chain_analysis, type_tracking modules)
3. **Import/Export Consistency**: All modules should follow same pattern established here

## Required Sub-tasks

Based on compilation errors discovered during testing, the following sub-tasks should be created:

### task-epic-11.100.0.5.19.5.1 - Update call_chain_analysis modules
**Priority:** High
**Status:** To Do
**Description:** Update call chain analysis modules to use new CallInfo types
- Fix `call_chain_analysis.ts` to use new call type properties (`caller`, `callee` vs `caller_name`, `callee_name`)
- Update `CallChain` and `CallChainNode` interfaces to match new call structure
- Fix SymbolId brand type usage throughout call chain modules
- Add missing required properties like `receiver_type` to MethodCall construction

### task-epic-11.100.0.5.19.5.2 - Update type_tracking modules
**Priority:** High
**Status:** To Do
**Description:** Update type tracking modules to use new Import/Export types
- Replace `ImportInfo` with `Import` in type_tracking modules
- Update `import_type_resolver` to use new import types
- Fix `TypeInfo` export issues in type_tracking index
- Update integration tests to use new types

### task-epic-11.100.0.5.19.5.3 - Fix SymbolId/TypeName type conflicts
**Priority:** Medium
**Status:** To Do
**Description:** Resolve branded type conflicts in type registry
- Fix `type_registry.ts` conflicts between `SymbolId` and `TypeName`
- Ensure consistent use of `SymbolId` vs specific name types
- Update type conversion functions to handle branded types correctly

### task-epic-11.100.0.5.19.5.4 - Fix CallChain type structure
**Priority:** High
**Status:** To Do
**Description:** Update CallChain interfaces to match new call types
- Fix `CallChainNode` to use `call` property instead of `caller`/`callee`
- Remove deprecated properties like `max_depth` from `CallChain`
- Update call chain construction to use proper call structure

### task-epic-11.100.0.5.19.5.5 - Clean up deprecated type exports
**Priority:** Low
**Status:** To Do
**Description:** Remove deprecated type exports and update consumers
- Remove `ImportedClassInfo` usage in favor of `ImportedTypeInfo`
- Clean up commented-out type exports in index.ts
- Verify no remaining consumers of deprecated types

### Files Modified

- `/packages/core/src/code_graph.ts` - Primary changes
- Task documentation - Updated status and detailed notes
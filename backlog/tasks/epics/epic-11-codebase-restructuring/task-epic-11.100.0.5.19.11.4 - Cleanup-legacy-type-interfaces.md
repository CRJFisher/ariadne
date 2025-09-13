---
id: task-epic-11.100.0.5.19.11.4
title: Cleanup legacy type interfaces in type_tracking module
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['cleanup', 'legacy-interfaces']
dependencies: ['task-epic-11.100.0.5.19.11.1', 'task-epic-11.100.0.5.19.11.2']
parent_task_id: task-epic-11.100.0.5.19.11
priority: low
---

## Description

Clean up legacy type interfaces and implementations in the type_tracking module now that the main `track_types` function has been updated to use the new type system.

## Legacy Elements to Review

### 1. LegacyTypeInfo Interface
File: `src/type_analysis/type_tracking/type_tracking.ts:44-60`

Current status: Marked as "for internal use only" but still extensively used throughout the module.

**Action needed**:
- Evaluate if this can be removed after query-based implementation
- Document migration path from LegacyTypeInfo to new TrackedType system

### 2. FileTypeTracker Interface
File: `src/type_analysis/type_tracking/type_tracking.ts:88-96`

Current status: Still used by many functions but may become obsolete with query-based approach.

**Action needed**:
- Determine if this should be deprecated in favor of Map<SymbolId, TrackedType>
- Plan migration strategy for dependent functions

### 3. Legacy Function Overloads
Multiple functions have legacy overloads for backward compatibility:
- `set_variable_type` (lines 112-169)
- `set_imported_class` (lines 186-228)
- `get_imported_class` (lines 232-256)

**Action needed**:
- Create deprecation plan for string-based overloads
- Ensure SymbolId-based versions work correctly

### 4. Generic Configuration Functions
Large section of configuration-driven processing (lines 358+):
- `track_assignment_generic`
- `infer_type_generic`
- `extract_type_annotation_generic`
- `track_imports_generic`
- `track_exports_generic`

**Action needed**:
- Evaluate if these should be preserved or replaced by tree-sitter queries
- Document their role in the transition period

## Cleanup Strategy

### Phase 1: Documentation
- [ ] Document which interfaces are deprecated vs transitional
- [ ] Add clear migration examples for each legacy interface
- [ ] Update JSDoc comments with deprecation warnings

### Phase 2: Function Signatures
- [ ] Mark legacy overloads with @deprecated annotations
- [ ] Ensure all new code uses SymbolId-based versions
- [ ] Add type guards for safe transitions

### Phase 3: Integration Planning
- [ ] Define how legacy functions integrate with new `track_types` return type
- [ ] Plan data transformation between FileTypeTracker and Map<SymbolId, TrackedType>
- [ ] Document timeline for legacy removal

## Acceptance Criteria

- [ ] All legacy interfaces clearly documented as deprecated or transitional
- [ ] Migration path documented for each legacy interface
- [ ] @deprecated annotations added to legacy function overloads
- [ ] Integration strategy defined for legacy and new systems
- [ ] No new code uses legacy string-based overloads
- [ ] Clear timeline established for legacy interface removal
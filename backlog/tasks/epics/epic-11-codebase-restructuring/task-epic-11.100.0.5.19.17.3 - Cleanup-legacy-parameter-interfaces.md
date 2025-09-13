---
id: task-epic-11.100.0.5.19.17.3
title: Cleanup legacy parameter type interfaces
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['cleanup', 'legacy-removal']
dependencies: ['task-epic-11.100.0.5.19.17.2', 'task-epic-11.100.13']
parent_task_id: task-epic-11.100.0.5.19.17
priority: low
---

## Description

Clean up legacy parameter type interfaces and functions that are no longer needed after the migration to the new type system.

## Legacy Interfaces to Review/Remove

### In parameter_type_inference.ts

1. **ParameterInfo** (lines 44-52)
   - Used by old parameter extraction logic
   - May be replaced by query-based extraction

2. **ParameterTypeInfo** (lines 57-62)
   - Used for individual parameter type information
   - Replaced by TypeDefinition in new system

3. **ParameterAnalysis** (lines 67-71)
   - Used as return type for function analysis
   - Replaced by Map<SymbolId, TypeDefinition>

4. **ParameterInferenceContext** (lines 76-82)
   - May still be needed depending on implementation

### Functions to Review

1. **extract_parameters** - May be replaced by query-based extraction
2. **extract_parameter_info** - Internal function, may be obsolete
3. **infer_parameter_types** (the internal one) - May be refactored
4. **apply_bespoke_handlers** - May be simplified or removed
5. All the inference helper functions (infer_type_from_default, check_parameter_patterns, etc.)

## Cleanup Strategy

### Phase 1: After Query Implementation (task 11.100.13)
- [ ] Identify which interfaces are truly obsolete
- [ ] Check if any are still used by bespoke language handlers
- [ ] Determine if any should be kept for backward compatibility

### Phase 2: After Downstream Updates (task 11.100.0.5.19.17.2)
- [ ] Remove unused interface definitions
- [ ] Remove unused import statements
- [ ] Clean up exports in index.ts
- [ ] Remove unused helper functions

### Phase 3: Final Cleanup
- [ ] Update documentation to reflect new API
- [ ] Remove any remaining dead code
- [ ] Verify all tests still pass

## Acceptance Criteria

- [ ] All truly unused interfaces removed
- [ ] No dead code remaining in the module
- [ ] Exports cleaned up appropriately
- [ ] Documentation updated
- [ ] No compilation errors
- [ ] All tests pass
- [ ] Module size reduced significantly